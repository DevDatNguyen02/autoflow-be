import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database.constants';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../database/schema';
import { eq } from 'drizzle-orm';
import { TrackingJobData } from './types';
import {
  WorkflowGraph,
  WorkflowNode,
  AutomationJobData,
} from '../automation/types';

@Processor('tracking-queue')
export class TrackingProcessor extends WorkerHost {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    @InjectQueue('automation-engine')
    private readonly automationQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<TrackingJobData>): Promise<{ success: boolean }> {
    const {
      eventName,
      anonymousId,
      profileId,
      properties,
      url,
      source,
      campaign,
    } = job.data;

    try {
      // 1. Identify Flow: If it's an 'identify' event, we try to create/link a profile
      if (eventName === 'identify' && (job.data.email || job.data.userId)) {
        const email = job.data.email;
        const userId = job.data.userId;

        // Try to find if profile exists or create one
        let profile: typeof schema.profiles.$inferSelect | undefined;

        // Simple logic: Find by email or create
        if (email) {
          const existing = await this.db.query.profiles.findFirst({
            where: eq(schema.profiles.email, email),
          });

          if (existing) {
            profile = existing;
          } else {
            const [newProfile] = await this.db
              .insert(schema.profiles)
              .values({
                email: email,
                name: job.data.name,
                userId: userId,
                properties: properties,
              })
              .returning();
            profile = newProfile;
          }
        }

        // Link existing anonymous events to this profile if found
        if (profile && anonymousId) {
          await this.db
            .update(schema.events)
            .set({ profileId: profile.id })
            .where(eq(schema.events.anonymousId, anonymousId));
        }
      }

      // 2. Insert the Event itself
      await this.db.insert(schema.events).values({
        eventName,
        anonymousId,
        profileId, // Might be null if not identified yet
        properties,
        url,
        source,
        campaign,
        timestamp: new Date(job.data.timestamp || Date.now()),
      });

      // 3. Automation Triggering
      // Tìm các workflow active
      const allWorkflows = await this.db
        .select()
        .from(schema.workflows)
        .where(eq(schema.workflows.status, 'active'));

      for (const wf of allWorkflows) {
        const graph = wf.graph as WorkflowGraph;
        // Tìm node Trigger mà label trùng với eventName hoặc là Page View
        const triggerNode = graph.nodes.find(
          (n: WorkflowNode) =>
            n.type === 'trigger' &&
            (n.data?.label === eventName ||
              (eventName === 'page_view' &&
                n.data?.label === 'Page View Event')),
        );

        if (triggerNode) {
          const jobData: AutomationJobData = {
            workflowId: wf.id,
            nodeId: triggerNode.id,
            profileId: profileId || '', // ProfileId could be undefined if not identified
            context: { eventName, properties },
          };

          await this.automationQueue.add('trigger-workflow', jobData);
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error processing tracking event:', error);
      throw error; // Re-throw to allow BullMQ to retry
    }
  }
}

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database.module';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../database/schema';
import { eq } from 'drizzle-orm';

@Processor('tracking-queue')
export class TrackingProcessor extends WorkerHost {
  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { eventName, anonymousId, profileId, properties, url, source, campaign } = job.data;

    try {
      // 1. Identify Flow: If it's an 'identify' event, we try to create/link a profile
      if (eventName === 'identify' && (job.data.email || job.data.userId)) {
        const email = job.data.email;
        const userId = job.data.userId;

        // Try to find if profile exists or create one
        // Note: In a real world, we'd do a complex upsert
        let profile;
        
        // Simple logic: Find by email or create
        if (email) {
          const existing = await this.db.query.profiles.findFirst({
            where: eq(schema.profiles.email, email)
          });
          
          if (existing) {
            profile = existing;
          } else {
            const [newProfile] = await this.db.insert(schema.profiles).values({
              email: email,
              name: job.data.name,
              userId: userId,
              properties: properties,
            }).returning();
            profile = newProfile;
          }
        }

        // Link existing anonymous events to this profile if found
        if (profile && anonymousId) {
          await this.db.update(schema.events)
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

      return { success: true };
    } catch (error) {
      console.error('Error processing tracking event:', error);
      throw error; // Re-throw to allow BullMQ to retry
    }
  }
}

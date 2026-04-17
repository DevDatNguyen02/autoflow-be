import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { WorkflowParser } from './workflow.parser';
import { DatabaseService } from '../../database/database.service';
import { workflows, profiles } from '../../database/schema';
import { eq } from 'drizzle-orm';

@Processor('automation-engine')
export class workflowConsumer extends WorkerHost {
  private readonly logger = new Logger(workflowConsumer.name);

  constructor(
    private readonly parser: WorkflowParser,
    private readonly db: DatabaseService,
  ) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    const { workflowId, nodeId, profileId, context } = job.data;
    this.logger.log(`Processing workflow ${workflowId} at node ${nodeId} for profile ${profileId}`);

    // 1. Fetch Workflow
    const [workflow] = await this.db.conn
      .select()
      .from(workflows)
      .where(eq(workflows.id, workflowId));

    if (!workflow) return;

    // 2. Resolve Current Node Logic
    const graph = workflow.graph as any;
    const currentNode = graph.nodes.find((n: any) => n.id === nodeId);
    if (!currentNode) return;

    let result = true; // Default result for branching

    // MOCK EXECUTION LOGIC
    if (currentNode.type === 'action') {
      this.logger.log(`Executing ACTION: ${currentNode.data.label}`);
      // Ví dụ: Gắn tag hoặc cập nhật thuộc tính
      if (currentNode.data.label?.includes('Tag')) {
          // Logic update profile properties here
          this.logger.log(`[Action] Tagging user ${profileId}`);
      }
    }

    if (currentNode.type === 'condition') {
      this.logger.log(`Checking CONDITION: ${currentNode.data.label}`);
      // Mock condition logic: always true for now or check context
      result = true; 
    }

    // 3. Find Next Steps
    const nextSteps = await this.parser.getNextSteps(graph, nodeId, result);

    // 4. Enqueue Next Steps
    for (const step of nextSteps) {
      await job.queue.add('execute-step', {
        workflowId,
        nodeId: step.targetNodeId,
        profileId,
        context: { ...context, lastStepResult: result },
      }, {
        // Handle DELAY nodes if any
        // delay: currentNode.type === 'delay' ? 5000 : 0
      });
    }

    return { status: 'completed', nodeId };
  }
}

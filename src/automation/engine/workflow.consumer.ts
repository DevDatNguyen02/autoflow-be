import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { WorkflowParser } from './workflow.parser';
import { DatabaseService } from '../../database/database.service';
import { workflows } from '../../database/schema';
import { eq } from 'drizzle-orm';
import { WorkflowGraph, WorkflowNode, AutomationJobData } from '../types';

@Processor('automation-engine')
export class workflowConsumer extends WorkerHost {
  private readonly logger = new Logger(workflowConsumer.name);

  constructor(
    private readonly parser: WorkflowParser,
    private readonly db: DatabaseService,
    @InjectQueue('automation-engine')
    private readonly automationQueue: Queue,
  ) {
    super();
  }

  async process(
    job: Job<AutomationJobData>,
  ): Promise<{ status: string; nodeId: string } | undefined> {
    const { workflowId, nodeId, profileId, context } = job.data;
    this.logger.log(
      `Processing workflow ${workflowId} at node ${nodeId} for profile ${profileId}`,
    );

    // 1. Fetch Workflow
    const [workflow] = await this.db.conn
      .select()
      .from(workflows)
      .where(eq(workflows.id, workflowId));

    if (!workflow) return;

    // 2. Resolve Current Node Logic
    const graph = workflow.graph as WorkflowGraph;
    const currentNode = graph.nodes.find((n: WorkflowNode) => n.id === nodeId);
    if (!currentNode) return;

    let result = true; // Default result for branching

    // MOCK EXECUTION LOGIC
    if (currentNode.type === 'action') {
      const label = currentNode.data?.label;
      this.logger.log(`Executing ACTION: ${String(label)}`);
      // Ví dụ: Gắn tag hoặc cập nhật thuộc tính
      if (typeof label === 'string' && label.includes('Tag')) {
        // Logic update profile properties here
        this.logger.log(`[Action] Tagging user ${profileId}`);
      }
    }

    if (currentNode.type === 'condition') {
      const label = currentNode.data?.label;
      this.logger.log(`Checking CONDITION: ${String(label)}`);
      // Mock condition logic: always true for now or check context
      result = true;
    }

    // 3. Find Next Steps
    const nextSteps = this.parser.getNextSteps(graph, nodeId, result);

    // 4. Enqueue Next Steps
    for (const step of nextSteps) {
      const stepData: AutomationJobData = {
        workflowId,
        nodeId: step.targetNodeId,
        profileId,
        context: { ...context, lastStepResult: result },
      };

      await this.automationQueue.add('execute-step', stepData, {
        // Handle DELAY nodes if any
        // delay: currentNode.type === 'delay' ? 5000 : 0
      });
    }

    return { status: 'completed', nodeId };
  }
}

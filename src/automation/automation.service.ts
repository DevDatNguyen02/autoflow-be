import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { workflows } from '../database/schema';
import { WorkflowParser } from './engine/workflow.parser';
import { eq } from 'drizzle-orm';
import { WorkflowGraph, StepRef } from './types';

@Injectable()
export class AutomationService {
  constructor(
    private readonly db: DatabaseService,
    private readonly parser: WorkflowParser,
  ) {}

  async createWorkflow(data: { name: string; graph: WorkflowGraph }) {
    const [newWorkflow] = await this.db.conn
      .insert(workflows)
      .values({
        name: data.name,
        graph: data.graph,
        status: 'draft',
      })
      .returning();
    return newWorkflow;
  }

  async getAllWorkflows() {
    return this.db.conn.select().from(workflows);
  }

  async getWorkflowById(id: string) {
    const [workflow] = await this.db.conn
      .select()
      .from(workflows)
      .where(eq(workflows.id, id));
    return workflow;
  }

  async updateWorkflowStatus(id: string, status: 'draft' | 'active') {
    const [updated] = await this.db.conn
      .update(workflows)
      .set({ status, updatedAt: new Date() })
      .where(eq(workflows.id, id))
      .returning();
    return updated;
  }

  /**
   * Mô phỏng chạy workflow mà không tạo job thực tế (Dry Run)
   */
  async dryRunWorkflow(id: string, mockPayload: Record<string, any>) {
    const workflow = await this.getWorkflowById(id);
    if (!workflow) throw new NotFoundException('Workflow not found');

    const graph = workflow.graph as WorkflowGraph;
    const trace: string[] = [];

    // Tìm trigger node
    const triggerNode = graph.nodes.find((n) => n.type === 'trigger');
    if (!triggerNode) return { trace: [], message: 'No trigger node found' };

    let currentNodes: StepRef[] = [{ targetNodeId: triggerNode.id }];

    // Duyệt qua kịch bản (giới hạn bước để tránh loop vô tận trong test)
    let steps = 0;
    while (currentNodes.length > 0 && steps < 50) {
      const nextBatch: StepRef[] = [];
      for (const nodeRef of currentNodes) {
        trace.push(nodeRef.targetNodeId);
        const currentNode = graph.nodes.find(
          (n) => n.id === nodeRef.targetNodeId,
        );

        if (!currentNode) continue;

        // Giả lập logic cho Condition
        let result: boolean | undefined = undefined;
        if (currentNode.type === 'condition') {
          // Thực hiện đánh giá logic đơn giản từ mockPayload
          const nodeData = currentNode.data || {};
          const field = nodeData.field;
          const operator = nodeData.operator;
          const value = nodeData.value;

          if (field) {
            const actualValue = (mockPayload as Record<string, unknown>)[field];

            if (operator === 'equals') result = actualValue === value;
            else if (operator === 'contains')
              result = String(actualValue).includes(String(value));
            else result = !!actualValue;
          }
        }

        const nextSteps = this.parser.getNextSteps(
          graph,
          nodeRef.targetNodeId,
          result,
        );
        nextBatch.push(...nextSteps);
      }
      currentNodes = nextBatch;
      steps++;
    }

    return {
      trace,
      executedAt: new Date(),
      mockPayload,
    };
  }
}

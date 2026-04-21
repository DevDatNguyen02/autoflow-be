import { Injectable } from '@nestjs/common';
import { WorkflowGraph, StepRef } from '../types';

@Injectable()
export class WorkflowParser {
  /**
   * Tìm các node tiếp theo sau một node nhất định dựa trên graph schema.
   */
  getNextSteps(
    graph: WorkflowGraph,
    currentNodeId: string,
    result?: boolean,
  ): StepRef[] {
    // 1. Tìm loại của node hiện tại
    const currentNode = graph.nodes.find((n) => n.id === currentNodeId);
    if (!currentNode) return [];

    // 2. Lấy danh sách các edges đi ra từ node này
    let outgoingEdges = graph.edges.filter((e) => e.source === currentNodeId);

    // 3. Xử lý logic rẽ nhánh (Condition)
    if (currentNode.type === 'condition' && result !== undefined) {
      // Giả thiết Condition node có 2 output handles: 'yes' và 'no'
      const handle = result ? 'yes' : 'no';
      outgoingEdges = outgoingEdges.filter((e) => e.sourceHandle === handle);
    }

    // 4. Trả về thông tin các node đích
    return outgoingEdges.map((e) => ({
      targetNodeId: e.target,
      handle: e.sourceHandle,
    }));
  }
}

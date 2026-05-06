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
      // Chấp nhận cả định dạng yes/no hoặc true/false
      const handles = result ? ['yes', 'true'] : ['no', 'false'];
      outgoingEdges = outgoingEdges.filter((e) => 
          e.sourceHandle &&
          handles.includes(String(e.sourceHandle).toLowerCase()),
      );
    }

    // 4. Trả về thông tin các node đích
    return outgoingEdges.map((e) => ({
      targetNodeId: e.target,
      handle: e.sourceHandle,
    }));
  }
}

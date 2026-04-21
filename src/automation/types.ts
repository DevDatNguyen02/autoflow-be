export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'action' | 'condition';
  data?: {
    label?: string;
    field?: string;
    operator?: string;
    value?: unknown;
    [key: string]: unknown;
  };
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  animated?: boolean;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface StepRef {
  targetNodeId: string;
  handle?: string | null;
}

export interface AutomationJobData {
  workflowId: string;
  nodeId: string;
  profileId: string;
  context?: Record<string, unknown>;
}

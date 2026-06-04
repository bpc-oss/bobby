import type { KernelEvent } from '@bobby/shared';

export interface VM {
  lines: string[];
  status: 'running' | 'done' | 'failed' | 'blocked';
  pendingGate?: {
    gateId: string;
    reason: string;
  };
}

export const initialVM = (): VM => ({ lines: [], status: 'running' });

export function reduceEvent(vm: VM, e: KernelEvent): VM {
  const pushLine = (line: string): VM => ({ ...vm, lines: [...vm.lines, line] });

  switch (e.type) {
    case 'intent_proposed': return pushLine(`意图: ${e.contract.goal}`);
    case 'plan_ready': return pushLine(`计划: ${e.steps.length} 步`);
    case 'step_started': return pushLine(`步骤: ${e.stepId}`);
    case 'tool_called': return pushLine(`工具: ${e.tool}`);
    case 'verdict': return pushLine(`评估: ${e.verdict.acId}/${e.verdict.result}`);
    case 'evidence_produced': return pushLine(`证据: ${e.evidence.acId}/${e.evidence.evidenceType}`);
    case 'gate_request': {
      const pendingGate = { gateId: e.gateId, reason: e.reason };
      return { ...vm, pendingGate };
    }
    case 'final_result':
      return { ...vm, status: e.status, lines: [...vm.lines, `状态: ${e.status}`] };
    case 'error': return pushLine(`错误: ${e.message}`);
    default:
      return vm;
  }
}

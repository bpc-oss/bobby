export type Tier = 'L0' | 'L1' | 'L2' | 'L3' | 'L4';

export type Action =
  | {
      kind: 'read';
      insideWorkspace: boolean;
    }
  | {
      kind: 'write';
      insideWorkspace: boolean;
    }
  | { kind: 'exec' }
  | { kind: 'delete' }
  | { kind: 'install' }
  | { kind: 'network' }
  | { kind: 'global' };

export function classifyAction(action: Action): Tier {
  switch (action.kind) {
    case 'read':
      return action.insideWorkspace ? 'L0' : 'L4';
    case 'write':
      return action.insideWorkspace ? 'L1' : 'L3';
    case 'exec':
      return 'L2';
    case 'delete':
    case 'install':
      return 'L3';
    case 'network':
    case 'global':
      return 'L4';
  }
  const _exhaustive: never = action;
  throw new Error(`Unsupported action kind: ${(_exhaustive as { kind: string }).kind}`);
}

export function requiresGate(tier: Tier): boolean {
  return tier === 'L3' || tier === 'L4';
}

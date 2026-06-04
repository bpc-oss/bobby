export interface SandboxConfig {
  enabled: boolean;
}

export interface SandboxPlan {
  mode: 'lightweight' | 'strong';
}

export function resolveSandbox(
  cfg: SandboxConfig,
  hasContainerRuntime: () => boolean
): SandboxPlan {
  if (!cfg.enabled) {
    return { mode: 'lightweight' };
  }

  if (!hasContainerRuntime()) {
    throw new Error('strong sandbox enabled but no container runtime found; install one or disable');
  }

  return { mode: 'strong' };
}

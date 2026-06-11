import React from 'react';
import { Check, ClipboardCopy, ExternalLink, RefreshCw, Sparkles } from 'lucide-react';
import type { OnboardingStatus } from '../ipc/contract';

type WizardProps = {
  status: OnboardingStatus | null;
  loading?: boolean;
  onRefresh: () => void;
  onStart: () => void;
  onOpenQuickstart: () => void;
};

type SetupStep = {
  key: 'key' | 'capabilities';
  title: string;
  description: string;
  command: string;
  ready: boolean;
};

async function copyText(text: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    return;
  }

  await navigator.clipboard.writeText(text);
}

export function Wizard({ status, loading = false, onRefresh, onStart, onOpenQuickstart }: WizardProps): JSX.Element {
  const ready = Boolean(status?.hasKey && status?.hasCapabilities);
  const steps: SetupStep[] = [
    {
      key: 'key',
      title: 'Store your DeepSeek key',
      description: status?.hasEnvKey
        ? 'An environment key is available. Import it into ~/.bobby/key so GUI and CLI share the same local state.'
        : 'Create ~/.bobby/key so Bobby can start a real session.',
      command: status?.hasEnvKey ? 'bobby login --from-env' : 'bobby login',
      ready: Boolean(status?.hasKey)
    },
    {
      key: 'capabilities',
      title: 'Refresh capability probes',
      description: 'Probe writes ~/.bobby/capabilities.json, which the desktop app uses before starting tasks.',
      command: 'bobby probe',
      ready: Boolean(status?.hasCapabilities)
    }
  ];

  return (
    <section className="flex h-full min-h-0 flex-col bg-bobby-main text-bobby-ink">
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-8">
        <div className="w-full max-w-[760px]">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl text-white shadow-chip" style={{ background: 'var(--bobby-accent)' }}>
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[28px] font-semibold leading-tight">Welcome to Bobby</div>
              <div className="text-[13px] text-bobby-faint">Get the local key and capability cache in place before the workspace opens.</div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {steps.map((step) => (
              <article
                key={step.key}
                className="rounded-xl border p-4"
                style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[14px] font-semibold text-bobby-ink">{step.title}</div>
                    <div className="mt-1 text-[12px] leading-5 text-bobby-muted">{step.description}</div>
                  </div>
                  <span
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: step.ready ? 'var(--bobby-success-soft)' : 'var(--bobby-surface-subtle)',
                      color: step.ready ? 'var(--bobby-success)' : 'var(--bobby-text-muted)'
                    }}
                    aria-label={step.ready ? 'Ready' : 'Missing'}
                  >
                    {step.ready ? <Check className="h-4 w-4" /> : <span className="text-[15px] leading-none">1</span>}
                  </span>
                </div>

                <div
                  className="mt-4 rounded-lg border px-3 py-2 font-mono text-[12px]"
                  style={{ background: 'var(--bobby-surface-subtle)', borderColor: 'var(--bobby-border-muted)' }}
                >
                  {step.command}
                </div>

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void copyText(step.command)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] text-bobby-muted transition hover:bg-bobby-sidebar-row-hover hover:text-bobby-ink"
                  >
                    <ClipboardCopy className="h-3.5 w-3.5" />
                    Copy command
                  </button>
                  {step.key === 'key' && (
                    <button
                      type="button"
                      onClick={onOpenQuickstart}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] text-bobby-muted transition hover:bg-bobby-sidebar-row-hover hover:text-bobby-ink"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Quickstart
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className="mt-4 rounded-xl border px-4 py-3" style={{ background: 'var(--bobby-surface-card)', borderColor: 'var(--bobby-border)' }}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[13px] font-medium text-bobby-ink">
                  {ready ? 'Setup is ready. Enter the workspace.' : loading ? 'Checking setup state...' : 'Finish setup to unlock the workspace.'}
                </div>
                <div className="mt-1 text-[12px] text-bobby-muted">
                  {status
                    ? `${status.keyPath} and ${status.capabilitiesPath}`
                    : 'Bobby checks ~/.bobby/key and ~/.bobby/capabilities.json at startup.'}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={onRefresh}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] text-bobby-muted transition hover:bg-bobby-sidebar-row-hover hover:text-bobby-ink"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Refresh
                </button>
                <button
                  type="button"
                  onClick={onStart}
                  disabled={!ready}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-4 text-[13px] font-medium text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ background: 'var(--bobby-accent)' }}
                >
                  Enter workspace
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


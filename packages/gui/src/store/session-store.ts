import type { KernelEvent, PlanStep } from '@bobby/shared';
import { create } from 'zustand';

import { addUsage, emptyUsage } from '../kernel/client';
import type { GuiEvent, SessionMeta, SessionStatus, Usage } from '../kernel/client';

export type TimelineItem =
  | { kind: 'user'; text: string }
  | { kind: 'kernel'; event: KernelEvent };

interface SessionState {
  sessions: Record<string, SessionMeta>;
  timelines: Record<string, TimelineItem[]>;
  usages: Record<string, Usage>;
  plans: Record<string, PlanStep[]>;
  currentStepIds: Record<string, string>;
  pendingGates: Record<string, { gateId: string; reason: string } | undefined>;
  statuses: Record<string, SessionStatus>;
  activeSessionId?: string;
  setSessions: (list: SessionMeta[]) => void;
  setActiveSession: (id: string) => void;
  addUserMessage: (sessionId: string, text: string) => void;
  applyGuiEvent: (event: GuiEvent) => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  sessions: {},
  timelines: {},
  usages: {},
  plans: {},
  currentStepIds: {},
  pendingGates: {},
  statuses: {},
  activeSessionId: undefined,

  setSessions: (list) =>
    set((state) => ({
      sessions: {
        ...state.sessions,
        ...Object.fromEntries(list.map((meta) => [meta.id, meta]))
      },
      statuses: {
        ...state.statuses,
        ...Object.fromEntries(list.map((meta) => [meta.id, meta.status]))
      }
    })),

  setActiveSession: (id) => set({ activeSessionId: id }),

  addUserMessage: (sessionId, text) =>
    set((state) => ({
      timelines: {
        ...state.timelines,
        [sessionId]: [...(state.timelines[sessionId] ?? []), { kind: 'user', text }]
      },
      statuses: { ...state.statuses, [sessionId]: 'running' }
    })),

  applyGuiEvent: (event) =>
    set((state) => {
      if (event.kind === 'session_meta') {
        return {
          sessions: { ...state.sessions, [event.session.id]: event.session },
          statuses: { ...state.statuses, [event.session.id]: event.session.status }
        };
      }

      if (event.kind === 'usage') {
        const prev = state.usages[event.sessionId] ?? emptyUsage();
        return {
          usages: {
            ...state.usages,
            [event.sessionId]: addUsage(prev, event.usage)
          }
        };
      }

      const { sessionId } = event;
      const kernelEvent = event.event;
      const next: Partial<SessionState> = {
        timelines: {
          ...state.timelines,
          [sessionId]: [...(state.timelines[sessionId] ?? []), { kind: 'kernel', event: kernelEvent }]
        }
      };

      if (kernelEvent.type === 'plan_ready') {
        next.plans = { ...state.plans, [sessionId]: kernelEvent.steps };
      }

      if (kernelEvent.type === 'step_started') {
        next.currentStepIds = { ...state.currentStepIds, [sessionId]: kernelEvent.stepId };
      }

      if (kernelEvent.type === 'gate_request') {
        next.pendingGates = {
          ...state.pendingGates,
          [sessionId]: { gateId: kernelEvent.gateId, reason: kernelEvent.reason }
        };
        next.statuses = { ...state.statuses, [sessionId]: 'gate' };
      }

      if (kernelEvent.type === 'final_result') {
        next.pendingGates = { ...state.pendingGates, [sessionId]: undefined };
        next.statuses = {
          ...state.statuses,
          [sessionId]: kernelEvent.status === 'done' ? 'done' : 'failed'
        };
      }

      return next;
    })
}));

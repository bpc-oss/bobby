import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ScheduleTasks } from '../src/screens/ScheduleTasks';
import type { AutomationRecord } from '../src/ipc/contract';

function addMinutes(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

function makeAutomation(overrides: Partial<AutomationRecord> = {}): AutomationRecord {
  const createdAt = overrides.createdAt ?? new Date('2026-06-11T08:00:00.000Z').toISOString();
  return {
    id: overrides.id ?? `automation-${Math.random().toString(16).slice(2, 8)}`,
    title: overrides.title ?? 'Daily check-in',
    kind: overrides.kind ?? 'schedule',
    prompt: overrides.prompt ?? 'Summarize the current Bobby session.',
    intervalMinutes: overrides.intervalMinutes ?? 30,
    enabled: overrides.enabled ?? true,
    createdAt,
    updatedAt: overrides.updatedAt ?? createdAt,
    lastRunAt: overrides.lastRunAt ?? null,
    nextRunAt: overrides.nextRunAt ?? addMinutes(createdAt, overrides.intervalMinutes ?? 30)
  };
}

describe('ScheduleTasks', () => {
  const items: AutomationRecord[] = [makeAutomation()];

  beforeEach(() => {
    items.splice(0, items.length, makeAutomation());
    (window as Window & { bobby?: unknown }).bobby = {
      send: vi.fn(),
      onEvent: vi.fn(),
      getSetupStatus: vi.fn(),
      openQuickstart: vi.fn(),
      listAutomations: vi.fn(async () => items.map((item) => ({ ...item }))),
      createAutomation: vi.fn(async (input) => {
        const created = makeAutomation({
          title: input.title,
          kind: input.kind,
          prompt: input.prompt,
          intervalMinutes: input.intervalMinutes
        });
        items.unshift(created);
        return { ...created };
      }),
      updateAutomation: vi.fn(async (input) => {
        const index = items.findIndex((item) => item.id === input.id);
        if (index < 0) throw new Error('Automation not found');
        items[index] = {
          ...items[index],
          ...input,
          updatedAt: new Date('2026-06-11T09:00:00.000Z').toISOString()
        };
        return { ...items[index] };
      }),
      toggleAutomation: vi.fn(async (input) => {
        const index = items.findIndex((item) => item.id === input.id);
        if (index < 0) throw new Error('Automation not found');
        items[index] = {
          ...items[index],
          enabled: !items[index].enabled,
          updatedAt: new Date('2026-06-11T09:00:00.000Z').toISOString()
        };
        return { ...items[index] };
      }),
      removeAutomation: vi.fn(async (input) => {
        const before = items.length;
        for (let index = items.length - 1; index >= 0; index -= 1) {
          if (items[index].id === input.id) {
            items.splice(index, 1);
          }
        }
        return items.length !== before;
      }),
      runAutomationNow: vi.fn(async (input) => {
        const index = items.findIndex((item) => item.id === input.id);
        if (index < 0) return null;
        items[index] = {
          ...items[index],
          lastRunAt: new Date('2026-06-11T10:00:00.000Z').toISOString(),
          nextRunAt: new Date('2026-06-11T10:30:00.000Z').toISOString(),
          updatedAt: new Date('2026-06-11T10:00:00.000Z').toISOString()
        };
        return { ...items[index] };
      })
    };
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    (window as { bobby?: unknown }).bobby = undefined;
  });

  it('lists, creates, runs, toggles, and removes automations through the local bridge', async () => {
    render(<ScheduleTasks />);

    expect(await screen.findByText('Daily check-in')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Daily code review'), { target: { value: 'Weekly digest' } });
    fireEvent.change(screen.getByPlaceholderText('What should Bobby do when this automation fires?'), {
      target: { value: 'Summarize the latest session and flag blockers.' }
    });
    fireEvent.change(screen.getByDisplayValue('60'), { target: { value: '45' } });
    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(screen.getByText('Weekly digest')).toBeTruthy();
    });

    expect(window.bobby.createAutomation).toHaveBeenCalledWith({
      title: 'Weekly digest',
      kind: 'schedule',
      prompt: 'Summarize the latest session and flag blockers.',
      intervalMinutes: 45
    });

    fireEvent.click(screen.getAllByTitle('Run now')[0]);
    await waitFor(() => {
      expect(window.bobby.runAutomationNow).toHaveBeenCalled();
    });

    fireEvent.click(screen.getAllByTitle('Disable')[0]);
    await waitFor(() => {
      expect(window.bobby.toggleAutomation).toHaveBeenCalled();
    });

    fireEvent.click(screen.getAllByTitle('Remove')[0]);
    await waitFor(() => {
      expect(window.bobby.removeAutomation).toHaveBeenCalled();
    });
  });

  it('shows automation action failures as an error card', async () => {
    window.bobby.runAutomationNow = vi.fn().mockRejectedValueOnce(new Error('runner unavailable'));

    render(<ScheduleTasks />);

    expect(await screen.findByText('Daily check-in')).toBeTruthy();
    fireEvent.click(screen.getAllByTitle('Run now')[0]);

    expect(await screen.findByText('runner unavailable')).toBeTruthy();
  });
});

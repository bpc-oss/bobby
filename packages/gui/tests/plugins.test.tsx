import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { PluginMarketplace } from '../src/screens/PluginMarketplace';
import type { McpServerRecordDto } from '../src/ipc/contract';

function makeServer(overrides: Partial<McpServerRecordDto> = {}): McpServerRecordDto {
  const createdAt = overrides.createdAt ?? '2026-06-11T00:00:00.000Z';
  return {
    id: overrides.id ?? 'filesystem-demo',
    name: overrides.name ?? 'Filesystem Demo',
    enabled: overrides.enabled ?? true,
    transport:
      overrides.transport ?? {
        kind: 'stdio',
        command: 'node',
        args: ['--input-type=module', '-e', '<demo>'],
        cwd: 'E:\\ai-files\\Bobby'
      },
    tools:
      overrides.tools ?? [
        { name: 'read_file', permissionTier: 'L2', description: 'Read a text file', evidenceType: 'command_output' },
        { name: 'write_file', permissionTier: 'L1', description: 'Write a text file', evidenceType: 'file_diff' }
      ],
    health: overrides.health ?? 'healthy',
    lastCheckedAt: overrides.lastCheckedAt ?? createdAt,
    lastError: overrides.lastError ?? null,
    createdAt,
    updatedAt: overrides.updatedAt ?? createdAt
  };
}

beforeEach(() => {
  (window as any).bobby = {
    send: vi.fn(),
    onEvent: vi.fn(),
    getSetupStatus: vi.fn(),
    openQuickstart: vi.fn(),
    listMcpServers: vi.fn().mockResolvedValue([makeServer()]),
    upsertMcpServer: vi.fn(async (input) => makeServer({
      id: 'server-2',
      name: input.name,
      enabled: input.enabled ?? true,
      transport: input.transport,
      tools: input.tools
    })),
    toggleMcpServer: vi.fn(async (input) => makeServer({ id: input.id, enabled: false, health: 'disabled' })),
    removeMcpServer: vi.fn(async () => true)
  };
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  (window as any).bobby = undefined;
});

describe('PluginMarketplace', () => {
  it('loads servers and supports add toggle remove', async () => {
    render(<PluginMarketplace />);

    expect(await screen.findByText('Filesystem Demo')).toBeTruthy();
    expect(await screen.findByText('read_file · L2')).toBeTruthy();

    fireEvent.change(screen.getByDisplayValue('Filesystem Demo'), { target: { value: 'HTTP Files' } });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'url' } });
    fireEvent.change(screen.getByDisplayValue('http://localhost:3000/mcp'), { target: { value: 'http://localhost:3010/mcp' } });

    fireEvent.click(screen.getByText('Add server'));
    await waitFor(() => {
      expect((window as any).bobby.upsertMcpServer).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('Disable'));
    await waitFor(() => {
      expect((window as any).bobby.toggleMcpServer).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByText('Remove'));
    await waitFor(() => {
      expect((window as any).bobby.removeMcpServer).toHaveBeenCalled();
    });
  });

  it('renders MCP health and tool permissions from backend records', async () => {
    (window as any).bobby.listMcpServers = vi.fn().mockResolvedValue([
      makeServer({ health: 'disabled', enabled: false, lastError: null }),
      makeServer({
        id: 'remote',
        name: 'Remote MCP',
        transport: { kind: 'url', url: 'http://localhost:3010/mcp' },
        tools: [
          { name: 'read_remote', permissionTier: 'L2', description: 'Read remote file', evidenceType: 'command_output' }
        ],
        health: 'healthy'
      })
    ]);

    render(<PluginMarketplace />);

    expect(await screen.findByText('Disabled')).toBeTruthy();
    expect(await screen.findByText('Healthy')).toBeTruthy();
    expect(screen.getByText(/read_remote/)).toBeTruthy();
    expect(screen.getAllByText(/L2/).some((element) => element.textContent?.includes('read_remote'))).toBe(true);
  });
});

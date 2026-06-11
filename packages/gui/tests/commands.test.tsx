import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Commands } from '../src/screens/Commands';

beforeEach(() => {
  (window as any).bobby = {
    send: vi.fn(),
    onEvent: vi.fn(),
    listCommands: vi.fn().mockResolvedValue([
      {
        sourcePath: 'E:\\ai-files\\Bobby\\.bobby\\commands\\summarize.md',
        name: 'summarize',
        description: 'Summarize the current task',
        promptTemplate: 'Summarize this task:\n{{input}}'
      }
    ]),
    upsertCommand: vi.fn().mockResolvedValue({
      sourcePath: 'E:\\ai-files\\Bobby\\.bobby\\commands\\summarize.md',
      name: 'summarize',
      description: 'Summarize the current task',
      promptTemplate: 'Summarize this task:\n{{input}}'
    }),
    removeCommand: vi.fn().mockResolvedValue(true)
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Commands screen', () => {
  it('renders the command editor and list', async () => {
    render(<Commands />);

    expect(await screen.findByText('Summarize the current task')).toBeTruthy();
    expect(screen.getByText('Slash menu')).toBeTruthy();
    expect(screen.getByText('Current preview')).toBeTruthy();
  });

  it('saves a new command file through IPC', async () => {
    render(<Commands />);

    fireEvent.click(screen.getByTitle('New command'));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'rewrite' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Rewrite text' } });
    fireEvent.change(screen.getByLabelText('Template'), { target: { value: 'Rewrite:\n{{input}}' } });
    fireEvent.click(screen.getByText('Save'));

    await vi.waitFor(() => {
      expect((window as any).bobby.upsertCommand).toHaveBeenCalledWith({
        sourcePath: undefined,
        name: 'rewrite',
        description: 'Rewrite text',
        promptTemplate: 'Rewrite:\n{{input}}'
      });
    });
  });
});

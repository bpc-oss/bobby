import { spawnSync } from 'node:child_process';

export interface Runner {
  lang: 'node' | 'python' | 'bash';
  cmd: string;
  available: boolean;
}

async function probeCommand(command: string): Promise<boolean> {
  try {
    const result = spawnSync(command, ['--version'], {
      timeout: 3_000,
      stdio: 'ignore',
      shell: false
    });

    return result.status === 0;
  } catch {
    return false;
  }
}

export async function detectRunners(): Promise<Runner[]> {
  const pythonAvailable = await probeCommand('python');
  const bashAvailable = await probeCommand('bash');

  return [
    {
      lang: 'node',
      cmd: process.execPath,
      available: true
    },
    {
      lang: 'python',
      cmd: 'python',
      available: pythonAvailable
    },
    {
      lang: 'bash',
      cmd: 'bash',
      available: bashAvailable
    }
  ];
}

import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

import { ToolRegistry } from '../src/hands/tool';
import { ExecTool } from '../src/hands/tools/exec';
import { FileExistsTool, WriteFileTool } from '../src/hands/tools/fs';
import { Workspace } from '../src/hands/workspace';
import { toToolSchemas } from '../src/model/deepseek/tool-schema';

it('exports registered tools as OpenAI-compatible function schemas in registration order', async () => {
  const root = await mkdtemp(join(tmpdir(), 'bobby-tool-schema-'));
  const workspace = new Workspace(root);
  const registry = new ToolRegistry();

  registry.register(new ExecTool(workspace));
  registry.register(new WriteFileTool(workspace));
  registry.register(new FileExistsTool(workspace));

  expect(toToolSchemas(registry)).toEqual([
    {
      type: 'function',
      function: {
        name: 'exec',
        description: 'Run a command inside the workspace and capture command-output evidence.',
        parameters: {
          type: 'object',
          properties: {
            cmd: {
              type: 'string',
              description: 'Executable or shell command name to run.'
            },
            args: {
              type: 'array',
              description: 'Optional command arguments passed positionally.',
              items: {
                type: 'string'
              }
            },
            timeoutMs: {
              type: 'number',
              description: 'Optional timeout in milliseconds before the process is terminated.'
            }
          },
          required: ['cmd'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'write_file',
        description: 'Write UTF-8 text to a workspace-relative path and emit file-diff evidence.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Workspace-relative file path to write.'
            },
            content: {
              type: 'string',
              description: 'Text content to write into the file.'
            }
          },
          required: ['path'],
          additionalProperties: false
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'file_exists',
        description: 'Check whether a workspace-relative path exists and emit file-exists evidence.',
        parameters: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Workspace-relative path to inspect.'
            }
          },
          required: ['path'],
          additionalProperties: false
        }
      }
    }
  ]);
});

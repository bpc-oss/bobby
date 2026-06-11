import type { PlanStep } from '@bobby/shared';
import { z } from 'zod';
import type { ModelClient, ModelRole, ReasoningEffort } from '../model/model-client';
import { FORBIDDEN_WIN32_COMMANDS, getRunnerSystemPrompt, getRunnerSystemPromptWithTools, type RunnerToolDescriptor } from './system-prompts';
import type { PlannedCall } from '../hands/evidence-provider';

export interface Claim {
  stepId: string;
  acIds: string[];
  summary: string;
  calls: PlannedCall[];
  needsPro?: boolean;
}

const RunnerCallSchema = z.object({
  tool: z.string().min(1),
  input: z.record(z.unknown())
});

const RunnerResponseSchema = z.object({
  calls: z.array(RunnerCallSchema).min(1),
  needsPro: z.boolean().optional()
});

const isForbiddenWin32Command = (cmd: unknown): cmd is (typeof FORBIDDEN_WIN32_COMMANDS)[number] => {
  if (typeof cmd !== 'string') {
    return false;
  }

  return FORBIDDEN_WIN32_COMMANDS.includes(cmd.toLowerCase() as (typeof FORBIDDEN_WIN32_COMMANDS)[number]);
};

const getCommandToken = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const [commandToken] = trimmed.split(/\s+/);
  return commandToken?.toLowerCase();
};

const getExecInputCommand = (input: Record<string, unknown>): string | undefined => {
  const canonicalToken = getCommandToken(input.cmd);
  if (canonicalToken) {
    return canonicalToken;
  }

  return getCommandToken(input.command);
};

const assertRunnerCallsSafe = (calls: z.output<typeof RunnerResponseSchema>['calls'], platform: string): void => {
  if (platform.toLowerCase() !== 'win32') {
    return;
  }

  for (const [index, call] of calls.entries()) {
    if (call.tool !== 'exec') {
      continue;
    }

    const command = getExecInputCommand(call.input);
    if (isForbiddenWin32Command(command)) {
      throw new Error(`executeStep: invalid runner schema at calls.${index}.input.cmd: \`${command}\` is forbidden on win32`);
    }
  }
};

export interface ExecuteStepOptions {
  role?: ModelRole;
  model?: string;
  reasoningEffort?: ReasoningEffort;
  retryContext?: string;
  platform?: NodeJS.Platform | string;
  tools?: readonly RunnerToolDescriptor[];
}

export async function executeStep(model: ModelClient, step: PlanStep, options: ExecuteStepOptions = {}): Promise<Claim> {
  const role = options.role ?? 'runner';
  const platform = options.platform ?? process.platform;
  const prompt = options.retryContext
    ? `${step.desc}\n\n${options.retryContext}`
    : step.desc;
  const systemPrompt = options.tools && options.tools.length > 0
    ? getRunnerSystemPromptWithTools(platform, options.tools)
    : getRunnerSystemPrompt(platform);

  const response = await model.complete(
    role,
    [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: prompt }
  ], {
    json: true,
    model: options.model,
    reasoningEffort: options.reasoningEffort
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(response.content);
  } catch {
    throw new Error('executeStep: model response is not valid JSON');
  }

  const planResult = RunnerResponseSchema.safeParse(parsed);
  if (!planResult.success) {
    const issue = planResult.error.issues[0];
    if (!issue) {
      throw new Error('executeStep: model output violates runner call schema');
    }

    const path = issue.path.length ? issue.path.join('.') : 'root';
    throw new Error(`executeStep: invalid runner schema at ${path}: ${issue.message}`);
  }

  const plan = planResult.data;
  assertRunnerCallsSafe(plan.calls, platform);

  return {
    stepId: step.id,
    acIds: step.satisfiesAcIds,
    summary: response.content,
    calls: plan.calls,
    needsPro: plan.needsPro
  };
}

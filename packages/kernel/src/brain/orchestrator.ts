import { type AcceptanceCriterion, type Evidence, KernelEvent, type Verdict } from '@bobby/shared';
import type { PlanStep } from '@bobby/shared';
import type { TaskContract } from '@bobby/shared';
import { captureIntent } from './intent';
import { executeStep, type Claim } from './executor';
import { planTask } from './planner';
import { needsClarification } from './clarify';
import { TraceStore } from '../trace/trace-store';
import type { ModelClient } from '../model/model-client';
import type { VerificationEngine } from '../conscience/engine';
import type { ToolRegistry } from '../hands/tool';
import { buildEscalationPlan, type EscalationPlan } from '../model/deepseek/escalation';
import { allocateBudget, estimateDifficulty, scoreToTier, type DifficultyBudget } from '../model/deepseek/difficulty';
import {
  type ConstraintChecker,
  type ExecContext,
  enforceConstraints
} from '../conscience/constraints';
import type { CompletionGate } from '../conscience/gate';
import type { PlannedCall } from '../hands/evidence-provider';
import { parseTestOutput, formatTestFailureContext, type ParsedTestOutput } from '../conscience/test-feedback';

type Listener = (event: KernelEvent) => void;
let taskCounter = 0;

type PlanDecision =
  | { decision: 'approve' }
  | { decision: 'reject' }
  | { decision: 'edit'; instructions: string };
type PlanDecisionResolver = (taskId: string) => Promise<PlanDecision>;

export interface OrchestratorOptions {
  planOnly?: boolean;
}
const createTaskId = (): string => {
  taskCounter += 1;
  return `task-${Date.now()}-${taskCounter}`;
};

const extractOutputText = (entry: Evidence): string | undefined => {
  if (entry.evidenceType !== 'command_output' && entry.evidenceType !== 'test_run') {
    return undefined;
  }

  const payload = entry.payload as Record<string, unknown>;
  return typeof payload.stdout === 'string'
    ? payload.stdout
    : typeof payload.stderr === 'string'
      ? payload.stderr
      : typeof payload.output === 'string'
        ? payload.output
        : undefined;
};

const addParsedOutput = (
  merged: ParsedTestOutput,
  failuresSeen: Set<string>,
  parsed: ParsedTestOutput
): void => {
  merged.passCount = Math.max(merged.passCount, parsed.passCount);
  merged.failCount = Math.max(merged.failCount, parsed.failCount);

  for (const failure of parsed.failures) {
    const key = `${failure.file}|${failure.title}|${failure.message}`;
    if (!failuresSeen.has(key)) {
      failuresSeen.add(key);
      merged.failures.push(failure);
    }
  }

  for (const file of parsed.files) {
    if (!merged.files.includes(file)) {
      merged.files.push(file);
    }
  }

  for (const message of parsed.errorMessages) {
    if (!merged.errorMessages.includes(message)) {
      merged.errorMessages.push(message);
    }
  }
};

const buildMergedFailureContext = (evidence: Evidence[]): ParsedTestOutput => {
  const merged: ParsedTestOutput = {
    passCount: 0,
    failCount: 0,
    failures: [],
    files: [],
    errorMessages: []
  };
  const failuresSeen = new Set<string>();

  for (const entry of evidence) {
    const output = extractOutputText(entry);
    if (!output?.trim()) {
      continue;
    }
    const parsed = parseTestOutput(output);
    addParsedOutput(merged, failuresSeen, parsed);
  }

  return merged;
};

export interface ConscienceDeps {
  engine: VerificationEngine;
  gate: CompletionGate;
  evidenceFor: (
    stepId: string,
    acIds: string[],
    calls?: ReadonlyArray<PlannedCall>,
    acCriteria?: AcceptanceCriterion[]
  ) => Evidence[] | Promise<Evidence[]>;
  constraintCheckers?: ConstraintChecker[];
  context?: () => ExecContext;
  getExecContext?: () => ExecContext | Promise<ExecContext>;
  toolRegistry?: ToolRegistry;
}

export class Orchestrator {
  readonly trace = new TraceStore();
  private readonly listeners = new Set<Listener>();

  constructor(
    private readonly model: ModelClient,
    private readonly conscience?: ConscienceDeps,
    private readonly requestPlanDecision: PlanDecisionResolver = async () => ({ decision: 'approve' }),
    private readonly options: OrchestratorOptions = {}
  ) {}

  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit(taskId: string, event: KernelEvent): void {
    this.trace.append(taskId, event);
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  async startTask(input: string, taskId = createTaskId()): Promise<string> {
    const contract = await captureIntent(this.model, input);
    this.emit(taskId, { type: 'intent_proposed', taskId, contract });

    if (needsClarification(contract).should) {
      this.emitDirectAnswer(taskId);
      return taskId;
    }

    await this.runPlannedTask(taskId, contract);
    return taskId;
  }

  private emitDirectAnswer(taskId: string): void {
    this.emit(taskId, {
      type: 'direct_answer',
      taskId,
      text: '你想让我具体做什么？请给我一个明确任务或要修改的文件。'
    });
  }

  private async runPlannedTask(taskId: string, contract: TaskContract): Promise<void> {
    const budget: DifficultyBudget = allocateBudget(scoreToTier(estimateDifficulty(contract)));
    let revisionInstructions: string | undefined;
    const verdicts = new Map<string, Verdict>();

    while (true) {
      const steps = await planTask(this.model, contract, revisionInstructions);
      const decisionPromise = this.options.planOnly ? null : this.requestPlanDecision(taskId);
      this.emit(taskId, { type: 'plan_ready', taskId, steps });

      if (this.options.planOnly) {
        this.emit(taskId, { type: 'final_result', taskId, status: 'done' });
        return;
      }

      const decision = await decisionPromise!;
      if (decision.decision === 'approve') {
        await this.executeSteps(taskId, steps, contract, verdicts, budget);
        await this.emitFinalResult(taskId, contract, verdicts);
        return;
      }

      if (decision.decision === 'reject') {
        this.emit(taskId, { type: 'final_result', taskId, status: 'blocked' });
        return;
      }

      revisionInstructions = decision.instructions;
    }
  }

  private async executeSteps(
    taskId: string,
    steps: PlanStep[],
    contract: TaskContract,
    verdicts: Map<string, Verdict>,
    budget: DifficultyBudget
  ): Promise<void> {
    for (const step of steps) {
      this.emit(taskId, { type: 'step_started', taskId, stepId: step.id });
      if (!this.conscience) {
        await executeStep(this.model, step);
        continue;
      }

      await this.runVerifiedStep(
        taskId,
        step,
        contract.acceptanceCriteria,
        verdicts,
        this.conscience,
        budget
      );
    }
  }

  private async emitFinalResult(
    taskId: string,
    contract: TaskContract,
    verdicts: Map<string, Verdict>
  ): Promise<void> {
    let status: 'done' | 'failed' | 'blocked' = 'failed';
    if (this.conscience) {
      const ctx = await this.getContext(this.conscience);
      const constraintResults = enforceConstraints(
        contract.constraints,
        ctx,
        this.conscience.constraintCheckers ?? []
      );
      status = this.conscience.gate.evaluate(contract, verdicts, constraintResults).status;
    }

    this.emit(taskId, { type: 'final_result', taskId, status });
  }

  private async runVerifiedStep(
    taskId: string,
    step: PlanStep,
    criteria: AcceptanceCriterion[],
    verdicts: Map<string, Verdict>,
    conscience: ConscienceDeps,
    budget: DifficultyBudget
  ): Promise<void> {
    const result = await this.runRunnerAttempts(taskId, step, criteria, verdicts, conscience, budget);
    if (result.stepDone || result.blockedOnNeedHuman) {
      return;
    }

    const graderPlan: EscalationPlan = buildEscalationPlan('grader', result.runnerFailures);
    await this.runGraderAttempt(
      taskId,
      step,
      criteria,
      verdicts,
      conscience,
      graderPlan.role,
      graderPlan.model,
      graderPlan.reasoning_effort
    );
  }

  private async runRunnerAttempts(
    taskId: string,
    step: PlanStep,
    criteria: AcceptanceCriterion[],
    verdicts: Map<string, Verdict>,
    conscience: ConscienceDeps,
    budget: DifficultyBudget
  ): Promise<{ stepDone: boolean; runnerFailures: number; blockedOnNeedHuman: boolean }> {
    let runnerFailures = 0;
    let retryContext: string | undefined;
    const shouldStopRunnerLoop = (needsPro: boolean, failureCount: number): boolean =>
      needsPro || failureCount >= budget.maxRetries;

    while (runnerFailures < budget.maxRetries) {
      const plan = buildEscalationPlan('runner', runnerFailures, budget);
      for (let turn = 0; turn < plan.maxTurns; turn += 1) {
        const claim = await executeStep(this.model, step, {
          role: plan.role,
          model: plan.model,
          reasoningEffort: plan.reasoning_effort,
          retryContext,
          tools: conscience.toolRegistry?.list().map((tool) => ({
            name: tool.name,
            permissionTier: tool.permissionTier,
            description: tool.description
          }))
        });

        const claimResult = await this.processClaim(taskId, conscience, claim, step, criteria, verdicts);
        if (claimResult.result === 'pass') {
          return { stepDone: true, runnerFailures, blockedOnNeedHuman: false };
        }

        if (claimResult.context) {
          retryContext = claimResult.context;
        }

        if (claimResult.result === 'need_human') {
          return { stepDone: false, runnerFailures, blockedOnNeedHuman: true };
        }

        runnerFailures += 1;
        if (shouldStopRunnerLoop(claim.needsPro ?? false, runnerFailures)) {
          return { stepDone: false, runnerFailures, blockedOnNeedHuman: false };
        }
      }
    }

    return {
      stepDone: false,
      runnerFailures,
      blockedOnNeedHuman: false
    };
  }

  private async runGraderAttempt(
    taskId: string,
    step: PlanStep,
    criteria: AcceptanceCriterion[],
    verdicts: Map<string, Verdict>,
    conscience: ConscienceDeps,
    role: EscalationPlan['role'],
    model?: string,
    reasoningEffort?: 'low' | 'medium' | 'high'
  ): Promise<boolean> {
    const plan: Pick<EscalationPlan, 'role' | 'model' | 'reasoning_effort'> = {
      role,
      model,
      reasoning_effort: reasoningEffort
    };
    const claim = await executeStep(this.model, step, {
      role: plan.role,
      model: plan.model,
      reasoningEffort: plan.reasoning_effort
    });

    const result = await this.processClaim(taskId, conscience, claim, step, criteria, verdicts);
    return result.result === 'pass';
  }

  private async processClaim(
    taskId: string,
    conscience: ConscienceDeps,
    claim: Claim,
    step: PlanStep,
    criteria: AcceptanceCriterion[],
    verdicts: Map<string, Verdict>
  ): Promise<{ result: 'pass' | 'fail' | 'need_human'; context?: string }> {
    const relevantAcs = criteria.filter((ac) => step.satisfiesAcIds.includes(ac.id));
    const evidence = await conscience.evidenceFor(
      step.id,
      claim.acIds,
      claim.calls,
      relevantAcs
    );
    for (const e of evidence) {
      this.emit(taskId, { type: 'evidence_produced', taskId, evidence: e });
    }

    const verdictsResult = await Promise.all(
      relevantAcs.map(async (ac) => {
        const verdict = await conscience.engine.verify(ac, evidence);
        verdicts.set(ac.id, verdict);
        this.emit(taskId, { type: 'verdict', taskId, verdict });
        return verdict.result;
      })
    );

    if (verdictsResult.includes('fail')) {
      return { result: 'fail', context: this.buildRetryContext(evidence) };
    }

    if (verdictsResult.includes('need_human')) {
      return { result: 'need_human' };
    }

    return { result: 'pass' };
  }

  private buildRetryContext(evidence: Evidence[]): string | undefined {
    const merged = buildMergedFailureContext(evidence);
    if (merged.failCount === 0 && merged.failures.length === 0 && merged.errorMessages.length === 0) {
      return undefined;
    }

    return formatTestFailureContext(merged);
  }

  private async getContext(deps: ConscienceDeps): Promise<ExecContext> {
    if (deps.context !== undefined) {
      return deps.context();
    }

    if (deps.getExecContext !== undefined) {
      return await deps.getExecContext();
    }

    return {
      touchedPaths: [],
      networkCalls: []
    };
  }
}

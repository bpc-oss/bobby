import { expect, it } from 'vitest';

import { ProReviewOracle } from '../src/conscience/oracles/pro-review';
import type { AcceptanceCriterion, Evidence } from '@bobby/shared';
import type { ModelClient, ModelMessage, ModelResponse, ModelRole } from '../src/model/model-client';

const ac: AcceptanceCriterion = { id: 'AC1', desc: 'logical correctness', oracleHint: 'review' };

const makeEvidence = (payload: Record<string, unknown>): Evidence => ({
  claimId: 'claim-1',
  acId: 'AC1',
  evidenceType: 'file_diff',
  payload,
  producedBy: 'tool',
});

const evidenceWithSelfNarrative: Evidence[] = [
  makeEvidence({ diff: 'diff-1', summary: 'I fixed this', executorSays: 'I completed task', file: 'main.ts' }),
  {
    claimId: 'claim-2',
    acId: 'AC1',
    evidenceType: 'file_exists',
    payload: { path: 'src/main.ts', executorSays: 'already changed' },
    producedBy: 'tool',
  },
];

class RecordingModelClient implements ModelClient {
  public messages: Array<{ role: ModelRole; messages: ModelMessage[]; opts?: Parameters<ModelClient['complete']>[2] }> =
    [];

  constructor(private readonly responses: string[]) {}

  async complete(role: ModelRole, messages: ModelMessage[], opts?: Parameters<ModelClient['complete']>[2]): Promise<ModelResponse> {
    this.messages.push({ role, messages, opts });

    const content = this.responses.shift();
    if (!content) {
      throw new Error('RecordingModelClient: no queued response');
    }

    return { content };
  }
}

it('critical defect -> fail', async () => {
  const review = JSON.stringify({
    verdict: 'pass',
    defects: [{ severity: 'critical', acId: 'AC1', evidence: 'line 3 out of range', mustFix: true }],
    unverifiable: [],
  });
  const model = new RecordingModelClient([review]);
  const oracle = new ProReviewOracle(model);
  const verdict = await oracle.judge(ac, [makeEvidence({ diff: '... ' })]);

  expect(verdict.result).toBe('fail');
});

it('unverifiable non-empty -> need_human', async () => {
  const review = JSON.stringify({
    verdict: 'pass',
    defects: [],
    unverifiable: ['cannot verify business intent'],
  });
  const model = new RecordingModelClient([review]);
  const oracle = new ProReviewOracle(model);
  const verdict = await oracle.judge(ac, [makeEvidence({ diff: '... ' })]);

  expect(verdict.result).toBe('need_human');
});

it('clean pass -> pass', async () => {
  const review = JSON.stringify({
    verdict: 'pass',
    defects: [],
    unverifiable: [],
  });
  const model = new RecordingModelClient([review]);
  const oracle = new ProReviewOracle(model);
  const verdict = await oracle.judge(ac, [makeEvidence({ diff: '...' })]);

  expect(verdict.result).toBe('pass');
});

it('does not send executor self-summary to grader', async () => {
  const review = JSON.stringify({
    verdict: 'pass',
    defects: [],
    unverifiable: [],
  });
  const model = new RecordingModelClient([review]);
  const oracle = new ProReviewOracle(model);
  await oracle.judge(ac, evidenceWithSelfNarrative);

  const call = model.messages[0];
  expect(call.role).toBe('grader');
  const userMessage = call.messages[1];
  expect(userMessage.role).toBe('user');
  const payload = JSON.parse(userMessage.content) as { ac: AcceptanceCriterion; evidence: Evidence[] };
  expect(call.opts).toEqual({ json: true });

  for (const e of payload.evidence) {
    expect(e.payload).not.toHaveProperty('summary');
    expect(e.payload).not.toHaveProperty('executorSays');
    if (e.acId === 'AC1' && 'diff' in e.payload) {
      expect(e.payload.diff).toBeDefined();
    }
  }

  expect(payload).toHaveProperty('ac');
  expect(payload.evidence).toHaveLength(2);
});

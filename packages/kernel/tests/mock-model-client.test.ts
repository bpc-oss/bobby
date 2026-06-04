import { describe, expect, it } from 'vitest';
import { MockModelClient } from '../src/model/mock-model-client';

describe('MockModelClient', () => {
  it('returns queued responses by role', async () => {
    const model = new MockModelClient({ grader: ['{"ok":true}'], runner: ['done'] });

    expect((await model.complete('grader', [{ role: 'user', content: 'hi' }])).content).toBe(
      '{"ok":true}'
    );
    expect((await model.complete('runner', [{ role: 'user', content: 'go' }])).content).toBe(
      'done'
    );
  });

  it('throws when queued responses are exhausted', async () => {
    const model = new MockModelClient({ grader: [], runner: [] });

    await expect(model.complete('grader', [])).rejects.toThrow();
  });
});

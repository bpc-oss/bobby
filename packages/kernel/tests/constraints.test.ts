import { describe, expect, it } from 'vitest';

import { NoForbiddenPathChecker, enforceConstraints } from '../src/conscience/constraints';
import type { Constraint } from '@bobby/shared';

describe('constraint enforcement', () => {
  const noLegacy: Constraint = {
    id: 'C1',
    desc: 'Do not touch legacy files',
    check: 'path:src/legacy/'
  };

  it('NoForbiddenPathChecker fails when touched path is under forbidden prefix', () => {
    const results = enforceConstraints([noLegacy], { touchedPaths: ['src/legacy/a.ts'] }, [new NoForbiddenPathChecker()]);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'C1',
      result: 'fail'
    });
  });

  it('NoForbiddenPathChecker passes when no touched path is under forbidden prefix', () => {
    const results = enforceConstraints([noLegacy], { touchedPaths: ['src/app.ts'] }, [new NoForbiddenPathChecker()]);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'C1',
      result: 'pass'
    });
  });

  it('path prefix match is exact, src/legacy2/a.ts should pass for path:src/legacy/', () => {
    const results = enforceConstraints([noLegacy], { touchedPaths: ['src/legacy2/a.ts'] }, [new NoForbiddenPathChecker()]);
    expect(results[0]).toMatchObject({
      id: 'C1',
      result: 'pass'
    });
  });

  it('unknown checker pattern returns need_human', () => {
    const vague: Constraint = {
      id: 'C2',
      desc: 'Unknown check',
      check: 'vibe'
    };

    const results = enforceConstraints([vague], { touchedPaths: [] }, [new NoForbiddenPathChecker()]);
    expect(results[0]).toMatchObject({
      id: 'C2',
      result: 'need_human'
    });
  });
});

import type { AcceptanceCriterion, Evidence, Verdict } from '@bobby/shared';
import type { Oracle } from '../oracle';

type CommandOutputPayload = {
  exitCode?: unknown;
};

type FileExistsPayload = {
  exists?: unknown;
};

type FileDiffPayload = {
  path?: unknown;
  bytes?: unknown;
};

export class CommandExitOracle implements Oracle {
  readonly tier = 'T0' as const;
  readonly name = 'command-exit';

  canJudge(_ac: AcceptanceCriterion, evidence: Evidence[]): boolean {
    return evidence.some((entry) => entry.evidenceType === 'command_output');
  }

  async judge(ac: AcceptanceCriterion, evidence: Evidence[]): Promise<Verdict> {
    const commandEvidences = evidence.filter((entry) => entry.evidenceType === 'command_output');
    const firstBadEvidence = commandEvidences.find((entry) => {
      const payload = (entry.payload ?? {}) as CommandOutputPayload;
      return typeof payload.exitCode !== 'number' || payload.exitCode !== 0;
    });
    const pass = commandEvidences.length > 0 && firstBadEvidence === undefined;

    return {
      claimId: commandEvidences[0]?.claimId ?? ac.id,
      acId: ac.id,
      oracleTier: 'T0',
      result: pass ? 'pass' : 'fail',
      detail: pass
        ? undefined
        : `command output indicates non-zero or missing exitCode: ${JSON.stringify(firstBadEvidence?.payload ?? {})}`,
    };
  }
}

export class FileExistsOracle implements Oracle {
  readonly tier = 'T0' as const;
  readonly name = 'file-exists';

  canJudge(_ac: AcceptanceCriterion, evidence: Evidence[]): boolean {
    return evidence.some((entry) => entry.evidenceType === 'file_exists');
  }

  async judge(ac: AcceptanceCriterion, evidence: Evidence[]): Promise<Verdict> {
    const fileEvidences = evidence.filter((entry) => entry.evidenceType === 'file_exists');
    const firstBadEvidence = fileEvidences.find((entry) => {
      const payload = (entry.payload ?? {}) as FileExistsPayload;
      return payload.exists !== true;
    });
    const pass = fileEvidences.length > 0 && firstBadEvidence === undefined;

    return {
      claimId: fileEvidences[0]?.claimId ?? ac.id,
      acId: ac.id,
      oracleTier: 'T0',
      result: pass ? 'pass' : 'fail',
      detail: pass ? undefined : `file existence check failed: ${JSON.stringify(firstBadEvidence?.payload ?? {})}`,
    };
  }
}

export class FileDiffOracle implements Oracle {
  readonly tier = 'T0' as const;
  readonly name = 'file-diff';

  canJudge(_ac: AcceptanceCriterion, evidence: Evidence[]): boolean {
    return evidence.some((entry) => entry.evidenceType === 'file_diff');
  }

  async judge(ac: AcceptanceCriterion, evidence: Evidence[]): Promise<Verdict> {
    const fileDiffEvidences = evidence.filter((entry) => entry.evidenceType === 'file_diff');
    const firstBadEvidence = fileDiffEvidences.find((entry) => {
      const payload = (entry.payload ?? {}) as FileDiffPayload;

      if (typeof payload.path !== 'string' || payload.path.trim().length === 0) {
        return true;
      }

      return typeof payload.bytes !== 'number' || !Number.isFinite(payload.bytes) || payload.bytes <= 0;
    });

    const pass = fileDiffEvidences.length > 0 && firstBadEvidence === undefined;

    return {
      claimId: fileDiffEvidences[0]?.claimId ?? ac.id,
      acId: ac.id,
      oracleTier: 'T0',
      result: pass ? 'pass' : 'fail',
      detail: pass
        ? undefined
        : `file diff evidence check failed: ${JSON.stringify(firstBadEvidence?.payload ?? {})}`,
    };
  }
}

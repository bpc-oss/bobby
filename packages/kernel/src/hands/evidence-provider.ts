import type { AcceptanceCriterion, Evidence, EvidenceType } from '@bobby/shared';
import type { ToolRegistry } from './tool';
import type { ExecContext } from '../conscience/constraints';

export interface PlannedCall {
  tool: string;
  input: Record<string, unknown>;
}

type ACIdByEvidenceType = Map<EvidenceType, Set<string>>;

export class ToolEvidenceProvider {
  private plans = new Map<string, PlannedCall[]>();
  private touched: string[] = [];

  constructor(private registry: ToolRegistry) {}

  plan(stepId: string, calls: PlannedCall[]): void {
    this.plans.set(stepId, calls);
  }

  async evidenceFor(
    stepId: string,
    acIds: string[],
    calls: ReadonlyArray<PlannedCall> = this.plans.get(stepId) ?? [],
    acCriteria: AcceptanceCriterion[] = []
  ): Promise<Evidence[]> {
    if (acIds.length === 0) {
      throw new Error('acIds must include at least one acceptance criterion id');
    }

    if (calls.length === 0) {
      throw new Error(`No calls found for step ${stepId}`);
    }

    const criteriaMap = this.buildCriteriaMap(acCriteria);
    const matchingAcsByEvidenceType = this.groupAcIdsByEvidenceType(acIds, criteriaMap);
    const out: Evidence[] = [];
    let commandEvidenceCursor = 0;

    for (const call of calls) {
      const runResult = await this.registry.get(call.tool).run(call.input, { acId: acIds[0], claimId: stepId });
      for (const evidence of runResult.evidence) {
        const eligibleAcIds = this.eligibleAcIdsForEvidence(evidence.evidenceType, matchingAcsByEvidenceType, acIds);
        const commandEvidenceIndex = this.isCommandEvidence(evidence.evidenceType)
          ? commandEvidenceCursor++
          : undefined;
        const targetAcIds = this.selectAcIdsForEvidence(
          evidence.evidenceType,
          eligibleAcIds,
          acIds,
          commandEvidenceIndex
        );

        for (const acId of targetAcIds) {
          out.push({
            ...evidence,
            acId
          });
          const path = (evidence.payload as { path?: unknown }).path;
          if (typeof path === 'string') {
            this.touched.push(path);
          }
        }

      }
    }

    return out;
  }

  context(): ExecContext {
    return { touchedPaths: [...this.touched] };
  }

  private buildCriteriaMap(acCriteria: AcceptanceCriterion[]): Map<string, AcceptanceCriterion> {
    const criteria = new Map<string, AcceptanceCriterion>();
    for (const ac of acCriteria) {
      criteria.set(ac.id, ac);
    }
    return criteria;
  }

  private groupAcIdsByEvidenceType(acIds: string[], criteriaMap: Map<string, AcceptanceCriterion>): ACIdByEvidenceType {
    const byType = new Map<EvidenceType, Set<string>>();
    const typeByHint: Record<AcceptanceCriterion['oracleHint'], EvidenceType[]> = {
      run: ['command_output', 'test_run'],
      test: ['command_output', 'test_run'],
      file: ['file_diff', 'file_exists'],
      schema: ['file_diff', 'file_exists', 'schema_valid', 'symbol_exists'],
      review: ['file_diff', 'quote_with_location'],
      human: []
    };

    for (const acId of acIds) {
      const criterion = criteriaMap.get(acId);
      if (!criterion) {
        continue;
      }

      const evidenceTypes = typeByHint[criterion.oracleHint];
      if (evidenceTypes.length === 0) {
        continue;
      }

      for (const evidenceType of evidenceTypes) {
        if (!byType.has(evidenceType)) {
          byType.set(evidenceType, new Set());
        }
        byType.get(evidenceType)?.add(acId);
      }
    }

    return byType;
  }

  private eligibleAcIdsForEvidence(
    evidenceType: EvidenceType,
    byType: ACIdByEvidenceType,
    fallbackAcIds: string[]
  ): string[] {
    if (byType.size === 0) {
      return fallbackAcIds;
    }

    const match = byType.get(evidenceType);
    if (match && match.size > 0) {
      return [...match];
    }

    return fallbackAcIds;
  }

  private selectAcIdsForEvidence(
    evidenceType: EvidenceType,
    eligibleAcIds: string[],
    fallbackAcIds: string[],
    commandEvidenceIndex?: number
  ): string[] {
    if (eligibleAcIds.length === 0) {
      return fallbackAcIds;
    }

    if (!this.isCommandEvidence(evidenceType)) {
      return eligibleAcIds;
    }

    if (eligibleAcIds.length === 1) {
      return eligibleAcIds;
    }

    if (commandEvidenceIndex === undefined) {
      return fallbackAcIds;
    }

    const commandTarget = eligibleAcIds[commandEvidenceIndex % eligibleAcIds.length];
    return commandTarget === undefined ? fallbackAcIds : [commandTarget];
  }

  private isCommandEvidence(evidenceType: EvidenceType): boolean {
    return evidenceType === 'command_output' || evidenceType === 'test_run';
  }
}

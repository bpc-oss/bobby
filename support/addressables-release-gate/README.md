# Addressables Release Gate Documentation

Addressables Release Gate is a Unity Editor and CI helper for teams that already ship Addressables and need explicit go or no-go checks before content release.

## What It Does

- Capture a known-good baseline from a release candidate.
- Compare new builds against size, duplication, and bundle-count budgets.
- Reuse the same rule pack in the Unity Editor and in CI.
- Export JSON and Markdown findings for release review and artifact retention.

## Supported Unity Versions

- Unity 2022 LTS
- Unity 6

## Installation

1. Add the package to a Unity 2022 LTS or Unity 6 project.
2. Import the included sample payloads if you want a local validation example.
3. Prepare a rule pack, current build snapshot, and optional baseline snapshot.
4. Choose an artifact output directory for JSON and Markdown results.

## Editor Quickstart

1. Open `Tools > Addressables Release Gate > Validate`.
2. Load a rule pack and current build snapshot.
3. Optionally load a known-good baseline snapshot.
4. Run validation and review the findings before release approval.

## Batch Mode

```powershell
Unity.exe -batchmode -quit \
  -projectPath <validation-project> \
  -executeMethod StudioOS.AddressablesReleaseGate.ReleaseGateBatch.Run \
  -releaseGateRulePackPath <rule-pack.json> \
  -releaseGateSnapshotPath <build-snapshot.json> \
  -releaseGateBaselinePath <baseline.json> \
  -releaseGateArtifactPath <artifact-output>
```

## Expected Outputs

- `validation-result.json` for machine-readable review
- `validation-summary.md` for release notes and artifact retention

## Troubleshooting Inputs

When reporting an issue, include the following when possible:

- Unity version
- Editor log
- Licensing Client log
- rule pack JSON
- current build snapshot JSON
- baseline snapshot JSON when applicable

## Support Scope

Support is intended for:

- installation problems
- setup questions
- validation-flow issues
- bug reports with reproducible package behavior

Support mailbox: `s1015341084@gmail.com`

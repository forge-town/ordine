# Task 4 Anatomy proposal specification review

Status: **PASS_PROPOSAL**

This is an independent review of the proposed structural definitions. It does not approve the migrating source tree, runtime behavior, final Task 4 completion, or production saves. No source or proposed Anatomy definition was changed by this review; no production mutation, commit, push, or additional agent was performed.

## Assessment and approved scope

The complete brainstorming skill and its workflow, Lean, and checklist references were read before review. The assessment uses the already approved design rather than starting a new design or approval cycle. The scope is the Package boundary, unchanged Service-unit composition, proposed Method/Helper extensions, checker semantics, and impact on the existing Daedalus Service package directory. Source quality and business behavior are outside this proposal review.

The Chinese and English sections of `docs/specs/2026-10-06-ordine-service-structure-design.md` agree on explicit support boundaries, canonical leaf specs, optional isolated scenario specs, preserved snapshots/PDF inputs, strict global policies, and final validation. The Lean specification retains leaf specs, prohibits aggregate Service specs, protects support assets and real-model test entry points, and requires verified structure before publication. `lean docs/specs/2026-10-06-ordine-service-structure-design.lean` exited 0 using the root-pinned `leanprover/lean4:v4.34.0`. Those proofs describe acceptance conditions; they do not establish implementation completion.

## Baseline and actual checker

Read-only production `anatomy_get` confirmed Code Forge workspace `28adc534-c0b5-454f-a121-76a43c22e5af`: shared Service Package `1054274d-005e-4554-84c2-b0459e89c849` revision 1, Service Unit `45015e2f-5c8a-48dc-87ba-9e1accf0fc3e` revision 7, Method `c9e8b402-e926-4ba5-b04c-2086a39db531` revision 1, and Helper `824299ac-1cde-47c4-b866-a99a29059ba2` revision 1. All three dependency drafts exactly matched `anatomy-dependencies.json`; the Service Unit remains unchanged in `anatomy-dependencies-proposed.json`.

All definitions use schemaVersion 2. The real dispatch is `packages/anatomy/src/core/check-anatomy.ts:125-132` → `adapter/createAnatomyBundle.ts:34-39` → `adapter/checkAnatomyBundle.ts:33-38` → `anatomy-cli` 0.0.4 `planAnatomyBundle`. Explicit composition targets use their referenced root entries (`createAnatomyBundle.ts:53-66`). The legacy checker loop and `matchesAnatomyEntryName.ts` were read, but the acceptance conclusions below come from executing the actual version-2 path, not from assuming the legacy loop applies.

Reviewed definition fingerprints (SHA-256):

| File                               | SHA-256                                                          |
| ---------------------------------- | ---------------------------------------------------------------- |
| anatomy-before.json                | 88121b60c0b21a812ad52a3a572cc0b895b1d643a5fb7687332f8897343e84a4 |
| anatomy-proposed.json              | e156ee51417b4df42ddc28170dc8066fc6c8bdcb4a61aecedd1d117f073263d2 |
| anatomy-dependencies.json          | 8defa56c72353c079710fbdd588e253b01023cb44ae3a94f76d5a00355973d09 |
| anatomy-dependencies-proposed.json | f9cb45c0de79d103001db887bbfba3b0f884067be362a92bb70bea5b7f3c3b22 |

## Findings

No blocking proposal discrepancy was found. There are no missing or extra proposal requirements requiring a correction.

| Rule and evidence location                                                        | Review result                                                                                                                                                                                                          |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `anatomy-proposed.json:6-10`; dependency defaults at lines 7-11, 132-136, 261-265 | All four global policies remain `block`.                                                                                                                                                                               |
| Package `src` composition, `anatomy-proposed.json:64-70`                          | Business Services still compose the existing Service Unit with `one_or_more`; the unit requires `index.ts` and `<name>.service.ts`.                                                                                    |
| Fixed support nodes, `anatomy-proposed.json:112-214`; archived at 248-259         | The only `unexpectedEntry: allow` overrides belong to the eight named directories and `archived`. Their internal entries are outside the business Service template. No global wildcard or parent/root override exists. |
| Fixed configuration and common files, `anatomy-proposed.json:72-110`, 218-246     | Optional declarations use exact names for the requested tooling files, public composition/errors/declaration files and `m2Services.unit.test.ts`.                                                                      |
| Method canonical files, dependency proposal lines 150-178; Helper lines 279-307   | `index.ts`, implementation, and standard spec remain `exactly_one`; isolated scenarios cannot satisfy a missing canonical file.                                                                                        |
| Scenario pattern, dependency proposal lines 180-188 and 309-317                   | `<scenario>.scenario.spec.ts` is `zero_or_more`; two isolated scenarios coexist. `realLlm.scenario.spec.ts` passes, while `alpha.realLlm.scenario.spec.ts` fails.                                                      |
| Snapshots and fixtures, dependency proposal lines 190-243 and 319-372             | Only canonical/scenario `.spec.ts.snap` names and named PDFs are declared. Canonical snapshot prefixes bind the leaf name. Unknown TXT/PNG assets fail.                                                                |
| `CodeGuidelines.md:34-39`; design Markdown sections 3, 4, 7                       | Local guidance matches the proposal and preserves file-level mock isolation, canonical leaf tests, and protected support responsibilities.                                                                             |

Independent `anatomy-spec-review-probes.ts` executes 26 in-memory cases through the real `checkAnatomy` API; `anatomy-spec-review-probes.json` records all 26 expected outcomes passing. Both Method and Helper cases cover valid canonical/scenario/assets, wrong implementation/spec names, extra-dot scenarios, absent canonical implementation/spec despite scenario files, wrong canonical snapshot names, and unknown assets. Package probes cover all eight fixed support directories, unknown package/src/Service entries, aggregate Service specs, wrong Service implementation bindings, and support-directory wrong-kind/wrong-case violations. Thus the local overrides do not permit sibling unknown entries or weaken Service obligations.

The eight support directories exist with their distinct responsibilities: canvas conversion/compilation, execution public exports, process actors, artifacts, submission gateway, migration schemas/imports, prompt actors, and job lease helpers. Their existing entries include scripts, README, fixtures and integration/live tests that do not fit the business Service template. At review time `git diff --name-only` for these directories, shared factory/errors/declaration files, and the package manifest returned no changes. Their behavior still requires the final type/lint/test and public-consumer checks; this Anatomy deliberately declares their boundary rather than certifying internals.

## Local-tree and Daedalus impact evidence

The supplied `structural-progress.json` was inspected and remains a progress snapshot. An independent rerun captured `anatomy-spec-review-current.json`: the original ordine baseline reproduces 166 blocks, while the actively migrating worktree had 75 blocks, 61 allow-level internal support entries, and `conforms: false`. All eight invariant checks, including independent canonical Method/Helper contracts, were true. This is expected unfinished migration evidence, not a proposal failure or final conformance claim.

The supplied `daedalus-structure-impact.json` was inspected and independently rerun. A further isolated comparison in `anatomy-spec-review-impact.ts` holds the real Daedalus tree fixed and distinguishes leaf-only changes from the full proposal. It compares block identity using code, path, constraint, source Anatomy and severity.

| Definitions on `/Users/amin/projects/daedalus/packages/services` | Blocks | New blocks | Removed blocks |
| ---------------------------------------------------------------- | -----: | ---------: | -------------: |
| Original Package and original dependencies                       |    118 |          — |              — |
| Original Package and proposed Method/Helper definitions          |    118 |          0 |              0 |
| Proposed Package and proposed dependencies                       |    117 |          0 |              1 |

The one removed block is the newly declared `services/vitest.config.ts`. Daedalus remains nonconforming with 117 existing blocks; no claim is made that it passes. Results are retained in `anatomy-spec-review-isolated-daedalus-impact.json` and `anatomy-spec-review-daedalus-impact.json`.

Read-only `anatomy_list(limit: 50)` returned the complete 21-item Code Forge list, containing no independently named `DaedalusServicePackage` or `Daedalus Service Package` object. The parent clarified that the task refers to the existing Daedalus project's Service package directory under the shared Service Package definition. No dedicated definition was invented or created.

## Conditions still required for final Task 4

1. Complete all 27 Service migrations, then rerun the real checker with `--require-conforming`; verify every identified Service is present exactly once and the complete local package conforms.
2. Recheck support boundaries and unknown-root/unknown-leaf/asset rejection against the final tree, including the independent Method/Helper canonical-file checks.
3. Finish the required implementation and consumer validation; this review does not approve unchanged runtime behavior, test assertion preservation, snapshots/PDF content preservation, or public-entry behavior.
4. Obtain final Task 4 review after migration. Only then save the changed Package/Method/Helper drafts with their applicable `expectedRevision`, and read back exact definitions and revisions. This review performed no save and establishes no production update or Finding resolution.

The session/result check found no unsupported success claim: proposal semantics and compatibility probes are verified, while implementation completion and production persistence remain explicitly pending.

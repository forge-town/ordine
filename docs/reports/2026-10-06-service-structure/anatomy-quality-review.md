# Task 4 proposal quality and evidence review

Status: **PASS_PROPOSAL_QUALITY**

This is a proposal-stage review after the independent specification review. It approves the bounded JSON changes and the corrected structural verification approach. It does not approve the unfinished Task 2 source migration, final conformance, test/behavior preservation, or any production save. The reviewer changed only this report. No production mutation, commit, push, or additional agent was performed.

## Assessment

The brainstorming skill and all three required workflow/formalization/checklist references were read. The already approved bilingual design and Lean specification supply the intent and acceptance boundary; a second design approval cycle is unnecessary for this read-only review. The chosen approach was to inspect the explicit JSON and checker dispatch, independently rerun the existing negative probes and compatibility comparison, and challenge final-gate completeness with a minimal counterexample. Broad source review and unrelated validator refactoring were excluded.

## Reviewed evidence

- `anatomy-proposed.json` SHA-256: `e156ee51417b4df42ddc28170dc8066fc6c8bdcb4a61aecedd1d117f073263d2`.
- `anatomy-dependencies-proposed.json` SHA-256: `f9cb45c0de79d103001db887bbfba3b0f884067be362a92bb70bea5b7f3c3b22`.
- Corrected `verify-structure.ts` SHA-256: `667efd34d92bdc7246ac0607053a10cdcef142c3d01a2a0abe8f5e61b991cdb4`.
- Read-only production `anatomy_get` independently returned Package revision 1, Service Unit revision 7, Method revision 1, Helper revision 1, all in Code Forge workspace `28adc534-c0b5-454f-a121-76a43c22e5af`. Their current drafts exactly matched the local baseline JSON objects.
- The actual source dispatch is `packages/anatomy/src/core/check-anatomy.ts` to `packages/anatomy/src/adapter/createAnatomyBundle.ts` and `checkAnatomyBundle.ts`, then `anatomy-cli` 0.0.4 `planAnatomyBundle`. Version-2 definitions therefore use the explicit bundle path. No legacy-loop simulation was used for acceptance.
- Independent rerun of `anatomy-spec-review-probes.ts` exited 0: **26/26** expected outcomes passed. Positive fixtures establish a conforming starting point before each negative mutation.
- Independent rerun of `anatomy-spec-review-impact.ts` reproduced Daedalus block counts **118 original / 118 leaf-only / 117 complete proposal**, with zero new blocks in both comparisons and only the declared `services/vitest.config.ts` block removed by the complete proposal.

## Quality findings resolved during review

### P2 — The final gate did not prove preservation of the 27-Service scope — fixed

Original trigger: a valid package containing only `alphaService` and one canonical Method leaf. The Package intentionally uses `one_or_more`, and the original `verify-structure.ts` final condition checked only conformance and eight structural invariants. Executing the script in memory with only `currentTree` replaced by that synthetic tree produced `conforms: true`, all eight invariants true, and exit code 0 with `--require-conforming`. Thus that command alone could not establish design AC01.

Minimal correction, implemented by the parent: `verify-structure.ts:56-58` compares the actual sorted Service directory names against `baseline-inventory.json.services`; lines 214 and 243 include the comparison in the report and final gate. The saved baseline inventory names all 27 Services. No project-specific count was added to the shared Anatomy definition.

Validation: independently reran the same in-memory counterexample against the corrected script. Anatomy still returned `conforms: true`, but `serviceScopePreserved: false` caused exit code **1**. The real target reported 27 expected names and exact scope equality. This counterexample modified no repository script or source file.

### P2 — The input walker silently omitted unknown symbolic links — fixed

Original trigger: an undeclared root symbolic link. The old walker filtered every `isSymbolicLink()` entry before passing the tree to the checker, so the unknown-root invariant did not cover those filesystem entries.

Minimal correction, implemented by the parent: `verify-structure.ts:21-25` retains links as named file entries without following their targets. Lines 68-76 create a real temporary fixture under this report directory with `services/package.json` and an `unapproved-root-link` symlink, observe the link in the collected tree, require a block specifically at its path, and remove the fixture. The combined observation/block result is a final invariant at line 230.

Validation: independently executed the corrected script; `unknownRootSymlinkBlocked` was true. The real nongenerated package tree contained no symlinks at inspection, so the earlier real-tree counts were not affected by this omission. No `symlink-probe-*` fixture directories remained after the independent runs.

No unresolved blocking quality finding remains for this proposal stage.

## Definition boundaries and maintainability

The proposal uses exact literal support/configuration names and stable explicit nodes. The only relaxed `unexpectedEntry` policies are inside `archived` and the eight named non-Service support directories. Global missing-required, unexpected-entry, name-mismatch, and nesting-mismatch policies remain `block`. Service Unit revision 7 remains unchanged; canonical implementation and canonical spec obligations remain mandatory in the leaf definitions. Scenario files cannot replace those obligations. No generic wildcard exemption leaks to root files, sibling Services, or unknown leaf assets.

The existing snapshot use inspected in Ordine is `toMatchSnapshot`, and the package Vitest configuration has no custom snapshot resolver. Installed Vitest 4.1.6 `@vitest/snapshot/dist/environment.js:18` resolves `__snapshots__/<test basename>.snap`, which agrees with canonical `.method.spec.ts.snap`, `.helper.spec.ts.snap`, and scenario `.scenario.spec.ts.snap` filenames. A dot-free scenario basename and named PDF fixtures cover the approved current migration boundary; arbitrary future asset formats are deliberately not granted admission.

Anatomy checks filename shape, not snapshot contents or whether a scenario snapshot has a matching scenario test. It also cannot prove snapshots were consumed, PDF bytes were preserved, assertions stayed effective, file-level mocks remain isolated, or real-model tests remain runnable. Those are final migration test/preservation checks. Existing snapshot/PDF files were still in old locations at this partial inspection, which is expected unfinished work and not evidence of completion.

## Revision and combined-dependency save boundary

The production objects compose by Anatomy ID, not by pinned dependency revision. A successful Package `expectedRevision` check alone cannot establish that Service Unit, Method, and Helper still match the reviewed bundle. No transaction covering all four objects was observed in the save-tool contract.

For the eventual authorized save, refresh and compare all four definitions/revisions first. Revalidate any changed dependency rather than blindly retrying with a newer revision. Save only the three changed definitions using their own expected revisions; the unchanged Service Unit must remain untouched. Saving the optional Method/Helper additions before the Package addition gives a clear dependency-first sequence, but is not an atomic transaction. Record each successful result, stop on conflict or ambiguous failure, and read the affected object before retrying. Finally read back the complete four-object bundle, compare exact reviewed name/purpose/structure and resulting revisions, and run the final tree against those read-back definitions. If the untouched Service Unit changes during this window, revalidate the resulting bundle before reporting completion.

## Verification limits and remaining conditions

- The corrected real-tree rerun reproduced the original Ordine baseline at **166 blocks**. The migrating target had **73 blocks**, 61 allow-level support entries, `conforms: false`, exact 27-Service scope equality, and all **10 invariants true**. These are a partial working-tree snapshot while another agent continues migration.
- The local walker deliberately excludes names `node_modules`, `.git`, `dist`, `.turbo`, and `.cache`. Claims apply to that declared scan scope. Its file treatment of symlinks checks their structural names without certifying target contents.
- The script's original-baseline path and checker import are local-machine dependencies. Reproducing 166 blocks confirms this inspection's baseline, not immutable future checkout state. Final evidence should record the actual target revision/tree and exact definition fingerprints. No portability refactor is necessary for this local diagnostic.
- `verify-structure.ts` uses a coarse code/path identity for its quick impact field. The separate isolated impact script uses code, path, constraint, Anatomy identity, and severity and remains the authoritative compatibility comparison.
- `--require-conforming` must be invoked with the explicit Ordine target, e.g. `bun docs/reports/2026-10-06-service-structure/verify-structure.ts packages/services --require-conforming`. Its new inventory gate is Ordine-specific; use the isolated impact script for Daedalus rather than requiring Daedalus to have the same 27 names.
- Complete all 27 migrations, rerun final conformance and negative probes, and finish source/consumer/test/snapshot/PDF preservation validation before the final review and production save. Daedalus currently remains nonconforming with its 117 pre-existing blocks; zero additional blocks does not mean it passes.
- Production `expectedRevision` saves, exact full-bundle readback, and final checker execution against that readback remain pending. This report does not establish a production update or Finding resolution.

## Session/result check

The review distinguished successful checker executions from incomplete migration and future production persistence. Both concrete validation gaps were reproduced or demonstrated from the input walker, corrected by the parent, and independently rechecked. The reviewed JSON fingerprints did not change. Failed setup attempts for the in-memory harness were corrected before using its output as evidence. The only retained reviewer artifact is this report; temporary symlink fixtures were removed. No claim about unfinished source quality, runtime behavior, or production completion is made.

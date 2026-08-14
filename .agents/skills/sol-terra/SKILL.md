---
name: sol-terra
description: Run Ordine development through a Sol-led, Terra-executed workflow with bounded delegation, evidence review, testing, rollback, and tightly gated Sol High escalation. Use when the user explicitly invokes $sol-terra or asks Sol to plan, delegate, review, and accept repository work.
---

# Sol-Terra Workflow

Keep the main Sol thread responsible for requirements, decisions, risk, integration, and final acceptance. Use Terra only for bounded execution units.

## Workflow

1. Inspect the request, repository state, applicable `AGENTS.md`, and current constraints. Define the target result, exclusions, evidence needed, and stop condition.
2. Decide whether a read-only exploration is needed. Delegate it to `terra_explorer` only when it removes a concrete uncertainty.
3. Split implementation and verification into the smallest independently testable units. Serialize tasks that can edit the same files or code region.
4. Before every delegation, write the complete task contract below. Do not use open-ended prompts such as "finish this feature" or "research and complete it yourself."
5. Send exploration, implementation, and verification to `terra_explorer`, `terra_implementer`, and `terra_tester` respectively. Spawn by custom `agent_type` with `fork_turns="none"`; omit explicit model and reasoning overrides so the agent TOML remains authoritative. Parallelize only independent read-heavy work or non-conflicting tests. If the runtime rejects the configured agent or model, fail closed and report the limitation.
6. Wait for structured results. Inspect the actual diff, command exit codes, and decisive test output; a Terra completion message is evidence to review, not acceptance.
7. Accept, request a bounded rework, add targeted tests, or roll back. Sol owns the decision and must preserve unrelated changes.
8. Call `sol_escalation` only when an escalation trigger below is explicitly met and supported by evidence. Otherwise keep the work at Sol Medium.
9. Finish with an acceptance report: result, changed files, verification evidence, residual risk, rollback, and any unverified limitation.

## Delegation Contract

Every Terra task must state:

1. Task objective: the single result required now.
2. Allowed scope: exact readable and writable files or directories.
3. Forbidden scope: files, behavior, dependencies, and operations that must not change.
4. Known context: relevant call chain, constraints, assumptions, and prior conclusions.
5. Completion criteria: observable conditions for done.
6. Validation: exact tests, builds, checks, or searches and expected evidence.
7. Rollback: how to restore the pre-task state and remove generated output.
8. Return format: investigation conclusion; modified files; key code changes; commands; test results; unresolved issues; risks and recommendations.

If any item is missing or the task requires a major design choice, do not delegate implementation. Clarify locally or escalate only if eligible.

## Escalation Gate

`sol_escalation` is allowed only for cross-subsystem architecture, migration or protocol changes, irreversible operations, security or permission boundaries, concurrency or consistency hazards, material long-term tradeoffs, two unsuccessful Sol Medium decision attempts, or credible production/data-damage blast radius.

Routine features, formatting, normal tests, simple bugs, search, and documentation are never High work. A temporary `NO_HIGH` instruction from the user disables escalation; Sol must then report a blocker rather than silently using High.

## Acceptance Gate

- Set the parent turn's live permission mode no broader than the delegated task requires; live parent overrides can supersede an agent file's sandbox default.
- Review `git diff` and ensure only authorized paths changed.
- Require completed validation with exit status and decisive output.
- Distinguish passed, failed, skipped, timed out, and unobservable checks.
- Do not accept hidden dependency additions, broad refactors, or unexplained generated files.
- Remove temporary artifacts or run the stated rollback before the final report.

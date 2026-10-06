namespace OrdineServiceMigrationV1

inductive Role where | user | authorizedAgent deriving DecidableEq, Repr
inductive Repository where | ordine deriving DecidableEq, Repr
inductive Branch where | develop deriving DecidableEq, Repr
inductive Publication where | sameRepositoryDraftPR deriving DecidableEq, Repr
inductive Phase where | planned | migrated | verified | draftReady deriving DecidableEq, Repr
inductive Action where | migrate | verify | openDraftPR deriving DecidableEq, Repr

inductive ServiceFamily where
  | agentControl | agentRuns | agentRuntimes | agents
  | capabilityCatalog | capabilityHarvest | connectors | conversationMessages
  | distillations | execution | filesystem | githubProjects | jobs
  | operationOutputItemTemplates | operationRunner | operations
  | pipelineAgentSessions | pipelineAssets | pipelineRunner | pipelines
  | projects | refinements | routineScheduler | routines | settings | skills | usage
  deriving DecidableEq, Repr

inductive ProtectedAsset where
  | publicPackageEntry | executionSubpath | executionMigrationSubpath
  | vitestConfiguration | lintConfiguration | changeLog | archivedSources
  | canvasExecution | execution | executionActors | executionArtifacts
  | executionGateway | executionMigration | executionPrompt | jobLease
  | compositionEntry | errorDefinitions | textImportDeclaration | realLlmTestEntryPoints
  deriving DecidableEq, Repr

structure Design where
  actor : Role
  repository : Repository
  baseBranch : Branch
  publication : Publication
  services : List ServiceFamily
  protectedAssets : List ProtectedAsset
  requireLeafSpecs : Bool
  prohibitAggregateServiceSpec : Bool
  requireFullVerification : Bool
  keepStrictUnexpectedEntryPolicy : Bool
  deriving DecidableEq, Repr

def canonicalDesign : Design := {
  actor := .authorizedAgent
  repository := .ordine
  baseBranch := .develop
  publication := .sameRepositoryDraftPR
  services := [
    .agentControl, .agentRuns, .agentRuntimes, .agents,
    .capabilityCatalog, .capabilityHarvest, .connectors, .conversationMessages,
    .distillations, .execution, .filesystem, .githubProjects, .jobs,
    .operationOutputItemTemplates, .operationRunner, .operations,
    .pipelineAgentSessions, .pipelineAssets, .pipelineRunner, .pipelines,
    .projects, .refinements, .routineScheduler, .routines, .settings, .skills, .usage
  ]
  protectedAssets := [
    .publicPackageEntry, .executionSubpath, .executionMigrationSubpath,
    .vitestConfiguration, .lintConfiguration, .changeLog, .archivedSources,
    .canvasExecution, .execution, .executionActors, .executionArtifacts,
    .executionGateway, .executionMigration, .executionPrompt, .jobLease,
    .compositionEntry, .errorDefinitions, .textImportDeclaration, .realLlmTestEntryPoints
  ]
  requireLeafSpecs := true
  prohibitAggregateServiceSpec := true
  requireFullVerification := true
  keepStrictUnexpectedEntryPolicy := true
}

def WellFormed (d : Design) : Prop :=
  d.actor = .authorizedAgent ∧
  d.repository = .ordine ∧
  d.baseBranch = .develop ∧
  d.publication = .sameRepositoryDraftPR ∧
  d.services.length = 27 ∧ d.services.Nodup ∧ d.protectedAssets.Nodup ∧
  d.requireLeafSpecs = true ∧ d.prohibitAggregateServiceSpec = true ∧
  d.requireFullVerification = true ∧ d.keepStrictUnexpectedEntryPolicy = true

theorem canonicalDesign_wellFormed : WellFormed canonicalDesign := by
  unfold WellFormed canonicalDesign
  decide

structure Evidence where
  factoryInjectionPreserved : Bool
  publicApiPreserved : Bool
  runtimeBehaviorPreserved : Bool
  existingAssertionsPreserved : Bool
  protectedAssetsPreserved : Bool
  importsUpdated : Bool
  leafSpecsColocated : Bool
  aggregateServiceSpecsAbsent : Bool
  ruleBoundaryReviewed : Bool
  typesPassed : Bool
  lintPassed : Bool
  testsPassed : Bool
  structurePassed : Bool
  deriving DecidableEq, Repr

def MigrationInvariant (e : Evidence) : Prop :=
  e.factoryInjectionPreserved = true ∧ e.publicApiPreserved = true ∧
  e.runtimeBehaviorPreserved = true ∧ e.existingAssertionsPreserved = true ∧
  e.protectedAssetsPreserved = true ∧ e.importsUpdated = true ∧
  e.leafSpecsColocated = true ∧ e.aggregateServiceSpecsAbsent = true

def FullyVerified (e : Evidence) : Prop :=
  MigrationInvariant e ∧ e.ruleBoundaryReviewed = true ∧
  e.typesPassed = true ∧ e.lintPassed = true ∧
  e.testsPassed = true ∧ e.structurePassed = true

def Allowed (actor : Role) (before : Phase) (action : Action)
    (e : Evidence) (after : Phase) : Prop :=
  actor = .authorizedAgent ∧
  match before, action, after with
  | .planned, .migrate, .migrated => MigrationInvariant e
  | .migrated, .verify, .verified => FullyVerified e
  | .verified, .openDraftPR, .draftReady => FullyVerified e
  | _, _, _ => False

theorem AC01_exact_service_scope :
    canonicalDesign.services.length = 27 ∧ canonicalDesign.services.Nodup ∧
    (∀ service : ServiceFamily, service ∈ canonicalDesign.services) := by
  refine ⟨by rfl, by decide, ?_⟩
  intro service
  cases service <;> decide

theorem AC03_real_llm_entry_points_protected :
    ProtectedAsset.realLlmTestEntryPoints ∈ canonicalDesign.protectedAssets := by decide

theorem AC02_preserve_factory_and_api (e : Evidence)
    (h : Allowed .authorizedAgent .planned .migrate e .migrated) :
    e.factoryInjectionPreserved = true ∧ e.publicApiPreserved = true :=
  ⟨h.2.1, h.2.2.1⟩

theorem AC03_preserve_behavior_and_assertions (e : Evidence)
    (h : Allowed .authorizedAgent .planned .migrate e .migrated) :
    e.runtimeBehaviorPreserved = true ∧ e.existingAssertionsPreserved = true :=
  ⟨h.2.2.2.1, h.2.2.2.2.1⟩

theorem AC04_preserve_assets_and_imports (e : Evidence)
    (h : Allowed .authorizedAgent .planned .migrate e .migrated) :
    e.protectedAssetsPreserved = true ∧ e.importsUpdated = true :=
  ⟨h.2.2.2.2.2.1, h.2.2.2.2.2.2.1⟩

theorem AC05_tests_at_leaf_units (e : Evidence)
    (h : Allowed .authorizedAgent .planned .migrate e .migrated) :
    e.leafSpecsColocated = true ∧ e.aggregateServiceSpecsAbsent = true :=
  h.2.2.2.2.2.2.2

theorem AC06_publish_requires_full_verification (e : Evidence)
    (h : Allowed .authorizedAgent .verified .openDraftPR e .draftReady) :
    e.typesPassed = true ∧ e.lintPassed = true ∧
    e.testsPassed = true ∧ e.structurePassed = true :=
  h.2.2.2

theorem AC07_review_structural_boundary (e : Evidence)
    (h : Allowed .authorizedAgent .verified .openDraftPR e .draftReady) :
    e.ruleBoundaryReviewed = true := h.2.2.1

theorem AC08_same_repository_develop :
    canonicalDesign.repository = .ordine ∧
    canonicalDesign.baseBranch = .develop ∧
    canonicalDesign.publication = .sameRepositoryDraftPR := by decide

theorem AC09_strict_policy_preserved :
    canonicalDesign.keepStrictUnexpectedEntryPolicy = true := by rfl

theorem publication_preserves_migration_invariants (e : Evidence)
    (h : Allowed .authorizedAgent .verified .openDraftPR e .draftReady) :
    MigrationInvariant e := h.2.1

theorem user_cannot_execute_agent_step (before : Phase) (action : Action)
    (e : Evidence) (after : Phase) :
    ¬ Allowed .user before action e after := by
  intro h
  cases h.1

inductive ApprovedSource where | approvedChatDesign | confirmedFinding
  deriving DecidableEq, Repr

def normalize (_ : ApprovedSource) : Design := canonicalDesign

theorem sources_normalize_to_same_design :
    normalize .approvedChatDesign = normalize .confirmedFinding := by rfl

end OrdineServiceMigrationV1

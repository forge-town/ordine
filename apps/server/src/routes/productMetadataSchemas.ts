import { z } from "zod/v4";
import {
  AgentRuntimeConfigSchema,
  AgentRuntimePreferenceSchema,
  SettingsSchema,
  GithubProjectSchema,
  OperationOutputItemTemplateSchema,
  SkillSchema,
  LocalConnectionSchema,
  SshConnectionSchema,
  RuntimeModelSchema,
  RuntimeModelCapabilityOptionSchema,
  RuntimeAdapterManifestSchema,
  RuntimeCapabilitiesSchema,
  RuntimeVerificationSchema,
} from "@repo/schemas";

export const MetadataIdSchema = AgentRuntimeConfigSchema.pick({ id: true }).strict();
export const MetadataSettingsPatchSchema = SettingsSchema.omit({ id: true, meta: true })
  .partial()
  .extend({
    agentRuntimePreferences: z
      .record(z.string().min(1), AgentRuntimePreferenceSchema.strict())
      .optional(),
  })
  .strict();
const modelSchema = RuntimeModelSchema.extend({
  reasoningEfforts: RuntimeModelCapabilityOptionSchema.strict().array().optional(),
  speeds: RuntimeModelCapabilityOptionSchema.strict().array().optional(),
}).strict();
export const MetadataRuntimeSchema = AgentRuntimeConfigSchema.extend({
  connection: z.discriminatedUnion("mode", [
    LocalConnectionSchema.extend({ models: modelSchema.array().optional() }).strict(),
    SshConnectionSchema.strict(),
  ]),
  compatibility: RuntimeAdapterManifestSchema.extend({
    capabilities: RuntimeCapabilitiesSchema.strict(),
    verification: RuntimeVerificationSchema.strict().array().optional(),
  })
    .strict()
    .optional(),
}).strict();
export const MetadataRuntimePatchSchema = MetadataRuntimeSchema.omit({ id: true }).partial();
export const MetadataRuntimeSyncSchema = z.strictObject({
  runtimes: MetadataRuntimeSchema.array(),
});
export const MetadataGithubProjectSchema = GithubProjectSchema.omit({ meta: true })
  .extend({ id: MetadataIdSchema.shape.id })
  .strict();
export const MetadataGithubProjectPatchSchema = MetadataGithubProjectSchema.omit({ id: true })
  .partial()
  .extend({
    description: GithubProjectSchema.shape.description.unwrap().optional(),
    branch: GithubProjectSchema.shape.branch.unwrap().optional(),
    isPrivate: GithubProjectSchema.shape.isPrivate.unwrap().optional(),
  });
export const MetadataTemplateSchema = OperationOutputItemTemplateSchema.omit({ meta: true })
  .extend({ id: MetadataIdSchema.shape.id })
  .strict();
export const MetadataTemplatePatchSchema = MetadataTemplateSchema.omit({ id: true })
  .partial()
  .extend({
    description: OperationOutputItemTemplateSchema.shape.description.unwrap().optional(),
  });
export const MetadataSkillPreviewSchema = z.strictObject({ rootPath: z.string().min(1) });
export const MetadataSkillCandidateSchema = SkillSchema.pick({
  id: true,
  name: true,
  label: true,
  description: true,
})
  .extend({ path: z.string().min(1) })
  .strict();
export const MetadataSkillImportSchema = z.strictObject({
  candidates: MetadataSkillCandidateSchema.array(),
});

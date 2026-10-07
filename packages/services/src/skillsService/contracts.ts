export interface SkillImportCandidate {
  id: string;
  name: string;
  label: string;
  description: string;
  path: string;
}
export interface SkillImportPreview {
  candidates: SkillImportCandidate[];
  errors: string[];
}

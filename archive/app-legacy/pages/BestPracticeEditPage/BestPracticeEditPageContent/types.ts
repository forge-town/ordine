export interface ChecklistItemDraft {
  id: string;
  title: string;
  description: string;
  checkType: "script" | "llm";
  script: string;
  sortOrder: number;
  isNew: boolean;
  isDeleted: boolean;
  isDirty: boolean;
}

export interface CodeSnippetDraft {
  id: string;
  title: string;
  language: string;
  code: string;
  sortOrder: number;
  isNew: boolean;
  isDeleted: boolean;
  isDirty: boolean;
}

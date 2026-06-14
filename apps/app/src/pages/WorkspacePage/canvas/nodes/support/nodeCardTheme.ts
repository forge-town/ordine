/**
 * Semantic node theme names. Since the prototype-aligned restyle (N16-04) the
 * cards render monochrome (neutral icon chip + neutral IO handles), so themes
 * no longer map to colors; the name is still carried as `data-theme` on the
 * card root for tests and future accents.
 */
export type NodeTheme = "emerald" | "violet" | "amber" | "sky" | "orange" | "teal" | "indigo";

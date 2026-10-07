export const extractDescription = (body: string, frontmatterDescription?: string): string => {
  if (frontmatterDescription && frontmatterDescription.trim().length > 0) {
    return frontmatterDescription.trim();
  }

  const firstParagraph = body
    .split(/\n\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)[0];

  if (!firstParagraph) return "";

  return firstParagraph.replace(/^#{1,6}\s*/, "").trim();
};

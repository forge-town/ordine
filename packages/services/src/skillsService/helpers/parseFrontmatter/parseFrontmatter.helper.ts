export const parseFrontmatter = (content: string) => {
  if (!content.startsWith("---")) {
    return { fields: new Map<string, string>(), body: content.trim() };
  }

  const closeIndex = content.indexOf("\n---", 3);
  if (closeIndex < 0) {
    return { fields: new Map<string, string>(), body: content.trim() };
  }

  const frontmatterRaw = content.slice(3, closeIndex);
  const body = content.slice(closeIndex + 4).trim();
  const fields = new Map<string, string>();
  const lines = frontmatterRaw.split(/\r?\n/);

  const readBlockValue = (
    index: number,
    blockIndent: number,
    blockLines: string[],
  ): { nextIndex: number; value: string } => {
    if (index >= lines.length) {
      return { nextIndex: index, value: blockLines.join("\n").trim() };
    }

    const blockLine = lines[index];
    if (!blockLine) {
      return readBlockValue(index + 1, blockIndent, blockLines);
    }
    if (blockLine.trim().length === 0) {
      return readBlockValue(index + 1, blockIndent, [...blockLines, ""]);
    }

    const spaceMatch = blockLine.match(/^(\s*)/);
    const leadingSpaces = spaceMatch && spaceMatch[1] ? spaceMatch[1].length : 0;
    if (leadingSpaces < blockIndent) {
      return { nextIndex: index, value: blockLines.join("\n").trim() };
    }

    return readBlockValue(index + 1, blockIndent, [...blockLines, blockLine.slice(blockIndent)]);
  };

  const readField = (index: number): void => {
    if (index >= lines.length) {
      return;
    }

    const line = lines[index];
    if (!line) {
      readField(index + 1);

      return;
    }
    const separatorIndex = line.indexOf(":");
    if (separatorIndex < 0) {
      readField(index + 1);

      return;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();

    if (!key) {
      readField(index + 1);

      return;
    }

    if (rawValue === "|" || rawValue === ">") {
      const nextLine = lines[index + 1];
      const indentMatch = nextLine ? nextLine.match(/^(\s+)/) : null;
      const blockIndent = indentMatch && indentMatch[1] ? indentMatch[1].length : 2;
      const { nextIndex, value } = readBlockValue(index + 1, blockIndent, []);
      if (value) fields.set(key, value);
      readField(nextIndex);

      return;
    }

    const value = rawValue.replaceAll(/^["']|["']$/g, "");
    if (value) fields.set(key, value);
    readField(index + 1);
  };

  readField(0);

  return { fields, body };
};

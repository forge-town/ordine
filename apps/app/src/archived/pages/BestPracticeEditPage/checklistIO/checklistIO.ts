import { type Result, ok, err } from "neverthrow";
import { safeJsonParse } from "@/lib/safeJson";

export interface ChecklistExportItem {
  title: string;
  description: string;
  checkType: "script" | "llm";
  script: string | null;
  sortOrder: number;
}

export const toJson = (items: ChecklistExportItem[]): string => JSON.stringify(items, null, 2);

export const fromJson = (text: string): Result<ChecklistExportItem[], string> => {
  return safeJsonParse<unknown>(text)
    .mapErr(() => "Invalid JSON")
    .andThen((parsed) => {
      if (!Array.isArray(parsed)) return err("Expected an array");

      return ok(
        parsed.map((item: Record<string, unknown>, idx: number) => ({
          title: String(item.title ?? ""),
          description: String(item.description ?? ""),
          checkType: (item.checkType === "script" || item.checkType === "llm"
            ? item.checkType
            : "llm") as "script" | "llm",
          script: item.script == null ? null : String(item.script),
          sortOrder: typeof item.sortOrder === "number" ? item.sortOrder : idx,
        }))
      );
    });
};

const escapeCsvField = (value: string): string => {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
};

export const toCsv = (items: ChecklistExportItem[]): string => {
  const header = "title,description,checkType,script,sortOrder";
  const rows = items.map((item) =>
    [
      escapeCsvField(item.title),
      escapeCsvField(item.description),
      item.checkType,
      escapeCsvField(item.script ?? ""),
      String(item.sortOrder),
    ].join(",")
  );

  return [header, ...rows].join("\n");
};

export const fromCsv = (text: string): ChecklistExportItem[] => {
  if (!text.trim()) return [];

  const rows = parseCsvRows(text);
  if (rows.length < 2) return [];

  const items: ChecklistExportItem[] = [];

  for (const [i, fields] of rows.slice(1).entries()) {
    if (fields.length < 3) continue;
    items.push({
      title: fields[0] ?? "",
      description: fields[1] ?? "",
      checkType: fields[2] === "script" || fields[2] === "llm" ? fields[2] : "llm",
      script: fields[3] || null,
      sortOrder: Number(fields[4]) || i,
    });
  }

  return items;
};

const parseCsvRows = (text: string): string[][] => {
  const rows: string[][] = [];
  const state = { current: "", inQuotes: false, pos: 0 };
  const fields: string[] = [];

  while (state.pos < text.length) {
    const char = text[state.pos];
    if (state.inQuotes) {
      if (char === '"' && text[state.pos + 1] === '"') {
        state.current += '"';
        state.pos++;
      } else if (char === '"') {
        state.inQuotes = false;
      } else {
        state.current += char;
      }
    } else {
      if (char === '"') {
        state.inQuotes = true;
      } else if (char === ",") {
        fields.push(state.current);
        state.current = "";
      } else if (char === "\n" || char === "\r") {
        if (char === "\r" && text[state.pos + 1] === "\n") state.pos++;
        fields.push(state.current);
        state.current = "";
        if (fields.some((f) => f.trim())) rows.push([...fields]);
        fields.length = 0;
      } else {
        state.current += char;
      }
    }
    state.pos++;
  }

  fields.push(state.current);
  if (fields.some((f) => f.trim())) rows.push([...fields]);

  return rows;
};

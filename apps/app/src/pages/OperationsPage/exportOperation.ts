import type { Operation } from "@repo/schemas";

export const exportOperation = (op: Operation) => {
  const data = JSON.stringify(op, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${op.name.replaceAll(/\s+/g, "-").toLowerCase()}.operation.json`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

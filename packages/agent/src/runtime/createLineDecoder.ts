export type LineHandler = (line: string) => void;

/**
 * Incrementally decodes UTF-8 bytes and emits complete lines. The TextDecoder
 * retains split multibyte code points between chunks; flush emits a final line
 * even when the process exits without a trailing newline.
 */
export const createLineDecoder = (onLine: LineHandler) => {
  const decoder = new TextDecoder("utf-8", { fatal: false });
  const state = { buffer: "" };

  const drain = (): void => {
    const lines = state.buffer.split("\n");
    state.buffer = lines.pop() ?? "";
    for (const line of lines) {
      onLine(line.endsWith("\r") ? line.slice(0, -1) : line);
    }
  };

  return {
    feed(chunk: Uint8Array | string): void {
      state.buffer += typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
      drain();
    },
    flush(): void {
      state.buffer += decoder.decode();
      drain();
      if (state.buffer.length > 0) {
        onLine(state.buffer.endsWith("\r") ? state.buffer.slice(0, -1) : state.buffer);
      }
      state.buffer = "";
    },
  };
};

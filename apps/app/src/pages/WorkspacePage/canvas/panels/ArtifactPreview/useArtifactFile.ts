import { useEffect, useState } from "react";
import type { ArtifactFileLoader, ArtifactFileLoadResult } from "./types";

export type ArtifactFileState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: ArtifactFileLoadResult };

/** 通过注入的 loader 拉取单文件内容；filePath/loader 缺失视为 error。 */
export const useArtifactFile = (
  filePath: string | null,
  loadFile?: ArtifactFileLoader,
): ArtifactFileState => {
  const [state, setState] = useState<ArtifactFileState>({ status: "loading" });

  useEffect(() => {
    if (!filePath || !loadFile) {
      setState({ status: "error" });

      return;
    }
    const token = { active: true };
    setState({ status: "loading" });
    loadFile(filePath)
      .then((data) => {
        if (token.active) setState({ status: "ready", data });
      })
      .catch(() => {
        if (token.active) setState({ status: "error" });
      });

    return () => {
      token.active = false;
    };
  }, [filePath, loadFile]);

  return state;
};

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ServerGate } from "./components/ServerGate";
import { DesktopWorkspace } from "./components/DesktopWorkspace";
import "./plugins/init";
import "./lib/i18n";
import "./styles.css";

const rootElement = document.querySelector("#root");
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <ServerGate>
        <DesktopWorkspace />
      </ServerGate>
    </StrictMode>,
  );
}

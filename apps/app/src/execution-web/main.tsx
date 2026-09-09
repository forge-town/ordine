import { createRoot } from "react-dom/client";
import { ExecutionWebApp } from "./ExecutionWebApp";
import "../styles.css";

const element = document.querySelector("#root");
if (!element) throw new Error("Execution root element is missing");
createRoot(element).render(<ExecutionWebApp />);

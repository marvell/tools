import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MermaidViewer } from "./MermaidViewer";

const elem = document.getElementById("root")!;
const app = (
  <StrictMode>
    <MermaidViewer />
  </StrictMode>
);

if (import.meta.hot) {
  const root = (import.meta.hot.data.root ??= createRoot(elem));
  root.render(app);
} else {
  createRoot(elem).render(app);
}

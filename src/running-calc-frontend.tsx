/**
 * This file is the entry point for the Running Calculator app.
 * It sets up the root element and renders the RunningCalc component to the DOM.
 *
 * It is included in `src/running-calc.html`.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RunningCalc } from "./RunningCalc";

const elem = document.getElementById("root")!;
const app = (
  <StrictMode>
    <RunningCalc />
  </StrictMode>
);

if (import.meta.hot) {
  // With hot module reloading, `import.meta.hot.data` is persisted.
  const root = (import.meta.hot.data.root ??= createRoot(elem));
  root.render(app);
} else {
  // The hot module reloading API is not available in production.
  createRoot(elem).render(app);
}

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { StreamAssembler } from "./StreamAssembler";

const elem = document.getElementById("root")!;
const app = (
  <StrictMode>
    <StreamAssembler />
  </StrictMode>
);

if (import.meta.hot) {
  const root = (import.meta.hot.data.root ??= createRoot(elem));
  root.render(app);
} else {
  createRoot(elem).render(app);
}

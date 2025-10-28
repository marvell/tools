/**
 * This file is the entry point for the YouTube Transcript app.
 * It sets up the root element and renders the YouTubeTranscript component to the DOM.
 *
 * It is included in `src/youtube-transcript.html`.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { YouTubeTranscript } from "./YouTubeTranscript";

const elem = document.getElementById("root")!;
const app = (
  <StrictMode>
    <YouTubeTranscript />
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

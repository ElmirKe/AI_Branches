import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Root from "./Root";
import "@fontsource-variable/onest";
import "@fontsource-variable/jetbrains-mono";
import "./styles.css";
import "./design.css";
import "./brand.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);

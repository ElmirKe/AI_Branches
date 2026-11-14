import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
  // GitHub Pages открывает сайт по адресу /AI_Branches/, Vercel — от корня
  base: process.env.GH_PAGES ? "/AI_Branches/" : "/",
  plugins: [react()],
});

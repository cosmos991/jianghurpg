import { defineConfig } from "vite";

export default defineConfig({
  // Relative URLs also work when hosted under /jianghurpg/ on GitHub Pages.
  base: "./",
  build: { target: "es2022" },
});

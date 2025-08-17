import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Replace with your repo name
const repoName = "photo_matcher";

export default defineConfig({
  plugins: [react()],
  base: `/${repoName}/`,  // 👈 this is important
});
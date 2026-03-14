import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const REPO_NAME = "cargotrack";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: `/${REPO_NAME}/`,
  build: {
    outDir: "dist",
  },
});

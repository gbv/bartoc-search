import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

const base = process.env.VIRTUAL_PATH || "/";

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  base,
});

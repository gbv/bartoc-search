import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vite.dev/config/
export default defineConfig(() => {
  const allowedHosts = process.env.__VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS
    ?.split(",")
    .map((h) => h.trim()) || ["localhost"];

  return {
    plugins: [vue()],
    server: {
      allowedHosts,
    },
  };
});

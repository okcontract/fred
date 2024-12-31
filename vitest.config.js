import { defineConfig } from "vite";

export default defineConfig({
  test: {
     setupFiles: './vitest.setup.ts',
    // browser: {
    //   enabled: true,
    //   name: "chrome" // browser name is required
    // }
  }
});

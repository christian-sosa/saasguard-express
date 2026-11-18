import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createAuthHandler } from "./server/auth-server.js";
import { createSavingsHistoryHandler } from "./server/savings-history.js";

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ["SAASGUARD_", "DATABASE_URL"]), ...process.env };
  const serverAuth = env.SAASGUARD_SERVER_AUTH === "1" || Boolean(env.SAASGUARD_SESSION_SECRET);
  const auth = createAuthHandler({ env });
  const savingsHistory = createSavingsHistoryHandler({ env });

  function installServerRoutes(server) {
    if (!serverAuth) return;
    server.middlewares.use("/api/auth", auth);
    server.middlewares.use("/api/savings-history", savingsHistory);
  }

  return {
    define: { "import.meta.env.VITE_SAASGUARD_SERVER_AUTH": JSON.stringify(String(serverAuth)) },
    build: {
      outDir: "dist/client",
    },
    optimizeDeps: {
      include: ["react", "react-dom/client"],
    },
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      warmup: {
        clientFiles: ["./src/main.jsx"],
      },
    },
    plugins: [
      react(),
      { name: "saasguard-server-routes", configureServer: installServerRoutes, configurePreviewServer: installServerRoutes },
    ],
  };
});

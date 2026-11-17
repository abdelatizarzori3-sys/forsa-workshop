import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app";
import { environmentAuth } from "./auth";
import { databasePool, MysqlRepository } from "./mysql";

async function start() {
  const pool = databasePool();
  const app = createApp({ repository: new MysqlRepository(pool), authConfig: environmentAuth() });
  const server = createServer(app);
  if (process.env.NODE_ENV === "production") {
    const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "public");
    app.use(express.static(root, { index: false }));
    app.get(["/", "/workspace", "/404"], (_req, res) => { res.set("Cache-Control", "no-store").sendFile(path.join(root, "index.html")); });
    app.use((_req, res) => res.status(404).type("text").send("Not found"));
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({ configFile: path.resolve("vite.config.ts"), server: { middlewareMode: true, hmr: { server } }, appType: "spa" });
    app.use(vite.middlewares);
  }
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid PORT");
  server.listen(port, "0.0.0.0", () => console.log(`Forsa workspace listening on ${port}`));
  const close = () => server.close(() => { void pool.end().finally(() => process.exit(0)); });
  process.once("SIGTERM", close); process.once("SIGINT", close);
}
start().catch(error => { console.error("Forsa startup failed", error instanceof Error ? error.name : "UnknownError"); process.exitCode = 1; });

import { config } from "dotenv";
config({ path: ".env.local" });
config(); // fallback to .env
import { createMessageWorker } from "@/lib/queue/worker";

console.log("[Worker] Starting CES Connector worker...");

const worker = createMessageWorker();

// Graceful shutdown
async function shutdown() {
  console.log("[Worker] Shutting down gracefully...");
  await worker.close();
  console.log("[Worker] Worker closed.");
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

worker.on("ready", () => {
  console.log("[Worker] Worker is ready and listening for jobs.");
});

worker.on("error", (err) => {
  console.error("[Worker] Worker error:", err);
});

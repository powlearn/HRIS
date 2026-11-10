#!/usr/bin/env node
/**
 * Local development PostgreSQL server.
 *
 * NexaHR targets PostgreSQL. In environments without a system Postgres or
 * Docker daemon, this helper runs a real PostgreSQL server from userland
 * binaries (embedded-postgres) so the app can be migrated, seeded and tested.
 * Production deployments use the `db` service from docker-compose.yml instead.
 *
 * Usage: node scripts/local-db.mjs [start|stop|status]
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, ".data", "pg");
const PID_FILE = path.join(ROOT, ".data", "pg.pid");
const PORT = Number(process.env.LOCAL_PG_PORT ?? 5432);
const USER = process.env.LOCAL_PG_USER ?? "nexahr";
const PASSWORD = process.env.LOCAL_PG_PASSWORD ?? "nexahr";
const DATABASE = process.env.LOCAL_PG_DATABASE ?? "nexahr";

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.setTimeout(800, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function start() {
  if (await portOpen(PORT)) {
    console.log(`PostgreSQL sudah berjalan di port ${PORT}.`);
    return;
  }
  mkdirSync(path.join(ROOT, ".data"), { recursive: true });
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: USER,
    password: PASSWORD,
    port: PORT,
    persistent: true,
  });

  if (!existsSync(path.join(DATA_DIR, "PG_VERSION"))) {
    console.log("Menginisialisasi cluster PostgreSQL…");
    await pg.initialise();
  }
  await pg.start();
  try {
    await pg.createDatabase(DATABASE);
  } catch (error) {
    if (!String(error).includes("already exists")) throw error;
  }
  writeFileSync(PID_FILE, String(process.pid));
  console.log(`PostgreSQL siap: postgresql://${USER}:***@localhost:${PORT}/${DATABASE}`);

  const shutdown = async () => {
    try {
      await pg.stop();
    } finally {
      rmSync(PID_FILE, { force: true });
      process.exit(0);
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  // Keep the server process (and its child postmaster) alive.
  setInterval(() => {}, 1 << 30).unref();
  await new Promise(() => {});
}

function stop() {
  if (!existsSync(PID_FILE)) {
    console.log("Tidak ada PID server lokal. Jika server masih hidup, hentikan proses postgres secara manual.");
    return;
  }
  const pid = Number(readFileSync(PID_FILE, "utf8").trim());
  try {
    process.kill(pid, "SIGTERM");
    console.log(`Menghentikan PostgreSQL (pid ${pid})…`);
  } catch {
    console.log("Proses sudah tidak aktif.");
  }
  rmSync(PID_FILE, { force: true });
}

const command = process.argv[2] ?? "start";
if (command === "start") await start();
else if (command === "stop") stop();
else if (command === "status") console.log((await portOpen(PORT)) ? `aktif di port ${PORT}` : "tidak aktif");
else {
  console.error("Perintah tidak dikenal. Gunakan start|stop|status.");
  process.exit(1);
}

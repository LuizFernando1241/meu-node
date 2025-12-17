const { createClient } = require("@libsql/client");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "change-me";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const STATE_KEY = process.env.STATE_KEY || "state";
const TURSO_URL = process.env.TURSO_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || "";

if (!TURSO_URL) {
  console.error("Missing TURSO_URL.");
  process.exit(1);
}

const client = createClient({
  url: TURSO_URL,
  authToken: TURSO_AUTH_TOKEN,
});

app.use(
  cors({
    origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(",").map((o) => o.trim()),
    methods: ["GET", "PUT", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-API-Key"],
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use((req, res, next) => {
  if (req.method === "OPTIONS") return res.sendStatus(204);
  if (req.path === "/health") return next();
  const key = req.get("x-api-key");
  if (!API_KEY || key === API_KEY) return next();
  return res.status(401).json({ error: "unauthorized" });
});

app.get("/state", async (_req, res) => {
  try {
    const row = await getStateRow();
    if (!row) return res.status(404).json({ error: "empty" });
    const parsed = safeJsonParse(row.value);
    if (!parsed) return res.status(500).json({ error: "invalid_state" });
    res.json({ state: parsed, updatedAt: Number(row.updated_at) || Date.now() });
  } catch (error) {
    res.status(500).json({ error: "db_error" });
  }
});

app.put("/state", async (req, res) => {
  const incoming = req.body && typeof req.body === "object" ? req.body : null;
  const incomingState = incoming && incoming.state ? incoming.state : incoming;
  if (!incomingState || typeof incomingState !== "object") {
    return res.status(400).json({ error: "invalid_payload" });
  }

  const incomingUpdatedAt =
    incoming && Number.isFinite(incoming.updatedAt) ? incoming.updatedAt : Date.now();

  try {
    await setStateRow(incomingState, incomingUpdatedAt);
    res.json({ ok: true, updatedAt: incomingUpdatedAt });
  } catch (error) {
    res.status(500).json({ error: "db_error" });
  }
});

start().catch((error) => {
  console.error("Failed to start API.", error);
  process.exit(1);
});

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`API pronta na porta ${PORT}`);
  });
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (err) {
    return null;
  }
}

async function initDb() {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
}

async function getStateRow() {
  const result = await client.execute({
    sql: "SELECT value, updated_at FROM kv WHERE key = ?",
    args: [STATE_KEY],
  });
  return result.rows && result.rows[0] ? result.rows[0] : null;
}

async function setStateRow(state, updatedAt) {
  await client.execute({
    sql:
      "INSERT INTO kv (key, value, updated_at) VALUES (?, ?, ?) " +
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    args: [STATE_KEY, JSON.stringify(state), updatedAt],
  });
}

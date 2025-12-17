const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.API_KEY || "change-me";
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data.db");
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const STATE_KEY = process.env.STATE_KEY || "state";

ensureDbDir(DB_PATH);
const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS kv (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  );
`);

const stmtGet = db.prepare("SELECT value, updated_at FROM kv WHERE key = ?");
const stmtSet = db.prepare(
  "INSERT INTO kv (key, value, updated_at) VALUES (@key, @value, @updated_at) " +
    "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
);

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

app.get("/state", (_req, res) => {
  const row = stmtGet.get(STATE_KEY);
  if (!row) return res.status(404).json({ error: "empty" });
  const parsed = safeJsonParse(row.value);
  if (!parsed) return res.status(500).json({ error: "invalid_state" });
  res.json({ state: parsed, updatedAt: row.updated_at });
});

app.put("/state", (req, res) => {
  const incoming = req.body && typeof req.body === "object" ? req.body : null;
  const incomingState = incoming && incoming.state ? incoming.state : incoming;
  if (!incomingState || typeof incomingState !== "object") {
    return res.status(400).json({ error: "invalid_payload" });
  }

  const incomingUpdatedAt =
    incoming && Number.isFinite(incoming.updatedAt) ? incoming.updatedAt : Date.now();

  stmtSet.run({
    key: STATE_KEY,
    value: JSON.stringify(incomingState),
    updated_at: incomingUpdatedAt,
  });

  res.json({ ok: true, updatedAt: incomingUpdatedAt });
});

app.listen(PORT, () => {
  console.log(`API pronta na porta ${PORT}`);
});

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch (err) {
    return null;
  }
}

function ensureDbDir(dbPath) {
  const dir = path.dirname(dbPath);
  if (!dir || dir === ".") return;
  fs.mkdirSync(dir, { recursive: true });
}

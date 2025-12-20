const { createClient } = require("@libsql/client");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const STATE_KEY = process.env.STATE_KEY || "state";
const API_KEY = process.env.API_KEY || "sua-chave";
const DEFAULT_USER_ID = process.env.DEFAULT_USER_ID || "single-user";
const TURSO_URL = process.env.TURSO_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || "";

if (!TURSO_URL) {
  console.error("Missing TURSO_URL.");
  process.exit(1);
}

const client = createClient({
  url: TURSO_URL,
  authToken: TURSO_AUTH_TOKEN
});

app.use(
  cors({
    origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(",").map((o) => o.trim()),
    methods: ["GET", "POST", "PUT", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-API-Key"]
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(express.static("public"));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/", (req, res) => {
  res.send("Servidor funcionando!");
});

app.use(authRequired);

app.get("/state", async (req, res) => {
  try {
    let row = await getStateRow(req.userId);
    if (!row) {
      row = await getAnyStateRow();
    }
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

  try {
    const baseUpdatedAt =
      incoming && Number.isFinite(incoming.baseUpdatedAt) ? incoming.baseUpdatedAt : null;
    if (Number.isFinite(baseUpdatedAt)) {
      const existing = await getStateRow(req.userId);
      if (existing && Number(existing.updated_at) > baseUpdatedAt) {
        const parsed = safeJsonParse(existing.value);
        if (!parsed) {
          return res.status(500).json({ error: "invalid_state" });
        }
        const existingUpdatedAt = Number(existing.updated_at) || Date.now();
        return res
          .status(409)
          .json({ error: "conflict", state: parsed, updatedAt: existingUpdatedAt });
      }
    }
    const updatedAt = Date.now();
    await setStateRow(req.userId, incomingState, updatedAt);
    res.json({ ok: true, updatedAt });
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

function authRequired(req, res, next) {
  if (req.method === "OPTIONS") return res.sendStatus(204);
  const apiKey = req.get("x-api-key") || "";
  if (API_KEY && apiKey !== API_KEY) {
    return res.status(401).json({ error: "unauthorized" });
  }
  req.userId = DEFAULT_USER_ID;
  return next();
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
    CREATE TABLE IF NOT EXISTS kv_user (
      user_id TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, key)
    );
  `);

  await client.execute(`CREATE INDEX IF NOT EXISTS kv_user_user_id ON kv_user (user_id);`);
}

async function getStateRow(userId) {
  const result = await client.execute({
    sql: "SELECT value, updated_at FROM kv_user WHERE user_id = ? AND key = ?",
    args: [userId, STATE_KEY]
  });
  return result.rows && result.rows[0] ? result.rows[0] : null;
}

async function getAnyStateRow() {
  const result = await client.execute({
    sql: "SELECT user_id, value, updated_at FROM kv_user WHERE key = ? ORDER BY updated_at DESC LIMIT 1",
    args: [STATE_KEY]
  });
  return result.rows && result.rows[0] ? result.rows[0] : null;
}

async function setStateRow(userId, state, updatedAt) {
  await client.execute({
    sql:
      "INSERT INTO kv_user (user_id, key, value, updated_at) VALUES (?, ?, ?, ?) " +
      "ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    args: [userId, STATE_KEY, JSON.stringify(state), updatedAt]
  });
}

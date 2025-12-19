const { createClient } = require("@libsql/client");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const STATE_KEY = process.env.STATE_KEY || "state";
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "30d";
const PASSWORD_MIN = Number(process.env.PASSWORD_MIN) || 6;
const TURSO_URL = process.env.TURSO_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || "";

if (!TURSO_URL) {
  console.error("Missing TURSO_URL.");
  process.exit(1);
}

if (!JWT_SECRET) {
  console.error("Missing JWT_SECRET.");
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
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/auth/register", async (req, res) => {
  const name = normalizeName(req.body && req.body.name);
  const email = normalizeEmail(req.body && req.body.email);
  const password = String((req.body && req.body.password) || "");

  if (!name || !email || !password) {
    return res.status(400).json({ error: "invalid_payload" });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "invalid_email" });
  }
  if (password.length < PASSWORD_MIN) {
    return res.status(400).json({ error: "weak_password" });
  }

  try {
    const existing = await getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "email_taken" });
    }

    const userId = randomUUID();
    const passwordHash = await bcrypt.hash(password, 10);
    await createUser({
      id: userId,
      name,
      email,
      passwordHash,
      createdAt: Date.now()
    });

    const token = issueToken(userId);
    res.status(201).json({ token, user: { id: userId, name, email } });
  } catch (error) {
    res.status(500).json({ error: "db_error" });
  }
});

app.post("/auth/login", async (req, res) => {
  const email = normalizeEmail(req.body && req.body.email);
  const password = String((req.body && req.body.password) || "");

  if (!email || !password) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  try {
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "invalid_credentials" });
    }
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "invalid_credentials" });
    }
    const token = issueToken(user.id);
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (error) {
    res.status(500).json({ error: "db_error" });
  }
});

app.use(authRequired);

app.get("/state", async (req, res) => {
  try {
    const row = await getStateRow(req.userId);
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
    await setStateRow(req.userId, incomingState, incomingUpdatedAt);
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

function normalizeName(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function issueToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function authRequired(req, res, next) {
  if (req.method === "OPTIONS") return res.sendStatus(204);
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: "unauthorized" });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (!payload || !payload.sub) {
      return res.status(401).json({ error: "unauthorized" });
    }
    req.userId = payload.sub;
    return next();
  } catch (error) {
    return res.status(401).json({ error: "unauthorized" });
  }
}

function getBearerToken(req) {
  const header = req.get("authorization") || "";
  if (!header.startsWith("Bearer ")) {
    return "";
  }
  return header.slice(7).trim();
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
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

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

async function getUserByEmail(email) {
  const result = await client.execute({
    sql: "SELECT id, name, email, password_hash FROM users WHERE email = ?",
    args: [email]
  });
  return result.rows && result.rows[0] ? result.rows[0] : null;
}

async function createUser(user) {
  await client.execute({
    sql: "INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)",
    args: [user.id, user.name, user.email, user.passwordHash, user.createdAt]
  });
}

async function getStateRow(userId) {
  const result = await client.execute({
    sql: "SELECT value, updated_at FROM kv_user WHERE user_id = ? AND key = ?",
    args: [userId, STATE_KEY]
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

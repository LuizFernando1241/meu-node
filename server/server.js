const { createClient } = require("@libsql/client");
const cors = require("cors");
const crypto = require("crypto");
const express = require("express");
require("dotenv").config();

const app = express();

const PORT = process.env.PORT || 3000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "https://luizfernando1241.github.io";
const APP_PIN = Object.prototype.hasOwnProperty.call(process.env, "APP_PIN")
  ? process.env.APP_PIN
  : "meu-node-2025-abc123";
const TURSO_URL = process.env.TURSO_URL;
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || "";

const TASK_STATUSES = new Set(["todo", "doing", "done"]);
const TASK_PRIORITIES = new Set(["low", "normal", "high"]);
const PROJECT_STATUSES = new Set(["active", "paused", "done"]);
const INBOX_TYPES = new Set(["task", "note", "event"]);

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
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-APP-PIN"]
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/v1/health", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

const api = express.Router();
api.use(requirePin);

api.get("/tasks", listTasks);
api.post("/tasks", upsertTask);
api.patch("/tasks/:id", patchTask);
api.delete("/tasks/:id", deleteTask);

api.get("/events", listEvents);
api.post("/events", upsertEvent);
api.patch("/events/:id", patchEvent);
api.delete("/events/:id", deleteEvent);

api.get("/areas", listAreas);
api.post("/areas", upsertArea);
api.delete("/areas/:id", deleteArea);

api.get("/projects", listProjects);
api.post("/projects", upsertProject);
api.patch("/projects/:id", patchProject);

api.get("/inbox", listInbox);
api.post("/inbox", createInboxItem);
api.post("/inbox/:id/process", processInboxItem);
api.delete("/inbox/:id", deleteInboxItem);

api.get("/notes", listNotes);
api.get("/notes/:id", getNote);
api.post("/notes", upsertNote);
api.patch("/notes/:id", patchNote);
api.delete("/notes/:id", deleteNote);

api.get("/search", searchAll);

app.use("/v1", api);

start().catch((error) => {
  console.error("Failed to start API.", error);
  process.exit(1);
});

async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`API ready on port ${PORT}`);
  });
}

function requirePin(req, res, next) {
  if (req.method === "OPTIONS") return res.sendStatus(204);
  if (!APP_PIN) return next();
  const pin = req.get("x-app-pin") || "";
  if (pin !== APP_PIN) {
    return res.status(401).json({ error: "unauthorized" });
  }
  return next();
}

function createId(prefix) {
  if (typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value) {
  const text = asString(value);
  return text ? text : null;
}

function asNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function inferInboxType(text) {
  const value = (text || "").toLowerCase();
  if (value.startsWith("nota:")) return "note";
  if (/\b(\d{1,2}h|\d{1,2}:\d{2})\b/.test(value)) return "event";
  return "task";
}

function mapTaskRow(row) {
  return {
    id: row.id,
    areaId: row.area_id || null,
    projectId: row.project_id || null,
    title: row.title,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date || "",
    scheduledAt: row.scheduled_at || "",
    durationMin: row.duration_min,
    notes: row.notes || "",
    focus: row.focus ? 1 : 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at
  };
}

function mapEventRow(row) {
  return {
    id: row.id,
    title: row.title,
    startAt: row.start_at,
    endAt: row.end_at,
    location: row.location || "",
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapAreaRow(row) {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order
  };
}

function mapProjectRow(row) {
  return {
    id: row.id,
    areaId: row.area_id || null,
    title: row.title,
    objective: row.objective || "",
    status: row.status,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapNoteRow(row) {
  return {
    id: row.id,
    areaId: row.area_id || null,
    projectId: row.project_id || null,
    title: row.title,
    contentJson: row.content_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapInboxRow(row) {
  return {
    id: row.id,
    rawText: row.raw_text,
    inferredType: row.inferred_type || "task",
    createdAt: row.created_at
  };
}

async function listTasks(req, res) {
  try {
    const { status, from, to, projectId, areaId } = req.query;
    const where = [];
    const args = [];
    if (status) {
      if (!TASK_STATUSES.has(status)) {
        return res.status(400).json({ error: "invalid_status" });
      }
      where.push("status = ?");
      args.push(status);
    }
    if (projectId) {
      where.push("project_id = ?");
      args.push(projectId);
    }
    if (areaId) {
      where.push("area_id = ?");
      args.push(areaId);
    }
    if (from || to) {
      const fromVal = asString(from) || "0000-01-01";
      const toVal = asString(to) || "9999-12-31";
      where.push("(due_date BETWEEN ? AND ? OR substr(scheduled_at, 1, 10) BETWEEN ? AND ?)");
      args.push(fromVal, toVal, fromVal, toVal);
    }
    let sql = "SELECT * FROM tasks";
    if (where.length) {
      sql += ` WHERE ${where.join(" AND ")}`;
    }
    sql += " ORDER BY updated_at DESC";
    const result = await client.execute({ sql, args });
    res.json(result.rows.map(mapTaskRow));
  } catch (error) {
    console.error("Error in GET /tasks:", error);
    res.status(500).json({ error: "db_error" });
  }
}

async function upsertTask(req, res) {
  try {
    const body = req.body || {};
    const id = asString(body.id) || createId("task");
    const title = asString(body.title);
    if (!title) {
      return res.status(400).json({ error: "missing_title" });
    }
    const status = TASK_STATUSES.has(body.status) ? body.status : "todo";
    const priority = TASK_PRIORITIES.has(body.priority) ? body.priority : "normal";
    const dueDate = asNullableString(body.dueDate);
    const scheduledAt = asNullableString(body.scheduledAt);
    const durationMin = asNumber(body.durationMin);
    const areaId = asNullableString(body.areaId);
    const projectId = asNullableString(body.projectId);
    const notes = asString(body.notes);
    const focus = body.focus ? 1 : 0;
    const now = Date.now();

    const existing = await client.execute({
      sql: "SELECT created_at, completed_at FROM tasks WHERE id = ?",
      args: [id]
    });
    const existingRow = existing.rows && existing.rows[0] ? existing.rows[0] : null;
    const createdAt = existingRow ? existingRow.created_at : now;
    let completedAt = existingRow ? existingRow.completed_at : null;
    if (status === "done") {
      completedAt = completedAt || now;
    } else {
      completedAt = null;
    }

    await client.execute({
      sql:
        "INSERT INTO tasks (id, area_id, project_id, title, status, priority, due_date, scheduled_at, duration_min, notes, focus, created_at, updated_at, completed_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT(id) DO UPDATE SET " +
        "area_id = excluded.area_id, project_id = excluded.project_id, title = excluded.title, " +
        "status = excluded.status, priority = excluded.priority, due_date = excluded.due_date, " +
        "scheduled_at = excluded.scheduled_at, duration_min = excluded.duration_min, notes = excluded.notes, " +
        "focus = excluded.focus, updated_at = excluded.updated_at, completed_at = excluded.completed_at",
      args: [
        id,
        areaId,
        projectId,
        title,
        status,
        priority,
        dueDate,
        scheduledAt,
        durationMin,
        notes,
        focus,
        createdAt,
        now,
        completedAt
      ]
    });

    const result = await client.execute({
      sql: "SELECT * FROM tasks WHERE id = ?",
      args: [id]
    });
    res.json(mapTaskRow(result.rows[0]));
  } catch (error) {
    console.error("Error in POST /tasks:", error);
    res.status(500).json({ error: "db_error" });
  }
}

async function patchTask(req, res) {
  try {
    const id = asString(req.params.id);
    const existing = await client.execute({
      sql: "SELECT * FROM tasks WHERE id = ?",
      args: [id]
    });
    const row = existing.rows && existing.rows[0] ? existing.rows[0] : null;
    if (!row) {
      return res.status(404).json({ error: "not_found" });
    }
    const current = mapTaskRow(row);
    const body = req.body || {};
    const merged = {
      ...current,
      ...body,
      id
    };
    req.body = merged;
    return upsertTask(req, res);
  } catch (error) {
    console.error("Error in PATCH /tasks:", error);
    res.status(500).json({ error: "db_error" });
  }
}

async function deleteTask(req, res) {
  try {
    const id = asString(req.params.id);
    await client.execute({
      sql: "DELETE FROM tasks WHERE id = ?",
      args: [id]
    });
    res.sendStatus(204);
  } catch (error) {
    console.error("Error in DELETE /tasks:", error);
    res.status(500).json({ error: "db_error" });
  }
}

async function listEvents(req, res) {
  try {
    const { from, to } = req.query;
    const where = [];
    const args = [];
    if (from || to) {
      const fromVal = asString(from) || "0000-01-01";
      const toVal = asString(to) || "9999-12-31";
      where.push("substr(start_at, 1, 10) BETWEEN ? AND ?");
      args.push(fromVal, toVal);
    }
    let sql = "SELECT * FROM events";
    if (where.length) {
      sql += ` WHERE ${where.join(" AND ")}`;
    }
    sql += " ORDER BY start_at ASC";
    const result = await client.execute({ sql, args });
    res.json(result.rows.map(mapEventRow));
  } catch (error) {
    console.error("Error in GET /events:", error);
    res.status(500).json({ error: "db_error" });
  }
}

async function upsertEvent(req, res) {
  try {
    const body = req.body || {};
    const id = asString(body.id) || createId("event");
    const title = asString(body.title);
    if (!title) {
      return res.status(400).json({ error: "missing_title" });
    }
    const startAt = asString(body.startAt);
    const endAt = asString(body.endAt);
    if (!startAt || !endAt) {
      return res.status(400).json({ error: "missing_time" });
    }
    const location = asString(body.location);
    const notes = asString(body.notes);
    const now = Date.now();
    const existing = await client.execute({
      sql: "SELECT created_at FROM events WHERE id = ?",
      args: [id]
    });
    const existingRow = existing.rows && existing.rows[0] ? existing.rows[0] : null;
    const createdAt = existingRow ? existingRow.created_at : now;

    await client.execute({
      sql:
        "INSERT INTO events (id, title, start_at, end_at, location, notes, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT(id) DO UPDATE SET " +
        "title = excluded.title, start_at = excluded.start_at, end_at = excluded.end_at, " +
        "location = excluded.location, notes = excluded.notes, updated_at = excluded.updated_at",
      args: [id, title, startAt, endAt, location, notes, createdAt, now]
    });

    const result = await client.execute({
      sql: "SELECT * FROM events WHERE id = ?",
      args: [id]
    });
    res.json(mapEventRow(result.rows[0]));
  } catch (error) {
    console.error("Error in POST /events:", error);
    res.status(500).json({ error: "db_error" });
  }
}

async function patchEvent(req, res) {
  try {
    const id = asString(req.params.id);
    const existing = await client.execute({
      sql: "SELECT * FROM events WHERE id = ?",
      args: [id]
    });
    const row = existing.rows && existing.rows[0] ? existing.rows[0] : null;
    if (!row) {
      return res.status(404).json({ error: "not_found" });
    }
    const current = mapEventRow(row);
    const body = req.body || {};
    const merged = {
      ...current,
      ...body,
      id
    };
    req.body = merged;
    return upsertEvent(req, res);
  } catch (error) {
    console.error("Error in PATCH /events:", error);
    res.status(500).json({ error: "db_error" });
  }
}

async function deleteEvent(req, res) {
  try {
    const id = asString(req.params.id);
    await client.execute({
      sql: "DELETE FROM events WHERE id = ?",
      args: [id]
    });
    res.sendStatus(204);
  } catch (error) {
    console.error("Error in DELETE /events:", error);
    res.status(500).json({ error: "db_error" });
  }
}

async function listAreas(_req, res) {
  try {
    const result = await client.execute("SELECT * FROM areas ORDER BY sort_order ASC, name ASC");
    res.json(result.rows.map(mapAreaRow));
  } catch (error) {
    console.error("Error in GET /areas:", error);
    res.status(500).json({ error: "db_error" });
  }
}

async function upsertArea(req, res) {
  try {
    const body = req.body || {};
    const id = asString(body.id) || createId("area");
    const name = asString(body.name);
    if (!name) {
      return res.status(400).json({ error: "missing_name" });
    }
    const sortOrder = asNumber(body.sortOrder) || 0;
    await client.execute({
      sql:
        "INSERT INTO areas (id, name, sort_order) VALUES (?, ?, ?) " +
        "ON CONFLICT(id) DO UPDATE SET name = excluded.name, sort_order = excluded.sort_order",
      args: [id, name, sortOrder]
    });
    const result = await client.execute({
      sql: "SELECT * FROM areas WHERE id = ?",
      args: [id]
    });
    res.json(mapAreaRow(result.rows[0]));
  } catch (error) {
    console.error("Error in POST /areas:", error);
    res.status(500).json({ error: "db_error" });
  }
}

async function deleteArea(req, res) {
  try {
    const id = asString(req.params.id);
    await client.execute({
      sql: "DELETE FROM areas WHERE id = ?",
      args: [id]
    });
    res.sendStatus(204);
  } catch (error) {
    console.error("Error in DELETE /areas:", error);
    res.status(500).json({ error: "db_error" });
  }
}

async function listProjects(_req, res) {
  try {
    const result = await client.execute("SELECT * FROM projects ORDER BY sort_order ASC, updated_at DESC");
    res.json(result.rows.map(mapProjectRow));
  } catch (error) {
    console.error("Error in GET /projects:", error);
    res.status(500).json({ error: "db_error" });
  }
}

async function upsertProject(req, res) {
  try {
    const body = req.body || {};
    const id = asString(body.id) || createId("project");
    const title = asString(body.title);
    if (!title) {
      return res.status(400).json({ error: "missing_title" });
    }
    const status = PROJECT_STATUSES.has(body.status) ? body.status : "active";
    const objective = asString(body.objective);
    const areaId = asNullableString(body.areaId);
    const sortOrder = asNumber(body.sortOrder) || 0;
    const now = Date.now();

    const existing = await client.execute({
      sql: "SELECT created_at FROM projects WHERE id = ?",
      args: [id]
    });
    const existingRow = existing.rows && existing.rows[0] ? existing.rows[0] : null;
    const createdAt = existingRow ? existingRow.created_at : now;

    await client.execute({
      sql:
        "INSERT INTO projects (id, area_id, title, objective, status, sort_order, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT(id) DO UPDATE SET " +
        "area_id = excluded.area_id, title = excluded.title, objective = excluded.objective, " +
        "status = excluded.status, sort_order = excluded.sort_order, updated_at = excluded.updated_at",
      args: [id, areaId, title, objective, status, sortOrder, createdAt, now]
    });
    const result = await client.execute({
      sql: "SELECT * FROM projects WHERE id = ?",
      args: [id]
    });
    res.json(mapProjectRow(result.rows[0]));
  } catch (error) {
    console.error("Error in POST /projects:", error);
    res.status(500).json({ error: "db_error" });
  }
}

async function patchProject(req, res) {
  try {
    const id = asString(req.params.id);
    const existing = await client.execute({
      sql: "SELECT * FROM projects WHERE id = ?",
      args: [id]
    });
    const row = existing.rows && existing.rows[0] ? existing.rows[0] : null;
    if (!row) {
      return res.status(404).json({ error: "not_found" });
    }
    const current = mapProjectRow(row);
    const body = req.body || {};
    const merged = {
      ...current,
      ...body,
      id
    };
    req.body = merged;
    return upsertProject(req, res);
  } catch (error) {
    console.error("Error in PATCH /projects:", error);
    res.status(500).json({ error: "db_error" });
  }
}

async function listInbox(_req, res) {
  try {
    const result = await client.execute("SELECT * FROM inbox ORDER BY created_at DESC");
    res.json(result.rows.map(mapInboxRow));
  } catch (error) {
    console.error("Error in GET /inbox:", error);
    res.status(500).json({ error: "db_error" });
  }
}

async function createInboxItem(req, res) {
  try {
    const body = req.body || {};
    const rawText = asString(body.rawText || body.title);
    if (!rawText) {
      return res.status(400).json({ error: "missing_text" });
    }
    const inferredType = INBOX_TYPES.has(body.inferredType)
      ? body.inferredType
      : inferInboxType(rawText);
    const id = asString(body.id) || createId("inbox");
    const createdAt = Date.now();
    await client.execute({
      sql:
        "INSERT INTO inbox (id, raw_text, inferred_type, created_at) VALUES (?, ?, ?, ?) " +
        "ON CONFLICT(id) DO UPDATE SET raw_text = excluded.raw_text, inferred_type = excluded.inferred_type",
      args: [id, rawText, inferredType, createdAt]
    });
    const result = await client.execute({
      sql: "SELECT * FROM inbox WHERE id = ?",
      args: [id]
    });
    res.json(mapInboxRow(result.rows[0]));
  } catch (error) {
    console.error("Error in POST /inbox:", error);
    res.status(500).json({ error: "db_error" });
  }
}

async function processInboxItem(req, res) {
  try {
    const id = asString(req.params.id);
    const result = await client.execute({
      sql: "SELECT * FROM inbox WHERE id = ?",
      args: [id]
    });
    const row = result.rows && result.rows[0] ? result.rows[0] : null;
    if (!row) {
      return res.status(404).json({ error: "not_found" });
    }
    const body = req.body || {};
    const type = INBOX_TYPES.has(body.type) ? body.type : row.inferred_type || "task";
    const title = asString(body.title) || row.raw_text;
    let created = null;

    if (type === "note") {
      const noteId = createId("note");
      const now = Date.now();
      await client.execute({
        sql:
          "INSERT INTO notes (id, area_id, project_id, title, content_json, created_at, updated_at) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?)",
        args: [
          noteId,
          asNullableString(body.areaId),
          asNullableString(body.projectId),
          title,
          asString(body.contentJson || "[]"),
          now,
          now
        ]
      });
      const note = await client.execute({
        sql: "SELECT * FROM notes WHERE id = ?",
        args: [noteId]
      });
      created = mapNoteRow(note.rows[0]);
    } else if (type === "event") {
      const eventId = createId("event");
      const now = Date.now();
      const startAt = asString(body.startAt);
      const endAt = asString(body.endAt);
      if (!startAt || !endAt) {
        return res.status(400).json({ error: "missing_time" });
      }
      await client.execute({
        sql:
          "INSERT INTO events (id, title, start_at, end_at, location, notes, created_at, updated_at) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        args: [eventId, title, startAt, endAt, asString(body.location), asString(body.notes), now, now]
      });
      const event = await client.execute({
        sql: "SELECT * FROM events WHERE id = ?",
        args: [eventId]
      });
      created = mapEventRow(event.rows[0]);
    } else {
      const taskId = createId("task");
      const now = Date.now();
      await client.execute({
        sql:
          "INSERT INTO tasks (id, area_id, project_id, title, status, priority, due_date, scheduled_at, duration_min, notes, focus, created_at, updated_at, completed_at) " +
          "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        args: [
          taskId,
          asNullableString(body.areaId),
          asNullableString(body.projectId),
          title,
          TASK_STATUSES.has(body.status) ? body.status : "todo",
          TASK_PRIORITIES.has(body.priority) ? body.priority : "normal",
          asNullableString(body.dueDate),
          asNullableString(body.scheduledAt),
          asNumber(body.durationMin),
          asString(body.notes),
          body.focus ? 1 : 0,
          now,
          now,
          null
        ]
      });
      const task = await client.execute({
        sql: "SELECT * FROM tasks WHERE id = ?",
        args: [taskId]
      });
      created = mapTaskRow(task.rows[0]);
    }

    await client.execute({
      sql: "DELETE FROM inbox WHERE id = ?",
      args: [id]
    });
    res.json({ created, type });
  } catch (error) {
    console.error("Error in POST /inbox/:id/process:", error);
    res.status(500).json({ error: "db_error" });
  }
}

async function deleteInboxItem(req, res) {
  try {
    const id = asString(req.params.id);
    await client.execute({
      sql: "DELETE FROM inbox WHERE id = ?",
      args: [id]
    });
    res.sendStatus(204);
  } catch (error) {
    console.error("Error in DELETE /inbox:", error);
    res.status(500).json({ error: "db_error" });
  }
}

async function listNotes(req, res) {
  try {
    const { areaId, projectId, q } = req.query;
    const where = [];
    const args = [];
    if (areaId) {
      where.push("area_id = ?");
      args.push(areaId);
    }
    if (projectId) {
      where.push("project_id = ?");
      args.push(projectId);
    }
    if (q) {
      where.push("title LIKE ?");
      args.push(`%${q}%`);
    }
    let sql = "SELECT * FROM notes";
    if (where.length) {
      sql += ` WHERE ${where.join(" AND ")}`;
    }
    sql += " ORDER BY updated_at DESC";
    const result = await client.execute({ sql, args });
    res.json(result.rows.map(mapNoteRow));
  } catch (error) {
    console.error("Error in GET /notes:", error);
    res.status(500).json({ error: "db_error" });
  }
}

async function getNote(req, res) {
  try {
    const id = asString(req.params.id);
    const result = await client.execute({
      sql: "SELECT * FROM notes WHERE id = ?",
      args: [id]
    });
    const row = result.rows && result.rows[0] ? result.rows[0] : null;
    if (!row) {
      return res.status(404).json({ error: "not_found" });
    }
    res.json(mapNoteRow(row));
  } catch (error) {
    console.error("Error in GET /notes/:id:", error);
    res.status(500).json({ error: "db_error" });
  }
}

async function upsertNote(req, res) {
  try {
    const body = req.body || {};
    const id = asString(body.id) || createId("note");
    const title = asString(body.title);
    if (!title) {
      return res.status(400).json({ error: "missing_title" });
    }
    const contentJson = typeof body.contentJson === "string" ? body.contentJson : "[]";
    const areaId = asNullableString(body.areaId);
    const projectId = asNullableString(body.projectId);
    const now = Date.now();

    const existing = await client.execute({
      sql: "SELECT created_at FROM notes WHERE id = ?",
      args: [id]
    });
    const existingRow = existing.rows && existing.rows[0] ? existing.rows[0] : null;
    const createdAt = existingRow ? existingRow.created_at : now;

    await client.execute({
      sql:
        "INSERT INTO notes (id, area_id, project_id, title, content_json, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?) " +
        "ON CONFLICT(id) DO UPDATE SET " +
        "area_id = excluded.area_id, project_id = excluded.project_id, title = excluded.title, " +
        "content_json = excluded.content_json, updated_at = excluded.updated_at",
      args: [id, areaId, projectId, title, contentJson, createdAt, now]
    });
    const result = await client.execute({
      sql: "SELECT * FROM notes WHERE id = ?",
      args: [id]
    });
    res.json(mapNoteRow(result.rows[0]));
  } catch (error) {
    console.error("Error in POST /notes:", error);
    res.status(500).json({ error: "db_error" });
  }
}

async function patchNote(req, res) {
  try {
    const id = asString(req.params.id);
    const existing = await client.execute({
      sql: "SELECT * FROM notes WHERE id = ?",
      args: [id]
    });
    const row = existing.rows && existing.rows[0] ? existing.rows[0] : null;
    if (!row) {
      return res.status(404).json({ error: "not_found" });
    }
    const current = mapNoteRow(row);
    const body = req.body || {};
    const merged = {
      ...current,
      ...body,
      id
    };
    req.body = merged;
    return upsertNote(req, res);
  } catch (error) {
    console.error("Error in PATCH /notes:", error);
    res.status(500).json({ error: "db_error" });
  }
}

async function deleteNote(req, res) {
  try {
    const id = asString(req.params.id);
    await client.execute({
      sql: "DELETE FROM notes WHERE id = ?",
      args: [id]
    });
    res.sendStatus(204);
  } catch (error) {
    console.error("Error in DELETE /notes:", error);
    res.status(500).json({ error: "db_error" });
  }
}

async function searchAll(req, res) {
  try {
    const q = asString(req.query.q);
    if (!q) {
      return res.json({ tasks: [], events: [], projects: [], notes: [] });
    }
    const like = `%${q}%`;
    const [tasks, events, projects, notes] = await Promise.all([
      client.execute({ sql: "SELECT * FROM tasks WHERE title LIKE ? LIMIT 5", args: [like] }),
      client.execute({ sql: "SELECT * FROM events WHERE title LIKE ? LIMIT 5", args: [like] }),
      client.execute({ sql: "SELECT * FROM projects WHERE title LIKE ? LIMIT 5", args: [like] }),
      client.execute({ sql: "SELECT * FROM notes WHERE title LIKE ? LIMIT 5", args: [like] })
    ]);
    res.json({
      tasks: tasks.rows.map(mapTaskRow),
      events: events.rows.map(mapEventRow),
      projects: projects.rows.map(mapProjectRow),
      notes: notes.rows.map(mapNoteRow)
    });
  } catch (error) {
    console.error("Error in GET /search:", error);
    res.status(500).json({ error: "db_error" });
  }
}

async function initDb() {
  await client.execute("PRAGMA foreign_keys = ON;");

  await client.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);
  await client.execute({
    sql: "INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)",
    args: ["v1", Date.now()]
  });

  await client.execute(`
    CREATE TABLE IF NOT EXISTS areas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      area_id TEXT,
      title TEXT NOT NULL,
      objective TEXT,
      status TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      area_id TEXT,
      project_id TEXT,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      due_date TEXT,
      scheduled_at TEXT,
      duration_min INTEGER,
      notes TEXT,
      focus INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      completed_at INTEGER,
      FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );
  `);

  try {
    await client.execute("ALTER TABLE tasks ADD COLUMN focus INTEGER NOT NULL DEFAULT 0;");
  } catch (error) {
    // Column already exists.
  }

  await client.execute(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      location TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      area_id TEXT,
      project_id TEXT,
      title TEXT NOT NULL,
      content_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS inbox (
      id TEXT PRIMARY KEY,
      raw_text TEXT NOT NULL,
      inferred_type TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS relations (
      id TEXT PRIMARY KEY,
      from_type TEXT NOT NULL,
      from_id TEXT NOT NULL,
      to_type TEXT NOT NULL,
      to_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  await client.execute("CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks (status);");
  await client.execute("CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON tasks (due_date);");
  await client.execute("CREATE INDEX IF NOT EXISTS tasks_scheduled_at_idx ON tasks (scheduled_at);");
  await client.execute("CREATE INDEX IF NOT EXISTS events_start_at_idx ON events (start_at);");
  await client.execute("CREATE INDEX IF NOT EXISTS notes_updated_at_idx ON notes (updated_at);");
}

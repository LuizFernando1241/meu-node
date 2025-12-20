"use strict";

const STORAGE_KEY = "meu-node-v2";
const BASE_PATH = "/meu-node";
const SAVE_DEBOUNCE_MS = 250;
const WEEK_STARTS_MONDAY = true;
const DEFAULT_EVENT_DURATION = 60;
const TIME_STEP_MINUTES = 30;
const API_BASE_URL = "https://meu-node.onrender.com";
const APP_PIN_KEY = "lifeos-app-pin";
const DEFAULT_APP_PIN = "meu-node-2025-abc123";
const REMOTE_DEBOUNCE_MS = 600;

const STATUS_ORDER = ["todo", "doing", "done"];
const STATUS_LABELS = {
  todo: "A fazer",
  doing: "Fazendo",
  done: "Feito"
};

const PRIORITY_LABELS = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta"
};

const BLOCK_TYPES = [
  { value: "title", label: "Titulo" },
  { value: "text", label: "Texto" },
  { value: "heading", label: "Heading" },
  { value: "list", label: "Lista" },
  { value: "checklist", label: "Checklist" },
  { value: "table", label: "Tabela" },
  { value: "quote", label: "Quote" },
  { value: "divider", label: "Divisor" },
  { value: "embed", label: "Embed" }
];

const HOURS = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"];
const CALENDAR_START_HOUR = 7;
const CALENDAR_END_HOUR = 18;

const ROUTE_META = {
  today: { title: "Hoje", eyebrow: "Executar" },
  inbox: { title: "Inbox", eyebrow: "Capturar" },
  week: { title: "Semana", eyebrow: "Planejar" },
  calendar: { title: "Calendario", eyebrow: "Agenda" },
  projects: { title: "Projetos", eyebrow: "Visao macro" },
  project: { title: "Projeto", eyebrow: "Detalhe" },
  notes: { title: "Notas", eyebrow: "Conhecimento" },
  note: { title: "Nota", eyebrow: "Detalhe" },
  areas: { title: "Areas", eyebrow: "Estrutura" },
  area: { title: "Area", eyebrow: "Detalhe" }
};

const el = {
  appRoot: document.getElementById("appRoot"),
  globalSearch: document.getElementById("globalSearch"),
  searchClear: document.getElementById("searchClear"),
  createBtn: document.getElementById("createBtn"),
  commandBtn: document.getElementById("commandBtn"),
  helpBtn: document.getElementById("helpBtn"),
  countToday: document.getElementById("countToday"),
  countInbox: document.getElementById("countInbox"),
  countWeek: document.getElementById("countWeek"),
  countProjects: document.getElementById("countProjects"),
  countNotes: document.getElementById("countNotes"),
  pageEyebrow: document.getElementById("pageEyebrow"),
  pageTitle: document.getElementById("pageTitle"),
  pageActions: document.getElementById("pageActions"),
  viewRoot: document.getElementById("viewRoot"),
  detailsPanel: document.getElementById("detailsPanel"),
  detailsTitle: document.getElementById("detailsTitle"),
  detailsBody: document.getElementById("detailsBody"),
  detailsClose: document.getElementById("detailsClose"),
  detailsToggle: document.getElementById("detailsToggle"),
  detailsBackdrop: document.getElementById("detailsBackdrop"),
  modalBackdrop: document.getElementById("modalBackdrop"),
  modalEyebrow: document.getElementById("modalEyebrow"),
  modalTitle: document.getElementById("modalTitle"),
  modalBody: document.getElementById("modalBody"),
  modalClose: document.getElementById("modalClose"),
  modalCancel: document.getElementById("modalCancel"),
  modalSave: document.getElementById("modalSave"),
  modalDelete: document.getElementById("modalDelete"),
  commandPalette: document.getElementById("commandPalette"),
  commandInput: document.getElementById("commandInput"),
  commandList: document.getElementById("commandList"),
  toastContainer: document.getElementById("toastContainer"),
  offlineBanner: document.getElementById("offlineBanner"),
  mobileCreateBtn: document.getElementById("mobileCreateBtn")
};

const modalState = {
  onSave: null,
  onDelete: null,
  previousFocus: null
};

const commandState = {
  open: false,
  index: 0,
  filtered: [],
  previousFocus: null
};

let state = normalizeState(loadState());
let saveTimer = null;
let syncTimer = null;
let syncBusy = false;
let syncPending = false;
let syncReady = false;
let suppressSync = false;
let lastSyncErrorAt = 0;
let searchTimer = null;

const pendingDeletes = {
  tasks: new Set(),
  events: new Set(),
  notes: new Set(),
  projects: new Set(),
  areas: new Set(),
  inbox: new Set()
};

async function init() {
  if (DEFAULT_APP_PIN && localStorage.getItem(APP_PIN_KEY) === null) {
    localStorage.setItem(APP_PIN_KEY, DEFAULT_APP_PIN);
  }
  bindEvents();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch((error) => {
      console.warn("Service worker registration failed.", error);
    });
  }
  applyRouteFromLocation();
  scheduleSearch(state.ui.search);
  renderAll();
  await loadRemoteState();
}

init().catch((error) => {
  console.error("Failed to init app.", error);
});

function bindEvents() {
  if (el.globalSearch) {
    el.globalSearch.addEventListener("input", () => {
      state.ui.search = el.globalSearch.value;
      scheduleSearch(state.ui.search);
      saveStateDebounced();
      renderAll();
    });
  }

  if (el.searchClear) {
    el.searchClear.addEventListener("click", () => {
      state.ui.search = "";
      state.ui.searchResults = null;
      state.ui.searching = false;
      state.ui.lastSearchQuery = "";
      if (el.globalSearch) {
        el.globalSearch.value = "";
      }
      saveState();
      renderAll();
    });
  }

  if (el.createBtn) {
    el.createBtn.addEventListener("click", openCreateChooser);
  }
  if (el.mobileCreateBtn) {
    el.mobileCreateBtn.addEventListener("click", openCreateChooser);
  }
  if (el.commandBtn) {
    el.commandBtn.addEventListener("click", openCommandPalette);
  }
  if (el.helpBtn) {
    el.helpBtn.addEventListener("click", openHelpModal);
  }

  document.querySelectorAll("[data-route]").forEach((node) => {
    node.addEventListener("click", () => {
      const route = node.dataset.route;
      if (route) {
        navigate(route);
      }
    });
  });

  if (el.detailsClose) {
    el.detailsClose.addEventListener("click", clearSelection);
  }
  if (el.detailsToggle) {
    el.detailsToggle.addEventListener("click", (ev) => {
      ev.stopPropagation();
      toggleDetailsMinimize();
    });
  }
  if (el.detailsBackdrop) {
    el.detailsBackdrop.addEventListener("click", clearSelection);
  }

  if (el.modalClose) {
    el.modalClose.addEventListener("click", closeModal);
  }
  if (el.modalCancel) {
    el.modalCancel.addEventListener("click", closeModal);
  }
  if (el.modalSave) {
    el.modalSave.addEventListener("click", handleModalSave);
  }
  if (el.modalDelete) {
    el.modalDelete.addEventListener("click", handleModalDelete);
  }
  if (el.modalBackdrop) {
    el.modalBackdrop.addEventListener("click", (event) => {
      if (event.target === el.modalBackdrop) {
        closeModal();
      }
    });
  }

  document.addEventListener("keydown", handleGlobalShortcuts);
  document.addEventListener("click", handleGlobalClick);
  // Hide details panel on mobile when scrolling/touch-moving to avoid it covering content
  window.addEventListener("scroll", handleMobileScroll, { passive: true });
  window.addEventListener("touchmove", handleMobileScroll, { passive: true });
  window.addEventListener("popstate", handlePopState);
  window.addEventListener("online", updateConnectionStatus);
  window.addEventListener("offline", updateConnectionStatus);
  updateConnectionStatus();
}

function handleGlobalShortcuts(event) {
  if (commandState.open) {
    handleCommandPaletteKeydown(event);
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openCommandPalette();
    return;
  }

  if (isModalOpen()) {
    if (event.key === "Escape") {
      closeModal();
    }
    if (event.key === "Tab") {
      trapTabKey(event);
    }
    return;
  }

  handleInboxShortcuts(event);
}

function handleGlobalClick(event) {
  if (commandState.open && el.commandPalette) {
    const card = el.commandPalette.querySelector(".command-card");
    if (card && !card.contains(event.target)) {
      closeCommandPalette();
    }
  }
}

function handlePopState() {
  state.ui.route = normalizePath(window.location.pathname);
  saveState();
  renderAll();
}

function applyRouteFromLocation() {
  const query = new URLSearchParams(window.location.search);
  const forwarded = query.get("path");
  if (forwarded) {
    history.replaceState({}, "", toPublicPath(normalizePath(forwarded)));
  }
  const path = normalizePath(stripBasePath(window.location.pathname));
  const route = parseRoute(path);
  if (!route) {
    navigate("/today", { replace: true });
    return;
  }
  state.ui.route = path;
  saveState();
}

function navigate(path, options = {}) {
  const normalized = normalizePath(path);
  const route = parseRoute(normalized);
  if (!route) {
    return;
  }
  state.ui.route = normalized;
  const publicPath = toPublicPath(normalized);
  if (options.replace) {
    history.replaceState({}, "", publicPath);
  } else {
    history.pushState({}, "", publicPath);
  }
  saveState();
  renderAll();
}

function normalizePath(path) {
  if (!path || path === "/") {
    return "/today";
  }
  let cleaned = path.trim();
  if (!cleaned.startsWith("/")) {
    cleaned = `/${cleaned}`;
  }
  cleaned = cleaned.replace(/\/+$/, "");
  return cleaned || "/today";
}

function stripBasePath(path) {
  if (!path) {
    return "/";
  }
  if (path === BASE_PATH) {
    return "/";
  }
  if (path.startsWith(`${BASE_PATH}/`)) {
    return path.slice(BASE_PATH.length);
  }
  return path;
}

function toPublicPath(path) {
  const normalized = normalizePath(path);
  if (BASE_PATH && BASE_PATH !== "/") {
    return `${BASE_PATH}${normalized}`;
  }
  return normalized;
}

function parseRoute(path) {
  const cleaned = normalizePath(path);
  const parts = cleaned.split("/").filter(Boolean);
  if (!parts.length || parts[0] === "today") {
    return { name: "today" };
  }
  if (parts[0] === "inbox") {
    return { name: "inbox" };
  }
  if (parts[0] === "week") {
    return { name: "week" };
  }
  if (parts[0] === "calendar") {
    return { name: "calendar" };
  }
  if (parts[0] === "projects") {
    if (parts[1]) {
      return { name: "project", id: parts[1] };
    }
    return { name: "projects" };
  }
  if (parts[0] === "notes") {
    if (parts[1]) {
      return { name: "note", id: parts[1] };
    }
    return { name: "notes" };
  }
  if (parts[0] === "areas") {
    if (parts[1]) {
      return { name: "area", id: parts[1] };
    }
    return { name: "areas" };
  }
  return null;
}

function defaultState() {
  return {
    tasks: [],
    events: [],
    notes: [],
    projects: [],
    areas: [],
    inbox: [],
    meta: {
      lastReviewAt: null
    },
    ui: {
      route: "/today",
      search: "",
      selected: { kind: null, id: null },
      loading: true,
      searching: false,
      lastSearchQuery: "",
      searchResults: null,
      weekTab: "plan",
      weekOffset: 0,
      weekShowTimeBlocks: true,
      calendarTab: "week",
      calendarMonthOffset: 0,
      projectFilter: "active",
      notesNoteId: null,
      inboxSelection: [],
      overdueCollapsed: true
    }
  };
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return defaultState();
  }
  try {
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    return defaultState();
  }
}

function normalizeState(data) {
  const base = defaultState();
  if (!data || typeof data !== "object") {
    return base;
  }
  const ui = {
    ...base.ui,
    ...(data.ui || {})
  };
  return {
    tasks: Array.isArray(data.tasks) ? data.tasks.map(normalizeTask).filter(Boolean) : [],
    events: Array.isArray(data.events) ? data.events.map(normalizeEvent).filter(Boolean) : [],
    notes: Array.isArray(data.notes) ? data.notes.map(normalizeNote).filter(Boolean) : [],
    projects: Array.isArray(data.projects) ? data.projects.map(normalizeProject).filter(Boolean) : [],
    areas: Array.isArray(data.areas) ? data.areas.map(normalizeArea).filter(Boolean) : [],
    inbox: Array.isArray(data.inbox) ? data.inbox.map(normalizeInboxItem).filter(Boolean) : [],
    meta: {
      lastReviewAt: data.meta && data.meta.lastReviewAt ? data.meta.lastReviewAt : null
    },
    ui
  };
}

function saveState(options = {}) {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!options.skipRemote) {
    scheduleRemoteSync();
  }
  if (options.render !== false) {
    renderSidebar();
  }
}

function saveStateDebounced(options = {}) {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveState(options);
  }, SAVE_DEBOUNCE_MS);
}

function getApiHeaders() {
  const headers = { "Content-Type": "application/json" };
  const pin = localStorage.getItem(APP_PIN_KEY);
  if (pin) {
    headers["X-APP-PIN"] = pin;
  }
  return headers;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/v1${path}`, {
    method: options.method || "GET",
    headers: { ...getApiHeaders(), ...(options.headers || {}) },
    body: options.body
  });
  if (!response.ok) {
    let detail = "";
    try {
      const data = await response.json();
      if (data && data.error) {
        detail = data.error;
      }
    } catch (error) {
      detail = "";
    }
    const message = detail ? `${response.status}: ${detail}` : `HTTP ${response.status}`;
    throw new Error(message);
  }
  if (response.status === 204) {
    return null;
  }
  return response.json();
}

async function apiDelete(path) {
  const response = await fetch(`${API_BASE_URL}/v1${path}`, {
    method: "DELETE",
    headers: getApiHeaders()
  });
  if (response.status === 404) {
    return;
  }
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}

function scheduleSearch(query) {
  const trimmed = (query || "").trim();
  if (!trimmed) {
    state.ui.searchResults = null;
    state.ui.searching = false;
    state.ui.lastSearchQuery = "";
    return;
  }
  if (searchTimer) {
    clearTimeout(searchTimer);
  }
  searchTimer = setTimeout(() => {
    searchTimer = null;
    runSearch(trimmed);
  }, 300);
}

async function runSearch(query) {
  state.ui.searching = true;
  state.ui.lastSearchQuery = query;
  renderMain();
  try {
    const data = await apiRequest(`/search?q=${encodeURIComponent(query)}`);
    state.ui.searchResults = {
      tasks: Array.isArray(data.tasks) ? data.tasks.map(taskFromApi).filter(Boolean) : [],
      events: Array.isArray(data.events) ? data.events.map(eventFromApi).filter(Boolean) : [],
      projects: Array.isArray(data.projects) ? data.projects.map(projectFromApi).filter(Boolean) : [],
      notes: Array.isArray(data.notes) ? data.notes.map(noteFromApi).filter(Boolean) : []
    };
  } catch (error) {
    state.ui.searchResults = null;
  } finally {
    state.ui.searching = false;
    renderMain();
  }
}

function inferQuickCapture(text) {
  const raw = String(text || "").trim();
  const lower = raw.toLowerCase();
  const now = new Date();

  if (!raw) {
    return null;
  }

  let kind = "task";
  let date = "";
  let time = "";

  if (lower.startsWith("nota:")) {
    kind = "note";
  }

  if (/\bhoje\b/.test(lower)) {
    date = formatDate(now);
  }
  if (/\bamanha\b/.test(lower)) {
    date = formatDate(addDays(now, 1));
  }

  const dateMatch = lower.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (dateMatch) {
    const day = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10);
    let year = dateMatch[3] ? parseInt(dateMatch[3], 10) : now.getFullYear();
    if (year < 100) {
      year += 2000;
    }
    const parsed = new Date(year, month - 1, day);
    if (!Number.isNaN(parsed.getTime())) {
      date = formatDate(parsed);
    }
  }

  const timeMatch = lower.match(/(\b\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const hh = String(timeMatch[1]).padStart(2, "0");
    const mm = String(timeMatch[2]).padStart(2, "0");
    time = `${hh}:${mm}`;
  } else {
    const hourMatch = lower.match(/(\b\d{1,2})\s*h\b/);
    if (hourMatch) {
      const hh = String(hourMatch[1]).padStart(2, "0");
      time = `${hh}:00`;
    }
  }

  if (time) {
    kind = "event";
    if (!date) {
      date = formatDate(now);
    }
  } else if (!date) {
    date = formatDate(now);
  }

  let title = raw;
  title = title.replace(/^nota:\s*/i, "");
  title = title.replace(/\bhoje\b/gi, "");
  title = title.replace(/\bamanha\b/gi, "");
  if (dateMatch) {
    title = title.replace(dateMatch[0], "");
  }
  if (timeMatch) {
    title = title.replace(timeMatch[0], "");
  }
  title = title.replace(/\s{2,}/g, " ").trim();
  if (!title) {
    title = raw;
  }

  return { kind, title, date, time };
}

function parseDateTime(value) {
  if (!value || typeof value !== "string") {
    return { date: "", time: "" };
  }
  const cleaned = value.trim();
  const parts = cleaned.includes("T") ? cleaned.split("T") : cleaned.split(" ");
  const date = parts[0] || "";
  const timePart = parts[1] || "";
  const time = timePart ? timePart.slice(0, 5) : "";
  return { date, time };
}

function formatDateTime(date, time) {
  if (!date || !time) {
    return "";
  }
  return `${date}T${time}:00`;
}

function addMinutesToDateTime(dateStr, timeStr, minutes) {
  if (!dateStr || !timeStr) {
    return "";
  }
  const base = parseDate(dateStr);
  if (!base) {
    return "";
  }
  const [hh, mm] = timeStr.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) {
    return "";
  }
  const date = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    hh,
    mm,
    0,
    0
  );
  date.setMinutes(date.getMinutes() + (Number(minutes) || 0));
  const endDate = formatDate(date);
  const endTime = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return formatDateTime(endDate, endTime);
}

function diffMinutes(startAt, endAt) {
  if (!startAt || !endAt) {
    return DEFAULT_EVENT_DURATION;
  }
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return DEFAULT_EVENT_DURATION;
  }
  const diff = Math.round((end - start) / 60000);
  return Math.max(15, diff || DEFAULT_EVENT_DURATION);
}

function buildTimeBlock(scheduledAt, durationMin) {
  const parts = parseDateTime(scheduledAt);
  if (!parts.date || !parts.time) {
    return null;
  }
  const duration = Number(durationMin);
  return {
    date: parts.date,
    start: parts.time,
    duration: Number.isFinite(duration) ? duration : DEFAULT_EVENT_DURATION
  };
}

function taskFromApi(data) {
  if (!data) {
    return null;
  }
  return normalizeTask({
    id: data.id,
    title: data.title,
    status: data.status,
    priority: data.priority,
    dueDate: data.dueDate || "",
    projectId: data.projectId || null,
    areaId: data.areaId || null,
    notes: data.notes || "",
    focus: Boolean(data.focus),
    timeBlock: buildTimeBlock(data.scheduledAt, data.durationMin),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  });
}

function taskToApi(task) {
  const scheduledAt = task.timeBlock
    ? formatDateTime(task.timeBlock.date, task.timeBlock.start)
    : "";
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate || "",
    scheduledAt: scheduledAt || null,
    durationMin: task.timeBlock ? Number(task.timeBlock.duration) || DEFAULT_EVENT_DURATION : null,
    projectId: task.projectId || null,
    areaId: task.areaId || null,
    notes: task.notes || "",
    focus: task.focus ? 1 : 0
  };
}

function eventFromApi(data) {
  if (!data) {
    return null;
  }
  const startParts = parseDateTime(data.startAt);
  const date = startParts.date || formatDate(new Date());
  const start = startParts.time || "09:00";
  const duration = diffMinutes(data.startAt, data.endAt);
  return normalizeEvent({
    id: data.id,
    title: data.title,
    date,
    start,
    duration,
    location: data.location || "",
    notes: data.notes || "",
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  });
}

function eventToApi(event) {
  const startAt = formatDateTime(event.date, event.start);
  const duration = Number(event.duration) || DEFAULT_EVENT_DURATION;
  const endAt = addMinutesToDateTime(event.date, event.start, duration);
  return {
    id: event.id,
    title: event.title,
    startAt,
    endAt,
    location: event.location || "",
    notes: event.notes || ""
  };
}

function noteFromApi(data) {
  if (!data) {
    return null;
  }
  let blocks = [];
  if (typeof data.contentJson === "string" && data.contentJson) {
    try {
      const parsed = JSON.parse(data.contentJson);
      if (Array.isArray(parsed)) {
        blocks = parsed;
      }
    } catch (error) {
      blocks = [];
    }
  }
  return normalizeNote({
    id: data.id,
    title: data.title,
    areaId: data.areaId || null,
    projectId: data.projectId || null,
    blocks,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  });
}

function noteToApi(note) {
  return {
    id: note.id,
    title: note.title,
    areaId: note.areaId || null,
    projectId: note.projectId || null,
    contentJson: JSON.stringify(note.blocks || [])
  };
}

function projectFromApi(data) {
  if (!data) {
    return null;
  }
  return normalizeProject({
    id: data.id,
    title: data.title,
    objective: data.objective || "",
    areaId: data.areaId || null,
    status: data.status,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  });
}

function projectToApi(project) {
  return {
    id: project.id,
    title: project.title,
    objective: project.objective || "",
    areaId: project.areaId || null,
    status: project.status
  };
}

function areaFromApi(data) {
  if (!data) {
    return null;
  }
  return normalizeArea({
    id: data.id,
    name: data.name
  });
}

function areaToApi(area) {
  return {
    id: area.id,
    name: area.name
  };
}

function inboxFromApi(data) {
  if (!data) {
    return null;
  }
  return normalizeInboxItem({
    id: data.id,
    title: data.rawText || "",
    kind: data.inferredType || "task",
    createdAt: data.createdAt
  });
}

function inboxToApi(item) {
  return {
    id: item.id,
    rawText: item.title || "",
    inferredType: item.kind || "task",
    createdAt: item.createdAt
  };
}

async function loadRemoteState() {
  try {
    state.ui.loading = true;
    renderMain();
    const [areas, projects, tasks, events, notes, inbox] = await Promise.all([
      apiRequest("/areas"),
      apiRequest("/projects"),
      apiRequest("/tasks"),
      apiRequest("/events"),
      apiRequest("/notes"),
      apiRequest("/inbox")
    ]);

    const nextState = normalizeState({
      areas: (areas || []).map(areaFromApi).filter(Boolean),
      projects: (projects || []).map(projectFromApi).filter(Boolean),
      tasks: (tasks || []).map(taskFromApi).filter(Boolean),
      events: (events || []).map(eventFromApi).filter(Boolean),
      notes: (notes || []).map(noteFromApi).filter(Boolean),
      inbox: (inbox || []).map(inboxFromApi).filter(Boolean),
      meta: state.meta,
      ui: state.ui
    });

    suppressSync = true;
    state = nextState;
    state.ui.loading = false;
    saveState({ skipRemote: true });
    suppressSync = false;
    renderAll();
  } catch (error) {
    console.error("Failed to load API data.", error);
    showToast("Falha ao conectar na API.");
    state.ui.loading = false;
    renderAll();
  } finally {
    syncReady = true;
    if (syncPending) {
      scheduleRemoteSync();
    }
  }
}

function scheduleRemoteSync() {
  syncPending = true;
  if (!syncReady || suppressSync) {
    return;
  }
  if (syncTimer) {
    clearTimeout(syncTimer);
  }
  syncTimer = setTimeout(() => {
    syncTimer = null;
    if (syncBusy) {
      return;
    }
    flushDirty().catch((error) => {
      console.error("Sync failed.", error);
    });
  }, REMOTE_DEBOUNCE_MS);
}

function markDirty(item) {
  if (!item || suppressSync) {
    return;
  }
  item._dirty = true;
  scheduleRemoteSync();
}

function markDeleted(kind, id) {
  if (!id || !pendingDeletes[kind]) {
    return;
  }
  pendingDeletes[kind].add(id);
  scheduleRemoteSync();
}

async function flushDirty() {
  if (!syncReady || suppressSync) {
    return;
  }
  if (syncBusy) {
    syncPending = true;
    return;
  }
  syncBusy = true;
  syncPending = false;
  try {
    await flushDeletes();
    await flushList(state.areas, upsertArea);
    await flushList(state.projects, upsertProject);
    await flushList(state.tasks, upsertTask);
    await flushList(state.events, upsertEvent);
    await flushList(state.notes, upsertNote);
    await flushList(state.inbox, upsertInbox);
  } catch (error) {
    const now = Date.now();
    if (now - lastSyncErrorAt > 5000) {
      lastSyncErrorAt = now;
      showToast("Falha ao sincronizar.");
    }
    throw error;
  } finally {
    syncBusy = false;
    if (syncPending) {
      scheduleRemoteSync();
    }
  }
}

async function flushDeletes() {
  await flushDeleteSet("tasks", pendingDeletes.tasks, (id) => apiDelete(`/tasks/${id}`));
  await flushDeleteSet("events", pendingDeletes.events, (id) => apiDelete(`/events/${id}`));
  await flushDeleteSet("notes", pendingDeletes.notes, (id) => apiDelete(`/notes/${id}`));
  await flushDeleteSet("projects", pendingDeletes.projects, (id) => apiDelete(`/projects/${id}`));
  await flushDeleteSet("areas", pendingDeletes.areas, (id) => apiDelete(`/areas/${id}`));
  await flushDeleteSet("inbox", pendingDeletes.inbox, (id) => apiDelete(`/inbox/${id}`));
}

async function flushDeleteSet(_kind, set, action) {
  const ids = Array.from(set);
  for (const id of ids) {
    await action(id);
    set.delete(id);
  }
}

async function flushList(items, upsertFn) {
  for (const item of items) {
    if (!item._dirty) {
      continue;
    }
    const saved = await upsertFn(item);
    if (saved) {
      Object.assign(item, saved);
    }
    item._dirty = false;
  }
}

async function upsertTask(task) {
  const data = await apiRequest("/tasks", {
    method: "POST",
    body: JSON.stringify(taskToApi(task))
  });
  return taskFromApi(data);
}

async function upsertEvent(event) {
  const data = await apiRequest("/events", {
    method: "POST",
    body: JSON.stringify(eventToApi(event))
  });
  return eventFromApi(data);
}

async function upsertNote(note) {
  const data = await apiRequest("/notes", {
    method: "POST",
    body: JSON.stringify(noteToApi(note))
  });
  return noteFromApi(data);
}

async function upsertProject(project) {
  const data = await apiRequest("/projects", {
    method: "POST",
    body: JSON.stringify(projectToApi(project))
  });
  return projectFromApi(data);
}

async function upsertArea(area) {
  const data = await apiRequest("/areas", {
    method: "POST",
    body: JSON.stringify(areaToApi(area))
  });
  return areaFromApi(data);
}

async function upsertInbox(item) {
  const data = await apiRequest("/inbox", {
    method: "POST",
    body: JSON.stringify(inboxToApi(item))
  });
  return inboxFromApi(data);
}

function normalizeUpdatedAt(value) {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  if (Number.isFinite(value)) {
    return new Date(value).toISOString();
  }
  return null;
}

function normalizeTask(task) {
  if (!task || typeof task !== "object") {
    return null;
  }
  const normalized = { ...task };
  normalized.id = typeof normalized.id === "string" ? normalized.id : uid("task");
  normalized.title = typeof normalized.title === "string" ? normalized.title : "Nova tarefa";
  normalized.status = STATUS_ORDER.includes(normalized.status) ? normalized.status : "todo";
  normalized.priority = ["low", "normal", "high"].includes(normalized.priority)
    ? normalized.priority
    : "normal";
  normalized.dueDate = typeof normalized.dueDate === "string" ? normalized.dueDate : "";
  normalized.projectId = typeof normalized.projectId === "string" ? normalized.projectId : null;
  normalized.areaId = typeof normalized.areaId === "string" ? normalized.areaId : null;
  normalized.notes = typeof normalized.notes === "string" ? normalized.notes : "";
  delete normalized.dueTime;
  delete normalized.scheduledAt;
  delete normalized.durationMin;
  delete normalized.checklist;
  delete normalized.attachments;
  delete normalized.linkedNoteId;
  delete normalized.sourceNoteId;
  delete normalized.archived;
  normalized.focus = Boolean(normalized.focus);
  normalized.timeBlock =
    normalized.timeBlock && typeof normalized.timeBlock === "object"
      ? normalizeTimeBlock(normalized.timeBlock)
      : null;
  normalized.createdAt =
    normalizeUpdatedAt(normalized.createdAt) || new Date().toISOString();
  normalized.updatedAt =
    normalizeUpdatedAt(normalized.updatedAt) || normalizeUpdatedAt(normalized.createdAt);
  return normalized;
}

function normalizeEvent(event) {
  if (!event || typeof event !== "object") {
    return null;
  }
  const normalized = { ...event };
  normalized.id = typeof normalized.id === "string" ? normalized.id : uid("event");
  normalized.title = typeof normalized.title === "string" ? normalized.title : "Novo evento";
  normalized.date = typeof normalized.date === "string" ? normalized.date : formatDate(new Date());
  normalized.start = typeof normalized.start === "string" ? normalized.start : "09:00";
  normalized.duration = Number.isFinite(normalized.duration)
    ? Math.max(15, normalized.duration)
    : 60;
  normalized.location = typeof normalized.location === "string" ? normalized.location : "";
  normalized.notes = typeof normalized.notes === "string" ? normalized.notes : "";
  delete normalized.startAt;
  delete normalized.endAt;
  delete normalized.projectId;
  delete normalized.areaId;
  delete normalized.recurrence;
  delete normalized.archived;
  normalized.createdAt =
    normalizeUpdatedAt(normalized.createdAt) || new Date().toISOString();
  normalized.updatedAt =
    normalizeUpdatedAt(normalized.updatedAt) || normalizeUpdatedAt(normalized.createdAt);
  return normalized;
}

function normalizeNote(note) {
  if (!note || typeof note !== "object") {
    return null;
  }
  const normalized = { ...note };
  normalized.id = typeof normalized.id === "string" ? normalized.id : uid("note");
  normalized.title = typeof normalized.title === "string" ? normalized.title : "Nova nota";
  normalized.areaId = typeof normalized.areaId === "string" ? normalized.areaId : null;
  normalized.projectId = typeof normalized.projectId === "string" ? normalized.projectId : null;
  normalized.blocks = Array.isArray(normalized.blocks)
    ? normalized.blocks.map(normalizeBlock).filter(Boolean)
    : [];
  delete normalized.contentJson;
  delete normalized.archived;
  normalized.createdAt =
    normalizeUpdatedAt(normalized.createdAt) || new Date().toISOString();
  normalized.updatedAt =
    normalizeUpdatedAt(normalized.updatedAt) || normalizeUpdatedAt(normalized.createdAt);
  return normalized;
}

function normalizeProject(project) {
  if (!project || typeof project !== "object") {
    return null;
  }
  const normalized = { ...project };
  normalized.id = typeof normalized.id === "string" ? normalized.id : uid("project");
  const legacyTitle = typeof normalized.name === "string" ? normalized.name : "";
  normalized.title = typeof normalized.title === "string" ? normalized.title : legacyTitle || "Novo projeto";
  delete normalized.name;
  delete normalized.notes;
  delete normalized.milestones;
  normalized.objective = typeof normalized.objective === "string" ? normalized.objective : "";
  normalized.areaId = typeof normalized.areaId === "string" ? normalized.areaId : null;
  normalized.status = ["active", "paused", "done"].includes(normalized.status)
    ? normalized.status
    : "active";
  normalized.createdAt =
    normalizeUpdatedAt(normalized.createdAt) || new Date().toISOString();
  normalized.updatedAt =
    normalizeUpdatedAt(normalized.updatedAt) || normalizeUpdatedAt(normalized.createdAt);
  return normalized;
}

function normalizeArea(area) {
  if (!area || typeof area !== "object") {
    return null;
  }
  const normalized = { ...area };
  normalized.id = typeof normalized.id === "string" ? normalized.id : uid("area");
  normalized.name = typeof normalized.name === "string" ? normalized.name : "Nova area";
  delete normalized.objective;
  normalized.createdAt =
    normalizeUpdatedAt(normalized.createdAt) || new Date().toISOString();
  normalized.updatedAt =
    normalizeUpdatedAt(normalized.updatedAt) || normalizeUpdatedAt(normalized.createdAt);
  return normalized;
}

function normalizeInboxItem(item) {
  if (!item || typeof item !== "object") {
    return null;
  }
  const normalized = { ...item };
  normalized.id = typeof normalized.id === "string" ? normalized.id : uid("cap");
  normalized.title = typeof normalized.title === "string" ? normalized.title : "Captura";
  normalized.kind = ["task", "note", "event"].includes(normalized.kind)
    ? normalized.kind
    : "task";
  delete normalized.rawText;
  delete normalized.inferredType;
  normalized.createdAt =
    normalizeUpdatedAt(normalized.createdAt) || new Date().toISOString();
  return normalized;
}

function normalizeTimeBlock(block) {
  if (!block || typeof block !== "object") {
    return null;
  }
  return {
    date: typeof block.date === "string" ? block.date : formatDate(new Date()),
    start: typeof block.start === "string" ? block.start : "09:00",
    duration: Number.isFinite(block.duration) ? Math.max(15, block.duration) : 60
  };
}

function normalizeBlock(block) {
  if (!block || typeof block !== "object") {
    return null;
  }
  const normalized = { ...block };
  normalized.id = typeof normalized.id === "string" ? normalized.id : uid("block");
  normalized.type = BLOCK_TYPES.find((type) => type.value === normalized.type)
    ? normalized.type
    : "text";
  if (["text", "heading", "quote", "title"].includes(normalized.type)) {
    normalized.text = typeof normalized.text === "string" ? normalized.text : "";
  }
  if (normalized.type === "list") {
    normalized.items = Array.isArray(normalized.items) ? normalized.items : [];
  }
  if (normalized.type === "checklist") {
    normalized.items = Array.isArray(normalized.items) ? normalized.items : [];
  }
  if (normalized.type === "table") {
    normalized.rows = Array.isArray(normalized.rows) ? normalized.rows : [];
  }
  if (normalized.type === "embed") {
    normalized.url = typeof normalized.url === "string" ? normalized.url : "";
  }
  return normalized;
}

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

function formatDate(date) {
  if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

function formatTimeLabel(time) {
  return time || "--:--";
}

function parseDate(value) {
  if (!value || typeof value !== "string") {
    return null;
  }
  // Parse date safely - handle timezone issues
  const parts = value.split("-");
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return null;
  const date = new Date(year, month, day);
  return date;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

function buildTimeSlots(startHour, endHour, stepMinutes) {
  const slots = [];
  const start = startHour * 60;
  const end = endHour * 60;
  const step = Math.max(15, Number(stepMinutes) || 30);
  for (let minutes = start; minutes <= end; minutes += step) {
    const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
    const mm = String(minutes % 60).padStart(2, "0");
    slots.push(`${hh}:${mm}`);
  }
  return slots;
}

function getCalendarSlots() {
  return buildTimeSlots(
    CALENDAR_START_HOUR,
    CALENDAR_END_HOUR,
    TIME_STEP_MINUTES
  );
}

function dateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a, b) {
  return (
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function timeToMinutes(time) {
  if (!time || typeof time !== "string") {
    return 0;
  }
  const parts = time.split(":").map(Number);
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) {
    return 0;
  }
  return parts[0] * 60 + parts[1];
}

function formatDayLabel(date) {
  return date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" });
}

function getWeekStart(date, startsMonday) {
  if (!date || !(date instanceof Date)) {
    date = new Date();
  }
  const day = date.getDay();
  const diff = startsMonday ? (day === 0 ? -6 : 1 - day) : -day;
  return addDays(dateOnly(date), diff);
}

function getWeekDays(offset = 0) {
  const base = addDays(new Date(), offset * 7);
  const weekStart = getWeekStart(base, WEEK_STARTS_MONDAY);
  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const day = addDays(weekStart, i);
    days.push({
      date: formatDate(day),
      label: formatDayLabel(day),
      isToday: sameDay(day, new Date())
    });
  }
  return days;
}

function createTask(data = {}) {
  const task = normalizeTask({
    id: uid("task"),
    title: data.title || "Nova tarefa",
    status: data.status || "todo",
    priority: data.priority || "normal",
    dueDate: data.dueDate || "",
    projectId: data.projectId || null,
    areaId: data.areaId || null,
    notes: data.notes || "",
    focus: Boolean(data.focus),
    timeBlock: data.timeBlock || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  markDirty(task);
  return task;
}

function createEvent(data = {}) {
  const event = normalizeEvent({
    id: uid("event"),
    title: data.title || "Novo evento",
    date: data.date || formatDate(new Date()),
    start: data.start || "09:00",
    duration: Number.isFinite(data.duration) ? data.duration : DEFAULT_EVENT_DURATION,
    location: data.location || "",
    notes: data.notes || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  markDirty(event);
  return event;
}

function createNote(data = {}) {
  const note = normalizeNote({
    id: uid("note"),
    title: data.title || "Nova nota",
    areaId: data.areaId || null,
    projectId: data.projectId || null,
    blocks: Array.isArray(data.blocks) ? data.blocks : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  markDirty(note);
  return note;
}

function createProject(data = {}) {
  const project = normalizeProject({
    id: uid("project"),
    title: data.title || "Novo projeto",
    objective: data.objective || "",
    areaId: data.areaId || null,
    status: data.status || "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  markDirty(project);
  return project;
}

function createArea(data = {}) {
  const area = normalizeArea({
    id: uid("area"),
    name: data.name || "Nova area",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
  markDirty(area);
  return area;
}

function createInboxItem(title) {
  const item = normalizeInboxItem({
    id: uid("cap"),
    title: title || "Captura",
    kind: suggestInboxKind(title),
    createdAt: new Date().toISOString()
  });
  markDirty(item);
  return item;
}

function touch(item) {
  if (item) {
    item.updatedAt = new Date().toISOString();
    markDirty(item);
  }
}

function suggestInboxKind(text) {
  const value = (text || "").toLowerCase();
  if (value.includes("reuniao") || value.includes("call") || value.includes("evento")) {
    return "event";
  }
  if (value.includes("nota") || value.includes("ideia")) {
    return "note";
  }
  return "task";
}

function matchesQuery(value, query) {
  if (!query) {
    return true;
  }
  if (!value) {
    return false;
  }
  return value.toLowerCase().includes(query.toLowerCase());
}

function getBlockText(block) {
  if (!block) {
    return "";
  }
  if (block.type === "list") {
    return (block.items || []).join(" ");
  }
  if (block.type === "checklist") {
    return (block.items || []).map((item) => item.text).join(" ");
  }
  if (block.type === "table") {
    return (block.rows || []).map((row) => row.join(" ")).join(" ");
  }
  if (block.type === "embed") {
    return block.url || "";
  }
  return block.text || "";
}

function getTask(id) {
  return state.tasks.find((task) => task.id === id) || null;
}

function getEvent(id) {
  return state.events.find((event) => event.id === id) || null;
}

function getNote(id) {
  return state.notes.find((note) => note.id === id) || null;
}

function getProject(id) {
  return state.projects.find((project) => project.id === id) || null;
}

function getArea(id) {
  return state.areas.find((area) => area.id === id) || null;
}

function getSelectedItem() {
  const selection = state.ui.selected || {};
  if (selection.kind === "task") {
    return { kind: "task", item: getTask(selection.id) };
  }
  if (selection.kind === "event") {
    return { kind: "event", item: getEvent(selection.id) };
  }
  if (selection.kind === "note") {
    return { kind: "note", item: getNote(selection.id) };
  }
  if (selection.kind === "project") {
    return { kind: "project", item: getProject(selection.id) };
  }
  return { kind: null, item: null };
}

function getTodayKey() {
  return formatDate(new Date());
}

function getOverdueTasks() {
  const today = dateOnly(new Date());
  return state.tasks.filter((task) => {
    if (task.status === "done" || !task.dueDate) {
      return false;
    }
    const due = parseDate(task.dueDate);
    return due && due < today;
  });
}

function getTodayTasks() {
  const today = getTodayKey();
  return state.tasks.filter((task) => {
    if (task.status === "done") {
      return false;
    }
    return task.dueDate === today;
  });
}

function getNextDaysTasks(days = 7) {
  const today = dateOnly(new Date());
  const end = addDays(today, days - 1); // -1 para incluir o último dia no intervalo
  return state.tasks.filter((task) => {
    if (task.status === "done" || !task.dueDate) {
      return false;
    }
    const due = parseDate(task.dueDate);
    return due && due >= today && due <= end;
  });
}

function getAgendaItems(dateKey) {
  const items = [];
  state.events.forEach((event) => {
    if (event.date === dateKey) {
      items.push({
        kind: "event",
        id: event.id,
        title: event.title,
        start: event.start,
        duration: event.duration
      });
    }
  });
  state.tasks.forEach((task) => {
    if (task.status === "done" || !task.timeBlock) {
      return;
    }
    if (task.timeBlock.date === dateKey) {
      items.push({
        kind: "task",
        id: task.id,
        title: task.title,
        start: task.timeBlock.start,
        duration: task.timeBlock.duration
      });
    }
  });
  items.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  return items;
}

function countFocusTasks() {
  return state.tasks.filter((task) => task.focus && task.status !== "done").length;
}

function isFirstRun() {
  return (
    state.tasks.length === 0 &&
    state.events.length === 0 &&
    state.notes.length === 0 &&
    state.projects.length === 0 &&
    state.inbox.length === 0
  );
}

function renderAll() {
  renderTopbar();
  renderSidebar();
  renderPageHeader();
  renderMain();
  renderDetailsPanel();
}

function renderTopbar() {
  if (el.globalSearch) {
    el.globalSearch.value = state.ui.search || "";
  }
  if (el.searchClear) {
    el.searchClear.classList.toggle("hidden", !state.ui.search);
  }
}

function renderSidebar() {
  const route = parseRoute(state.ui.route);
  document.querySelectorAll("[data-route]").forEach((node) => {
    const routePath = node.dataset.route || "";
    const isActive =
      route &&
      (routePath === state.ui.route || state.ui.route.startsWith(`${routePath}/`));
    node.classList.toggle("active", isActive);
  });

  setCount(el.countInbox, state.inbox.length);
  setCount(el.countToday, getTodayTasks().length + getAgendaItems(getTodayKey()).length);
  setCount(el.countWeek, getNextDaysTasks(7).length);
  setCount(el.countProjects, state.projects.filter((project) => project.status === "active").length);
  setCount(el.countNotes, state.notes.length);
}

function renderPageHeader() {
  const route = parseRoute(state.ui.route);
  const meta = route ? ROUTE_META[route.name] : ROUTE_META.today;
  if (el.pageEyebrow) {
    el.pageEyebrow.textContent = meta.eyebrow;
  }
  if (el.pageTitle) {
    el.pageTitle.textContent = meta.title;
  }
  if (el.pageActions) {
    el.pageActions.innerHTML = "";
    renderPageActions(route, el.pageActions);
  }
}

function renderMain() {
  const route = parseRoute(state.ui.route);
  if (!route) {
    navigate("/today", { replace: true });
    return;
  }
  el.viewRoot.innerHTML = "";

  if (state.ui.loading) {
    renderLoadingView(el.viewRoot);
    return;
  }

  const query = (state.ui.search || "").trim().toLowerCase();
  if (query) {
    renderGlobalSearchView(el.viewRoot, query);
    return;
  }

  if (route.name === "today") {
    renderTodayView(el.viewRoot);
  } else if (route.name === "inbox") {
    renderInboxView(el.viewRoot);
  } else if (route.name === "week") {
    renderWeekView(el.viewRoot);
  } else if (route.name === "calendar") {
    renderCalendarView(el.viewRoot);
  } else if (route.name === "projects") {
    renderProjectsView(el.viewRoot);
  } else if (route.name === "project") {
    renderProjectDetail(el.viewRoot, route.id);
  } else if (route.name === "notes") {
    renderNotesView(el.viewRoot);
  } else if (route.name === "note") {
    renderNotesView(el.viewRoot, route.id);
  } else if (route.name === "areas") {
    renderAreasView(el.viewRoot);
  } else if (route.name === "area") {
    renderAreaDetail(el.viewRoot, route.id);
  } else {
    const empty = createElement("div", "empty", "Rota não encontrada.");
    el.viewRoot.append(empty);
  }
}

function renderGlobalSearchView(root, query) {
  const apiResults =
    state.ui.searchResults && state.ui.lastSearchQuery === query
      ? state.ui.searchResults
      : null;
  const results = apiResults || getSearchResults(query);
  const wrap = createElement("div", "today-grid");
  const summary = createSection("Busca global", `Resultados para "${query}"`);

  if (state.ui.searching && !apiResults) {
    summary.body.append(createElement("div", "list-meta", "Buscando na API..."));
    wrap.append(summary.section);
    root.append(wrap);
    return;
  }

  if (
    results.tasks.length === 0 &&
    results.events.length === 0 &&
    results.projects.length === 0 &&
    results.notes.length === 0
  ) {
    summary.body.append(createElement("div", "empty", "Nada encontrado."));
    wrap.append(summary.section);
    root.append(wrap);
    return;
  }

  summary.body.append(
    createElement(
      "div",
      "list-meta",
      `${results.tasks.length} tarefas, ${results.events.length} eventos, ${results.projects.length} projetos, ${results.notes.length} notas`
    )
  );
  wrap.append(summary.section);

  if (results.tasks.length) {
    const section = createSection("Tarefas", "");
    results.tasks.forEach((task) => section.body.append(createTaskRow(task)));
    wrap.append(section.section);
  }
  if (results.events.length) {
    const section = createSection("Eventos", "");
    results.events.forEach((event) => section.body.append(createEventRow(event)));
    wrap.append(section.section);
  }
  if (results.projects.length) {
    const section = createSection("Projetos", "");
    results.projects.forEach((project) => {
      const card = createProjectCard(project);
      card.addEventListener("click", () => navigate(`/projects/${project.id}`));
      section.body.append(card);
    });
    wrap.append(section.section);
  }
  if (results.notes.length) {
    const section = createSection("Notas", "");
    results.notes.forEach((note) => {
      const row = createElement("div", "task-row");
      row.append(createElement("div", "task-title", note.title));
      row.addEventListener("click", () => navigate(`/notes/${note.id}`));
      section.body.append(row);
    });
    wrap.append(section.section);
  }

  root.append(wrap);
}

function renderLoadingView(root) {
  const wrap = createElement("div", "today-grid");
  const section = createSection("Carregando", "Sincronizando dados...");
  for (let i = 0; i < 6; i += 1) {
    const skeleton = createElement("div", "skeleton");
    section.body.append(skeleton);
  }
  wrap.append(section.section);
  root.append(wrap);
}

function getSearchResults(query) {
  const tasks = state.tasks.filter((task) =>
    matchesQuery(`${task.title} ${task.notes || ""}`, query)
  );
  const events = state.events.filter((event) =>
    matchesQuery(`${event.title} ${event.notes || ""}`, query)
  );
  const projects = state.projects.filter((project) =>
    matchesQuery(`${project.title} ${project.objective || ""}`, query)
  );
  const notes = state.notes.filter((note) => {
    const blockText = (note.blocks || []).map(getBlockText).join(" ");
    return matchesQuery(`${note.title} ${blockText}`, query);
  });
  return {
    tasks: tasks.slice(0, 6),
    events: events.slice(0, 6),
    projects: projects.slice(0, 6),
    notes: notes.slice(0, 6)
  };
}

function renderPageActions(route, container) {
  if (!route) {
    return;
  }
  if (route.name === "today") {
    container.append(
      createButton("Nova tarefa", "ghost-btn", () => openTaskModal({ dueDate: getTodayKey() })),
      createButton("Novo evento", "ghost-btn", () => openEventModal({ date: getTodayKey() }))
    );
  }
  if (route.name === "inbox") {
    container.append(
      createButton("Capturar", "ghost-btn", () => {
        const input = document.querySelector(".capture-input");
        if (input) {
          input.focus();
        }
      })
    );
  }
  if (route.name === "week") {
    container.append(
      createButton("Hoje", "ghost-btn", () => {
        state.ui.weekOffset = 0;
        saveState();
        renderMain();
      }),
      createButton("Nova tarefa", "ghost-btn", () => openTaskModal({})),
      createButton("Novo evento", "ghost-btn", () => openEventModal({})),
      createButton("Semana -", "ghost-btn", () => shiftWeek(-1)),
      createButton("Semana +", "ghost-btn", () => shiftWeek(1))
    );
  }
  if (route.name === "calendar") {
    container.append(
      createButton("Hoje", "ghost-btn", () => {
        state.ui.calendarMonthOffset = 0;
        state.ui.weekOffset = 0;
        saveState();
        renderMain();
      }),
      createButton("Novo evento", "primary-btn", () => openEventModal({}))
    );
  }
  if (route.name === "projects") {
    container.append(createButton("Criar projeto", "primary-btn", openProjectModal));
  }
  if (route.name === "project") {
    container.append(
      createButton("Nova tarefa", "ghost-btn", () => openTaskModal({ projectId: route.id }))
    );
  }
  if (route.name === "notes" || route.name === "note") {
    container.append(
      createButton("Nova nota", "primary-btn", () => openNoteModal({})),
      createButton("Templates", "ghost-btn", openTemplateChooser)
    );
  }
  if (route.name === "areas") {
    container.append(createButton("Nova area", "primary-btn", openAreaModal));
  }
}

function renderTodayView(root) {
  const wrap = createElement("div", "today-grid");
  const query = (state.ui.search || "").trim().toLowerCase();

  const capture = document.createElement("input");
  capture.className = "capture-input";
  capture.placeholder = "Capturar rapido e Enter...";
  capture.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const value = capture.value.trim();
      if (!value) {
        return;
      }
      const captureInfo = inferQuickCapture(value);
      if (!captureInfo) {
        return;
      }
      if (captureInfo.kind === "event") {
        const eventItem = createEvent({
          title: captureInfo.title,
          date: captureInfo.date || getTodayKey(),
          start: captureInfo.time || "09:00",
          duration: DEFAULT_EVENT_DURATION
        });
        state.events.push(eventItem);
        showToast("Evento criado.");
      } else if (captureInfo.kind === "note") {
        openNoteModal({ title: captureInfo.title });
        capture.value = "";
        return;
      } else {
        const task = createTask({ title: captureInfo.title, dueDate: captureInfo.date || getTodayKey() });
        state.tasks.unshift(task);
        showToast("Tarefa criada.");
      }
      capture.value = "";
      saveState();
      renderMain();
    }
  });
  wrap.append(capture);

  if (isFirstRun() && !query) {
    const empty = createElement("div", "empty");
    empty.innerHTML = "<h3>Primeiro uso</h3><p>Exemplos rapidos para voce comecar.</p>";
    const examples = createElement("div", "focus-grid");
    ["Planejar a semana", "Revisar projetos", "Escrever nota de reuniao"].forEach((text) => {
      const card = createElement("div", "card");
      card.append(createElement("div", "card-title", text));
      card.append(createElement("div", "card-meta", "Exemplo"));
      examples.append(card);
    });
    const action = createButton("Criar primeira tarefa", "primary-btn", () =>
      openTaskModal({ dueDate: getTodayKey() })
    );
    empty.append(examples, action);
    wrap.append(empty);
    root.append(wrap);
    return;
  }

  const focusSection = createSection("Foco do dia", "Ate 3 itens");
  const focusTasks = state.tasks.filter(
    (task) =>
      task.status !== "done" &&
      task.focus &&
      matchesTaskSearch(task, query)
  );
  if (!focusTasks.length) {
    focusSection.body.append(createElement("div", "list-meta", "Sem foco definido."));
  } else {
    const grid = createElement("div", "focus-grid stagger");
    focusTasks.slice(0, 3).forEach((task, index) => {
      const card = createTaskCard(task, { compact: true });
      card.style.setProperty("--delay", `${index * 40}ms`);
      grid.append(card);
    });
    focusSection.body.append(grid);
  }
  wrap.append(focusSection.section);

  const agendaSection = createSection("Agenda de hoje", "Arraste tarefas para time-block");
  const agendaHeader = agendaSection.section.querySelector(".section-header");
  if (agendaHeader) {
    agendaHeader.append(
      createButton("+ Evento", "ghost-btn", () => openEventModal({ date: getTodayKey() }))
    );
  }
  const timeline = createElement("div", "timeline");
  const agendaItems = getAgendaItems(getTodayKey()).filter((item) =>
    matchesQuery(item.title, query)
  );
  HOURS.forEach((time) => {
    const slot = createElement("div", "timeline-slot");
    const label = createElement("div", "timeline-time", time);
    slot.append(label);
    const slotItems = agendaItems.filter((item) => item.start === time);
    slotItems.forEach((item) => {
      const chip = createCalendarChip(item);
      slot.append(chip);
    });
    attachDropHandlers(slot, { date: getTodayKey(), time });
    slot.addEventListener("click", () => openEventModal({ date: getTodayKey(), start: time }));
    timeline.append(slot);
  });
  agendaSection.body.append(timeline);
  wrap.append(agendaSection.section);

  const tasksSection = createSection("Tarefas de hoje", "Concluir em 1 clique");
  const overdue = getOverdueTasks().filter((task) => matchesTaskSearch(task, query));
  if (overdue.length) {
    const overdueWrap = createElement("div", "section");
    const header = createElement("div", "section-header");
    const title = createElement("div", "section-title", `Atrasadas (${overdue.length})`);
    const toggle = createButton(
      state.ui.overdueCollapsed ? "Mostrar" : "Ocultar",
      "ghost-btn",
      () => {
        state.ui.overdueCollapsed = !state.ui.overdueCollapsed;
        saveState();
        renderMain();
      }
    );
    header.append(title, toggle);
    overdueWrap.append(header);
    if (!state.ui.overdueCollapsed) {
      overdue.forEach((task) => overdueWrap.append(createTaskRow(task)));
    }
    tasksSection.body.append(overdueWrap);
  }

  const todayTasks = getTodayTasks().filter((task) => matchesTaskSearch(task, query));
  if (!todayTasks.length) {
    tasksSection.body.append(createElement("div", "list-meta", "Nenhuma tarefa para hoje."));
  } else {
    todayTasks.forEach((task) => tasksSection.body.append(createTaskRow(task)));
  }
  wrap.append(tasksSection.section);

  const nextSection = createSection("Proximos 7 dias", "Mini lista");
  const nextTasks = getNextDaysTasks(7)
    .filter((task) => task.dueDate !== getTodayKey())
    .filter((task) => matchesTaskSearch(task, query))
    .slice(0, 7);
  if (!nextTasks.length) {
    nextSection.body.append(createElement("div", "list-meta", "Sem tarefas futuras."));
  } else {
    nextTasks.forEach((task) => nextSection.body.append(createTaskRow(task, { compact: true })));
  }
  wrap.append(nextSection.section);

  root.append(wrap);
}

function renderInboxView(root) {
  state.ui.inboxSelection = state.ui.inboxSelection.filter((id) =>
    state.inbox.some((item) => item.id === id)
  );
  const capture = document.createElement("input");
  capture.className = "capture-input";
  capture.placeholder = "Digite e Enter para capturar...";
  capture.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const value = capture.value.trim();
      if (!value) {
        return;
      }
      state.inbox.unshift(createInboxItem(value));
      capture.value = "";
      saveState();
      renderMain();
    }
  });

  root.append(capture);

  if (state.inbox.length) {
    const cta = createElement("div", "inbox-cta");
    cta.append(createElement("div", "card-title", `Processar ${state.inbox.length} itens agora`));
    cta.append(
      createButton("Processar agora", "primary-btn", () => {
        const ids = state.inbox.map((item) => item.id);
        openBulkProcessModal(ids);
      })
    );
    root.append(cta);
  }

  if (state.ui.inboxSelection.length) {
    const bulk = createElement("div", "bulk-bar");
    bulk.append(
      createElement("div", "card-title", `${state.ui.inboxSelection.length} selecionados`)
    );
    bulk.append(
      createButton("Processar em lote", "ghost-btn", () =>
        openBulkProcessModal(state.ui.inboxSelection)
      )
    );
    bulk.append(
      createButton("Arquivar", "ghost-btn", () =>
        bulkArchiveInbox(state.ui.inboxSelection)
      )
    );
    bulk.append(
      createButton("Deletar", "ghost-btn danger", () =>
        bulkDeleteInbox(state.ui.inboxSelection)
      )
    );
    root.append(bulk);
  }

  const list = createElement("div", "inbox-list");
  if (!state.inbox.length) {
    list.append(createElement("div", "empty", "Inbox vazia."));
  } else {
    state.inbox
      .filter((item) => matchesQuery(item.title, state.ui.search))
      .forEach((item) => list.append(createInboxRow(item)));
  }
  root.append(list);
}

function renderWeekView(root) {
  const tabs = createElement("div", "week-tabs");
  const planBtn = createButton("Planejar", "tab-btn", () => setWeekTab("plan"));
  const reviewBtn = createButton("Revisar", "tab-btn", () => setWeekTab("review"));
  planBtn.classList.toggle("active", state.ui.weekTab === "plan");
  reviewBtn.classList.toggle("active", state.ui.weekTab === "review");
  tabs.append(planBtn, reviewBtn);
  root.append(tabs);

  if (state.ui.weekTab === "plan") {
    const toggleLabel = state.ui.weekShowTimeBlocks
      ? "Mostrar apenas compromissos"
      : "Mostrar compromissos + time-blocks";
    const toggle = createButton(toggleLabel, "ghost-btn", () => {
      state.ui.weekShowTimeBlocks = !state.ui.weekShowTimeBlocks;
      saveState();
      renderMain();
    });
    root.append(toggle);
  }

  if (state.ui.weekTab === "review") {
    renderWeekReview(root);
  } else {
    renderWeekPlan(root);
  }
}

function renderCalendarView(root) {
  const tabs = createElement("div", "week-tabs");
  const weekBtn = createButton("Semana", "tab-btn", () => setCalendarTab("week"));
  const monthBtn = createButton("Mes", "tab-btn", () => setCalendarTab("month"));
  weekBtn.classList.toggle("active", state.ui.calendarTab === "week");
  monthBtn.classList.toggle("active", state.ui.calendarTab === "month");
  tabs.append(weekBtn, monthBtn);
  root.append(tabs);

  if (state.ui.calendarTab === "month") {
    renderCalendarMonth(root);
  } else {
    renderCalendarWeek(root);
  }
}

function renderCalendarWeek(root) {
  const grid = createElement("div", "calendar-week-grid");
  const days = getWeekDays(0);
  days.forEach((day) => {
    const column = createElement("div", "calendar-day");
    const header = createElement("div", "calendar-day-header", day.label);
    column.append(header);
    const items = getAgendaItems(day.date);
    if (!items.length) {
      const empty = createElement("div", "empty");
      empty.append(createElement("div", "list-meta", "Sem itens"));
      const cta = createButton("Criar evento", "ghost-btn", (event) => {
        event.stopPropagation();
        openEventModal({ date: day.date });
      });
      empty.append(cta);
      column.append(empty);
    } else {
      items.forEach((item) => column.append(createCalendarChip(item)));
    }
    column.addEventListener("click", () => openEventModal({ date: day.date }));
    grid.append(column);
  });
  root.append(grid);
}

function renderCalendarMonth(root) {
  const base = addMonths(new Date(), state.ui.calendarMonthOffset);
  const first = new Date(base.getFullYear(), base.getMonth(), 1);
  const start = getWeekStart(first, WEEK_STARTS_MONDAY);
  const header = createElement("div", "calendar-month-header");
  const title = createElement(
    "div",
    "page-title",
    `${base.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`
  );
  const actions = createElement("div", "page-actions");
  actions.append(
    createButton("Mes -", "ghost-btn", () => shiftCalendarMonth(-1)),
    createButton("Mes +", "ghost-btn", () => shiftCalendarMonth(1))
  );
  header.append(title, actions);
  root.append(header);

  const grid = createElement("div", "calendar-month-grid");
  for (let i = 0; i < 42; i += 1) {
    const day = addDays(start, i);
    const dayKey = formatDate(day);
    const cell = createElement("div", "calendar-day");
    if (day.getMonth() !== base.getMonth()) {
      cell.classList.add("muted");
    }
    cell.append(createElement("div", "calendar-day-number", `${day.getDate()}`));
    const items = getAgendaItems(dayKey);
    if (items.length) {
      const count = createElement("div", "list-meta", `${items.length} itens`);
      cell.append(count);
    }
    cell.addEventListener("click", () => {
      openEventModal({ date: dayKey });
    });
    grid.append(cell);
  }
  root.append(grid);
}

function setCalendarTab(tab) {
  state.ui.calendarTab = tab;
  saveState();
  renderMain();
}

function shiftCalendarMonth(offset) {
  state.ui.calendarMonthOffset += offset;
  saveState();
  renderMain();
}

function renderWeekPlan(root) {
  const layout = createElement("div", "week-layout");
  const grid = createElement("div", "week-grid");
  const days = getWeekDays(state.ui.weekOffset);
  const query = (state.ui.search || "").trim().toLowerCase();

  days.forEach((day) => {
    const column = createElement("div", "week-day");
    const header = createElement("div", "week-header", day.label);
    if (day.isToday) {
      header.classList.add("pill");
    }
    header.addEventListener("click", () => openEventModal({ date: day.date }));
    column.append(header);
    attachDropHandlers(column, { date: day.date, time: null });

    const dayTasks = state.tasks.filter((task) => {
      if (task.status === "done") {
        return false;
      }
      return task.dueDate === day.date && !task.timeBlock && matchesTaskSearch(task, query);
    });
    dayTasks.forEach((task) => {
      column.append(createTaskRow(task, { compact: true }));
    });

    getCalendarSlots().forEach((time) => {
      const slot = createElement("div", "week-slot");
      const label = createElement("div", "list-meta", time);
      slot.append(label);
      let slotItems = getScheduledItems(day.date, time).filter((item) =>
        matchesQuery(item.title, query)
      );
      if (!state.ui.weekShowTimeBlocks) {
        slotItems = slotItems.filter((item) => item.kind === "event");
      }
      slotItems.forEach((item) => {
        const chip = createCalendarChip(item);
        slot.append(chip);
      });
      attachDropHandlers(slot, { date: day.date, time });
      slot.addEventListener("click", (event) => {
        if (event.target.closest(".calendar-chip")) {
          return;
        }
        openEventModal({ date: day.date, start: time });
      });
      column.append(slot);
    });
    grid.append(column);
  });

  layout.append(grid);

  const side = createElement("div", "week-tasks");
  const weekTasks = state.tasks.filter((task) => {
    if (task.status === "done") {
      return false;
    }
    return (
      (!task.dueDate || !days.find((day) => day.date === task.dueDate)) &&
      matchesTaskSearch(task, query)
    );
  });

  if (!weekTasks.length) {
    side.append(createElement("div", "empty", "Sem tarefas para planejar."));
  } else {
    weekTasks.forEach((task) => side.append(createTaskRow(task)));
  }

  layout.append(side);
  root.append(layout);
}

function renderWeekReview(root) {
  const sections = [
    { title: "Inbox pendente", items: state.inbox, type: "inbox" },
    { title: "Atrasadas", items: getOverdueTasks(), type: "task" },
    { title: "Proximas 14 dias", items: getNextDaysTasks(14), type: "task" },
    {
      title: "Sem projeto/area",
      items: state.tasks.filter(
        (task) =>
          task.status !== "done" &&
          !task.projectId &&
          !task.areaId
      ),
      type: "task"
    },
    {
      title: "Projetos sem proximo passo",
      items: state.projects.filter((project) => {
        if (project.status === "done") return false;
        return !state.tasks.some(
          (task) => task.projectId === project.id && task.status !== "done"
        );
      }),
      type: "project"
    }
  ];

  sections.forEach((section) => {
    const block = createSection(section.title, "");
    if (!section.items.length) {
      block.body.append(createElement("div", "list-meta", "Nada aqui."));
    } else {
      section.items.forEach((item) => {
        if (section.type === "task") {
          block.body.append(createTaskRow(item, { compact: true }));
        } else if (section.type === "inbox") {
          block.body.append(createInboxRow(item, { compact: true }));
        } else if (section.type === "project") {
          const card = createProjectCard(item);
          card.addEventListener("click", () => navigate(`/projects/${item.id}`));
          block.body.append(card);
        }
      });
    }
    root.append(block.section);
  });

  const closeBtn = createButton("Fechar semana", "primary-btn", () => {
    state.meta.lastReviewAt = new Date().toISOString();
    saveState();
    showToast("Revisao registrada.");
  });
  root.append(closeBtn);
}

function renderProjectsView(root) {
  const filters = createElement("div", "week-tabs");
  ["active", "paused", "done"].forEach((status) => {
    const label = status === "active" ? "Ativos" : status === "paused" ? "Pausados" : "Concluidos";
    const btn = createButton(label, "tab-btn", () => setProjectFilter(status));
    btn.classList.toggle("active", state.ui.projectFilter === status);
    filters.append(btn);
  });
  root.append(filters);

  const list = createElement("div", "projects-grid");
  const query = (state.ui.search || "").trim().toLowerCase();
  const projects = state.projects.filter(
    (project) =>
      project.status === state.ui.projectFilter &&
      matchesQuery(`${project.title} ${project.objective}`, query)
  );
  if (!projects.length) {
    list.append(createElement("div", "empty", "Sem projetos neste filtro."));
  } else {
    projects.forEach((project) => {
      const card = createProjectCard(project);
      card.style.cursor = "pointer";
      card.addEventListener("click", () => selectItem("project", project.id));
      list.append(card);
    });
  }
  root.append(list);
}

function renderProjectDetail(root, projectId) {
  const project = getProject(projectId);
  if (!project) {
    root.append(createElement("div", "empty", "Projeto nao encontrado."));
    return;
  }

  const summary = createSection("Resumo", "");
  const titleInput = document.createElement("input");
  titleInput.value = project.title;
  titleInput.addEventListener("input", () => {
    project.title = titleInput.value;
    touch(project);
    saveStateDebounced();
    renderSidebar();
  });
  const objectiveInput = document.createElement("textarea");
  objectiveInput.rows = 3;
  objectiveInput.value = project.objective || "";
  objectiveInput.addEventListener("input", () => {
    project.objective = objectiveInput.value;
    touch(project);
    saveStateDebounced();
  });
  const statusSelect = createSelect(
    [
      { value: "active", label: "Ativo" },
      { value: "paused", label: "Pausado" },
      { value: "done", label: "Concluido" }
    ],
    project.status
  );
  statusSelect.addEventListener("change", () => {
    project.status = statusSelect.value;
    touch(project);
    saveState();
    renderSidebar();
  });
  const areaSelect = createAreaSelect(project.areaId);
  areaSelect.addEventListener("change", () => {
    project.areaId = areaSelect.value || null;
    touch(project);
    saveState();
  });
  summary.body.append(
    buildField("Titulo", titleInput),
    buildField("Objetivo", objectiveInput),
    buildField("Status", statusSelect),
    buildField("Area", areaSelect)
  );
  root.append(summary.section);

  const nextStep = createSection("Proximo passo", "");
  const nextTask = state.tasks.find(
    (task) => task.projectId === project.id && task.status !== "done"
  );
  if (nextTask) {
    nextStep.body.append(createTaskRow(nextTask));
  } else {
    nextStep.body.append(createElement("div", "list-meta", "Defina o proximo passo."));
  }
  root.append(nextStep.section);

  const tasksSection = createSection("Tarefas do projeto", "");
  const quickInput = document.createElement("input");
  quickInput.placeholder = "Adicionar tarefa ao projeto e Enter";
  quickInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const value = quickInput.value.trim();
      if (!value) {
        return;
      }
      state.tasks.unshift(createTask({ title: value, projectId: project.id }));
      quickInput.value = "";
      saveState();
      renderMain();
    }
  });
  tasksSection.body.append(buildField("Nova tarefa", quickInput));
  STATUS_ORDER.forEach((status) => {
    const group = createElement("div", "section");
    const header = createElement("div", "section-header");
    header.append(
      createElement("div", "section-title", STATUS_LABELS[status]),
      createElement("div", "list-meta", "")
    );
    group.append(header);
    const tasks = state.tasks.filter(
      (task) => task.projectId === project.id && task.status === status
    );
    if (!tasks.length) {
      group.append(createElement("div", "list-meta", "Sem tarefas."));
    } else {
      tasks.forEach((task) => group.append(createTaskRow(task)));
    }
    tasksSection.body.append(group);
  });
  root.append(tasksSection.section);

  const notesSection = createSection("Notas do projeto", "");
  const noteActions = createElement("div", "card-actions");
  noteActions.append(
    createButton("Nova nota", "ghost-btn", () => openNoteModal({ projectId: project.id }))
  );
  notesSection.body.append(noteActions);

  const projectNotes = state.notes.filter((note) => note.projectId === project.id);
  if (!projectNotes.length) {
    notesSection.body.append(createElement("div", "list-meta", "Sem notas ainda."));
  } else {
    projectNotes.forEach((note) => {
      const item = createElement("div", "task-row");
      item.append(createElement("div", "task-title", note.title));
      item.addEventListener("click", () => navigate(`/notes/${note.id}`));
      notesSection.body.append(item);
    });
  }
  root.append(notesSection.section);
}

function renderNotesView(root, noteId) {
  if (noteId) {
    state.ui.notesNoteId = noteId;
  }
  const layout = createElement("div", "notes-layout");
  const tree = createElement("div", "notes-tree");

  const addNoteBtn = createButton("Nova nota", "ghost-btn", () => openNoteModal({}));
  const templatesBtn = createButton("Templates", "ghost-btn", openTemplateChooser);
  tree.append(addNoteBtn, templatesBtn);

  const grouped = groupNotesByArea();
  Object.keys(grouped).forEach((areaId) => {
    const area = areaId ? getArea(areaId) : null;
    const label = area ? area.name : "Sem area";
    const header = createElement("div", "section-title", label);
    tree.append(header);
    grouped[areaId].forEach((note) => {
      const item = createElement("div", "note-item", note.title);
      item.classList.toggle("active", note.id === state.ui.notesNoteId);
      item.addEventListener("click", () => navigate(`/notes/${note.id}`));
      tree.append(item);
    });
  });

  layout.append(tree);

  const editor = createElement("div", "notes-editor");
  const note = state.ui.notesNoteId ? getNote(state.ui.notesNoteId) : null;
  if (!note) {
    const empty = createElement("div", "empty");
    empty.innerHTML = "<h3>Escolha uma nota</h3><p>Ou crie uma nova com um template.</p>";
    const templates = createElement("div", "card-actions");
    templates.append(
      createButton("Reuniao", "ghost-btn", () => openNoteModal({ template: "meeting" })),
      createButton("Diario", "ghost-btn", () => openNoteModal({ template: "diary" })),
      createButton("Estudo", "ghost-btn", () => openNoteModal({ template: "study" })),
      createButton("Planejamento mensal", "ghost-btn", () =>
        openNoteModal({ template: "monthly" })
      )
    );
    empty.append(templates);
    editor.append(empty);
  } else {
    state.ui.selected = { kind: "note", id: note.id };
    const titleInput = document.createElement("input");
    titleInput.value = note.title;
    titleInput.addEventListener("input", () => {
      note.title = titleInput.value;
      touch(note);
      saveStateDebounced();
      renderSidebar();
      renderMain();
    });
    editor.append(buildField("Titulo", titleInput));

    const blockList = createElement("div", "stagger");
    note.blocks.forEach((block, index) => {
      const blockEl = createBlockEditor(note, block, index);
      blockEl.style.setProperty("--delay", `${index * 30}ms`);
      blockList.append(blockEl);
    });
    editor.append(blockList);

    const addBlock = createButton("Adicionar bloco", "ghost-btn", () => {
      note.blocks.push({ id: uid("block"), type: "text", text: "" });
      touch(note);
      saveState();
      renderMain();
    });
    editor.append(addBlock);
  }

  layout.append(editor);
  layout.append(createNotesSidePanel(note));
  root.append(layout);
}

function renderAreasView(root) {
  const shortcuts = createElement("div", "card-actions");
  shortcuts.append(
    createButton("Abrir calendario", "ghost-btn", () => navigate("/calendar"))
  );
  root.append(shortcuts);

  const list = createElement("div", "areas-grid");
  const query = (state.ui.search || "").trim().toLowerCase();
  const areas = state.areas.filter((area) => matchesQuery(area.name, query));
  if (!areas.length) {
    list.append(createElement("div", "empty", "Nenhuma area criada."));
  } else {
    areas.forEach((area) => {
      const card = createAreaCard(area);
      card.style.cursor = "pointer";
      card.addEventListener("click", () => navigate(`/areas/${area.id}`));
      list.append(card);
    });
  }
  root.append(list);
}

// Nova função: renderizar detalhe de área
function renderAreaDetail(root, areaId) {
  const area = getArea(areaId);
  if (!area) {
    root.append(createElement("div", "empty", "Area não encontrada."));
    return;
  }

  const section = createSection(area.name, "");
  
  const nameInput = document.createElement("input");
  nameInput.value = area.name;
  nameInput.addEventListener("input", () => {
    area.name = nameInput.value;
    touch(area);
    saveStateDebounced();
    renderPageHeader();
  });

  section.body.append(buildField("Nome", nameInput));
  root.append(section.section);

  const projectsSection = createSection("Projetos", "");
  const projects = state.projects.filter((p) => p.areaId === area.id);
  if (!projects.length) {
    projectsSection.body.append(createElement("div", "list-meta", "Sem projetos."));
  } else {
    projects.forEach((p) => {
      const card = createProjectCard(p);
      card.style.cursor = "pointer";
      card.addEventListener("click", () => navigate(`/projects/${p.id}`));
      projectsSection.body.append(card);
    });
  }
  root.append(projectsSection.section);

  const tasksSection = createSection("Tarefas", "");
  const tasks = state.tasks.filter((t) => t.areaId === area.id);
  if (!tasks.length) {
    tasksSection.body.append(createElement("div", "list-meta", "Sem tarefas."));
  } else {
    tasks.forEach((t) => tasksSection.body.append(createTaskRow(t)));
  }
  root.append(tasksSection.section);

  const actions = createElement("div", "card-actions");
  actions.append(
    createButton("Editar", "ghost-btn", () => openAreaEditModal(area)),
    createButton("Deletar", "ghost-btn danger", () => {
      if (confirm("Deletar esta area?")) {
        deleteArea(area.id);
        navigate("/areas");
        showToast("Area deletada");
      }
    })
  );
  root.append(actions);
}

function openAreaModal() {
  openModal(
    "Nova area",
    "Area",
    { name: "" },
    (formData) => {
      if (!formData.name.trim()) {
        showToast("Nome obrigatório");
        return;
      }
      const area = createArea(formData);
      state.areas.push(area);
      saveState();
      renderAll();
      showToast("Area criada!");
    }
  );
}

function openAreaEditModal(area) {
  openModal(
    "Editar area",
    "Area",
    { name: area.name },
    (formData) => {
      if (!formData.name.trim()) {
        showToast("Nome obrigatório");
        return;
      }
      area.name = formData.name;
      touch(area);
      saveState();
      renderAll();
      showToast("Area atualizada");
    }
  );
}

function openTaskModal(data = {}) {
  openModal(
    data.id ? "Editar tarefa" : "Nova tarefa",
    "Tarefa",
    {
      title: data.title || "",
      status: data.status || "todo",
      priority: data.priority || "normal",
      dueDate: data.dueDate || "",
      projectId: data.projectId || "",
      areaId: data.areaId || "",
      notes: data.notes || ""
    },
    (formData) => {
      const title = (formData.title || "").trim();
      if (!title) {
        showToast("Titulo obrigatório");
        return;
      }
      if (data.id) {
        const task = getTask(data.id);
        if (task) {
          task.title = title;
          task.status = formData.status || "todo";
          task.priority = formData.priority || "normal";
          task.dueDate = formData.dueDate || "";
          task.projectId = formData.projectId || null;
          task.areaId = formData.areaId || null;
          task.notes = formData.notes || "";
          touch(task);
          saveState();
          renderAll();
          showToast("Tarefa atualizada");
        }
      } else {
        const task = createTask({ title, status: formData.status, priority: formData.priority, dueDate: formData.dueDate, projectId: formData.projectId, areaId: formData.areaId, notes: formData.notes });
        state.tasks.unshift(task);
        saveState();
        renderAll();
        showToast("Tarefa criada!");
      }
    },
    data.id ? () => {
      if (confirm("Deletar tarefa?")) {
        state.tasks = state.tasks.filter((task) => task.id !== data.id);
        markDeleted("tasks", data.id);
        saveState();
        closeModal();
        renderAll();
        showToast("Tarefa deletada.");
      }
    } : null
  );
}

function openTaskScheduleModal(task) {
  const initialDate = task.timeBlock ? task.timeBlock.date : task.dueDate || getTodayKey();
  const initialTime = task.timeBlock ? task.timeBlock.start : "09:00";
  const initialDuration = task.timeBlock ? task.timeBlock.duration : 60;
  openModal(
    "Agendar tarefa",
    "Agenda",
    {
      date: initialDate,
      start: initialTime,
      duration: initialDuration
    },
    (formData) => {
      const date = formData.date || getTodayKey();
      const start = formData.start || "09:00";
      const duration = Math.max(15, Number(formData.duration) || 60);
      task.timeBlock = { date, start, duration };
      task.dueDate = task.dueDate || date;
      touch(task);
      saveState();
      renderAll();
      showToast("Tarefa agendada.");
    }
  );
}

function openEventModal(data = {}) {
  openModal(
    data.id ? "Editar evento" : "Novo evento",
    "Evento",
    {
      title: data.title || "",
      date: data.date || formatDate(new Date()),
      start: data.start || "09:00",
      duration: data.duration || 60,
      location: data.location || "",
      notes: data.notes || ""
    },
    (formData) => {
      const title = (formData.title || "").trim();
      if (!title) {
        showToast("Titulo obrigatório");
        return;
      }
      if (data.id) {
        const event = getEvent(data.id);
        if (event) {
          event.title = title;
          event.date = formData.date || formatDate(new Date());
          event.start = formData.start || "09:00";
          event.duration = Math.max(15, Number(formData.duration) || 60);
          event.location = formData.location || "";
          event.notes = formData.notes || "";
          touch(event);
          saveState();
          renderAll();
          showToast("Evento atualizado");
        }
      } else {
        const event = createEvent({ title, date: formData.date, start: formData.start, duration: formData.duration, location: formData.location, notes: formData.notes });
        state.events.push(event);
        saveState();
        renderAll();
        showToast("Evento criado!");
      }
    },
    data.id ? () => {
      if (confirm("Deletar evento?")) {
        state.events = state.events.filter((event) => event.id !== data.id);
        markDeleted("events", data.id);
        saveState();
        closeModal();
        renderAll();
        showToast("Evento deletado.");
      }
    } : null
  );
}

function openNoteModal(data = {}) {
  const templates = {
    meeting: {
      title: "Notas de reuniao",
      blocks: [
        { id: uid("b"), type: "title", text: "Reuniao - " },
        { id: uid("b"), type: "heading", text: "Participantes" },
        { id: uid("b"), type: "list", items: [""] },
        { id: uid("b"), type: "heading", text: "Discussoes" },
        { id: uid("b"), type: "text", text: "" },
        { id: uid("b"), type: "heading", text: "Acoes" },
        { id: uid("b"), type: "checklist", items: [{ text: "", done: false }] }
      ]
    },
    diary: {
      title: "Entrada de diario",
      blocks: [
        { id: uid("b"), type: "title", text: formatDate(new Date()) },
        { id: uid("b"), type: "text", text: "" }
      ]
    },
    study: {
      title: "Notas de estudo",
      blocks: [
        { id: uid("b"), type: "heading", text: "Topico" },
        { id: uid("b"), type: "text", text: "" },
        { id: uid("b"), type: "heading", text: "Resumo" },
        { id: uid("b"), type: "text", text: "" }
      ]
    },
    monthly: {
      title: "Revisao mensal",
      blocks: [
        { id: uid("b"), type: "heading", text: "Conquistas" },
        { id: uid("b"), type: "list", items: [""] },
        { id: uid("b"), type: "heading", text: "Aprendizados" },
        { id: uid("b"), type: "list", items: [""] }
      ]
    }
  };

  const template = templates[data.template] || { title: "", blocks: [] };
  const noteData = {
    title: data.title || template.title || "Nova nota",
    areaId: data.areaId || "",
    projectId: data.projectId || "",
    blocks: data.blocks || template.blocks || []
  };

  if (data.id) {
    const note = getNote(data.id);
    if (note) {
      state.ui.notesNoteId = note.id;
      navigate(`/notes/${note.id}`);
    }
    return;
  }

  const note = createNote(noteData);
  state.notes.push(note);
  saveState();
  navigate(`/notes/${note.id}`);
}

function openProjectModal() {
  openModal(
    "Novo projeto",
    "Projeto",
    { title: "", objective: "", areaId: "" },
    (formData) => {
      if (!formData.title.trim()) {
        showToast("Nome do projeto obrigatório");
        return;
      }
      const project = createProject(formData);
      state.projects.push(project);
      saveState();
      renderAll();
      showToast("Projeto criado!");
    }
  );
}

function openCreateChooser() {
  const commands = [
    { label: "Tarefa rapida", action: () => openTaskModal({ dueDate: getTodayKey() }) },
    { label: "Evento", action: () => openEventModal({}) },
    { label: "Nota", action: () => openNoteModal({}) },
    { label: "Projeto", action: () => openProjectModal() },
    { label: "Area", action: () => openAreaModal() }
  ];
  openCommandMenu(commands);
}

function openCommandPalette() {
  commandState.open = true;
  commandState.index = 0;
  commandState.previousFocus = document.activeElement;
  el.commandPalette.classList.remove("hidden");
  el.commandInput.style.display = "block";
  el.commandInput.focus();
  buildCommandList();
}

function closeCommandPalette() {
  commandState.open = false;
  el.commandPalette.classList.add("hidden");
  if (commandState.previousFocus) {
    commandState.previousFocus.focus();
  }
}

function buildCommandList() {
  const query = (el.commandInput.value || "").trim().toLowerCase();
  const selected = getSelectedItem();
  const allCommands = [
    { label: "Nova tarefa", action: () => openTaskModal({}) },
    { label: "Novo evento", action: () => openEventModal({}) },
    { label: "Nova nota", action: () => openNoteModal({}) },
    { label: "Novo projeto", action: () => openProjectModal() },
    { label: "Nova area", action: () => openAreaModal() },
    { label: "Ir para hoje", action: () => navigate("/today") },
    { label: "Ir para inbox", action: () => navigate("/inbox") },
    { label: "Ir para semana", action: () => navigate("/week") },
    { label: "Ir para calendario", action: () => navigate("/calendar") },
    { label: "Ir para projetos", action: () => navigate("/projects") },
    { label: "Ir para notas", action: () => navigate("/notes") },
    { label: "Ir para areas", action: () => navigate("/areas") }
  ];

  if (selected.kind === "task" && selected.item) {
    allCommands.unshift(
      { label: "Agendar tarefa selecionada", action: () => openTaskScheduleModal(selected.item) },
      { label: "Adiar tarefa para amanha", action: () => snoozeTask(selected.item, 1) },
      { label: "Adiar tarefa para semana que vem", action: () => snoozeTask(selected.item, 7) },
      { label: "Alternar foco da tarefa", action: () => toggleTaskFocus(selected.item) }
    );
  }

  commandState.filtered = query
    ? allCommands.filter((cmd) => matchesQuery(cmd.label, query))
    : allCommands;

  commandState.index = 0;
  el.commandList.innerHTML = "";

  commandState.filtered.forEach((cmd, index) => {
    const item = createElement("div", "command-item");
    item.append(createElement("span", "", cmd.label));
    item.classList.toggle("active", index === commandState.index);
    item.addEventListener("click", () => {
      cmd.action();
      closeCommandPalette();
    });
    el.commandList.append(item);
  });
}

function handleCommandPaletteKeydown(event) {
  if (event.key === "Escape") {
    closeCommandPalette();
    return;
  }
  if (!commandState.filtered || commandState.filtered.length === 0) {
    return; // Nenhum comando para navegar
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    commandState.index = (commandState.index + 1) % commandState.filtered.length;
    buildCommandList();
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    commandState.index = (commandState.index - 1 + commandState.filtered.length) % commandState.filtered.length;
    buildCommandList();
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    if (commandState.filtered[commandState.index]) {
      commandState.filtered[commandState.index].action();
      closeCommandPalette();
    }
    return;
  }
  if (event.key.length === 1 || event.key === "Backspace") {
    setTimeout(buildCommandList, 0);
  }
}

function openCommandMenu(commands) {
  commandState.open = true;
  commandState.index = 0;
  commandState.filtered = commands;
  commandState.previousFocus = document.activeElement;
  el.commandPalette.classList.remove("hidden");
  el.commandList.innerHTML = "";
  commands.forEach((cmd, index) => {
    const item = createElement("div", "command-item");
    item.append(createElement("span", "", cmd.label));
    item.classList.toggle("active", index === 0);
    item.addEventListener("click", () => {
      cmd.action();
      closeCommandPalette();
    });
    el.commandList.append(item);
  });
  el.commandInput.value = "";
  el.commandInput.style.display = "none";
}

function openModal(title, eyebrow, data, onSave, onDelete) {
  el.modalEyebrow.textContent = eyebrow || "Editor";
  el.modalTitle.textContent = title || "Novo item";
  el.modalBody.innerHTML = "";
  el.modalDelete.classList.toggle("hidden", !onDelete);
  el.modalCancel.textContent = "Cancelar";

  const formData = { ...data };
  const fields = Object.keys(data);
  const hasSave = typeof onSave === "function";
  el.modalSave.classList.toggle("hidden", !hasSave);

  fields.forEach((key) => {
    const value = data[key];
    let input;

    if (key === "status") {
      input = createSelect(
        STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s] })),
        value
      );
    } else if (key === "priority") {
      input = createSelect(
        [
          { value: "low", label: "Baixa" },
          { value: "normal", label: "Normal" },
          { value: "high", label: "Alta" }
        ],
        value
      );
    } else if (key === "areaId") {
      input = createAreaSelect(value);
    } else if (key === "projectId") {
      input = createProjectSelect(value);
    } else if (key === "date" || key === "dueDate") {
      input = document.createElement("input");
      input.type = "date";
      input.value = value;
    } else if (key === "start") {
      input = document.createElement("input");
      input.type = "time";
      input.value = value;
    } else if (key === "duration") {
      input = document.createElement("input");
      input.type = "number";
      input.value = value;
    } else if (key === "notes" || key === "objective") {
      input = document.createElement("textarea");
      input.rows = 4;
      input.value = value;
    } else {
      input = document.createElement("input");
      input.value = value;
    }

    input.addEventListener("change", () => {
      formData[key] = input.value;
    });
    input.addEventListener("input", () => {
      formData[key] = input.value;
    });

    const label = key.charAt(0).toUpperCase() + key.slice(1);
    el.modalBody.append(buildField(label, input));
  });

  modalState.onSave = hasSave ? () => onSave(formData) : null;
  modalState.onDelete = onDelete;
  modalState.previousFocus = document.activeElement;

  el.modalBackdrop.classList.remove("hidden");
  el.modalSave.focus();
}

function openHelpModal() {
  openModal("Ajuda e atalhos", "Atalhos", {}, null, null);
  el.modalCancel.textContent = "Fechar";
  el.modalBody.innerHTML = "";

  const list = createElement("div", "help-list");
  const items = [
    { key: "Ctrl/Cmd+K", desc: "Abrir paleta de comandos" },
    { key: "Enter", desc: "Capturar e confirmar" },
    { key: "Esc", desc: "Fechar modais e painel" },
    { key: "Arrastar", desc: "Criar time-blocks e reordenar" }
  ];

  items.forEach((item) => {
    const row = createElement("div", "help-item");
    row.append(createElement("span", "", item.key), createElement("span", "", item.desc));
    list.append(row);
  });

  el.modalBody.append(list);
  el.modalSave.classList.add("hidden");
  el.modalDelete.classList.add("hidden");
}

function openTemplateChooser() {
  openModal("Templates de nota", "Notas", {}, null, null);
  el.modalCancel.textContent = "Fechar";
  el.modalBody.innerHTML = "";
  const actions = createElement("div", "card-actions");
  actions.append(
    createButton("Reuniao", "ghost-btn", () => {
      closeModal();
      openNoteModal({ template: "meeting" });
    }),
    createButton("Diario", "ghost-btn", () => {
      closeModal();
      openNoteModal({ template: "diary" });
    }),
    createButton("Estudo", "ghost-btn", () => {
      closeModal();
      openNoteModal({ template: "study" });
    }),
    createButton("Planejamento mensal", "ghost-btn", () => {
      closeModal();
      openNoteModal({ template: "monthly" });
    })
  );
  el.modalBody.append(actions);
  el.modalSave.classList.add("hidden");
  el.modalDelete.classList.add("hidden");
}

function openContextMenu(kind, item) {
  openModal("Acoes rapidas", "Atalhos", {}, null, null);
  el.modalCancel.textContent = "Fechar";
  el.modalBody.innerHTML = "";
  const actions = createElement("div", "card-actions");

  if (kind === "task") {
    actions.append(
      createButton("Editar", "ghost-btn", () => {
        closeModal();
        openTaskModal(item);
      }),
      createButton("Agendar", "primary-btn", () => {
        closeModal();
        openTaskScheduleModal(item);
      }),
      createButton("Amanha", "ghost-btn", () => {
        closeModal();
        snoozeTask(item, 1);
      }),
      createButton("+7d", "ghost-btn", () => {
        closeModal();
        snoozeTask(item, 7);
      }),
      createButton("Deletar", "ghost-btn danger", () => {
        closeModal();
        if (confirm("Deletar tarefa?")) {
          state.tasks = state.tasks.filter((task) => task.id !== item.id);
          markDeleted("tasks", item.id);
          saveState();
          renderAll();
        }
      })
    );
  }

  if (kind === "event") {
    actions.append(
      createButton("Editar", "ghost-btn", () => {
        closeModal();
        openEventModal(item);
      }),
      createButton("Deletar", "ghost-btn danger", () => {
        closeModal();
        if (confirm("Deletar evento?")) {
          state.events = state.events.filter((event) => event.id !== item.id);
          markDeleted("events", item.id);
          saveState();
          renderAll();
        }
      })
    );
  }

  el.modalBody.append(actions);
  el.modalSave.classList.add("hidden");
  el.modalDelete.classList.add("hidden");
}

function closeModal() {
  el.modalBackdrop.classList.add("hidden");
  el.modalBody.innerHTML = "";
  modalState.onSave = null;
  modalState.onDelete = null;
  if (modalState.previousFocus) {
    modalState.previousFocus.focus();
  }
}

function handleModalSave() {
  if (modalState.onSave) {
    modalState.onSave();
  }
  closeModal();
}

function handleModalDelete() {
  if (modalState.onDelete && confirm("Tem certeza?")) {
    modalState.onDelete();
    closeModal();
  }
}

function isModalOpen() {
  return !el.modalBackdrop.classList.contains("hidden");
}

function trapTabKey(event) {
  const focusable = el.modalBackdrop.querySelectorAll(
    "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
  );
  if (focusable.length === 0) return; // Sem elementos focáveis
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey) {
    if (document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
  } else {
    if (document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

function openProcessModal(item) {
  el.modalEyebrow.textContent = "Inbox";
  el.modalTitle.textContent = "Processar item";
  el.modalBody.innerHTML = "";
  el.modalDelete.classList.add("hidden");

  const typeSelect = createSelect(
    [
      { value: "task", label: "Tarefa" },
      { value: "event", label: "Evento" },
      { value: "note", label: "Nota" }
    ],
    item.kind || "task"
  );

  const titleInput = document.createElement("input");
  titleInput.value = item.title || "";

  const areaSelect = createAreaSelect("");
  const projectSelect = createProjectSelect("");
  const prioritySelect = createSelect(
    [
      { value: "low", label: "Baixa" },
      { value: "normal", label: "Normal" },
      { value: "high", label: "Alta" }
    ],
    "normal"
  );
  const noteAreaSelect = createAreaSelect("");
  const noteProjectSelect = createProjectSelect("");

  const dueDateInput = document.createElement("input");
  dueDateInput.type = "date";

  const scheduleDateInput = document.createElement("input");
  scheduleDateInput.type = "date";

  const scheduleTimeInput = document.createElement("input");
  scheduleTimeInput.type = "time";

  const scheduleDurationInput = document.createElement("input");
  scheduleDurationInput.type = "number";
  scheduleDurationInput.value = "60";

  const eventDateInput = document.createElement("input");
  eventDateInput.type = "date";
  eventDateInput.value = getTodayKey();

  const eventStartInput = document.createElement("input");
  eventStartInput.type = "time";
  eventStartInput.value = "09:00";

  const eventDurationInput = document.createElement("input");
  eventDurationInput.type = "number";
  eventDurationInput.value = "60";

  const eventLocationInput = document.createElement("input");
  const taskNotesInput = document.createElement("textarea");
  taskNotesInput.rows = 3;
  const eventNotesInput = document.createElement("textarea");
  eventNotesInput.rows = 3;

  const taskFields = createElement("div", "modal-fields");
  taskFields.append(
    buildField("Prioridade", prioritySelect),
    buildField("Area", areaSelect),
    buildField("Projeto", projectSelect),
    buildField("Prazo (dueDate)", dueDateInput),
    buildField("Agendar data", scheduleDateInput),
    buildField("Agendar hora", scheduleTimeInput),
    buildField("Duracao (min)", scheduleDurationInput)
  );

  const eventFields = createElement("div", "modal-fields");
  eventFields.append(
    buildField("Data", eventDateInput),
    buildField("Hora", eventStartInput),
    buildField("Duracao (min)", eventDurationInput),
    buildField("Local", eventLocationInput),
    buildField("Notas", eventNotesInput)
  );

  const noteFields = createElement("div", "modal-fields");
  noteFields.append(buildField("Area", noteAreaSelect), buildField("Projeto", noteProjectSelect));

  const sharedNotesField = buildField("Descricao", taskNotesInput);

  const renderFields = () => {
    taskFields.classList.add("hidden");
    eventFields.classList.add("hidden");
    noteFields.classList.add("hidden");
    sharedNotesField.classList.add("hidden");
    if (typeSelect.value === "task") {
      taskFields.classList.remove("hidden");
      sharedNotesField.classList.remove("hidden");
    } else if (typeSelect.value === "event") {
      eventFields.classList.remove("hidden");
    } else {
      noteFields.classList.remove("hidden");
    }
  };

  typeSelect.addEventListener("change", renderFields);

  el.modalBody.append(
    buildField("Tipo", typeSelect),
    buildField("Titulo", titleInput),
    taskFields,
    eventFields,
    noteFields,
    sharedNotesField
  );

  renderFields();

  modalState.onSave = () => {
    const title = (titleInput.value || "").trim();
    if (!title) {
      showToast("Titulo obrigatorio.");
      return;
    }
    const kind = typeSelect.value;
    if (kind === "task") {
      const task = createTask({
        title,
        priority: prioritySelect.value,
        areaId: areaSelect.value || null,
        projectId: projectSelect.value || null,
        dueDate: dueDateInput.value || "",
        notes: taskNotesInput.value || ""
      });
      if (scheduleDateInput.value && scheduleTimeInput.value) {
        task.timeBlock = {
          date: scheduleDateInput.value,
          start: scheduleTimeInput.value,
          duration: Math.max(15, Number(scheduleDurationInput.value) || 60)
        };
      }
      state.tasks.unshift(task);
    } else if (kind === "event") {
      const event = createEvent({
        title,
        date: eventDateInput.value || getTodayKey(),
        start: eventStartInput.value || "09:00",
        duration: Math.max(15, Number(eventDurationInput.value) || 60),
        location: eventLocationInput.value || "",
        notes: eventNotesInput.value || ""
      });
      state.events.push(event);
    } else {
      const note = createNote({
        title,
        areaId: noteAreaSelect.value || null,
        projectId: noteProjectSelect.value || null
      });
      state.notes.push(note);
    }
    deleteInboxItem(item.id);
    saveState();
    renderAll();
    showToast("Item processado!");
  };
  modalState.onDelete = null;
  modalState.previousFocus = document.activeElement;

  el.modalBackdrop.classList.remove("hidden");
}

function openBulkProcessModal(ids) {
  el.modalEyebrow.textContent = "Processar em lote";
  el.modalTitle.textContent = `${ids.length} itens selecionados`;
  el.modalBody.innerHTML = "";
  el.modalDelete.classList.add("hidden");

  const typeSelect = createSelect(
    [
      { value: "task", label: "Tarefa" },
      { value: "event", label: "Evento" },
      { value: "note", label: "Nota" }
    ],
    "task"
  );
  const areaSelect = createAreaSelect("");
  const projectSelect = createProjectSelect("");
  const prioritySelect = createSelect(
    [
      { value: "low", label: "Baixa" },
      { value: "normal", label: "Normal" },
      { value: "high", label: "Alta" }
    ],
    "normal"
  );
  const noteAreaSelect = createAreaSelect("");
  const noteProjectSelect = createProjectSelect("");
  const dueDateInput = document.createElement("input");
  dueDateInput.type = "date";
  const scheduleDateInput = document.createElement("input");
  scheduleDateInput.type = "date";
  const scheduleTimeInput = document.createElement("input");
  scheduleTimeInput.type = "time";
  const scheduleDurationInput = document.createElement("input");
  scheduleDurationInput.type = "number";
  scheduleDurationInput.value = "60";
  const eventDateInput = document.createElement("input");
  eventDateInput.type = "date";
  eventDateInput.value = getTodayKey();
  const eventStartInput = document.createElement("input");
  eventStartInput.type = "time";
  eventStartInput.value = "09:00";
  const eventDurationInput = document.createElement("input");
  eventDurationInput.type = "number";
  eventDurationInput.value = "60";

  const taskFields = createElement("div", "modal-fields");
  taskFields.append(
    buildField("Prioridade", prioritySelect),
    buildField("Area", areaSelect),
    buildField("Projeto", projectSelect),
    buildField("Prazo (dueDate)", dueDateInput),
    buildField("Agendar data", scheduleDateInput),
    buildField("Agendar hora", scheduleTimeInput),
    buildField("Duracao (min)", scheduleDurationInput)
  );

  const eventFields = createElement("div", "modal-fields");
  eventFields.append(
    buildField("Data", eventDateInput),
    buildField("Hora", eventStartInput),
    buildField("Duracao (min)", eventDurationInput)
  );

  const noteFields = createElement("div", "modal-fields");
  noteFields.append(buildField("Area", noteAreaSelect), buildField("Projeto", noteProjectSelect));

  const renderFields = () => {
    taskFields.classList.add("hidden");
    eventFields.classList.add("hidden");
    noteFields.classList.add("hidden");
    if (typeSelect.value === "task") {
      taskFields.classList.remove("hidden");
    } else if (typeSelect.value === "event") {
      eventFields.classList.remove("hidden");
    } else {
      noteFields.classList.remove("hidden");
    }
  };
  typeSelect.addEventListener("change", renderFields);

  el.modalBody.append(buildField("Tipo", typeSelect), taskFields, eventFields, noteFields);
  renderFields();

  modalState.onSave = () => {
    const kind = typeSelect.value;
    ids.forEach((id) => {
      const item = state.inbox.find((i) => i.id === id);
      if (!item) return;
      if (kind === "task") {
        const task = createTask({
          title: item.title,
          priority: prioritySelect.value,
          areaId: areaSelect.value || null,
          projectId: projectSelect.value || null,
          dueDate: dueDateInput.value || ""
        });
        if (scheduleDateInput.value && scheduleTimeInput.value) {
          task.timeBlock = {
            date: scheduleDateInput.value,
            start: scheduleTimeInput.value,
            duration: Math.max(15, Number(scheduleDurationInput.value) || 60)
          };
        }
        state.tasks.unshift(task);
      } else if (kind === "event") {
        const event = createEvent({
          title: item.title,
          date: eventDateInput.value || getTodayKey(),
          start: eventStartInput.value || "09:00",
          duration: Math.max(15, Number(eventDurationInput.value) || 60)
        });
        state.events.push(event);
      } else {
        const note = createNote({
          title: item.title,
          areaId: noteAreaSelect.value || null,
          projectId: noteProjectSelect.value || null
        });
        state.notes.push(note);
      }
    });
    bulkDeleteInbox(ids);
    closeModal();
    showToast("Itens processados!");
  };
  modalState.onDelete = null;
  modalState.previousFocus = document.activeElement;

  el.modalBackdrop.classList.remove("hidden");
}

function setWeekTab(tab) {
  state.ui.weekTab = tab;
  saveState();
  renderMain();
}

function shiftWeek(offset) {
  state.ui.weekOffset += offset;
  saveState();
  renderMain();
}

function setProjectFilter(status) {
  state.ui.projectFilter = status;
  saveState();
  renderMain();
}

function attachDropHandlers(element, context) {
  element.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    element.classList.add("dropping");
  });

  element.addEventListener("dragleave", () => {
    element.classList.remove("dropping");
  });

  element.addEventListener("drop", (event) => {
    event.preventDefault();
    element.classList.remove("dropping");

    const dragData = event.dataTransfer.getData("application/json");
    if (!dragData) return;

    try {
      const { kind, id } = JSON.parse(dragData);
      if (kind === "task") {
        const task = getTask(id);
        if (!task) return;
        if (context.status) {
          task.status = context.status;
        }
        if (context.date && context.time) {
          task.timeBlock = { date: context.date, start: context.time, duration: 60 };
        } else if (context.date) {
          task.dueDate = context.date;
          task.timeBlock = null;
        }
        touch(task);
        saveState();
        renderMain();
      }
    } catch (error) {
      console.error("Drop error:", error);
    }
  });
}

function setDragData(event, kind, id) {
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("application/json", JSON.stringify({ kind, id }));
}

function toggleTaskFocus(task) {
  if (!task.focus && countFocusTasks() >= 3) {
    showToast("Limite de 3 focos por dia.");
    return;
  }
  task.focus = !task.focus;
  touch(task);
  saveState();
  renderAll();
}

function snoozeTask(task, days) {
  const current = parseDate(task.dueDate);
  const target = current ? addDays(current, days) : addDays(new Date(), days);
  task.dueDate = formatDate(target);
  touch(task);
  saveState();
  renderAll();
  showToast(`Tarefa adiada para ${formatDate(target)}`);
}

function archiveInboxItem(id) {
  state.inbox = state.inbox.filter((item) => item.id !== id);
  markDeleted("inbox", id);
  saveState();
  renderMain();
  showToast("Item arquivado");
}

function deleteInboxItem(id) {
  state.inbox = state.inbox.filter((item) => item.id !== id);
  markDeleted("inbox", id);
  saveState();
  renderMain();
}

function bulkArchiveInbox(ids) {
  state.inbox = state.inbox.filter((item) => !ids.includes(item.id));
  ids.forEach((id) => markDeleted("inbox", id));
  state.ui.inboxSelection = [];
  saveState();
  renderMain();
}

function bulkDeleteInbox(ids) {
  state.inbox = state.inbox.filter((item) => !ids.includes(item.id));
  ids.forEach((id) => markDeleted("inbox", id));
  state.ui.inboxSelection = [];
  saveState();
  renderMain();
}

function toggleInboxSelection(id) {
  const index = state.ui.inboxSelection.indexOf(id);
  if (index > -1) {
    state.ui.inboxSelection.splice(index, 1);
  } else {
    state.ui.inboxSelection.push(id);
  }
  saveState({ render: false });
  renderMain();
}

function handleMobileScroll() {
  // Hide details panel on mobile when scrolling
  if (window.innerWidth < 769 && document.body.classList.contains("details-open")) {
    // Could optionally minimize on mobile scroll
  }
}

function handleInboxShortcuts(event) {
  // Can be extended for inbox-specific shortcuts in future
}

function matchesTaskSearch(task, query) {
  if (!query) return true;
  const projectName = task.projectId ? (getProject(task.projectId)?.title || "") : "";
  return (
    matchesQuery(task.title, query) ||
    matchesQuery(task.notes, query) ||
    matchesQuery(projectName, query)
  );
}

// Funções auxiliares para renderização
function createAreaSelect(value) {
  const options = state.areas.map((a) => ({ value: a.id, label: a.name }));
  options.unshift({ value: "", label: "Sem area" });
  const select = createSelect(options, value || "");
  return select;
}

function createProjectSelect(value) {
  const options = state.projects.map((p) => ({ value: p.id, label: p.title }));
  options.unshift({ value: "", label: "Sem projeto" });
  const select = createSelect(options, value || "");
  return select;
}

function getScheduledItems(date, time) {
  return getAgendaItems(date).filter((item) => item.start === time);
}

function createCalendarChip(item) {
  const chip = createElement("div", "chip");
  chip.textContent = item.title;
  chip.draggable = true;
  chip.addEventListener("dragstart", (event) => setDragData(event, item.kind, item.id));
  chip.addEventListener("click", (event) => {
    event.stopPropagation();
    if (item.kind === "task") {
      selectItem("task", item.id);
    } else if (item.kind === "event") {
      selectItem("event", item.id);
    }
  });
  return chip;
}

function groupNotesByArea() {
  const grouped = {};
  state.notes.forEach((note) => {
      const areaId = note.areaId || null;
      if (!grouped[areaId]) {
        grouped[areaId] = [];
      }
      grouped[areaId].push(note);
    });
  return grouped;
}

function createBlockEditor(note, block, index) {
  const wrapper = createElement("div", "block-editor");
  const header = createElement("div", "block-header");
  const typeSelect = createSelect(BLOCK_TYPES, block.type);
  typeSelect.addEventListener("change", () => {
    block.type = typeSelect.value;
    touch(note);
    saveState();
    renderMain();
  });
  if (["text", "heading", "quote", "title"].includes(block.type)) {
    const taskBtn = createButton("Criar tarefa", "ghost-btn", () => {
      const title = (block.text || "").trim();
      if (!title) {
        showToast("Texto vazio.");
        return;
      }
      state.tasks.unshift(createTask({ title }));
      saveState();
      showToast("Tarefa criada.");
    });
    header.append(taskBtn);
  }
  const deleteBtn = createButton("Deletar", "ghost-btn danger", () => {
    note.blocks.splice(index, 1);
    touch(note);
    saveState();
    renderMain();
  });
  header.append(typeSelect, deleteBtn);
  wrapper.append(header);

  const content = createElement("div", "block-content");
  if (["text", "heading", "quote", "title"].includes(block.type)) {
    const input = document.createElement("textarea");
    input.rows = 3;
    input.value = block.text || "";
    input.addEventListener("input", () => {
      block.text = input.value;
      touch(note);
      saveStateDebounced();
    });
    content.append(input);
  } else if (["list", "checklist"].includes(block.type)) {
    const itemList = createElement("div", "list-editor");
    (block.items || []).forEach((item, idx) => {
      const itemWrap = createElement("div", "list-item");
      const input = document.createElement("input");
      input.value = typeof item === "string" ? item : item.text || "";
      input.addEventListener("input", () => {
        if (typeof block.items[idx] === "string") {
          block.items[idx] = input.value;
        } else {
          block.items[idx].text = input.value;
        }
        touch(note);
        saveStateDebounced();
      });
      itemWrap.append(input);
      if (block.type === "checklist") {
        const convertBtn = createButton("-> tarefa", "ghost-btn", () => {
          const title = input.value.trim();
          if (!title) {
            showToast("Texto vazio.");
            return;
          }
          state.tasks.unshift(createTask({ title }));
          block.items.splice(idx, 1);
          touch(note);
          saveState();
          renderMain();
          showToast("Item convertido em tarefa.");
        });
        itemWrap.append(convertBtn);
      }
      itemList.append(itemWrap);
    });
    content.append(itemList);
  } else if (block.type === "table") {
    const tableWrap = createElement("div", "table-editor");
    tableWrap.append(createElement("div", "list-meta", "Editar tabela..."));
    content.append(tableWrap);
  } else if (block.type === "embed") {
    const input = document.createElement("input");
    input.placeholder = "URL do embed";
    input.value = block.url || "";
    input.addEventListener("input", () => {
      block.url = input.value;
      touch(note);
      saveStateDebounced();
    });
    content.append(input);
  }
  wrapper.append(content);
  return wrapper;
}

function createNotesSidePanel(note) {
  const panel = createElement("div", "notes-sidepanel");
  if (!note) {
    return panel;
  }

  const areaSelect = createAreaSelect(note.areaId);
  areaSelect.addEventListener("change", () => {
    note.areaId = areaSelect.value || null;
    touch(note);
    saveState();
  });

  const actions = createElement("div", "card-actions");
  actions.append(
    createButton("Deletar", "ghost-btn danger", () => {
      if (confirm("Deletar esta nota?")) {
        state.notes = state.notes.filter((n) => n.id !== note.id);
        markDeleted("notes", note.id);
        saveState();
        navigate("/notes");
        showToast("Nota deletada");
      }
    })
  );

  panel.append(buildField("Area", areaSelect), actions);
  return panel;
}

function deleteArea(areaId) {
  state.areas = state.areas.filter((a) => a.id !== areaId);
  state.projects = state.projects.map((p) => (p.areaId === areaId ? { ...p, areaId: null } : p));
  state.tasks = state.tasks.map((t) => (t.areaId === areaId ? { ...t, areaId: null } : t));
  markDeleted("areas", areaId);
  saveState();
}

function selectItem(kind, id) {
  state.ui.selected = { kind, id };
  setDetailsOpen(true);
  renderDetailsPanel();
}

function clearSelection() {
  state.ui.selected = { kind: null, id: null };
  setDetailsOpen(false);
  renderDetailsPanel();
}

function renderDetailsPanel() {
  const selection = getSelectedItem();
  if (!selection.item) {
    el.detailsPanel.innerHTML = "";
    return;
  }

  el.detailsTitle.textContent = selection.item.title || selection.item.name || "Detalhe";
  el.detailsBody.innerHTML = "";

  const info = createElement("div", "details-info");
  const typeLabel = {
    task: "Tarefa",
    event: "Evento",
    note: "Nota",
    project: "Projeto"
  }[selection.kind] || "Item";
  info.append(createElement("div", "detail-row", `Tipo: ${typeLabel}`));
  if (selection.kind === "task") {
    info.append(
      createElement("div", "detail-row", `Status: ${STATUS_LABELS[selection.item.status]}`),
      createElement("div", "detail-row", `Prioridade: ${PRIORITY_LABELS[selection.item.priority]}`),
      selection.item.dueDate ? createElement("div", "detail-row", `Data: ${selection.item.dueDate}`) : null
    );
    const actions = createElement("div", "card-actions");
    actions.append(
      createButton("Editar", "ghost-btn", () => openTaskModal(selection.item)),
      createButton("Agendar", "primary-btn", () => openTaskScheduleModal(selection.item)),
      createButton("Amanha", "ghost-btn", () => snoozeTask(selection.item, 1)),
      createButton("Deletar", "ghost-btn danger", () => {
        if (confirm("Deletar tarefa?")) {
          state.tasks = state.tasks.filter((task) => task.id !== selection.item.id);
          markDeleted("tasks", selection.item.id);
          saveState();
          clearSelection();
          renderAll();
        }
      })
    );
    info.append(actions);
  } else if (selection.kind === "event") {
    info.append(
      createElement("div", "detail-row", `Data: ${selection.item.date}`),
      createElement("div", "detail-row", `Hora: ${selection.item.start}`),
      createElement("div", "detail-row", `Duracao: ${selection.item.duration}min`)
    );
    const actions = createElement("div", "card-actions");
    actions.append(
      createButton("Editar", "ghost-btn", () => openEventModal(selection.item)),
      createButton("Deletar", "ghost-btn danger", () => {
        if (confirm("Deletar evento?")) {
          state.events = state.events.filter((event) => event.id !== selection.item.id);
          markDeleted("events", selection.item.id);
          saveState();
          clearSelection();
          renderAll();
        }
      })
    );
    info.append(actions);
  } else if (selection.kind === "note") {
    info.append(
      createElement("div", "detail-row", `Titulo: ${selection.item.title}`),
      selection.item.areaId
        ? createElement("div", "detail-row", `Area: ${getArea(selection.item.areaId)?.name || ""}`)
        : null,
      selection.item.projectId
        ? createElement("div", "detail-row", `Projeto: ${getProject(selection.item.projectId)?.title || ""}`)
        : null
    );
    const actions = createElement("div", "card-actions");
    actions.append(
      createButton("Abrir nota", "ghost-btn", () => navigate(`/notes/${selection.item.id}`)),
      createButton("Deletar", "ghost-btn danger", () => {
        if (confirm("Deletar nota?")) {
          state.notes = state.notes.filter((note) => note.id !== selection.item.id);
          markDeleted("notes", selection.item.id);
          saveState();
          clearSelection();
          renderAll();
        }
      })
    );
    info.append(actions);
  } else if (selection.kind === "project") {
    info.append(
      createElement("div", "detail-row", `Objetivo: ${selection.item.objective || "-"}`),
      createElement("div", "detail-row", `Status: ${selection.item.status}`)
    );
    if (selection.item.areaId) {
      info.append(
        createElement("div", "detail-row", `Area: ${getArea(selection.item.areaId)?.name || ""}`)
      );
    }
    const nextTask = state.tasks.find(
      (task) => task.projectId === selection.item.id && task.status !== "done"
    );
    if (nextTask) {
      info.append(createElement("div", "detail-row", `Proximo passo: ${nextTask.title}`));
    }
    const actions = createElement("div", "card-actions");
    actions.append(
      createButton("Abrir projeto", "ghost-btn", () => navigate(`/projects/${selection.item.id}`))
    );
    info.append(actions);
  }
  el.detailsBody.append(info);
}

function showToast(message) {
  const toast = createElement("div", "toast", message);
  el.toastContainer.append(toast);
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function showActionToast(message, actionLabel, actionFn) {
  const toast = createElement("div", "toast");
  const text = createElement("span", "", message);
  const actions = createElement("div", "toast-actions");
  const button = createButton(actionLabel, "toast-btn", () => {
    actionFn();
    toast.remove();
  });
  actions.append(button);
  toast.append(text, actions);
  el.toastContainer.append(toast);
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

function updateConnectionStatus() {
  if (!el.offlineBanner) return;
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  el.offlineBanner.classList.toggle("hidden", !offline);
}



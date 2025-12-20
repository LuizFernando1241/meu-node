"use strict";

const STORAGE_KEY = "meu-node-v2";
const REMOTE_KEY = "meu-node-remote-v2";
const DEFAULT_API_URL = "https://meu-node.onrender.com";
const DEFAULT_API_KEY = "meu-node-2025-abc123";
const BASE_PATH = "/meu-node";
const SAVE_DEBOUNCE_MS = 250;

const STATUS_ORDER = ["todo", "doing", "done"];
const STATUS_LABELS = {
  todo: "A fazer",
  doing: "Fazendo",
  done: "Feito"
};

const PRIORITY_LABELS = {
  low: "Baixa",
  med: "Media",
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
  projects: { title: "Projetos", eyebrow: "Visao macro" },
  project: { title: "Projeto", eyebrow: "Detalhe" },
  notes: { title: "Notas", eyebrow: "Conhecimento" },
  note: { title: "Nota", eyebrow: "Detalhe" },
  calendar: { title: "Calendario", eyebrow: "Agenda" },
  areas: { title: "Areas", eyebrow: "Estrutura" },
  area: { title: "Area", eyebrow: "Detalhe" },
  archive: { title: "Arquivo", eyebrow: "Historico" }
};

const el = {
  appRoot: document.getElementById("appRoot"),
  globalSearch: document.getElementById("globalSearch"),
  searchClear: document.getElementById("searchClear"),
  createBtn: document.getElementById("createBtn"),
  commandBtn: document.getElementById("commandBtn"),
  avatarToggle: document.getElementById("avatarToggle"),
  avatarMenu: document.getElementById("avatarMenu"),
  openSettings: document.getElementById("openSettings"),
  exportData: document.getElementById("exportData"),
  importData: document.getElementById("importData"),
  moreToggle: document.getElementById("moreToggle"),
  moreMenu: document.getElementById("moreMenu"),
  settingsShortcut: document.getElementById("settingsShortcut"),
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
  toastContainer: document.getElementById("toastContainer")
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
let remote = normalizeRemote(loadRemoteConfig());
const sync = { timer: null, busy: false, pending: false, lastPushedHash: "" };
let saveTimer = null;
let openMenu = null;

function init() {
  bindEvents();
  applyDefaultRemoteConfig();
  applyRouteFromLocation();
  renderAll();
  if (remote.url && remote.apiKey && remote.autoSync) {
    pullState({ queuePush: true, pushOnEmpty: true });
  }
}

init();

function bindEvents() {
  if (el.globalSearch) {
    el.globalSearch.addEventListener("input", () => {
      state.ui.search = el.globalSearch.value;
      saveStateDebounced();
      renderAll();
    });
  }

  if (el.searchClear) {
    el.searchClear.addEventListener("click", () => {
      state.ui.search = "";
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
  if (el.commandBtn) {
    el.commandBtn.addEventListener("click", openCommandPalette);
  }

  if (el.avatarToggle) {
    el.avatarToggle.addEventListener("click", () => toggleMenu(el.avatarMenu));
  }

  if (el.openSettings) {
    el.openSettings.addEventListener("click", () => {
      closeAllMenus();
      openSettingsModal();
    });
  }

  if (el.exportData) {
    el.exportData.addEventListener("click", () => {
      closeAllMenus();
      openExportModal();
    });
  }

  if (el.importData) {
    el.importData.addEventListener("click", () => {
      closeAllMenus();
      openImportModal();
    });
  }

  if (el.moreToggle) {
    el.moreToggle.addEventListener("click", () => {
      toggleMenu(el.moreMenu);
      el.moreToggle.setAttribute(
        "aria-expanded",
        String(!el.moreMenu.classList.contains("hidden"))
      );
    });
  }

  if (el.settingsShortcut) {
    el.settingsShortcut.addEventListener("click", () => {
      closeAllMenus();
      openSettingsModal();
    });
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
  if (openMenu && !openMenu.contains(event.target)) {
    openMenu.classList.add("hidden");
    openMenu = null;
    if (el.moreToggle) {
      el.moreToggle.setAttribute("aria-expanded", "false");
    }
  }

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

function toggleMenu(menu) {
  if (!menu) {
    return;
  }
  const isHidden = menu.classList.contains("hidden");
  closeAllMenus();
  if (isHidden) {
    menu.classList.remove("hidden");
    openMenu = menu;
  }
}

function closeAllMenus() {
  if (el.avatarMenu) {
    el.avatarMenu.classList.add("hidden");
  }
  if (el.moreMenu) {
    el.moreMenu.classList.add("hidden");
  }
  openMenu = null;
  if (el.moreToggle) {
    el.moreToggle.setAttribute("aria-expanded", "false");
  }
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
  if (parts[0] === "calendar") {
    return { name: "calendar" };
  }
  if (parts[0] === "areas") {
    if (parts[1]) {
      return { name: "area", id: parts[1] };
    }
    return { name: "areas" };
  }
  if (parts[0] === "archive") {
    return { name: "archive" };
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
    settings: {
      weekStartsMonday: true,
      timeFormat: "24h",
      defaultEventDuration: 60,
      timeStepMinutes: 30,
      apiUrl: DEFAULT_API_URL,
      apiKey: DEFAULT_API_KEY,
      autoSync: true
    },
    meta: {
      lastReviewAt: null
    },
    ui: {
      route: "/today",
      search: "",
      selected: { kind: null, id: null },
      weekTab: "plan",
      weekOffset: 0,
      calendarView: "week",
      calendarWeekOffset: 0,
      calendarMonthOffset: 0,
      projectFilter: "active",
      projectViewMode: "list",
      notesAreaId: null,
      notesNoteId: null,
      inboxSelection: [],
      inboxActiveId: null,
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
  const settings = {
    ...base.settings,
    ...(data.settings || {})
  };
  return {
    tasks: Array.isArray(data.tasks) ? data.tasks.map(normalizeTask).filter(Boolean) : [],
    events: Array.isArray(data.events) ? data.events.map(normalizeEvent).filter(Boolean) : [],
    notes: Array.isArray(data.notes) ? data.notes.map(normalizeNote).filter(Boolean) : [],
    projects: Array.isArray(data.projects) ? data.projects.map(normalizeProject).filter(Boolean) : [],
    areas: Array.isArray(data.areas) ? data.areas.map(normalizeArea).filter(Boolean) : [],
    inbox: Array.isArray(data.inbox) ? data.inbox.map(normalizeInboxItem).filter(Boolean) : [],
    settings,
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
  if (!options.skipSync) {
    scheduleAutoSync();
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

function defaultRemoteConfig() {
  return {
    url: DEFAULT_API_URL,
    apiKey: DEFAULT_API_KEY,
    autoSync: true,
    lastSyncAt: null,
    lastError: ""
  };
}

function loadRemoteConfig() {
  const raw = localStorage.getItem(REMOTE_KEY);
  if (!raw) {
    return defaultRemoteConfig();
  }
  try {
    return normalizeRemote(JSON.parse(raw));
  } catch (error) {
    return defaultRemoteConfig();
  }
}

function normalizeRemote(data) {
  const base = defaultRemoteConfig();
  if (!data || typeof data !== "object") {
    return base;
  }
  return {
    url: typeof data.url === "string" ? data.url : base.url,
    apiKey: typeof data.apiKey === "string" ? data.apiKey : base.apiKey,
    autoSync: Boolean(data.autoSync),
    lastSyncAt: Number.isFinite(data.lastSyncAt) ? data.lastSyncAt : base.lastSyncAt,
    lastError: typeof data.lastError === "string" ? data.lastError : base.lastError
  };
}

function saveRemoteConfig() {
  localStorage.setItem(REMOTE_KEY, JSON.stringify(remote));
}

function applyDefaultRemoteConfig() {
  let updated = false;
  if (!remote.url && DEFAULT_API_URL) {
    remote.url = DEFAULT_API_URL;
    updated = true;
  }
  if (!remote.apiKey && DEFAULT_API_KEY) {
    remote.apiKey = DEFAULT_API_KEY;
    updated = true;
  }
  if (updated) {
    saveRemoteConfig();
  }
  state.settings.apiUrl = remote.url;
  state.settings.apiKey = remote.apiKey;
  state.settings.autoSync = remote.autoSync;
}

function buildApiUrl(path) {
  const base = (remote.url || "").trim();
  if (!base) {
    return "";
  }
  return base.replace(/\/+$/, "") + path;
}

function buildStateUrl() {
  return buildApiUrl("/state");
}

function getAuthHeaders() {
  const headers = { "Content-Type": "application/json" };
  if (remote.apiKey) {
    headers["X-API-Key"] = remote.apiKey;
  }
  return headers;
}

function getSyncState(source = state) {
  return {
    tasks: source.tasks || [],
    events: source.events || [],
    notes: source.notes || [],
    projects: source.projects || [],
    areas: source.areas || [],
    inbox: source.inbox || [],
    settings: source.settings || {},
    meta: source.meta || {}
  };
}

function hashSyncState(syncState) {
  try {
    return JSON.stringify(syncState);
  } catch (error) {
    return "";
  }
}

function buildSyncStatus() {
  if (!remote.url) {
    return "Sync desativado";
  }
  if (remote.lastError) {
    return `Erro: ${remote.lastError}`;
  }
  if (remote.lastSyncAt) {
    return `Ultimo sync: ${new Date(remote.lastSyncAt).toLocaleString("pt-BR")}`;
  }
  return remote.autoSync ? "Sync ativo" : "Sync manual";
}

function refreshSyncStatus(message) {
  if (el.syncStatus) {
    el.syncStatus.textContent = message || buildSyncStatus();
  }
}

function scheduleAutoSync() {
  if (!remote.autoSync || !remote.url || !remote.apiKey) {
    return;
  }
  sync.pending = true;
  if (sync.timer) {
    clearTimeout(sync.timer);
  }
  sync.timer = setTimeout(() => {
    sync.timer = null;
    if (sync.busy) {
      return;
    }
    pushState({ silent: true });
  }, 1000);
}

async function pushState(options = {}) {
  const url = buildStateUrl();
  if (!url) {
    remote.lastError = "Configure URL";
    saveRemoteConfig();
    refreshSyncStatus();
    return { ok: false, error: remote.lastError };
  }
  if (!remote.apiKey) {
    remote.lastError = "Informe a API Key";
    saveRemoteConfig();
    refreshSyncStatus();
    return { ok: false, error: remote.lastError };
  }
  if (sync.busy) {
    sync.pending = true;
    return { ok: false, error: "Sync em andamento" };
  }
  sync.busy = true;
  sync.pending = false;
  try {
    const payloadState = getSyncState();
    const payloadHash = hashSyncState(payloadState);
    if (payloadHash && payloadHash === sync.lastPushedHash) {
      refreshSyncStatus();
      return { ok: true, skipped: true };
    }
    const response = await fetch(url, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ state: payloadState })
    });
    if (!response.ok) {
      remote.lastError = `HTTP ${response.status}`;
      saveRemoteConfig();
      refreshSyncStatus();
      return { ok: false, error: remote.lastError };
    }
    const data = await response.json().catch(() => ({}));
    remote.lastSyncAt = Number.isFinite(data.updatedAt) ? data.updatedAt : Date.now();
    remote.lastError = "";
    saveRemoteConfig();
    sync.lastPushedHash = payloadHash;
    refreshSyncStatus();
    return { ok: true };
  } catch (error) {
    remote.lastError = "Falha de rede";
    saveRemoteConfig();
    refreshSyncStatus();
    return { ok: false, error: remote.lastError };
  } finally {
    sync.busy = false;
    if (sync.pending) {
      scheduleAutoSync();
    }
  }
}

async function pullState(options = {}) {
  const url = buildStateUrl();
  if (!url) {
    remote.lastError = "Configure URL";
    saveRemoteConfig();
    refreshSyncStatus();
    return { ok: false, error: remote.lastError };
  }
  if (!remote.apiKey) {
    remote.lastError = "Informe a API Key";
    saveRemoteConfig();
    refreshSyncStatus();
    return { ok: false, error: remote.lastError };
  }
  if (sync.busy) {
    return { ok: false, error: "Sync em andamento" };
  }
  sync.busy = true;
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: getAuthHeaders()
    });
    if (response.status === 404) {
      remote.lastError = "Servidor vazio";
      saveRemoteConfig();
      refreshSyncStatus();
      if (options.pushOnEmpty) {
        scheduleAutoSync();
      }
      return { ok: false, error: remote.lastError };
    }
    if (!response.ok) {
      remote.lastError = `HTTP ${response.status}`;
      saveRemoteConfig();
      refreshSyncStatus();
      return { ok: false, error: remote.lastError };
    }
    const data = await response.json().catch(() => null);
    if (!data || !data.state || typeof data.state !== "object") {
      remote.lastError = "Resposta invalida";
      saveRemoteConfig();
      refreshSyncStatus();
      return { ok: false, error: remote.lastError };
    }
    const normalized = normalizeState(data.state);
    state = normalized;
    saveState({ skipSync: true });
    if (Number.isFinite(data.updatedAt)) {
      remote.lastSyncAt = data.updatedAt;
    } else {
      remote.lastSyncAt = Date.now();
    }
    remote.lastError = "";
    saveRemoteConfig();
    refreshSyncStatus();
    if (options.queuePush) {
      scheduleAutoSync();
    }
    renderAll();
    return { ok: true };
  } catch (error) {
    remote.lastError = "Falha de rede";
    saveRemoteConfig();
    refreshSyncStatus();
    return { ok: false, error: remote.lastError };
  } finally {
    sync.busy = false;
    if (sync.pending) {
      scheduleAutoSync();
    }
  }
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
  normalized.priority = ["low", "med", "high"].includes(normalized.priority)
    ? normalized.priority
    : "med";
  normalized.dueDate = typeof normalized.dueDate === "string" ? normalized.dueDate : "";
  normalized.dueTime = typeof normalized.dueTime === "string" ? normalized.dueTime : "";
  normalized.projectId = typeof normalized.projectId === "string" ? normalized.projectId : null;
  normalized.areaId = typeof normalized.areaId === "string" ? normalized.areaId : null;
  normalized.notes = typeof normalized.notes === "string" ? normalized.notes : "";
  normalized.checklist = Array.isArray(normalized.checklist) ? normalized.checklist : [];
  normalized.attachments = Array.isArray(normalized.attachments) ? normalized.attachments : [];
  normalized.linkedNoteId =
    typeof normalized.linkedNoteId === "string" ? normalized.linkedNoteId : null;
  normalized.sourceNoteId =
    typeof normalized.sourceNoteId === "string" ? normalized.sourceNoteId : null;
  normalized.focus = Boolean(normalized.focus);
  normalized.archived = Boolean(normalized.archived);
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
  normalized.projectId = typeof normalized.projectId === "string" ? normalized.projectId : null;
  normalized.areaId = typeof normalized.areaId === "string" ? normalized.areaId : null;
  normalized.location = typeof normalized.location === "string" ? normalized.location : "";
  normalized.notes = typeof normalized.notes === "string" ? normalized.notes : "";
  normalized.recurrence = ["none", "daily", "weekly", "monthly"].includes(normalized.recurrence)
    ? normalized.recurrence
    : "none";
  normalized.archived = Boolean(normalized.archived);
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
  normalized.archived = Boolean(normalized.archived);
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
  normalized.name = typeof normalized.name === "string" ? normalized.name : "Novo projeto";
  normalized.objective = typeof normalized.objective === "string" ? normalized.objective : "";
  normalized.areaId = typeof normalized.areaId === "string" ? normalized.areaId : null;
  normalized.status = ["active", "paused", "done"].includes(normalized.status)
    ? normalized.status
    : "active";
  normalized.notes = typeof normalized.notes === "string" ? normalized.notes : "";
  normalized.milestones = Array.isArray(normalized.milestones) ? normalized.milestones : [];
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
  normalized.objective = typeof normalized.objective === "string" ? normalized.objective : "";
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
  return date.toISOString().slice(0, 10);
}

function formatTimeLabel(time) {
  return time || "--:--";
}

function parseDate(value) {
  if (!value) {
    return null;
  }
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
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
    state.settings.timeStepMinutes
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
  const day = date.getDay();
  const diff = startsMonday ? (day === 0 ? -6 : 1 - day) : -day;
  return addDays(dateOnly(date), diff);
}

function getWeekDays(offset = 0) {
  const base = addDays(new Date(), offset * 7);
  const weekStart = getWeekStart(base, state.settings.weekStartsMonday);
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
  return normalizeTask({
    id: uid("task"),
    title: data.title || "Nova tarefa",
    status: data.status || "todo",
    priority: data.priority || "med",
    dueDate: data.dueDate || "",
    dueTime: data.dueTime || "",
    projectId: data.projectId || null,
    areaId: data.areaId || null,
    notes: data.notes || "",
    checklist: data.checklist || [],
    attachments: data.attachments || [],
    linkedNoteId: data.linkedNoteId || null,
    sourceNoteId: data.sourceNoteId || null,
    focus: Boolean(data.focus),
    archived: Boolean(data.archived),
    timeBlock: data.timeBlock || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

function createEvent(data = {}) {
  return normalizeEvent({
    id: uid("event"),
    title: data.title || "Novo evento",
    date: data.date || formatDate(new Date()),
    start: data.start || "09:00",
    duration: Number.isFinite(data.duration) ? data.duration : state.settings.defaultEventDuration,
    projectId: data.projectId || null,
    areaId: data.areaId || null,
    location: data.location || "",
    notes: data.notes || "",
    recurrence: data.recurrence || "none",
    archived: Boolean(data.archived),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

function createNote(data = {}) {
  return normalizeNote({
    id: uid("note"),
    title: data.title || "Nova nota",
    areaId: data.areaId || null,
    projectId: data.projectId || null,
    blocks: Array.isArray(data.blocks) ? data.blocks : [],
    archived: Boolean(data.archived),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

function createProject(data = {}) {
  return normalizeProject({
    id: uid("project"),
    name: data.name || "Novo projeto",
    objective: data.objective || "",
    areaId: data.areaId || null,
    status: data.status || "active",
    notes: data.notes || "",
    milestones: Array.isArray(data.milestones) ? data.milestones : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

function createArea(data = {}) {
  return normalizeArea({
    id: uid("area"),
    name: data.name || "Nova area",
    objective: data.objective || "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
}

function createInboxItem(title) {
  return normalizeInboxItem({
    id: uid("cap"),
    title: title || "Captura",
    kind: suggestInboxKind(title),
    createdAt: new Date().toISOString()
  });
}

function touch(item) {
  if (item) {
    item.updatedAt = new Date().toISOString();
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
  return { kind: null, item: null };
}

function getTodayKey() {
  return formatDate(new Date());
}

function getOverdueTasks() {
  const today = dateOnly(new Date());
  return state.tasks.filter((task) => {
    if (task.archived || task.status === "done") {
      return false;
    }
    const due = parseDate(task.dueDate);
    return due && due < today;
  });
}

function getTodayTasks() {
  const today = getTodayKey();
  return state.tasks.filter((task) => {
    if (task.archived || task.status === "done") {
      return false;
    }
    return task.dueDate === today;
  });
}

function getNextDaysTasks(days = 7) {
  const today = dateOnly(new Date());
  const end = addDays(today, days);
  return state.tasks.filter((task) => {
    if (task.archived || task.status === "done" || !task.dueDate) {
      return false;
    }
    const due = parseDate(task.dueDate);
    return due && due >= today && due <= end;
  });
}

function getAgendaItems(dateKey) {
  const items = [];
  state.events.forEach((event) => {
    if (!event.archived && event.date === dateKey) {
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
    if (task.archived || task.status === "done" || !task.timeBlock) {
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
  return state.tasks.filter((task) => task.focus && !task.archived && task.status !== "done").length;
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
  refreshSyncStatus();
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
  if (route.name === "today") {
    renderTodayView(el.viewRoot);
  } else if (route.name === "inbox") {
    renderInboxView(el.viewRoot);
  } else if (route.name === "week") {
    renderWeekView(el.viewRoot);
  } else if (route.name === "projects") {
    renderProjectsView(el.viewRoot);
  } else if (route.name === "project") {
    renderProjectDetail(el.viewRoot, route.id);
  } else if (route.name === "notes") {
    renderNotesView(el.viewRoot);
  } else if (route.name === "note") {
    renderNotesView(el.viewRoot, route.id);
  } else if (route.name === "calendar") {
    renderCalendarView(el.viewRoot);
  } else if (route.name === "areas") {
    renderAreasView(el.viewRoot);
  } else if (route.name === "area") {
    renderAreaDetail(el.viewRoot, route.id);
  } else if (route.name === "archive") {
    renderArchiveView(el.viewRoot);
  }
}

function renderPageActions(route, container) {
  if (!route) {
    return;
  }
  if (route.name === "today") {
    container.append(
      createButton("Nova tarefa", "ghost-btn", () => openTaskModal({ dueDate: getTodayKey() }))
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
      createButton("Semana -", "ghost-btn", () => shiftWeek(-1)),
      createButton("Semana +", "ghost-btn", () => shiftWeek(1))
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
    container.append(createButton("Nova nota", "primary-btn", () => openNoteModal({})));
  }
  if (route.name === "calendar") {
    container.append(
      createButton("Semana -", "ghost-btn", () => shiftCalendarWeek(-1)),
      createButton("Semana +", "ghost-btn", () => shiftCalendarWeek(1)),
      createButton("Mes -", "ghost-btn", () => shiftCalendarMonth(-1)),
      createButton("Mes +", "ghost-btn", () => shiftCalendarMonth(1)),
      createButton("Novo evento", "primary-btn", () => openEventModal({}))
    );
  }
  if (route.name === "areas") {
    container.append(createButton("Nova area", "primary-btn", openAreaModal));
  }
}

function renderTodayView(root) {
  const wrap = createElement("div", "today-grid");
  const query = (state.ui.search || "").trim().toLowerCase();

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
      !task.archived &&
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

  if (state.ui.weekTab === "review") {
    renderWeekReview(root);
  } else {
    renderWeekPlan(root);
  }
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
    column.append(header);
    attachDropHandlers(column, { date: day.date, time: null });

    const dayTasks = state.tasks.filter((task) => {
      if (task.archived || task.status === "done") {
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
      const slotItems = getScheduledItems(day.date, time).filter((item) =>
        matchesQuery(item.title, query)
      );
      slotItems.forEach((item) => {
        const chip = createCalendarChip(item);
        slot.append(chip);
      });
      attachDropHandlers(slot, { date: day.date, time });
      column.append(slot);
    });
    grid.append(column);
  });

  layout.append(grid);

  const side = createElement("div", "week-tasks");
  const weekTasks = state.tasks.filter((task) => {
    if (task.archived || task.status === "done") {
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
          !task.archived &&
          task.status !== "done" &&
          !task.projectId &&
          !task.areaId
      ),
      type: "task"
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
      matchesQuery(`${project.name} ${project.objective}`, query)
  );
  if (!projects.length) {
    list.append(createElement("div", "empty", "Sem projetos neste filtro."));
  } else {
    projects.forEach((project) => list.append(createProjectCard(project)));
  }
  root.append(list);
}

function renderProjectDetail(root, projectId) {
  const project = getProject(projectId);
  if (!project) {
    root.append(createElement("div", "empty", "Projeto nao encontrado."));
    return;
  }

  const viewToggle = createElement("div", "week-tabs");
  const listBtn = createButton("Lista", "tab-btn", () => setProjectViewMode("list"));
  const kanbanBtn = createButton("Kanban", "tab-btn", () => setProjectViewMode("kanban"));
  listBtn.classList.toggle("active", state.ui.projectViewMode !== "kanban");
  kanbanBtn.classList.toggle("active", state.ui.projectViewMode === "kanban");
  viewToggle.append(listBtn, kanbanBtn);
  root.append(viewToggle);

  const summary = createSection("Resumo", "");
  const nameInput = document.createElement("input");
  nameInput.value = project.name;
  nameInput.addEventListener("input", () => {
    project.name = nameInput.value;
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
    buildField("Nome", nameInput),
    buildField("Objetivo", objectiveInput),
    buildField("Status", statusSelect),
    buildField("Area", areaSelect)
  );
  root.append(summary.section);

  const nextStep = createSection("Proximo passo", "");
  const nextTask = state.tasks.find(
    (task) => task.projectId === project.id && task.status !== "done" && !task.archived
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
  if (state.ui.projectViewMode === "kanban") {
    tasksSection.body.append(renderProjectKanban(project));
  } else {
    STATUS_ORDER.forEach((status) => {
      const group = createElement("div", "section");
      const header = createElement("div", "section-header");
      header.append(
        createElement("div", "section-title", STATUS_LABELS[status]),
        createElement("div", "list-meta", "")
      );
      group.append(header);
      const tasks = state.tasks.filter(
        (task) =>
          task.projectId === project.id &&
          !task.archived &&
          task.status === status
      );
      if (!tasks.length) {
        group.append(createElement("div", "list-meta", "Sem tarefas."));
      } else {
        tasks.forEach((task) => group.append(createTaskRow(task)));
      }
      tasksSection.body.append(group);
    });
  }
  root.append(tasksSection.section);

  const notesSection = createSection("Notas do projeto", "");
  const notesArea = document.createElement("textarea");
  notesArea.rows = 4;
  notesArea.value = project.notes || "";
  notesArea.addEventListener("input", () => {
    project.notes = notesArea.value;
    touch(project);
    saveStateDebounced();
  });
  notesSection.body.append(notesArea);
  root.append(notesSection.section);

  const milestonesSection = createSection("Marcos", "");
  if (!Array.isArray(project.milestones) || !project.milestones.length) {
    milestonesSection.body.append(createElement("div", "list-meta", "Sem marcos."));
  } else {
    project.milestones.forEach((milestone) => {
      milestonesSection.body.append(createMilestoneRow(project, milestone));
    });
  }
  const addMilestone = createButton("Adicionar marco", "ghost-btn", () => {
    project.milestones.push({
      id: uid("milestone"),
      title: "Novo marco",
      dueDate: "",
      done: false
    });
    touch(project);
    saveState();
    renderMain();
  });
  milestonesSection.body.append(addMilestone);
  root.append(milestonesSection.section);
}

function renderNotesView(root, noteId) {
  if (noteId) {
    state.ui.notesNoteId = noteId;
  }
  const layout = createElement("div", "notes-layout");
  const tree = createElement("div", "notes-tree");

  const addNoteBtn = createButton("Nova nota", "ghost-btn", () => openNoteModal({}));
  tree.append(addNoteBtn);

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

function renderCalendarView(root) {
  const shell = createElement("div", "calendar-shell");
  const toggle = createElement("div", "calendar-toggle");
  const weekBtn = createButton("Semana", "tab-btn", () => setCalendarView("week"));
  const monthBtn = createButton("Mes", "tab-btn", () => setCalendarView("month"));
  weekBtn.classList.toggle("active", state.ui.calendarView === "week");
  monthBtn.classList.toggle("active", state.ui.calendarView === "month");
  toggle.append(weekBtn, monthBtn);
  shell.append(toggle);

  if (state.ui.calendarView === "month") {
    shell.append(renderCalendarMonth());
  } else {
    shell.append(renderCalendarWeek());
  }
  root.append(shell);
}

function renderAreasView(root) {
  const list = createElement("div", "areas-grid");
  const query = (state.ui.search || "").trim().toLowerCase();
  const areas = state.areas.filter((area) => matchesQuery(`${area.name} ${area.objective}`, query));
  if (!areas.length) {
    list.append(createElement("div", "empty", "Nenhuma area criada."));
  } else {
    areas.forEach((area) => list.append(createAreaCard(area)));
  }
  root.append(list);
}

function renderAreaDetail(root, areaId) {
  const area = getArea(areaId);
  if (!area) {
    root.append(createElement("div", "empty", "Area nao encontrada."));
    return;
  }

  const header = createSection("Resumo da area", "");
  const nameInput = document.createElement("input");
  nameInput.value = area.name;
  nameInput.addEventListener("input", () => {
    area.name = nameInput.value;
    touch(area);
    saveStateDebounced();
    renderSidebar();
  });
  const objectiveInput = document.createElement("textarea");
  objectiveInput.rows = 3;
  objectiveInput.value = area.objective || "";
  objectiveInput.addEventListener("input", () => {
    area.objective = objectiveInput.value;
    touch(area);
    saveStateDebounced();
  });
  
  const deleteBtn = createButton("Deletar area", "ghost-btn danger", () => {
    if (confirm(`Tem certeza que deseja deletar "${area.name}"? Isto nao deletara seus projetos e tarefas.`)) {
      deleteArea(area.id);
      navigate("/areas");
    }
  });
  
  header.body.append(
    buildField("Nome", nameInput),
    buildField("Objetivo", objectiveInput),
    deleteBtn
  );
  root.append(header.section);

  const projects = state.projects.filter((project) => project.areaId === area.id);
  const tasks = state.tasks.filter(
    (task) =>
      task.areaId === area.id && !task.projectId && !task.archived && task.status !== "done"
  );
  const notes = state.notes.filter((note) => note.areaId === area.id && !note.archived);

  const projectsSection = createSection("Projetos da area", "");
  if (!projects.length) {
    projectsSection.body.append(createElement("div", "list-meta", "Sem projetos."));
  } else {
    projects.forEach((project) => projectsSection.body.append(createProjectCard(project)));
  }
  root.append(projectsSection.section);

  const tasksSection = createSection("Tarefas sem projeto", "");
  if (!tasks.length) {
    tasksSection.body.append(createElement("div", "list-meta", "Sem tarefas."));
  } else {
    tasks.forEach((task) => tasksSection.body.append(createTaskRow(task)));
  }
  root.append(tasksSection.section);

  const notesSection = createSection("Notas da area", "");
  if (!notes.length) {
    notesSection.body.append(createElement("div", "list-meta", "Sem notas."));
  } else {
    notes.forEach((note) => notesSection.body.append(createNoteCard(note)));
  }
  root.append(notesSection.section);
}

function renderArchiveView(root) {
  const archivedTasks = state.tasks.filter((task) => task.archived);
  const archivedEvents = state.events.filter((event) => event.archived);
  const archivedNotes = state.notes.filter((note) => note.archived);

  const taskSection = createSection("Tarefas arquivadas", "");
  if (!archivedTasks.length) {
    taskSection.body.append(createElement("div", "list-meta", "Sem tarefas."));
  } else {
    archivedTasks.forEach((task) => taskSection.body.append(createTaskRow(task)));
  }
  root.append(taskSection.section);

  const eventSection = createSection("Eventos arquivados", "");
  if (!archivedEvents.length) {
    eventSection.body.append(createElement("div", "list-meta", "Sem eventos."));
  } else {
    archivedEvents.forEach((event) => eventSection.body.append(createEventRow(event)));
  }
  root.append(eventSection.section);

  const noteSection = createSection("Notas arquivadas", "");
  if (!archivedNotes.length) {
    noteSection.body.append(createElement("div", "list-meta", "Sem notas."));
  } else {
    archivedNotes.forEach((note) => noteSection.body.append(createNoteCard(note)));
  }
  root.append(noteSection.section);
}

function renderDetailsPanel() {
  const selection = getSelectedItem();
  el.detailsBody.innerHTML = "";

  if (!selection.item) {
    el.detailsTitle.textContent = "Nada selecionado";
    setDetailsOpen(false);
    const empty = createElement("div", "empty");
    empty.innerHTML = "<h3>Selecione um item</h3><p>Detalhes aparecem aqui.</p>";
    el.detailsBody.append(empty);
    appendQuickCapturePanel();
+    updateDetailsToggleButton();
    return;
  }

  setDetailsOpen(true);

  if (selection.kind === "task") {
    renderTaskDetails(selection.item);
  } else if (selection.kind === "event") {
    renderEventDetails(selection.item);
  } else if (selection.kind === "note") {
    renderNoteDetails(selection.item);
  }
  appendQuickCapturePanel();
+  updateDetailsToggleButton();
}

function setDetailsOpen(isOpen) {
  document.body.classList.toggle("details-open", isOpen);
  if (el.detailsBackdrop) {
    el.detailsBackdrop.classList.toggle("hidden", !isOpen);
    el.detailsBackdrop.setAttribute("aria-hidden", String(!isOpen));
  }
  if (el.detailsPanel) {
    el.detailsPanel.setAttribute("aria-hidden", String(!isOpen));
  }
  // if panel is being closed fully, also clear minimized visual state
  if (!isOpen) {
    document.body.classList.remove("details-minimized");
    updateDetailsToggleButton();
  }
}

// Hide details panel on mobile view when user scrolls/touches the page.
function handleMobileScroll() {
  try {
    if (window.innerWidth > 768) {
      return;
    }
    if (!document.body.classList.contains("details-open")) {
      return;
    }
    // keep selection but hide the panel so it doesn't cover 1/3 of the screen
    setDetailsOpen(false);
  } catch (e) {
    // noop
  }
}

// Toggle minimized visual state (keeps the item selected but frees space)
function toggleDetailsMinimize() {
  const isMin = document.body.classList.toggle("details-minimized");
  updateDetailsToggleButton();
  // when minimizing ensure header remains visible even if previously closed
  if (isMin && !document.body.classList.contains("details-open")) {
    document.body.classList.add("details-open");
    if (el.detailsBackdrop) { el.detailsBackdrop.classList.add("hidden"); el.detailsBackdrop.setAttribute("aria-hidden", "true"); }
    if (el.detailsPanel) { el.detailsPanel.setAttribute("aria-hidden", "false"); }
  }
}

// update button label/aria according to state
function updateDetailsToggleButton() {
  if (!el.detailsToggle) return;
  const minimized = document.body.classList.contains("details-minimized");
  el.detailsToggle.textContent = minimized ? "▴" : "—";
  el.detailsToggle.setAttribute("aria-label", minimized ? "Restaurar painel de detalhes" : "Minimizar painel de detalhes");
}

function renderTaskDetails(task) {
  el.detailsTitle.textContent = task.title || "Tarefa";

  const titleInput = document.createElement("input");
  titleInput.value = task.title;
  titleInput.addEventListener("input", () => {
    task.title = titleInput.value;
    touch(task);
    saveStateDebounced();
    renderMain();
  });

  const statusSelect = createSelect(
    STATUS_ORDER.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
    task.status
  );
  statusSelect.addEventListener("change", () => {
    task.status = statusSelect.value;
    touch(task);
    saveState();
    renderMain();
  });

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = task.dueDate || "";
  dateInput.addEventListener("change", () => {
    task.dueDate = dateInput.value;
    touch(task);
    saveState();
    renderMain();
  });

  const timeInput = document.createElement("input");
  timeInput.type = "time";
  timeInput.value = task.dueTime || "";
  timeInput.addEventListener("change", () => {
    task.dueTime = timeInput.value;
    touch(task);
    saveState();
    renderMain();
  });

  const prioritySelect = createSelect(
    [
      { value: "low", label: "Baixa" },
      { value: "med", label: "Media" },
      { value: "high", label: "Alta" }
    ],
    task.priority
  );
  prioritySelect.addEventListener("change", () => {
    task.priority = prioritySelect.value;
    touch(task);
    saveState();
  });

  const projectSelect = createProjectSelect(task.projectId);
  projectSelect.addEventListener("change", () => {
    task.projectId = projectSelect.value || null;
    touch(task);
    saveState();
    renderMain();
  });

  const areaSelect = createAreaSelect(task.areaId);
  areaSelect.addEventListener("change", () => {
    task.areaId = areaSelect.value || null;
    touch(task);
    saveState();
    renderMain();
  });

  const notesInput = document.createElement("textarea");
  notesInput.rows = 4;
  notesInput.value = task.notes || "";
  notesInput.addEventListener("input", () => {
    task.notes = notesInput.value;
    touch(task);
    saveStateDebounced();
  });

  const linksInput = document.createElement("textarea");
  linksInput.rows = 3;
  linksInput.value = (task.attachments || []).join("\n");
  linksInput.addEventListener("input", () => {
    task.attachments = linksInput.value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    touch(task);
    saveStateDebounced();
  });

  const noteSelect = createNoteSelect(task.linkedNoteId);
  noteSelect.addEventListener("change", () => {
    task.linkedNoteId = noteSelect.value || null;
    touch(task);
    saveState();
  });

  const checklist = createChecklistEditor(task);

  const actions = createElement("div", "card-actions");
  actions.append(
    createButton("Concluir", "ghost-btn", () => {
      task.status = "done";
      touch(task);
      saveState();
      renderAll();
    }),
    createButton("Definir foco", "ghost-btn", () => toggleTaskFocus(task)),
    createButton("Adiar 1 dia", "ghost-btn", () => snoozeTask(task, 1)),
    createButton("Adiar 7 dias", "ghost-btn", () => snoozeTask(task, 7)),
    createButton("Arquivar", "ghost-btn danger", () => archiveTask(task))
  );

  el.detailsBody.append(
    buildField("Titulo", titleInput),
    buildField("Status", statusSelect),
    buildField("Prazo", dateInput),
    buildField("Hora", timeInput),
    buildField("Prioridade", prioritySelect),
    buildField("Projeto", projectSelect),
    buildField("Area", areaSelect),
    buildField("Subtarefas", checklist),
    buildField("Descricao", notesInput),
    buildField("Anexos/links", linksInput),
    buildField("Vinculo com nota", noteSelect),
    buildField("Acoes chave", actions)
  );
}

function renderEventDetails(event) {
  el.detailsTitle.textContent = event.title || "Evento";

  const titleInput = document.createElement("input");
  titleInput.value = event.title;
  titleInput.addEventListener("input", () => {
    event.title = titleInput.value;
    touch(event);
    saveStateDebounced();
    renderMain();
  });

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = event.date;
  dateInput.addEventListener("change", () => {
    event.date = dateInput.value;
    touch(event);
    saveState();
    renderMain();
  });

  const timeInput = document.createElement("input");
  timeInput.type = "time";
  timeInput.value = event.start;
  timeInput.addEventListener("change", () => {
    event.start = timeInput.value;
    touch(event);
    saveState();
    renderMain();
  });

  const durationInput = document.createElement("input");
  durationInput.type = "number";
  durationInput.min = "15";
  durationInput.value = event.duration;
  durationInput.addEventListener("change", () => {
    event.duration = Math.max(15, Number(durationInput.value) || 15);
    touch(event);
    saveState();
    renderMain();
  });

  const recurrenceSelect = createSelect(
    [
      { value: "none", label: "Sem repeticao" },
      { value: "daily", label: "Diario" },
      { value: "weekly", label: "Semanal" },
      { value: "monthly", label: "Mensal" }
    ],
    event.recurrence
  );
  recurrenceSelect.addEventListener("change", () => {
    event.recurrence = recurrenceSelect.value;
    touch(event);
    saveState();
  });

  const locationInput = document.createElement("input");
  locationInput.value = event.location || "";
  locationInput.addEventListener("input", () => {
    event.location = locationInput.value;
    touch(event);
    saveStateDebounced();
  });

  const notesInput = document.createElement("textarea");
  notesInput.rows = 4;
  notesInput.value = event.notes || "";
  notesInput.addEventListener("input", () => {
    event.notes = notesInput.value;
    touch(event);
    saveStateDebounced();
  });

  const projectSelect = createProjectSelect(event.projectId);
  projectSelect.addEventListener("change", () => {
    event.projectId = projectSelect.value || null;
    touch(event);
    saveState();
  });

  const areaSelect = createAreaSelect(event.areaId);
  areaSelect.addEventListener("change", () => {
    event.areaId = areaSelect.value || null;
    touch(event);
    saveState();
  });

  const actions = createElement("div", "card-actions");
  actions.append(
    createButton("Arquivar", "ghost-btn danger", () => archiveEvent(event))
  );

  el.detailsBody.append(
    buildField("Titulo", titleInput),
    buildField("Data", dateInput),
    buildField("Hora", timeInput),
    buildField("Duracao (min)", durationInput),
    buildField("Repeticao", recurrenceSelect),
    buildField("Local", locationInput),
    buildField("Projeto", projectSelect),
    buildField("Area", areaSelect),
    buildField("Notas", notesInput),
    buildField("Acoes chave", actions)
  );
}

function renderNoteDetails(note) {
  el.detailsTitle.textContent = note.title || "Nota";

  const areaSelect = createAreaSelect(note.areaId);
  areaSelect.addEventListener("change", () => {
    note.areaId = areaSelect.value || null;
    touch(note);
    saveState();
    renderMain();
  });

  const projectSelect = createProjectSelect(note.projectId);
  projectSelect.addEventListener("change", () => {
    note.projectId = projectSelect.value || null;
    touch(note);
    saveState();
    renderMain();
  });

  const backlinks = createElement("div", "card");
  const linkedTasks = state.tasks.filter(
    (task) => task.linkedNoteId === note.id || task.sourceNoteId === note.id
  );
  backlinks.append(createElement("div", "card-title", "Backlinks"));
  if (!linkedTasks.length) {
    backlinks.append(createElement("div", "list-meta", "Nenhuma tarefa vinculada."));
  } else {
    linkedTasks.forEach((task) => backlinks.append(createTaskRow(task, { compact: true })));
  }

  const actions = createElement("div", "card-actions");
  actions.append(
    createButton("Abrir nota", "ghost-btn", () => navigate(`/notes/${note.id}`)),
    createButton("Arquivar", "ghost-btn danger", () => archiveNote(note))
  );

  el.detailsBody.append(
    buildField("Area", areaSelect),
    buildField("Projeto", projectSelect),
    buildField("Links", backlinks),
    buildField("Acoes chave", actions)
  );
}

function appendQuickCapturePanel() {
  const route = parseRoute(state.ui.route);
  if (!route || route.name !== "today") {
    return;
  }
  const section = createElement("div", "section");
  const header = createElement("div", "section-header");
  header.append(createElement("div", "section-title", "+ Capturar rapido"));
  section.append(header);
  const input = document.createElement("input");
  input.placeholder = "Digite uma tarefa para hoje...";
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const value = input.value.trim();
      if (!value) {
        return;
      }
      state.tasks.unshift(createTask({ title: value, dueDate: getTodayKey() }));
      input.value = "";
      saveState();
      renderMain();
    }
  });
  section.append(input);
  el.detailsBody.append(section);
}

function createElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function createButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className || "ghost-btn";
  button.textContent = label;
  if (onClick) {
    button.addEventListener("click", onClick);
  }
  return button;
}

function createSection(title, hint) {
  const section = createElement("div", "section");
  const header = createElement("div", "section-header");
  const heading = createElement("div", "section-title", title);
  header.append(heading);
  if (hint) {
    header.append(createElement("div", "section-hint", hint));
  }
  section.append(header);
  const body = createElement("div");
  section.append(body);
  return { section, body };
}

function buildField(label, input) {
  const wrapper = createElement("label", "field");
  const title = createElement("span", "", label);
  wrapper.append(title, input);
  return wrapper;
}

function createSelect(options, value) {
  const select = document.createElement("select");
  options.forEach((optionData) => {
    const option = document.createElement("option");
    option.value = optionData.value;
    option.textContent = optionData.label;
    select.append(option);
  });
  select.value = value || "";
  return select;
}

function setCount(node, count) {
  if (!node) {
    return;
  }
  node.textContent = count ? String(count) : "";
}

function createTaskRow(task, options = {}) {
  const row = createElement("div", "task-row");
  row.classList.toggle(
    "active",
    state.ui.selected && state.ui.selected.kind === "task" && state.ui.selected.id === task.id
  );
  row.draggable = !task.archived && task.status !== "done";
  row.addEventListener("dragstart", (event) => {
    if (!row.draggable) {
      event.preventDefault();
      return;
    }
    row.classList.add("dragging");
    setDragData(event, "task", task.id);
  });
  row.addEventListener("dragend", () => row.classList.remove("dragging"));

  const info = createElement("div");
  info.append(createElement("div", "task-title", task.title));
  const metaParts = [];
  if (task.dueDate) {
    metaParts.push(`Prazo ${task.dueDate}`);
  }
  if (task.dueTime) {
    metaParts.push(task.dueTime);
  }
  if (task.projectId) {
    const project = getProject(task.projectId);
    if (project) {
      metaParts.push(project.name);
    }
  }
  if (task.areaId) {
    const area = getArea(task.areaId);
    if (area) {
      metaParts.push(area.name);
    }
  }
  if (task.priority) {
    metaParts.push(PRIORITY_LABELS[task.priority] || "");
  }
  info.append(createElement("div", "task-meta", metaParts.filter(Boolean).join(" / ")));

  row.append(info);

  if (!options.compact) {
    const actions = createElement("div", "task-actions");
    if (task.archived) {
      actions.append(
        createButton("Restaurar", "ghost-btn", (event) => {
          event.stopPropagation();
          task.archived = false;
          touch(task);
          saveState();
          renderAll();
        })
      );
    } else if (task.status === "done") {
      actions.append(
        createButton("Reabrir", "ghost-btn", (event) => {
          event.stopPropagation();
          task.status = "todo";
          touch(task);
          saveState();
          renderAll();
        })
      );
    } else {
      actions.append(
        createButton("Concluir", "ghost-btn", (event) => {
          event.stopPropagation();
          task.status = "done";
          touch(task);
          saveState();
          renderAll();
        }),
        createButton("Definir foco", "ghost-btn", (event) => {
          event.stopPropagation();
          toggleTaskFocus(task);
        })
      );
    }
    row.append(actions);
  }

  row.addEventListener("click", () => selectItem("task", task.id));
  return row;
}

function createTaskCard(task, options = {}) {
  const card = createElement("div", "card");
  card.append(createElement("div", "card-title", task.title));
  const meta = [];
  if (task.dueDate) {
    meta.push(`Prazo ${task.dueDate}`);
  }
  if (task.projectId) {
    const project = getProject(task.projectId);
    if (project) {
      meta.push(project.name);
    }
  }
  card.append(createElement("div", "card-meta", meta.join(" / ")));
  if (!options.compact) {
    card.append(
      createButton("Ver detalhes", "ghost-btn", (event) => {
        event.stopPropagation();
        selectItem("task", task.id);
      })
    );
  }
  card.addEventListener("click", () => selectItem("task", task.id));
  return card;
}

function createEventRow(event) {
  const row = createElement("div", "event-row");
  row.classList.toggle(
    "active",
    state.ui.selected && state.ui.selected.kind === "event" && state.ui.selected.id === event.id
  );
  row.draggable = !event.archived;
  row.addEventListener("dragstart", (ev) => {
    if (!row.draggable) {
      ev.preventDefault();
      return;
    }
    row.classList.add("dragging");
    setDragData(ev, "event", event.id);
  });
  row.addEventListener("dragend", () => row.classList.remove("dragging"));

  const info = createElement("div");
  info.append(createElement("div", "event-title", event.title));
  info.append(
    createElement(
      "div",
      "event-meta",
      `${event.date} - ${formatTimeLabel(event.start)}`
    )
  );
  row.append(info);

  const actions = createElement("div", "task-actions");
  if (event.archived) {
    actions.append(
      createButton("Restaurar", "ghost-btn", (eventClick) => {
        eventClick.stopPropagation();
        event.archived = false;
        touch(event);
        saveState();
        renderAll();
      })
    );
  } else {
    actions.append(
      createButton("Arquivar", "ghost-btn", (eventClick) => {
        eventClick.stopPropagation();
        archiveEvent(event);
      })
    );
  }
  row.append(actions);

  row.addEventListener("click", () => selectItem("event", event.id));
  return row;
}

function createInboxRow(item, options = {}) {
  const row = createElement("div", "inbox-row");
  row.addEventListener("mouseenter", () => {
    state.ui.inboxActiveId = item.id;
  });

  if (!options.compact) {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.ui.inboxSelection.includes(item.id);
    checkbox.addEventListener("change", () => {
      toggleInboxSelection(item.id);
    });
    row.append(checkbox);
  } else {
    row.append(createElement("div", "tag", item.kind));
  }

  const info = createElement("div");
  info.append(createElement("div", "task-title", item.title));
  info.append(createElement("div", "list-meta", `Sugestao: ${item.kind}`));
  row.append(info);

  const actions = createElement("div", "inbox-actions");
  actions.append(
    createButton("Processar", "ghost-btn", (event) => {
      event.stopPropagation();
      openProcessModal(item);
    })
  );
  if (!options.compact) {
    actions.append(
      createButton("Arquivar", "ghost-btn", (event) => {
        event.stopPropagation();
        archiveInboxItem(item.id);
      }),
      createButton("Deletar", "ghost-btn danger", (event) => {
        event.stopPropagation();
        deleteInboxItem(item.id);
      })
    );
  }
  row.append(actions);
  return row;
}

function createProjectCard(project) {
  const card = createElement("div", "card");
  card.append(createElement("div", "card-title", project.name));
  if (project.objective) {
    card.append(createElement("div", "card-meta", project.objective));
  }
  const tasks = state.tasks.filter((task) => task.projectId === project.id && !task.archived);
  const done = tasks.filter((task) => task.status === "done").length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const progressWrap = createElement("div", "progress");
  const bar = createElement("div", "progress-bar");
  bar.style.width = `${progress}%`;
  progressWrap.append(bar);
  card.append(progressWrap);
  const next = tasks.find((task) => task.status !== "done");
  if (next) {
    card.append(createElement("div", "card-meta", `Proximo: ${next.title}`));
  }

  const actions = createElement("div", "card-actions");
  if (project.status === "active") {
    actions.append(
      createButton("Pausar", "ghost-btn", (event) => {
        event.stopPropagation();
        project.status = "paused";
        touch(project);
        saveState();
        renderMain();
      }),
      createButton("Concluir", "ghost-btn", (event) => {
        event.stopPropagation();
        project.status = "done";
        touch(project);
        saveState();
        renderMain();
      })
    );
  } else if (project.status === "paused") {
    actions.append(
      createButton("Reativar", "ghost-btn", (event) => {
        event.stopPropagation();
        project.status = "active";
        touch(project);
        saveState();
        renderMain();
      })
    );
  }
  card.append(actions);

  card.addEventListener("click", () => navigate(`/projects/${project.id}`));
  return card;
}

function createAreaCard(area) {
  const card = createElement("div", "card");
  card.append(createElement("div", "card-title", area.name));
  if (area.objective) {
    card.append(createElement("div", "card-meta", area.objective));
  }
  
  const actions = createElement("div", "card-actions");
  actions.append(
    createButton("Editar", "ghost-btn", (event) => {
      event.stopPropagation();
      openAreaEditModal(area);
    }),
    createButton("Deletar", "ghost-btn danger", (event) => {
      event.stopPropagation();
      if (confirm(`Tem certeza que deseja deletar "${area.name}"?`)) {
        deleteArea(area.id);
      }
    })
  );
  card.append(actions);
  
  card.addEventListener("click", () => navigate(`/areas/${area.id}`));
  return card;
}

function renderAreaDetail(root, areaId) {
  const area = getArea(areaId);
  if (!area) {
    root.append(createElement("div", "empty", "Area nao encontrada."));
    return;
  }

  const header = createSection("Resumo da area", "");
  const nameInput = document.createElement("input");
  nameInput.value = area.name;
  nameInput.addEventListener("input", () => {
    area.name = nameInput.value;
    touch(area);
    saveStateDebounced();
    renderSidebar();
  });
  const objectiveInput = document.createElement("textarea");
  objectiveInput.rows = 3;
  objectiveInput.value = area.objective || "";
  objectiveInput.addEventListener("input", () => {
    area.objective = objectiveInput.value;
    touch(area);
    saveStateDebounced();
  });
  
  const deleteBtn = createButton("Deletar area", "ghost-btn danger", () => {
    if (confirm(`Tem certeza que deseja deletar "${area.name}"? Isto nao deletara seus projetos e tarefas.`)) {
      deleteArea(area.id);
      navigate("/areas");
    }
  });
  
  header.body.append(
    buildField("Nome", nameInput),
    buildField("Objetivo", objectiveInput),
    deleteBtn
  );
  root.append(header.section);

  const projects = state.projects.filter((project) => project.areaId === area.id);
  const tasks = state.tasks.filter(
    (task) =>
      task.areaId === area.id && !task.projectId && !task.archived && task.status !== "done"
  );
  const notes = state.notes.filter((note) => note.areaId === area.id && !note.archived);

  const projectsSection = createSection("Projetos da area", "");
  if (!projects.length) {
    projectsSection.body.append(createElement("div", "list-meta", "Sem projetos."));
  } else {
    projects.forEach((project) => projectsSection.body.append(createProjectCard(project)));
  }
  root.append(projectsSection.section);

  const tasksSection = createSection("Tarefas sem projeto", "");
  if (!tasks.length) {
    tasksSection.body.append(createElement("div", "list-meta", "Sem tarefas."));
  } else {
    tasks.forEach((task) => tasksSection.body.append(createTaskRow(task)));
  }
  root.append(tasksSection.section);

  const notesSection = createSection("Notas da area", "");
  if (!notes.length) {
    notesSection.body.append(createElement("div", "list-meta", "Sem notas."));
  } else {
    notes.forEach((note) => notesSection.body.append(createNoteCard(note)));
  }
  root.append(notesSection.section);
}

function renderArchiveView(root) {
  const archivedTasks = state.tasks.filter((task) => task.archived);
  const archivedEvents = state.events.filter((event) => event.archived);
  const archivedNotes = state.notes.filter((note) => note.archived);

  const taskSection = createSection("Tarefas arquivadas", "");
  if (!archivedTasks.length) {
    taskSection.body.append(createElement("div", "list-meta", "Sem tarefas."));
  } else {
    archivedTasks.forEach((task) => taskSection.body.append(createTaskRow(task)));
  }
  root.append(taskSection.section);

  const eventSection = createSection("Eventos arquivados", "");
  if (!archivedEvents.length) {
    eventSection.body.append(createElement("div", "list-meta", "Sem eventos."));
  } else {
    archivedEvents.forEach((event) => eventSection.body.append(createEventRow(event)));
  }
  root.append(eventSection.section);

  const noteSection = createSection("Notas arquivadas", "");
  if (!archivedNotes.length) {
    noteSection.body.append(createElement("div", "list-meta", "Sem notas."));
  } else {
    archivedNotes.forEach((note) => noteSection.body.append(createNoteCard(note)));
  }
  root.append(noteSection.section);
}

function renderDetailsPanel() {
  const selection = getSelectedItem();
  el.detailsBody.innerHTML = "";

  if (!selection.item) {
    el.detailsTitle.textContent = "Nada selecionado";
    setDetailsOpen(false);
    const empty = createElement("div", "empty");
    empty.innerHTML = "<h3>Selecione um item</h3><p>Detalhes aparecem aqui.</p>";
    el.detailsBody.append(empty);
    appendQuickCapturePanel();
+    updateDetailsToggleButton();
    return;
  }

  setDetailsOpen(true);

  if (selection.kind === "task") {
    renderTaskDetails(selection.item);
  } else if (selection.kind === "event") {
    renderEventDetails(selection.item);
  } else if (selection.kind === "note") {
    renderNoteDetails(selection.item);
  }
  appendQuickCapturePanel();
+  updateDetailsToggleButton();
}

function setDetailsOpen(isOpen) {
  document.body.classList.toggle("details-open", isOpen);
  if (el.detailsBackdrop) {
    el.detailsBackdrop.classList.toggle("hidden", !isOpen);
    el.detailsBackdrop.setAttribute("aria-hidden", String(!isOpen));
  }
  if (el.detailsPanel) {
    el.detailsPanel.setAttribute("aria-hidden", String(!isOpen));
  }
  // if panel is being closed fully, also clear minimized visual state
  if (!isOpen) {
    document.body.classList.remove("details-minimized");
    updateDetailsToggleButton();
  }
}

// Hide details panel on mobile view when user scrolls/touch-moving to avoid it covering content
function handleMobileScroll() {
  try {
    if (window.innerWidth > 768) {
      return;
    }
    if (!document.body.classList.contains("details-open")) {
      return;
    }
    // keep selection but hide the panel so it doesn't cover 1/3 of the screen
    setDetailsOpen(false);
  } catch (e) {
    // noop
  }
}

// Toggle minimized visual state (keeps the item selected but frees space)
function toggleDetailsMinimize() {
  const isMin = document.body.classList.toggle("details-minimized");
  updateDetailsToggleButton();
  // when minimizing ensure header remains visible even if previously closed
  if (isMin && !document.body.classList.contains("details-open")) {
    document.body.classList.add("details-open");
    if (el.detailsBackdrop) { el.detailsBackdrop.classList.add("hidden"); el.detailsBackdrop.setAttribute("aria-hidden", "true"); }
    if (el.detailsPanel) { el.detailsPanel.setAttribute("aria-hidden", "false"); }
  }
}

// update button label/aria according to state
function updateDetailsToggleButton() {
  if (!el.detailsToggle) return;
  const minimized = document.body.classList.contains("details-minimized");
  el.detailsToggle.textContent = minimized ? "▴" : "—";
  el.detailsToggle.setAttribute("aria-label", minimized ? "Restaurar painel de detalhes" : "Minimizar painel de detalhes");
}

function renderTaskDetails(task) {
  el.detailsTitle.textContent = task.title || "Tarefa";

  const titleInput = document.createElement("input");
  titleInput.value = task.title;
  titleInput.addEventListener("input", () => {
    task.title = titleInput.value;
    touch(task);
    saveStateDebounced();
    renderMain();
  });

  const statusSelect = createSelect(
    STATUS_ORDER.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
    task.status
  );
  statusSelect.addEventListener("change", () => {
    task.status = statusSelect.value;
    touch(task);
    saveState();
    renderMain();
  });

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = task.dueDate || "";
  dateInput.addEventListener("change", () => {
    task.dueDate = dateInput.value;
    touch(task);
    saveState();
    renderMain();
  });

  const timeInput = document.createElement("input");
  timeInput.type = "time";
  timeInput.value = task.dueTime || "";
  timeInput.addEventListener("change", () => {
    task.dueTime = timeInput.value;
    touch(task);
    saveState();
    renderMain();
  });

  const prioritySelect = createSelect(
    [
      { value: "low", label: "Baixa" },
      { value: "med", label: "Media" },
      { value: "high", label: "Alta" }
    ],
    task.priority
  );
  prioritySelect.addEventListener("change", () => {
    task.priority = prioritySelect.value;
    touch(task);
    saveState();
  });

  const projectSelect = createProjectSelect(task.projectId);
  projectSelect.addEventListener("change", () => {
    task.projectId = projectSelect.value || null;
    touch(task);
    saveState();
    renderMain();
  });

  const areaSelect = createAreaSelect(task.areaId);
  areaSelect.addEventListener("change", () => {
    task.areaId = areaSelect.value || null;
    touch(task);
    saveState();
    renderMain();
  });

  const notesInput = document.createElement("textarea");
  notesInput.rows = 4;
  notesInput.value = task.notes || "";
  notesInput.addEventListener("input", () => {
    task.notes = notesInput.value;
    touch(task);
    saveStateDebounced();
  });

  const linksInput = document.createElement("textarea");
  linksInput.rows = 3;
  linksInput.value = (task.attachments || []).join("\n");
  linksInput.addEventListener("input", () => {
    task.attachments = linksInput.value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    touch(task);
    saveStateDebounced();
  });

  const noteSelect = createNoteSelect(task.linkedNoteId);
  noteSelect.addEventListener("change", () => {
    task.linkedNoteId = noteSelect.value || null;
    touch(task);
    saveState();
  });

  const checklist = createChecklistEditor(task);

  const actions = createElement("div", "card-actions");
  actions.append(
    createButton("Concluir", "ghost-btn", () => {
      task.status = "done";
      touch(task);
      saveState();
      renderAll();
    }),
    createButton("Definir foco", "ghost-btn", () => toggleTaskFocus(task)),
    createButton("Adiar 1 dia", "ghost-btn", () => snoozeTask(task, 1)),
    createButton("Adiar 7 dias", "ghost-btn", () => snoozeTask(task, 7)),
    createButton("Arquivar", "ghost-btn danger", () => archiveTask(task))
  );

  el.detailsBody.append(
    buildField("Titulo", titleInput),
    buildField("Status", statusSelect),
    buildField("Prazo", dateInput),
    buildField("Hora", timeInput),
    buildField("Prioridade", prioritySelect),
    buildField("Projeto", projectSelect),
    buildField("Area", areaSelect),
    buildField("Subtarefas", checklist),
    buildField("Descricao", notesInput),
    buildField("Anexos/links", linksInput),
    buildField("Vinculo com nota", noteSelect),
    buildField("Acoes chave", actions)
  );
}

function renderEventDetails(event) {
  el.detailsTitle.textContent = event.title || "Evento";

  const titleInput = document.createElement("input");
  titleInput.value = event.title;
  titleInput.addEventListener("input", () => {
    event.title = titleInput.value;
    touch(event);
    saveStateDebounced();
    renderMain();
  });

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = event.date;
  dateInput.addEventListener("change", () => {
    event.date = dateInput.value;
    touch(event);
    saveState();
    renderMain();
  });

  const timeInput = document.createElement("input");
  timeInput.type = "time";
  timeInput.value = event.start;
  timeInput.addEventListener("change", () => {
    event.start = timeInput.value;
    touch(event);
    saveState();
    renderMain();
  });

  const durationInput = document.createElement("input");
  durationInput.type = "number";
  durationInput.min = "15";
  durationInput.value = event.duration;
  durationInput.addEventListener("change", () => {
    event.duration = Math.max(15, Number(durationInput.value) || 15);
    touch(event);
    saveState();
    renderMain();
  });

  const recurrenceSelect = createSelect(
    [
      { value: "none", label: "Sem repeticao" },
      { value: "daily", label: "Diario" },
      { value: "weekly", label: "Semanal" },
      { value: "monthly", label: "Mensal" }
    ],
    event.recurrence
  );
  recurrenceSelect.addEventListener("change", () => {
    event.recurrence = recurrenceSelect.value;
    touch(event);
    saveState();
  });

  const locationInput = document.createElement("input");
  locationInput.value = event.location || "";
  locationInput.addEventListener("input", () => {
    event.location = locationInput.value;
    touch(event);
    saveStateDebounced();
  });

  const notesInput = document.createElement("textarea");
  notesInput.rows = 4;
  notesInput.value = event.notes || "";
  notesInput.addEventListener("input", () => {
    event.notes = notesInput.value;
    touch(event);
    saveStateDebounced();
  });

  const projectSelect = createProjectSelect(event.projectId);
  projectSelect.addEventListener("change", () => {
    event.projectId = projectSelect.value || null;
    touch(event);
    saveState();
  });

  const areaSelect = createAreaSelect(event.areaId);
  areaSelect.addEventListener("change", () => {
    event.areaId = areaSelect.value || null;
    touch(event);
    saveState();
  });

  const actions = createElement("div", "card-actions");
  actions.append(
    createButton("Arquivar", "ghost-btn danger", () => archiveEvent(event))
  );

  el.detailsBody.append(
    buildField("Titulo", titleInput),
    buildField("Data", dateInput),
    buildField("Hora", timeInput),
    buildField("Duracao (min)", durationInput),
    buildField("Repeticao", recurrenceSelect),
    buildField("Local", locationInput),
    buildField("Projeto", projectSelect),
    buildField("Area", areaSelect),
    buildField("Notas", notesInput),
    buildField("Acoes chave", actions)
  );
}

function renderNoteDetails(note) {
  el.detailsTitle.textContent = note.title || "Nota";

  const areaSelect = createAreaSelect(note.areaId);
  areaSelect.addEventListener("change", () => {
    note.areaId = areaSelect.value || null;
    touch(note);
    saveState();
    renderMain();
  });

  const projectSelect = createProjectSelect(note.projectId);
  projectSelect.addEventListener("change", () => {
    note.projectId = projectSelect.value || null;
    touch(note);
    saveState();
    renderMain();
  });

  const backlinks = createElement("div", "card");
  const linkedTasks = state.tasks.filter(
    (task) => task.linkedNoteId === note.id || task.sourceNoteId === note.id
  );
  backlinks.append(createElement("div", "card-title", "Backlinks"));
  if (!linkedTasks.length) {
    backlinks.append(createElement("div", "list-meta", "Nenhuma tarefa vinculada."));
  } else {
    linkedTasks.forEach((task) => backlinks.append(createTaskRow(task, { compact: true })));
  }

  const actions = createElement("div", "card-actions");
  actions.append(
    createButton("Abrir nota", "ghost-btn", () => navigate(`/notes/${note.id}`)),
    createButton("Arquivar", "ghost-btn danger", () => archiveNote(note))
  );

  el.detailsBody.append(
    buildField("Area", areaSelect),
    buildField("Projeto", projectSelect),
    buildField("Links", backlinks),
    buildField("Acoes chave", actions)
  );
}

function appendQuickCapturePanel() {
  const route = parseRoute(state.ui.route);
  if (!route || route.name !== "today") {
    return;
  }
  const section = createElement("div", "section");
  const header = createElement("div", "section-header");
  header.append(createElement("div", "section-title", "+ Capturar rapido"));
  section.append(header);
  const input = document.createElement("input");
  input.placeholder = "Digite uma tarefa para hoje...";
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const value = input.value.trim();
      if (!value) {
        return;
      }
      state.tasks.unshift(createTask({ title: value, dueDate: getTodayKey() }));
      input.value = "";
      saveState();
      renderMain();
    }
  });
  section.append(input);
  el.detailsBody.append(section);
}

function createElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function createButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className || "ghost-btn";
  button.textContent = label;
  if (onClick) {
    button.addEventListener("click", onClick);
  }
  return button;
}

function createSection(title, hint) {
  const section = createElement("div", "section");
  const header = createElement("div", "section-header");
  const heading = createElement("div", "section-title", title);
  header.append(heading);
  if (hint) {
    header.append(createElement("div", "section-hint", hint));
  }
  section.append(header);
  const body = createElement("div");
  section.append(body);
  return { section, body };
}

function buildField(label, input) {
  const wrapper = createElement("label", "field");
  const title = createElement("span", "", label);
  wrapper.append(title, input);
  return wrapper;
}

function createSelect(options, value) {
  const select = document.createElement("select");
  options.forEach((optionData) => {
    const option = document.createElement("option");
    option.value = optionData.value;
    option.textContent = optionData.label;
    select.append(option);
  });
  select.value = value || "";
  return select;
}

function setCount(node, count) {
  if (!node) {
    return;
  }
  node.textContent = count ? String(count) : "";
}

function createTaskRow(task, options = {}) {
  const row = createElement("div", "task-row");
  row.classList.toggle(
    "active",
    state.ui.selected && state.ui.selected.kind === "task" && state.ui.selected.id === task.id
  );
  row.draggable = !task.archived && task.status !== "done";
  row.addEventListener("dragstart", (event) => {
    if (!row.draggable) {
      event.preventDefault();
      return;
    }
    row.classList.add("dragging");
    setDragData(event, "task", task.id);
  });
  row.addEventListener("dragend", () => row.classList.remove("dragging"));

  const info = createElement("div");
  info.append(createElement("div", "task-title", task.title));
  const metaParts = [];
  if (task.dueDate) {
    metaParts.push(`Prazo ${task.dueDate}`);
  }
  if (task.dueTime) {
    metaParts.push(task.dueTime);
  }
  if (task.projectId) {
    const project = getProject(task.projectId);
    if (project) {
      metaParts.push(project.name);
    }
  }
  if (task.areaId) {
    const area = getArea(task.areaId);
    if (area) {
      metaParts.push(area.name);
    }
  }
  if (task.priority) {
    metaParts.push(PRIORITY_LABELS[task.priority] || "");
  }
  info.append(createElement("div", "task-meta", metaParts.filter(Boolean).join(" / ")));

  row.append(info);

  if (!options.compact) {
    const actions = createElement("div", "task-actions");
    if (task.archived) {
      actions.append(
        createButton("Restaurar", "ghost-btn", (event) => {
          event.stopPropagation();
          task.archived = false;
          touch(task);
          saveState();
          renderAll();
        })
      );
    } else if (task.status === "done") {
      actions.append(
        createButton("Reabrir", "ghost-btn", (event) => {
          event.stopPropagation();
          task.status = "todo";
          touch(task);
          saveState();
          renderAll();
        })
      );
    } else {
      actions.append(
        createButton("Concluir", "ghost-btn", (event) => {
          event.stopPropagation();
          task.status = "done";
          touch(task);
          saveState();
          renderAll();
        }),
        createButton("Definir foco", "ghost-btn", (event) => {
          event.stopPropagation();
          toggleTaskFocus(task);
        })
      );
    }
    row.append(actions);
  }

  row.addEventListener("click", () => selectItem("task", task.id));
  return row;
}

function createTaskCard(task, options = {}) {
  const card = createElement("div", "card");
  card.append(createElement("div", "card-title", task.title));
  const meta = [];
  if (task.dueDate) {
    meta.push(`Prazo ${task.dueDate}`);
  }
  if (task.projectId) {
    const project = getProject(task.projectId);
    if (project) {
      meta.push(project.name);
    }
  }
  card.append(createElement("div", "card-meta", meta.join(" / ")));
  if (!options.compact) {
    card.append(
      createButton("Ver detalhes", "ghost-btn", (event) => {
        event.stopPropagation();
        selectItem("task", task.id);
      })
    );
  }
  card.addEventListener("click", () => selectItem("task", task.id));
  return card;
}

function createEventRow(event) {
  const row = createElement("div", "event-row");
  row.classList.toggle(
    "active",
    state.ui.selected && state.ui.selected.kind === "event" && state.ui.selected.id === event.id
  );
  row.draggable = !event.archived;
  row.addEventListener("dragstart", (ev) => {
    if (!row.draggable) {
      ev.preventDefault();
      return;
    }
    row.classList.add("dragging");
    setDragData(ev, "event", event.id);
  });
  row.addEventListener("dragend", () => row.classList.remove("dragging"));

  const info = createElement("div");
  info.append(createElement("div", "event-title", event.title));
  info.append(
    createElement(
      "div",
      "event-meta",
      `${event.date} - ${formatTimeLabel(event.start)}`
    )
  );
  row.append(info);

  const actions = createElement("div", "task-actions");
  if (event.archived) {
    actions.append(
      createButton("Restaurar", "ghost-btn", (eventClick) => {
        eventClick.stopPropagation();
        event.archived = false;
        touch(event);
        saveState();
        renderAll();
      })
    );
  } else {
    actions.append(
      createButton("Arquivar", "ghost-btn", (eventClick) => {
        eventClick.stopPropagation();
        archiveEvent(event);
      })
    );
  }
  row.append(actions);

  row.addEventListener("click", () => selectItem("event", event.id));
  return row;
}

function createInboxRow(item, options = {}) {
  const row = createElement("div", "inbox-row");
  row.addEventListener("mouseenter", () => {
    state.ui.inboxActiveId = item.id;
  });

  if (!options.compact) {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.ui.inboxSelection.includes(item.id);
    checkbox.addEventListener("change", () => {
      toggleInboxSelection(item.id);
    });
    row.append(checkbox);
  } else {
    row.append(createElement("div", "tag", item.kind));
  }

  const info = createElement("div");
  info.append(createElement("div", "task-title", item.title));
  info.append(createElement("div", "list-meta", `Sugestao: ${item.kind}`));
  row.append(info);

  const actions = createElement("div", "inbox-actions");
  actions.append(
    createButton("Processar", "ghost-btn", (event) => {
      event.stopPropagation();
      openProcessModal(item);
    })
  );
  if (!options.compact) {
    actions.append(
      createButton("Arquivar", "ghost-btn", (event) => {
        event.stopPropagation();
        archiveInboxItem(item.id);
      }),
      createButton("Deletar", "ghost-btn danger", (event) => {
        event.stopPropagation();
        deleteInboxItem(item.id);
      })
    );
  }
  row.append(actions);
  return row;
}

function createProjectCard(project) {
  const card = createElement("div", "card");
  card.append(createElement("div", "card-title", project.name));
  if (project.objective) {
    card.append(createElement("div", "card-meta", project.objective));
  }
  const tasks = state.tasks.filter((task) => task.projectId === project.id && !task.archived);
  const done = tasks.filter((task) => task.status === "done").length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const progressWrap = createElement("div", "progress");
  const bar = createElement("div", "progress-bar");
  bar.style.width = `${progress}%`;
  progressWrap.append(bar);
  card.append(progressWrap);
  const next = tasks.find((task) => task.status !== "done");
  if (next) {
    card.append(createElement("div", "card-meta", `Proximo: ${next.title}`));
  }

  const actions = createElement("div", "card-actions");
  if (project.status === "active") {
    actions.append(
      createButton("Pausar", "ghost-btn", (event) => {
        event.stopPropagation();
        project.status = "paused";
        touch(project);
        saveState();
        renderMain();
      }),
      createButton("Concluir", "ghost-btn", (event) => {
        event.stopPropagation();
        project.status = "done";
        touch(project);
        saveState();
        renderMain();
      })
    );
  } else if (project.status === "paused") {
    actions.append(
      createButton("Reativar", "ghost-btn", (event) => {
        event.stopPropagation();
        project.status = "active";
        touch(project);
        saveState();
        renderMain();
      })
    );
  }
  card.append(actions);

  card.addEventListener("click", () => navigate(`/projects/${project.id}`));
  return card;
}

function createAreaCard(area) {
  const card = createElement("div", "card");
  card.append(createElement("div", "card-title", area.name));
  if (area.objective) {
    card.append(createElement("div", "card-meta", area.objective));
  }
  
  const actions = createElement("div", "card-actions");
  actions.append(
    createButton("Editar", "ghost-btn", (event) => {
      event.stopPropagation();
      openAreaEditModal(area);
    }),
    createButton("Deletar", "ghost-btn danger", (event) => {
      event.stopPropagation();
      if (confirm(`Tem certeza que deseja deletar "${area.name}"?`)) {
        deleteArea(area.id);
      }
    })
  );
  card.append(actions);
  
  card.addEventListener("click", () => navigate(`/areas/${area.id}`));
  return card;
}

function renderAreaDetail(root, areaId) {
  const area = getArea(areaId);
  if (!area) {
    root.append(createElement("div", "empty", "Area nao encontrada."));
    return;
  }

  const header = createSection("Resumo da area", "");
  const nameInput = document.createElement("input");
  nameInput.value = area.name;
  nameInput.addEventListener("input", () => {
    area.name = nameInput.value;
    touch(area);
    saveStateDebounced();
    renderSidebar();
  });
  const objectiveInput = document.createElement("textarea");
  objectiveInput.rows = 3;
  objectiveInput.value = area.objective || "";
  objectiveInput.addEventListener("input", () => {
    area.objective = objectiveInput.value;
    touch(area);
    saveStateDebounced();
  });
  
  const deleteBtn = createButton("Deletar area", "ghost-btn danger", () => {
    if (confirm(`Tem certeza que deseja deletar "${area.name}"? Isto nao deletara seus projetos e tarefas.`)) {
      deleteArea(area.id);
      navigate("/areas");
    }
  });
  
  header.body.append(
    buildField("Nome", nameInput),
    buildField("Objetivo", objectiveInput),
    deleteBtn
  );
  root.append(header.section);

  const projects = state.projects.filter((project) => project.areaId === area.id);
  const tasks = state.tasks.filter(
    (task) =>
      task.areaId === area.id && !task.projectId && !task.archived && task.status !== "done"
  );
  const notes = state.notes.filter((note) => note.areaId === area.id && !note.archived);

  const projectsSection = createSection("Projetos da area", "");
  if (!projects.length) {
    projectsSection.body.append(createElement("div", "list-meta", "Sem projetos."));
  } else {
    projects.forEach((project) => projectsSection.body.append(createProjectCard(project)));
  }
  root.append(projectsSection.section);

  const tasksSection = createSection("Tarefas sem projeto", "");
  if (!tasks.length) {
    tasksSection.body.append(createElement("div", "list-meta", "Sem tarefas."));
  } else {
    tasks.forEach((task) => tasksSection.body.append(createTaskRow(task)));
  }
  root.append(tasksSection.section);

  const notesSection = createSection("Notas da area", "");
  if (!notes.length) {
    notesSection.body.append(createElement("div", "list-meta", "Sem notas."));
  } else {
    notes.forEach((note) => notesSection.body.append(createNoteCard(note)));
  }
  root.append(notesSection.section);
}

function renderArchiveView(root) {
  const archivedTasks = state.tasks.filter((task) => task.archived);
  const archivedEvents = state.events.filter((event) => event.archived);
  const archivedNotes = state.notes.filter((note) => note.archived);

  const taskSection = createSection("Tarefas arquivadas", "");
  if (!archivedTasks.length) {
    taskSection.body.append(createElement("div", "list-meta", "Sem tarefas."));
  } else {
    archivedTasks.forEach((task) => taskSection.body.append(createTaskRow(task)));
  }
  root.append(taskSection.section);

  const eventSection = createSection("Eventos arquivados", "");
  if (!archivedEvents.length) {
    eventSection.body.append(createElement("div", "list-meta", "Sem eventos."));
  } else {
    archivedEvents.forEach((event) => eventSection.body.append(createEventRow(event)));
  }
  root.append(eventSection.section);

  const noteSection = createSection("Notas arquivadas", "");
  if (!archivedNotes.length) {
    noteSection.body.append(createElement("div", "list-meta", "Sem notas."));
  } else {
    archivedNotes.forEach((note) => noteSection.body.append(createNoteCard(note)));
  }
  root.append(noteSection.section);
}

function renderDetailsPanel() {
  const selection = getSelectedItem();
  el.detailsBody.innerHTML = "";

  if (!selection.item) {
    el.detailsTitle.textContent = "Nada selecionado";
    setDetailsOpen(false);
    const empty = createElement("div", "empty");
    empty.innerHTML = "<h3>Selecione um item</h3><p>Detalhes aparecem aqui.</p>";
    el.detailsBody.append(empty);
    appendQuickCapturePanel();
+    updateDetailsToggleButton();
    return;
  }

  setDetailsOpen(true);

  if (selection.kind === "task") {
    renderTaskDetails(selection.item);
  } else if (selection.kind === "event") {
    renderEventDetails(selection.item);
  } else if (selection.kind === "note") {
    renderNoteDetails(selection.item);
  }
  appendQuickCapturePanel();
+  updateDetailsToggleButton();
}

function setDetailsOpen(isOpen) {
  document.body.classList.toggle("details-open", isOpen);
  if (el.detailsBackdrop) {
    el.detailsBackdrop.classList.toggle("hidden", !isOpen);
    el.detailsBackdrop.setAttribute("aria-hidden", String(!isOpen));
  }
  if (el.detailsPanel) {
    el.detailsPanel.setAttribute("aria-hidden", String(!isOpen));
  }
  // if panel is being closed fully, also clear minimized visual state
  if (!isOpen) {
    document.body.classList.remove("details-minimized");
    updateDetailsToggleButton();
  }
}

// Hide details panel on mobile view when user scrolls/touch-moving to avoid it covering content
function handleMobileScroll() {
  try {
    if (window.innerWidth > 768) {
      return;
    }
    if (!document.body.classList.contains("details-open")) {
      return;
    }
    // keep selection but hide the panel so it doesn't cover 1/3 of the screen
    setDetailsOpen(false);
  } catch (e) {
    // noop
  }
}

// Toggle minimized visual state (keeps the item selected but frees space)
function toggleDetailsMinimize() {
  const isMin = document.body.classList.toggle("details-minimized");
  updateDetailsToggleButton();
  // when minimizing ensure header remains visible even if previously closed
  if (isMin && !document.body.classList.contains("details-open")) {
    document.body.classList.add("details-open");
    if (el.detailsBackdrop) { el.detailsBackdrop.classList.add("hidden"); el.detailsBackdrop.setAttribute("aria-hidden", "true"); }
    if (el.detailsPanel) { el.detailsPanel.setAttribute("aria-hidden", "false"); }
  }
}

// update button label/aria according to state
function updateDetailsToggleButton() {
  if (!el.detailsToggle) return;
  const minimized = document.body.classList.contains("details-minimized");
  el.detailsToggle.textContent = minimized ? "▴" : "—";
  el.detailsToggle.setAttribute("aria-label", minimized ? "Restaurar painel de detalhes" : "Minimizar painel de detalhes");
}

function renderTaskDetails(task) {
  el.detailsTitle.textContent = task.title || "Tarefa";

  const titleInput = document.createElement("input");
  titleInput.value = task.title;
  titleInput.addEventListener("input", () => {
    task.title = titleInput.value;
    touch(task);
    saveStateDebounced();
    renderMain();
  });

  const statusSelect = createSelect(
    STATUS_ORDER.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
    task.status
  );
  statusSelect.addEventListener("change", () => {
    task.status = statusSelect.value;
    touch(task);
    saveState();
    renderMain();
  });

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = task.dueDate || "";
  dateInput.addEventListener("change", () => {
    task.dueDate = dateInput.value;
    touch(task);
    saveState();
    renderMain();
  });

  const timeInput = document.createElement("input");
  timeInput.type = "time";
  timeInput.value = task.dueTime || "";
  timeInput.addEventListener("change", () => {
    task.dueTime = timeInput.value;
    touch(task);
    saveState();
    renderMain();
  });

  const prioritySelect = createSelect(
    [
      { value: "low", label: "Baixa" },
      { value: "med", label: "Media" },
      { value: "high", label: "Alta" }
    ],
    task.priority
  );
  prioritySelect.addEventListener("change", () => {
    task.priority = prioritySelect.value;
    touch(task);
    saveState();
  });

  const projectSelect = createProjectSelect(task.projectId);
  projectSelect.addEventListener("change", () => {
    task.projectId = projectSelect.value || null;
    touch(task);
    saveState();
    renderMain();
  });

  const areaSelect = createAreaSelect(task.areaId);
  areaSelect.addEventListener("change", () => {
    task.areaId = areaSelect.value || null;
    touch(task);
    saveState();
    renderMain();
  });

  const notesInput = document.createElement("textarea");
  notesInput.rows = 4;
  notesInput.value = task.notes || "";
  notesInput.addEventListener("input", () => {
    task.notes = notesInput.value;
    touch(task);
    saveStateDebounced();
  });

  const linksInput = document.createElement("textarea");
  linksInput.rows = 3;
  linksInput.value = (task.attachments || []).join("\n");
  linksInput.addEventListener("input", () => {
    task.attachments = linksInput.value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    touch(task);
    saveStateDebounced();
  });

  const noteSelect = createNoteSelect(task.linkedNoteId);
  noteSelect.addEventListener("change", () => {
    task.linkedNoteId = noteSelect.value || null;
    touch(task);
    saveState();
  });

  const checklist = createChecklistEditor(task);

  const actions = createElement("div", "card-actions");
  actions.append(
    createButton("Concluir", "ghost-btn", () => {
      task.status = "done";
      touch(task);
      saveState();
      renderAll();
    }),
    createButton("Definir foco", "ghost-btn", () => toggleTaskFocus(task)),
    createButton("Adiar 1 dia", "ghost-btn", () => snoozeTask(task, 1)),
    createButton("Adiar 7 dias", "ghost-btn", () => snoozeTask(task, 7)),
    createButton("Arquivar", "ghost-btn danger", () => archiveTask(task))
  );

  el.detailsBody.append(
    buildField("Titulo", titleInput),
    buildField("Status", statusSelect),
    buildField("Prazo", dateInput),
    buildField("Hora", timeInput),
    buildField("Prioridade", prioritySelect),
    buildField("Projeto", projectSelect),
    buildField("Area", areaSelect),
    buildField("Subtarefas", checklist),
    buildField("Descricao", notesInput),
    buildField("Anexos/links", linksInput),
    buildField("Vinculo com nota", noteSelect),
    buildField("Acoes chave", actions)
  );
}

function renderEventDetails(event) {
  el.detailsTitle.textContent = event.title || "Evento";

  const titleInput = document.createElement("input");
  titleInput.value = event.title;
  titleInput.addEventListener("input", () => {
    event.title = titleInput.value;
    touch(event);
    saveStateDebounced();
    renderMain();
  });

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = event.date;
  dateInput.addEventListener("change", () => {
    event.date = dateInput.value;
    touch(event);
    saveState();
    renderMain();
  });

  const timeInput = document.createElement("input");
  timeInput.type = "time";
  timeInput.value = event.start;
  timeInput.addEventListener("change", () => {
    event.start = timeInput.value;
    touch(event);
    saveState();
    renderMain();
  });

  const durationInput = document.createElement("input");
  durationInput.type = "number";
  durationInput.min = "15";
  durationInput.value = event.duration;
  durationInput.addEventListener("change", () => {
    event.duration = Math.max(15, Number(durationInput.value) || 15);
    touch(event);
    saveState();
    renderMain();
  });

  const recurrenceSelect = createSelect(
    [
      { value: "none", label: "Sem repeticao" },
      { value: "daily", label: "Diario" },
      { value: "weekly", label: "Semanal" },
      { value: "monthly", label: "Mensal" }
    ],
    event.recurrence
  );
  recurrenceSelect.addEventListener("change", () => {
    event.recurrence = recurrenceSelect.value;
    touch(event);
    saveState();
  });

  const locationInput = document.createElement("input");
  locationInput.value = event.location || "";
  locationInput.addEventListener("input", () => {
    event.location = locationInput.value;
    touch(event);
    saveStateDebounced();
  });

  const notesInput = document.createElement("textarea");
  notesInput.rows = 4;
  notesInput.value = event.notes || "";
  notesInput.addEventListener("input", () => {
    event.notes = notesInput.value;
    touch(event);
    saveStateDebounced();
  });

  const projectSelect = createProjectSelect(event.projectId);
  projectSelect.addEventListener("change", () => {
    event.projectId = projectSelect.value || null;
    touch(event);
    saveState();
  });

  const areaSelect = createAreaSelect(event.areaId);
  areaSelect.addEventListener("change", () => {
    event.areaId = areaSelect.value || null;
    touch(event);
    saveState();
  });

  const actions = createElement("div", "card-actions");
  actions.append(
    createButton("Arquivar", "ghost-btn danger", () => archiveEvent(event))
  );

  el.detailsBody.append(
    buildField("Titulo", titleInput),
    buildField("Data", dateInput),
    buildField("Hora", timeInput),
    buildField("Duracao (min)", durationInput),
    buildField("Repeticao", recurrenceSelect),
    buildField("Local", locationInput),
    buildField("Projeto", projectSelect),
    buildField("Area", areaSelect),
    buildField("Notas", notesInput),
    buildField("Acoes chave", actions)
  );
}

function renderNoteDetails(note) {
  el.detailsTitle.textContent = note.title || "Nota";

  const areaSelect = createAreaSelect(note.areaId);
  areaSelect.addEventListener("change", () => {
    note.areaId = areaSelect.value || null;
    touch(note);
    saveState();
    renderMain();
  });

  const projectSelect = createProjectSelect(note.projectId);
  projectSelect.addEventListener("change", () => {
    note.projectId = projectSelect.value || null;
    touch(note);
    saveState();
    renderMain();
  });

  const backlinks = createElement("div", "card");
  const linkedTasks = state.tasks.filter(
    (task) => task.linkedNoteId === note.id || task.sourceNoteId === note.id
  );
  backlinks.append(createElement("div", "card-title", "Backlinks"));
  if (!linkedTasks.length) {
    backlinks.append(createElement("div", "list-meta", "Nenhuma tarefa vinculada."));
  } else {
    linkedTasks.forEach((task) => backlinks.append(createTaskRow(task, { compact: true })));
  }

  const actions = createElement("div", "card-actions");
  actions.append(
    createButton("Abrir nota", "ghost-btn", () => navigate(`/notes/${note.id}`)),
    createButton("Arquivar", "ghost-btn danger", () => archiveNote(note))
  );

  el.detailsBody.append(
    buildField("Area", areaSelect),
    buildField("Projeto", projectSelect),
    buildField("Links", backlinks),
    buildField("Acoes chave", actions)
  );
}

function appendQuickCapturePanel() {
  const route = parseRoute(state.ui.route);
  if (!route || route.name !== "today") {
    return;
  }
  const section = createElement("div", "section");
  const header = createElement("div", "section-header");
  header.append(createElement("div", "section-title", "+ Capturar rapido"));
  section.append(header);
  const input = document.createElement("input");
  input.placeholder = "Digite uma tarefa para hoje...";
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const value = input.value.trim();
      if (!value) {
        return;
      }
      state.tasks.unshift(createTask({ title: value, dueDate: getTodayKey() }));
      input.value = "";
      saveState();
      renderMain();
    }
  });
  section.append(input);
  el.detailsBody.append(section);
}

function createElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function createButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className || "ghost-btn";
  button.textContent = label;
  if (onClick) {
    button.addEventListener("click", onClick);
  }
  return button;
}

function createSection(title, hint) {
  const section = createElement("div", "section");
  const header = createElement("div", "section-header");
  const heading = createElement("div", "section-title", title);
  header.append(heading);
  if (hint) {
    header.append(createElement("div", "section-hint", hint));
  }
  section.append(header);
  const body = createElement("div");
  section.append(body);
  return { section, body };
}

function buildField(label, input) {
  const wrapper = createElement("label", "field");
  const title = createElement("span", "", label);
  wrapper.append(title, input);
  return wrapper;
}

function createSelect(options, value) {
  const select = document.createElement("select");
  options.forEach((optionData) => {
    const option = document.createElement("option");
    option.value = optionData.value;
    option.textContent = optionData.label;
    select.append(option);
  });
  select.value = value || "";
  return select;
}

function setCount(node, count) {
  if (!node) {
    return;
  }
  node.textContent = count ? String(count) : "";
}

function createTaskRow(task, options = {}) {
  const row = createElement("div", "task-row");
  row.classList.toggle(
    "active",
    state.ui.selected && state.ui.selected.kind === "task" && state.ui.selected.id === task.id
  );
  row.draggable = !task.archived && task.status !== "done";
  row.addEventListener("dragstart", (event) => {
    if (!row.draggable) {
      event.preventDefault();
      return;
    }
    row.classList.add("dragging");
    setDragData(event, "task", task.id);
  });
  row.addEventListener("dragend", () => row.classList.remove("dragging"));

  const info = createElement("div");
  info.append(createElement("div", "task-title", task.title));
  const metaParts = [];
  if (task.dueDate) {
    metaParts.push(`Prazo ${task.dueDate}`);
  }
  if (task.dueTime) {
    metaParts.push(task.dueTime);
  }
  if (task.projectId) {
    const project = getProject(task.projectId);
    if (project) {
      metaParts.push(project.name);
    }
  }
  if (task.areaId) {
    const area = getArea(task.areaId);
    if (area) {
      metaParts.push(area.name);
    }
  }
  if (task.priority) {
    metaParts.push(PRIORITY_LABELS[task.priority] || "");
  }
  info.append(createElement("div", "task-meta", metaParts.filter(Boolean).join(" / ")));

  row.append(info);

  if (!options.compact) {
    const actions = createElement("div", "task-actions");
    if (task.archived) {
      actions.append(
        createButton("Restaurar", "ghost-btn", (event) => {
          event.stopPropagation();
          task.archived = false;
          touch(task);
          saveState();
          renderAll();
        })
      );
    } else if (task.status === "done") {
      actions.append(
        createButton("Reabrir", "ghost-btn", (event) => {
          event.stopPropagation();
          task.status = "todo";
          touch(task);
          saveState();
          renderAll();
        })
      );
    } else {
      actions.append(
        createButton("Concluir", "ghost-btn", (event) => {
          event.stopPropagation();
          task.status = "done";
          touch(task);
          saveState();
          renderAll();
        }),
        createButton("Definir foco", "ghost-btn", (event) => {
          event.stopPropagation();
          toggleTaskFocus(task);
        })
      );
    }
    row.append(actions);
  }

  row.addEventListener("click", () => selectItem("task", task.id));
  return row;
}

function createTaskCard(task, options = {}) {
  const card = createElement("div", "card");
  card.append(createElement("div", "card-title", task.title));
  const meta = [];
  if (task.dueDate) {
    meta.push(`Prazo ${task.dueDate}`);
  }
  if (task.projectId) {
    const project = getProject(task.projectId);
    if (project) {
      meta.push(project.name);
    }
  }
  card.append(createElement("div", "card-meta", meta.join(" / ")));
  if (!options.compact) {
    card.append(
      createButton("Ver detalhes", "ghost-btn", (event) => {
        event.stopPropagation();
        selectItem("task", task.id);
      })
    );
  }
  card.addEventListener("click", () => selectItem("task", task.id));
  return card;
}

function createEventRow(event) {
  const row = createElement("div", "event-row");
  row.classList.toggle(
    "active",
    state.ui.selected && state.ui.selected.kind === "event" && state.ui.selected.id === event.id
  );
  row.draggable = !event.archived;
  row.addEventListener("dragstart", (ev) => {
    if (!row.draggable) {
      ev.preventDefault();
      return;
    }
    row.classList.add("dragging");
    setDragData(ev, "event", event.id);
  });
  row.addEventListener("dragend", () => row.classList.remove("dragging"));

  const info = createElement("div");
  info.append(createElement("div", "event-title", event.title));
  info.append(
    createElement(
      "div",
      "event-meta",
      `${event.date} - ${formatTimeLabel(event.start)}`
    )
  );
  row.append(info);

  const actions = createElement("div", "task-actions");
  if (event.archived) {
    actions.append(
      createButton("Restaurar", "ghost-btn", (eventClick) => {
        eventClick.stopPropagation();
        event.archived = false;
        touch(event);
        saveState();
        renderAll();
      })
    );
  } else {
    actions.append(
      createButton("Arquivar", "ghost-btn", (eventClick) => {
        eventClick.stopPropagation();
        archiveEvent(event);
      })
    );
  }
  row.append(actions);

  row.addEventListener("click", () => selectItem("event", event.id));
  return row;
}

function createInboxRow(item, options = {}) {
  const row = createElement("div", "inbox-row");
  row.addEventListener("mouseenter", () => {
    state.ui.inboxActiveId = item.id;
  });

  if (!options.compact) {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.ui.inboxSelection.includes(item.id);
    checkbox.addEventListener("change", () => {
      toggleInboxSelection(item.id);
    });
    row.append(checkbox);
  } else {
    row.append(createElement("div", "tag", item.kind));
  }

  const info = createElement("div");
  info.append(createElement("div", "task-title", item.title));
  info.append(createElement("div", "list-meta", `Sugestao: ${item.kind}`));
  row.append(info);

  const actions = createElement("div", "inbox-actions");
  actions.append(
    createButton("Processar", "ghost-btn", (event) => {
      event.stopPropagation();
      openProcessModal(item);
    })
  );
  if (!options.compact) {
    actions.append(
      createButton("Arquivar", "ghost-btn", (event) => {
        event.stopPropagation();
        archiveInboxItem(item.id);
      }),
      createButton("Deletar", "ghost-btn danger", (event) => {
        event.stopPropagation();
        deleteInboxItem(item.id);
      })
    );
  }
  row.append(actions);
  return row;
}

function createProjectCard(project) {
  const card = createElement("div", "card");
  card.append(createElement("div", "card-title", project.name));
  if (project.objective) {
    card.append(createElement("div", "card-meta", project.objective));
  }
  const tasks = state.tasks.filter((task) => task.projectId === project.id && !task.archived);
  const done = tasks.filter((task) => task.status === "done").length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const progressWrap = createElement("div", "progress");
  const bar = createElement("div", "progress-bar");
  bar.style.width = `${progress}%`;
  progressWrap.append(bar);
  card.append(progressWrap);
  const next = tasks.find((task) => task.status !== "done");
  if (next) {
    card.append(createElement("div", "card-meta", `Proximo: ${next.title}`));
  }

  const actions = createElement("div", "card-actions");
  if (project.status === "active") {
    actions.append(
      createButton("Pausar", "ghost-btn", (event) => {
        event.stopPropagation();
        project.status = "paused";
        touch(project);
        saveState();
        renderMain();
      }),
      createButton("Concluir", "ghost-btn", (event) => {
        event.stopPropagation();
        project.status = "done";
        touch(project);
        saveState();
        renderMain();
      })
    );
  } else if (project.status === "paused") {
    actions.append(
      createButton("Reativar", "ghost-btn", (event) => {
        event.stopPropagation();
        project.status = "active";
        touch(project);
        saveState();
        renderMain();
      })
    );
  }
  card.append(actions);

  card.addEventListener("click", () => navigate(`/projects/${project.id}`));
  return card;
}

function createAreaCard(area) {
  const card = createElement("div", "card");
  card.append(createElement("div", "card-title", area.name));
  if (area.objective) {
    card.append(createElement("div", "card-meta", area.objective));
  }
  
  const actions = createElement("div", "card-actions");
  actions.append(
    createButton("Editar", "ghost-btn", (event) => {
      event.stopPropagation();
      openAreaEditModal(area);
    }),
    createButton("Deletar", "ghost-btn danger", (event) => {
      event.stopPropagation();
      if (confirm(`Tem certeza que deseja deletar "${area.name}"?`)) {
        deleteArea(area.id);
      }
    })
  );
  card.append(actions);
  
  card.addEventListener("click", () => navigate(`/areas/${area.id}`));
  return card;
}

function renderAreaDetail(root, areaId) {
  const area = getArea(areaId);
  if (!area) {
    root.append(createElement("div", "empty", "Area nao encontrada."));
    return;
  }

  const header = createSection("Resumo da area", "");
  const nameInput = document.createElement("input");
  nameInput.value = area.name;
  nameInput.addEventListener("input", () => {
    area.name = nameInput.value;
    touch(area);
    saveStateDebounced();
    renderSidebar();
  });
  const objectiveInput = document.createElement("textarea");
  objectiveInput.rows = 3;
  objectiveInput.value = area.objective || "";
  objectiveInput.addEventListener("input", () => {
    area.objective = objectiveInput.value;
    touch(area);
    saveStateDebounced();
  });
  
  const deleteBtn = createButton("Deletar area", "ghost-btn danger", () => {
    if (confirm(`Tem certeza que deseja deletar "${area.name}"? Isto nao deletara seus projetos e tarefas.`)) {
      deleteArea(area.id);
      navigate("/areas");
    }
  });
  
  header.body.append(
    buildField("Nome", nameInput),
    buildField("Objetivo", objectiveInput),
    deleteBtn
  );
  root.append(header.section);

  const projects = state.projects.filter((project) => project.areaId === area.id);
  const tasks = state.tasks.filter(
    (task) =>
      task.areaId === area.id && !task.projectId && !task.archived && task.status !== "done"
  );
  const notes = state.notes.filter((note) => note.areaId === area.id && !note.archived);

  const projectsSection = createSection("Projetos da area", "");
  if (!projects.length) {
    projectsSection.body.append(createElement("div", "list-meta", "Sem projetos."));
  } else {
    projects.forEach((project) => projectsSection.body.append(createProjectCard(project)));
  }
  root.append(projectsSection.section);

  const tasksSection = createSection("Tarefas sem projeto", "");
  if (!tasks.length) {
    tasksSection.body.append(createElement("div", "list-meta", "Sem tarefas."));
  } else {
    tasks.forEach((task) => tasksSection.body.append(createTaskRow(task)));
  }
  root.append(tasksSection.section);

  const notesSection = createSection("Notas da area", "");
  if (!notes.length) {
    notesSection.body.append(createElement("div", "list-meta", "Sem notas."));
  } else {
    notes.forEach((note) => notesSection.body.append(createNoteCard(note)));
  }
  root.append(notesSection.section);
}

function renderArchiveView(root) {
  const archivedTasks = state.tasks.filter((task) => task.archived);
  const archivedEvents = state.events.filter((event) => event.archived);
  const archivedNotes = state.notes.filter((note) => note.archived);

  const taskSection = createSection("Tarefas arquivadas", "");
  if (!archivedTasks.length) {
    taskSection.body.append(createElement("div", "list-meta", "Sem tarefas."));
  } else {
    archivedTasks.forEach((task) => taskSection.body.append(createTaskRow(task)));
  }
  root.append(taskSection.section);

  const eventSection = createSection("Eventos arquivados", "");
  if (!archivedEvents.length) {
    eventSection.body.append(createElement("div", "list-meta", "Sem eventos."));
  } else {
    archivedEvents.forEach((event) => eventSection.body.append(createEventRow(event)));
  }
  root.append(eventSection.section);

  const noteSection = createSection("Notas arquivadas", "");
  if (!archivedNotes.length) {
    noteSection.body.append(createElement("div", "list-meta", "Sem notas."));
  } else {
    archivedNotes.forEach((note) => noteSection.body.append(createNoteCard(note)));
  }
  root.append(noteSection.section);
}

function renderDetailsPanel() {
  const selection = getSelectedItem();
  el.detailsBody.innerHTML = "";

  if (!selection.item) {
    el.detailsTitle.textContent = "Nada selecionado";
    setDetailsOpen(false);
    const empty = createElement("div", "empty");
    empty.innerHTML = "<h3>Selecione um item</h3><p>Detalhes aparecem aqui.</p>";
    el.detailsBody.append(empty);
    appendQuickCapturePanel();
+    updateDetailsToggleButton();
    return;
  }

  setDetailsOpen(true);

  if (selection.kind === "task") {
    renderTaskDetails(selection.item);
  } else if (selection.kind === "event") {
    renderEventDetails(selection.item);
  } else if (selection.kind === "note") {
    renderNoteDetails(selection.item);
  }
  appendQuickCapturePanel();
+  updateDetailsToggleButton();
}

function setDetailsOpen(isOpen) {
  document.body.classList.toggle("details-open", isOpen);
  if (el.detailsBackdrop) {
    el.detailsBackdrop.classList.toggle("hidden", !isOpen);
    el.detailsBackdrop.setAttribute("aria-hidden", String(!isOpen));
  }
  if (el.detailsPanel) {
    el.detailsPanel.setAttribute("aria-hidden", String(!isOpen));
  }
  // if panel is being closed fully, also clear minimized visual state
  if (!isOpen) {
    document.body.classList.remove("details-minimized");
    updateDetailsToggleButton();
  }
}

// Hide details panel on mobile view when user scrolls/touch-moving to avoid it covering content
function handleMobileScroll() {
  try {
    if (window.innerWidth > 768) {
      return;
    }
    if (!document.body.classList.contains("details-open")) {
      return;
    }
    // keep selection but hide the panel so it doesn't cover 1/3 of the screen
    setDetailsOpen(false);
  } catch (e) {
    // noop
  }
}

// Toggle minimized visual state (keeps the item selected but frees space)
function toggleDetailsMinimize() {
  const isMin = document.body.classList.toggle("details-minimized");
  updateDetailsToggleButton();
  // when minimizing ensure header remains visible even if previously closed
  if (isMin && !document.body.classList.contains("details-open")) {
    document.body.classList.add("details-open");
    if (el.detailsBackdrop) { el.detailsBackdrop.classList.add("hidden"); el.detailsBackdrop.setAttribute("aria-hidden", "true"); }
    if (el.detailsPanel) { el.detailsPanel.setAttribute("aria-hidden", "false"); }
  }
}

// update button label/aria according to state
function updateDetailsToggleButton() {
  if (!el.detailsToggle) return;
  const minimized = document.body.classList.contains("details-minimized");
  el.detailsToggle.textContent = minimized ? "▴" : "—";
  el.detailsToggle.setAttribute("aria-label", minimized ? "Restaurar painel de detalhes" : "Minimizar painel de detalhes");
}

function renderTaskDetails(task) {
  el.detailsTitle.textContent = task.title || "Tarefa";

  const titleInput = document.createElement("input");
  titleInput.value = task.title;
  titleInput.addEventListener("input", () => {
    task.title = titleInput.value;
    touch(task);
    saveStateDebounced();
    renderMain();
  });

  const statusSelect = createSelect(
    STATUS_ORDER.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
    task.status
  );
  statusSelect.addEventListener("change", () => {
    task.status = statusSelect.value;
    touch(task);
    saveState();
    renderMain();
  });

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = task.dueDate || "";
  dateInput.addEventListener("change", () => {
    task.dueDate = dateInput.value;
    touch(task);
    saveState();
    renderMain();
  });

  const timeInput = document.createElement("input");
  timeInput.type = "time";
  timeInput.value = task.dueTime || "";
  timeInput.addEventListener("change", () => {
    task.dueTime = timeInput.value;
    touch(task);
    saveState();
    renderMain();
  });

  const prioritySelect = createSelect(
    [
      { value: "low", label: "Baixa" },
      { value: "med", label: "Media" },
      { value: "high", label: "Alta" }
    ],
    task.priority
  );
  prioritySelect.addEventListener("change", () => {
    task.priority = prioritySelect.value;
    touch(task);
    saveState();
  });

  const projectSelect = createProjectSelect(task.projectId);
  projectSelect.addEventListener("change", () => {
    task.projectId = projectSelect.value || null;
    touch(task);
    saveState();
    renderMain();
  });

  const areaSelect = createAreaSelect(task.areaId);
  areaSelect.addEventListener("change", () => {
    task.areaId = areaSelect.value || null;
    touch(task);
    saveState();
    renderMain();
  });

  const notesInput = document.createElement("textarea");
  notesInput.rows = 4;
  notesInput.value = task.notes || "";
  notesInput.addEventListener("input", () => {
    task.notes = notesInput.value;
    touch(task);
    saveStateDebounced();
  });

  const linksInput = document.createElement("textarea");
  linksInput.rows = 3;
  linksInput.value = (task.attachments || []).join("\n");
  linksInput.addEventListener("input", () => {
    task.attachments = linksInput.value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    touch(task);
    saveStateDebounced();
  });

  const noteSelect = createNoteSelect(task.linkedNoteId);
  noteSelect.addEventListener("change", () => {
    task.linkedNoteId = noteSelect.value || null;
    touch(task);
    saveState();
  });

  const checklist = createChecklistEditor(task);

  const actions = createElement("div", "card-actions");
  actions.append(
    createButton("Concluir", "ghost-btn", () => {
      task.status = "done";
      touch(task);
      saveState();
      renderAll();
    }),
    createButton("Definir foco", "ghost-btn", () => toggleTaskFocus(task)),
    createButton("Adiar 1 dia", "ghost-btn", () => snoozeTask(task, 1)),
    createButton("Adiar 7 dias", "ghost-btn", () => snoozeTask(task, 7)),
    createButton("Arquivar", "ghost-btn danger", () => archiveTask(task))
  );

  el.detailsBody.append(
    buildField("Titulo", titleInput),
    buildField("Status", statusSelect),
    buildField("Prazo", dateInput),
    buildField("Hora", timeInput),
    buildField("Prioridade", prioritySelect),
    buildField("Projeto", projectSelect),
    buildField("Area", areaSelect),
    buildField("Subtarefas", checklist),
    buildField("Descricao", notesInput),
    buildField("Anexos/links", linksInput),
    buildField("Vinculo com nota", noteSelect),
    buildField("Acoes chave", actions)
  );
}

function renderEventDetails(event) {
  el.detailsTitle.textContent = event.title || "Evento";

  const titleInput = document.createElement("input");
  titleInput.value = event.title;
  titleInput.addEventListener("input", () => {
    event.title = titleInput.value;
    touch(event);
    saveStateDebounced();
    renderMain();
  });

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = event.date;
  dateInput.addEventListener("change", () => {
    event.date = dateInput.value;
    touch(event);
    saveState();
    renderMain();
  });

  const timeInput = document.createElement("input");
  timeInput.type = "time";
  timeInput.value = event.start;
  timeInput.addEventListener("change", () => {
    event.start = timeInput.value;
    touch(event);
    saveState();
    renderMain();
  });

  const durationInput = document.createElement("input");
  durationInput.type = "number";
  durationInput.min = "15";
  durationInput.value = event.duration;
  durationInput.addEventListener("change", () => {
    event.duration = Math.max(15, Number(durationInput.value) || 15);
    touch(event);
    saveState();
    renderMain();
  });

  const recurrenceSelect = createSelect(
    [
      { value: "none", label: "Sem repeticao" },
      { value: "daily", label: "Diario" },
      { value: "weekly", label: "Semanal" },
      { value: "monthly", label: "Mensal" }
    ],
    event.recurrence
  );
  recurrenceSelect.addEventListener("change", () => {
    event.recurrence = recurrenceSelect.value;
    touch(event);
    saveState();
  });

  const locationInput = document.createElement("input");
  locationInput.value = event.location || "";
  locationInput.addEventListener("input", () => {
    event.location = locationInput.value;
    touch(event);
    saveStateDebounced();
  });

  const notesInput = document.createElement("textarea");
  notesInput.rows = 4;
  notesInput.value = event.notes || "";
  notesInput.addEventListener("input", () => {
    event.notes = notesInput.value;
    touch(event);
    saveStateDebounced();
  });

  const projectSelect = createProjectSelect(event.projectId);
  projectSelect.addEventListener("change", () => {
    event.projectId = projectSelect.value || null;
    touch(event);
    saveState();
  });

  const areaSelect = createAreaSelect(event.areaId);
  areaSelect.addEventListener("change", () => {
    event.areaId = areaSelect.value || null;
    touch(event);
    saveState();
  });

  const actions = createElement("div", "card-actions");
  actions.append(
    createButton("Arquivar", "ghost-btn danger", () => archiveEvent(event))
  );

  el.detailsBody.append(
    buildField("Titulo", titleInput),
    buildField("Data", dateInput),
    buildField("Hora", timeInput),
    buildField("Duracao (min)", durationInput),
    buildField("Repeticao", recurrenceSelect),
    buildField("Local", locationInput),
    buildField("Projeto", projectSelect),
    buildField("Area", areaSelect),
    buildField("Notas", notesInput),
    buildField("Acoes chave", actions)
  );
}

function renderNoteDetails(note) {
  el.detailsTitle.textContent = note.title || "Nota";

  const areaSelect = createAreaSelect(note.areaId);
  areaSelect.addEventListener("change", () => {
    note.areaId = areaSelect.value || null;
    touch(note);
    saveState();
    renderMain();
  });

  const projectSelect = createProjectSelect(note.projectId);
  projectSelect.addEventListener("change", () => {
    note.projectId = projectSelect.value || null;
    touch(note);
    saveState();
    renderMain();
  });

  const backlinks = createElement("div", "card");
  const linkedTasks = state.tasks.filter(
    (task) => task.linkedNoteId === note.id || task.sourceNoteId === note.id
  );
  backlinks.append(createElement("div", "card-title", "Backlinks"));
  if (!linkedTasks.length) {
    backlinks.append(createElement("div", "list-meta", "Nenhuma tarefa vinculada."));
  } else {
    linkedTasks.forEach((task) => backlinks.append(createTaskRow(task, { compact: true })));
  }

  const actions = createElement("div", "card-actions");
  actions.append(
    createButton("Abrir nota", "ghost-btn", () => navigate(`/notes/${note.id}`)),
    createButton("Arquivar", "ghost-btn danger", () => archiveNote(note))
  );

  el.detailsBody.append(
    buildField("Area", areaSelect),
    buildField("Projeto", projectSelect),
    buildField("Links", backlinks),
    buildField("Acoes chave", actions)
  );
}

function appendQuickCapturePanel() {
  const route = parseRoute(state.ui.route);
  if (!route || route.name !== "today") {
    return;
  }
  const section = createElement("div", "section");
  const header = createElement("div", "section-header");
  header.append(createElement("div", "section-title", "+ Capturar rapido"));
  section.append(header);
  const input = document.createElement("input");
  input.placeholder = "Digite uma tarefa para hoje...";
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const value = input.value.trim();
      if (!value) {
        return;
      }
      state.tasks.unshift(createTask({ title: value, dueDate: getTodayKey() }));
      input.value = "";
      saveState();
      renderMain();
    }
  });
  section.append(input);
  el.detailsBody.append(section);
}

function createElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function createButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className || "ghost-btn";
  button.textContent = label;
  if (onClick) {
    button.addEventListener("click", onClick);
  }
  return button;
}

function createSection(title, hint) {
  const section = createElement("div", "section");
  const header = createElement("div", "section-header");
  const heading = createElement("div", "section-title", title);
  header.append(heading);
  if (hint) {
    header.append(createElement("div", "section-hint", hint));
  }
  section.append(header);
  const body = createElement("div");
  section.append(body);
  return { section, body };
}

function buildField(label, input) {
  const wrapper = createElement("label", "field");
  const title = createElement("span", "", label);
  wrapper.append(title, input);
  return wrapper;
}

function createSelect(options, value) {
  const select = document.createElement("select");
  options.forEach((optionData) => {
    const option = document.createElement("option");
    option.value = optionData.value;
    option.textContent = optionData.label;
    select.append(option);
  });
  select.value = value || "";
  return select;
}

function setCount(node, count) {
  if (!node) {
    return;
  }
  node.textContent = count ? String(count) : "";
}

function createTaskRow(task, options = {}) {
  const row = createElement("div", "task-row");
  row.classList.toggle(
    "active",
    state.ui.selected && state.ui.selected.kind === "task" && state.ui.selected.id === task.id
  );
  row.draggable = !task.archived && task.status !== "done";
  row.addEventListener("dragstart", (event) => {
    if (!row.draggable) {
      event.preventDefault();
      return;
    }
    row.classList.add("dragging");
    setDragData(event, "task", task.id);
  });
  row.addEventListener("dragend", () => row.classList.remove("dragging"));

  const info = createElement("div");
  info.append(createElement("div", "task-title", task.title));
  const metaParts = [];
  if (task.dueDate) {
    metaParts.push(`Prazo ${task.dueDate}`);
  }
  if (task.dueTime) {
    metaParts.push(task.dueTime);
  }
  if (task.projectId) {
    const project = getProject(task.projectId);
    if (project) {
      metaParts.push(project.name);
    }
  }
  if (task.areaId) {
    const area = getArea(task.areaId);
    if (area) {
      metaParts.push(area.name);
    }
  }
  if (task.priority) {
    metaParts.push(PRIORITY_LABELS[task.priority] || "");
  }
  info.append(createElement("div", "task-meta", metaParts.filter(Boolean).join(" / ")));

  row.append(info);

  if (!options.compact) {
    const actions = createElement("div", "task-actions");
    if (task.archived) {
      actions.append(
        createButton("Restaurar", "ghost-btn", (event) => {
          event.stopPropagation();
          task.archived = false;
          touch(task);
          saveState();
          renderAll();
        })
      );
    } else if (task.status === "done") {
      actions.append(
        createButton("Reabrir", "ghost-btn", (event) => {
          event.stopPropagation();
          task.status = "todo";
          touch(task);
          saveState();
          renderAll();
        })
      );
    } else {
      actions.append(
        createButton("Concluir", "ghost-btn", (event) => {
          event.stopPropagation();
          task.status = "done";
          touch(task);
          saveState();
          renderAll();
        }),
        createButton("Definir foco", "ghost-btn", (event) => {
          event.stopPropagation();
          toggleTaskFocus(task);
        })
      );
    }
    row.append(actions);
  }

  row.addEventListener("click", () => selectItem("task", task.id));
  return row;
}

function createTaskCard(task, options = {}) {
  const card = createElement("div", "card");
  card.append(createElement("div", "card-title", task.title));
  const meta = [];
  if (task.dueDate) {
    meta.push(`Prazo ${task.dueDate}`);
  }
  if (task.projectId) {
    const project = getProject(task.projectId);
    if (project) {
      meta.push(project.name);
    }
  }
  card.append(createElement("div", "card-meta", meta.join(" / ")));
  if (!options.compact) {
    card.append(
      createButton("Ver detalhes", "ghost-btn", (event) => {
        event.stopPropagation();
        selectItem("task", task.id);
      })
    );
  }
  card.addEventListener("click", () => selectItem("task", task.id));
  return card;
}

function createEventRow(event) {
  const row = createElement("div", "event-row");
  row.classList.toggle(
    "active",
    state.ui.selected && state.ui.selected.kind === "event" && state.ui.selected.id === event.id
  );
  row.draggable = !event.archived;
  row.addEventListener("dragstart", (ev) => {
    if (!row.draggable) {
      ev.preventDefault();
      return;
    }
    row.classList.add("dragging");
    setDragData(ev, "event", event.id);
  });
  row.addEventListener("dragend", () => row.classList.remove("dragging"));

  const info = createElement("div");
  info.append(createElement("div", "event-title", event.title));
  info.append(
    createElement(
      "div",
      "event-meta",
      `${event.date} - ${formatTimeLabel(event.start)}`
    )
  );
  row.append(info);

  const actions = createElement("div", "task-actions");
  if (event.archived) {
    actions.append(
      createButton("Restaurar", "ghost-btn", (eventClick) => {
        eventClick.stopPropagation();
        event.archived = false;
        touch(event);
        saveState();
        renderAll();
      })
    );
  } else {
    actions.append(
      createButton("Arquivar", "ghost-btn", (eventClick) => {
        eventClick.stopPropagation();
        archiveEvent(event);
      })
    );
  }
  row.append(actions);

  row.addEventListener("click", () => selectItem("event", event.id));
  return row;
}

function createInboxRow(item, options = {}) {
  const row = createElement("div", "inbox-row");
  row.addEventListener("mouseenter", () => {
    state.ui.inboxActiveId = item.id;
  });

  if (!options.compact) {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.ui.inboxSelection.includes(item.id);
    checkbox.addEventListener("change", () => {
      toggleInboxSelection(item.id);
    });
    row.append(checkbox);
  } else {
    row.append(createElement("div", "tag", item.kind));
  }

  const info = createElement("div");
  info.append(createElement("div", "task-title", item.title));
  info.append(createElement("div", "list-meta", `Sugestao: ${item.kind}`));
  row.append(info);

  const actions = createElement("div", "inbox-actions");
  actions.append(
    createButton("Processar", "ghost-btn", (event) => {
      event.stopPropagation();
      openProcessModal(item);
    })
  );
  if (!options.compact) {
    actions.append(
      createButton("Arquivar", "ghost-btn", (event) => {
        event.stopPropagation();
        archiveInboxItem(item.id);
      }),
      createButton("Deletar", "ghost-btn danger", (event) => {
        event.stopPropagation();
        deleteInboxItem(item.id);
      })
    );
  }
  row.append(actions);
  return row;
}

function createProjectCard(project) {
  const card = createElement("div", "card");
  card.append(createElement("div", "card-title", project.name));
  if (project.objective) {
    card.append(createElement("div", "card-meta", project.objective));
  }
  const tasks = state.tasks.filter((task) => task.projectId === project.id && !task.archived);
  const done = tasks.filter((task) => task.status === "done").length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const progressWrap = createElement("div", "progress");
  const bar = createElement("div", "progress-bar");
  bar.style.width = `${progress}%`;
  progressWrap.append(bar);
  card.append(progressWrap);
  const next = tasks.find((task) => task.status !== "done");
  if (next) {
    card.append(createElement("div", "card-meta", `Proximo: ${next.title}`));
  }

  const actions = createElement("div", "card-actions");
  if (project.status === "active") {
    actions.append(
      createButton("Pausar", "ghost-btn", (event) => {
        event.stopPropagation();
        project.status = "paused";
        touch(project);
        saveState();
        renderMain();
      }),
      createButton("Concluir", "ghost-btn", (event) => {
        event.stopPropagation();
        project.status = "done";
        touch(project);
        saveState();
        renderMain();
      })
    );
  } else if (project.status === "paused") {
    actions.append(
      createButton("Reativar", "ghost-btn", (event) => {
        event.stopPropagation();
        project.status = "active";
        touch(project);
        saveState();
        renderMain();
      })
    );
  }
  card.append(actions);

  card.addEventListener("click", () => navigate(`/projects/${project.id}`));
  return card;
}

function createAreaCard(area) {
  const card = createElement("div", "card");
  card.append(createElement("div", "card-title", area.name));
  if (area.objective) {
    card.append(createElement("div", "card-meta", area.objective));
  }
  
  const actions = createElement("div", "card-actions");
  actions.append(
    createButton("Editar", "ghost-btn", (event) => {
      event.stopPropagation();
      openAreaEditModal(area);
    }),
    createButton("Deletar", "ghost-btn danger", (event) => {
      event.stopPropagation();
      if (confirm(`Tem certeza que deseja deletar "${area.name}"?`)) {
        deleteArea(area.id);
      }
    })
  );
  card.append(actions);
  
  card.addEventListener("click", () => navigate(`/areas/${area.id}`));
  return card;
}

function renderAreaDetail(root, areaId) {
  const area = getArea(areaId);
  if (!area) {
    root.append(createElement("div", "empty", "Area nao encontrada."));
    return;
  }

  const header = createSection("Resumo da area", "");
  const nameInput = document.createElement("input");
  nameInput.value = area.name;
  nameInput.addEventListener("input", () => {
    area.name = nameInput.value;
    touch(area);
    saveStateDebounced();
    renderSidebar();
  });
  const objectiveInput = document.createElement("textarea");
  objectiveInput.rows = 3;
  objectiveInput.value = area.objective || "";
  objectiveInput.addEventListener("input", () => {
    area.objective = objectiveInput.value;
    touch(area);
    saveStateDebounced();
  });
  
  const deleteBtn = createButton("Deletar area", "ghost-btn danger", () => {
    if (confirm(`Tem certeza que deseja deletar "${area.name}"? Isto nao deletara seus projetos e tarefas.`)) {
      deleteArea(area.id);
      navigate("/areas");
    }
  });
  
  header.body.append(
    buildField("Nome", nameInput),
    buildField("Objetivo", objectiveInput),
    deleteBtn
  );
  root.append(header.section);

  const projects = state.projects.filter((project) => project.areaId === area.id);
  const tasks = state.tasks.filter(
    (task) =>
      task.areaId === area.id && !task.projectId && !task.archived && task.status !== "done"
  );
  const notes = state.notes.filter((note) => note.areaId === area.id && !note.archived);

  const projectsSection = createSection("Projetos da area", "");
  if (!projects.length) {
    projectsSection.body.append(createElement("div", "list-meta", "Sem projetos."));
  } else {
    projects.forEach((project) => projectsSection.body.append(createProjectCard(project)));
  }
  root.append(projectsSection.section);

  const tasksSection = createSection("Tarefas sem projeto", "");
  if (!tasks.length) {
    tasksSection.body.append(createElement("div", "list-meta", "Sem tarefas."));
  } else {
    tasks.forEach((task) => tasksSection.body.append(createTaskRow(task)));
  }
  root.append(tasksSection.section);

  const notesSection = createSection("Notas da area", "");
  if (!notes.length) {
    notesSection.body.append(createElement("div", "list-meta", "Sem notas."));
  } else {
    notes.forEach((note) => notesSection.body.append(createNoteCard(note)));
  }
  root.append(notesSection.section);
}

function renderArchiveView(root) {
  const archivedTasks = state.tasks.filter((task) => task.archived);
  const archivedEvents = state.events.filter((event) => event.archived);
  const archivedNotes = state.notes.filter((note) => note.archived);

  const taskSection = createSection("Tarefas arquivadas", "");
  if (!archivedTasks.length) {
    taskSection.body.append(createElement("div", "list-meta", "Sem tarefas."));
  } else {
    archivedTasks.forEach((task) => taskSection.body.append(createTaskRow(task)));
  }
  root.append(taskSection.section);

  const eventSection = createSection("Eventos arquivados", "");
  if (!archivedEvents.length) {
    eventSection.body.append(createElement("div", "list-meta", "Sem eventos."));
  } else {
    archivedEvents.forEach((event) => eventSection.body.append(createEventRow(event)));
  }
  root.append(eventSection.section);

  const noteSection = createSection("Notas arquivadas", "");
  if (!archivedNotes.length) {
    noteSection.body.append(createElement("div", "list-meta", "Sem notas."));
  } else {
    archivedNotes.forEach((note) => noteSection.body.append(createNoteCard(note)));
  }
  root.append(noteSection.section);
}

function renderDetailsPanel() {
  const selection = getSelectedItem();
  el.detailsBody.innerHTML = "";

  if (!selection.item) {
    el.detailsTitle.textContent = "Nada selecionado";
    setDetailsOpen(false);
    const empty = createElement("div", "empty");
    empty.innerHTML = "<h3>Selecione um item</h3><p>Detalhes aparecem aqui.</p>";
    el.detailsBody.append(empty);
    appendQuickCapturePanel();
+    updateDetailsToggleButton();
    return;
  }

  setDetailsOpen(true);

  if (selection.kind === "task") {
    renderTaskDetails(selection.item);
  } else if (selection.kind === "event") {
    renderEventDetails(selection.item);
  } else if (selection.kind === "note") {
    renderNoteDetails(selection.item);
  }
  appendQuickCapturePanel();
+  updateDetailsToggleButton();
}

function setDetailsOpen(isOpen) {
  document.body.classList.toggle("details-open", isOpen);
  if (el.detailsBackdrop) {
    el.detailsBackdrop.classList.toggle("hidden", !isOpen);
    el.detailsBackdrop.setAttribute("aria-hidden", String(!isOpen));
  }
  if (el.detailsPanel) {
    el.detailsPanel.setAttribute("aria-hidden", String(!isOpen));
  }
  // if panel is being closed fully, also clear minimized visual state
  if (!isOpen) {
    document.body.classList.remove("details-minimized");
    updateDetailsToggleButton();
  }
}

// Hide details panel on mobile view when user scrolls/touch-moving to avoid it covering content
function handleMobileScroll() {
  try {
    if (window.innerWidth > 768) {
      return;
    }
    if (!document.body.classList.contains("details-open")) {
      return;
    }
    // keep selection but hide the panel so it doesn't cover 1/3 of the screen
    setDetailsOpen(false);
  } catch (e) {
    // noop
  }
}

// Toggle minimized visual state (keeps the item selected but frees space)
function toggleDetailsMinimize() {
  const isMin = document.body.classList.toggle("details-minimized");
  updateDetailsToggleButton();
  // when minimizing ensure header remains visible even if previously closed
  if (isMin && !document.body.classList.contains("details-open")) {
    document.body.classList.add("details-open");
    if (el.detailsBackdrop) { el.detailsBackdrop.classList.add("hidden"); el.detailsBackdrop.setAttribute("aria-hidden", "true"); }
    if (el.detailsPanel) { el.detailsPanel.setAttribute("aria-hidden", "false"); }
  }
}

// update button label/aria according to state
function updateDetailsToggleButton() {
  if (!el.detailsToggle) return;
  const minimized = document.body.classList.contains("details-minimized");
  el.detailsToggle.textContent = minimized ? "▴" : "—";
  el.detailsToggle.setAttribute("aria-label", minimized ? "Restaurar painel de detalhes" : "Minimizar painel de detalhes");
}

function renderTaskDetails(task) {
  el.detailsTitle.textContent = task.title || "Tarefa";

  const titleInput = document.createElement("input");
  titleInput.value = task.title;
  titleInput.addEventListener("input", () => {
    task.title = titleInput.value;
    touch(task);
    saveStateDebounced();
    renderMain();
  });

  const statusSelect = createSelect(
    STATUS_ORDER.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
    task.status
  );
  statusSelect.addEventListener("change", () => {
    task.status = statusSelect.value;
    touch(task);
    saveState();
    renderMain();
  });

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = task.dueDate || "";
  dateInput.addEventListener("change", () => {
    task.dueDate = dateInput.value;
    touch(task);
    saveState();
    renderMain();
  });

  const timeInput = document.createElement("input");
  timeInput.type = "time";
  timeInput.value = task.dueTime || "";
  timeInput.addEventListener("change", () => {
    task.dueTime = timeInput.value;
    touch(task);
    saveState();
    renderMain();
  });

  const prioritySelect = createSelect(
    [
      { value: "low", label: "Baixa" },
      { value: "med", label: "Media" },
      { value: "high", label: "Alta" }
    ],
    task.priority
  );
  prioritySelect.addEventListener("change", () => {
    task.priority = prioritySelect.value;
    touch(task);
    saveState();
  });

  const projectSelect = createProjectSelect(task.projectId);
  projectSelect.addEventListener("change", () => {
    task.projectId = projectSelect.value || null;
    touch(task);
    saveState();
    renderMain();
  });

  const areaSelect = createAreaSelect(task.areaId);
  areaSelect.addEventListener("change", () => {
    task.areaId = areaSelect.value || null;
    touch(task);
    saveState();
    renderMain();
  });

  const notesInput = document.createElement("textarea");
  notesInput.rows = 4;
  notesInput.value = task.notes || "";
  notesInput.addEventListener("input", () => {
    task.notes = notesInput.value;
    touch(task);
    saveStateDebounced();
  });

  const linksInput = document.createElement("textarea");
  linksInput.rows = 3;
  linksInput.value = (task.attachments || []).join("\n");
  linksInput.addEventListener("input", () => {
    task.attachments = linksInput.value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    touch(task);
    saveStateDebounced();
  });

  const noteSelect = createNoteSelect(task.linkedNoteId);
  noteSelect.addEventListener("change", () => {
    task.linkedNoteId = noteSelect.value || null;
    touch(task);
    saveState();
  });

  const checklist = createChecklistEditor(task);

  const actions = createElement("div", "card-actions");
  actions.append(
    createButton("Concluir", "ghost-btn", () => {
      task.status = "done";
      touch(task);
      saveState();
      renderAll();
    }),
    createButton("Definir foco", "ghost-btn", () => toggleTaskFocus(task)),
    createButton("Adiar 1 dia", "ghost-btn", () => snoozeTask(task, 1)),
    createButton("Adiar 7 dias", "ghost-btn", () => snoozeTask(task, 7)),
    createButton("Arquivar", "ghost-btn danger", () => archiveTask(task))
  );

  el.detailsBody.append(
    buildField("Titulo", titleInput),
    buildField("Status", statusSelect),
    buildField("Prazo", dateInput),
    buildField("Hora", timeInput),
    buildField("Prioridade", prioritySelect),
    buildField("Projeto", projectSelect),
    buildField("Area", areaSelect),
    buildField("Subtarefas", checklist),
    buildField("Descricao", notesInput),
    buildField("Anexos/links", linksInput),
    buildField("Vinculo com nota", noteSelect),
    buildField("Acoes chave", actions)
  );
}

function renderEventDetails(event) {
  el.detailsTitle.textContent = event.title || "Evento";

  const titleInput = document.createElement("input");
  titleInput.value = event.title;
  titleInput.addEventListener("input", () => {
    event.title = titleInput.value;
    touch(event);
    saveStateDebounced();
    renderMain();
  });

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = event.date;
  dateInput.addEventListener("change", () => {
    event.date = dateInput.value;
    touch(event);
    saveState();
    renderMain();
  });

  const timeInput = document.createElement("input");
  timeInput.type = "time";
  timeInput.value = event.start;
  timeInput.addEventListener("change", () => {
    event.start = timeInput.value;
    touch(event);
    saveState();
    renderMain();
  });

  const durationInput = document.createElement("input");
  durationInput.type = "number";
  durationInput.min = "15";
  durationInput.value = event.duration;
  durationInput.addEventListener("change", () => {
    event.duration = Math.max(15, Number(durationInput.value) || 15);
    touch(event);
    saveState();
    renderMain();
  });

  const recurrenceSelect = createSelect(
    [
      { value: "none", label: "Sem repeticao" },
      { value: "daily", label: "Diario" },
      { value: "weekly", label: "Semanal" },
      { value: "monthly", label: "Mensal" }
    ],
    event.recurrence
  );
  recurrenceSelect.addEventListener("change", () => {
    event.recurrence = recurrenceSelect.value;
    touch(event);
    saveState();
  });

  const locationInput = document.createElement("input");
  locationInput.value = event.location || "";
  locationInput.addEventListener("input", () => {
    event.location = locationInput.value;
    touch(event);
    saveStateDebounced();
  });

  const notesInput = document.createElement("textarea");
  notesInput.rows = 4;
  notesInput.value = event.notes || "";
  notesInput.addEventListener("input", () => {
    event.notes = notesInput.value;
    touch(event);
    saveStateDebounced();
  });

  const projectSelect = createProjectSelect(event.projectId);
  projectSelect.addEventListener("change", () => {
    event.projectId = projectSelect.value || null;
    touch(event);
    saveState();
  });

  const areaSelect = createAreaSelect(event.areaId);
  areaSelect.addEventListener("change", () => {
    event.areaId = areaSelect.value || null;
    touch(event);
    saveState();
  });

  const actions = createElement("div", "card-actions");
  actions.append(
    createButton("Arquivar", "ghost-btn danger", () => archiveEvent(event))
  );

  el.detailsBody.append(
    buildField("Titulo", titleInput),
    buildField("Data", dateInput),
    buildField("Hora", timeInput),
    buildField("Duracao (min)", durationInput),
    buildField("Repeticao", recurrenceSelect),
    buildField("Local", locationInput),
    buildField("Projeto", projectSelect),
    buildField("Area", areaSelect),
    buildField("Notas", notesInput),
    buildField("Acoes chave", actions)
  );
}

function renderNoteDetails(note) {
  el.detailsTitle.textContent = note.title || "Nota";

  const areaSelect = createAreaSelect(note.areaId);
  areaSelect.addEventListener("change", () => {
    note.areaId = areaSelect.value || null;
    touch(note);
    saveState();
    renderMain();
  });

  const projectSelect = createProjectSelect(note.projectId);
  projectSelect.addEventListener("change", () => {
    note.projectId = projectSelect.value || null;
    touch(note);
    saveState();
    renderMain();
  });

  const backlinks = createElement("div", "card");
  const linkedTasks = state.tasks.filter(
    (task) => task.linkedNoteId === note.id || task.sourceNoteId === note.id
  );
  backlinks.append(createElement("div", "card-title", "Backlinks"));
  if (!linkedTasks.length) {
    backlinks.append(createElement("div", "list-meta", "Nenhuma tarefa vinculada."));
  } else {
    linkedTasks.forEach((task) => backlinks.append(createTaskRow(task, { compact: true })));
  }

  const actions = createElement("div", "card-actions");
  actions.append(
    createButton("Abrir nota", "ghost-btn", () => navigate(`/notes/${note.id}`)),
    createButton("Arquivar", "ghost-btn danger", () => archiveNote(note))
  );

  el.detailsBody.append(
    buildField("Area", areaSelect),
    buildField("Projeto", projectSelect),
    buildField("Links", backlinks),
    buildField("Acoes chave", actions)
  );
}

function appendQuickCapturePanel() {
  const route = parseRoute(state.ui.route);
  if (!route || route.name !== "today") {
    return;
  }
  const section = createElement("div", "section");
  const header = createElement("div", "section-header");
  header.append(createElement("div", "section-title", "+ Capturar rapido"));
  section.append(header);
  const input = document.createElement("input");
  input.placeholder = "Digite uma tarefa para hoje...";
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      const value = input.value.trim();
      if (!value) {
        return;
      }
      state.tasks.unshift(createTask({ title: value, dueDate: getTodayKey() }));
      input.value = "";
      saveState();
      renderMain();
    }
  });
  section.append(input);
  el.detailsBody.append(section);
}

function createElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

function createButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className || "ghost-btn";
  button.textContent = label;
  if (onClick) {
    button.addEventListener("click", onClick);
  }
  return button;
}

function createSection(title, hint) {
  const section = createElement("div", "section");
  const header = createElement("div", "section-header");
  const heading = createElement("div", "section-title", title);
  header.append(heading);
  if (hint) {
    header.append(createElement("div", "section-hint", hint));
  }
  section.append(header);
  const body = createElement("div");
  section.append(body);
  return { section, body };
}

function buildField(label, input) {
  const wrapper = createElement("label", "field");
  const title = createElement("span", "", label);
  wrapper.append(title, input);
  return wrapper;
}

function createSelect(options, value) {
  const select = document.createElement("select");
  options.forEach((optionData) => {
    const option = document.createElement("option");
    option.value = optionData.value;
    option.textContent = optionData.label;
    select.append(option);
  });
  select.value = value || "";
  return select;
}

function setCount(node, count) {
  if (!node) {
    return;
  }
  node.textContent = count ? String(count) : "";
}

function createTaskRow(task, options = {}) {
  const row = createElement("div", "task-row");
  row.classList.toggle(
    "active",
    state.ui.selected && state.ui.selected.kind === "task" && state.ui.selected.id === task.id
  );
  row.draggable = !task.archived && task.status !== "done";
  row.addEventListener("dragstart", (event) => {
    if (!row.draggable) {
      event.preventDefault();
      return;
    }
    row.classList.add("dragging");
    setDragData(event, "task", task.id);
  });
  row.addEventListener("dragend", () => row.classList.remove("dragging"));

  const info = createElement("div");
  info.append(createElement("div", "task-title", task.title));
  const metaParts = [];
  if (task.dueDate) {
    metaParts.push(`Prazo ${task.dueDate}`);
  }
  if (task.dueTime) {
    metaParts.push(task.dueTime);
  }
  if (task.projectId) {
    const project = getProject(task.projectId);
    if (project) {
      metaParts.push(project.name);
    }
  }
  if (task.areaId) {
    const area = getArea(task.areaId);
    if (area) {
      metaParts.push(area.name);
    }
  }
  if (task.priority) {
    metaParts.push(PRIORITY_LABELS[task.priority] || "");
  }
  info.append(createElement("div", "task-meta", metaParts.filter(Boolean).join(" / ")));

  row.append(info);

  if (!options.compact) {
    const actions = createElement("div", "task-actions");
    if (task.archived) {
      actions.append(
        createButton("Restaurar", "ghost-btn", (event) => {
          event.stopPropagation();
          task.archived = false;
          touch(task);
          saveState();
          renderAll();
        })
      );
    } else if (task.status === "done") {
      actions.append(
        createButton("Reabrir", "ghost-btn", (event) => {
          event.stopPropagation();
          task.status = "todo";
          touch(task);
          saveState();
          renderAll();
        })
      );
    } else {
      actions.append(
        createButton("Concluir", "ghost-btn", (event) => {
          event.stopPropagation();
          task.status = "done";
          touch(task);
          saveState();
          renderAll();
        }),
        createButton("Definir foco", "ghost-btn", (event) => {
          event.stopPropagation();
          toggleTaskFocus(task);
        })
      );
    }
    row.append(actions);
  }

  row.addEventListener("click", () => selectItem("task", task.id));
  return row;
}

function createTaskCard(task, options = {}) {
  const card = createElement("div", "card");
  card.append(createElement("div", "card-title", task.title));
  const meta = [];
  if (task.dueDate) {
    meta.push(`Prazo ${task.dueDate}`);
  }
  if (task.projectId) {
    const project = getProject(task.projectId);
    if (project) {
      meta.push(project.name);
    }
  }
  card.append(createElement("div", "card-meta", meta.join(" / ")));
  if (!options.compact) {
    card.append(
      createButton("Ver detalhes", "ghost-btn", (event) => {
        event.stopPropagation();
        selectItem("task", task.id);
      })
    );
  }
  card.addEventListener("click", () => selectItem("task", task.id));
  return card;
}

function createEventRow(event) {
  const row = createElement("div", "event-row");
  row.classList.toggle(
    "active",
    state.ui.selected && state.ui.selected.kind === "event" && state.ui.selected.id === event.id
  );
  row.draggable = !event.archived;
  row.addEventListener("dragstart", (ev) => {
    if (!row.draggable) {
      ev.preventDefault();
      return;
    }
    row.classList.add("dragging");
    setDragData(ev, "event", event.id);
  });
  row.addEventListener("dragend", () => row.classList.remove("dragging"));

  const info = createElement("div");
  info.append(createElement("div", "event-title", event.title));
  info.append(
    createElement(
      "div",
      "event-meta",
      `${event.date} - ${formatTimeLabel(event.start)}`
    )
  );
  row.append(info);

  const actions = createElement("div", "task-actions");
  if (event.archived) {
    actions.append(
      createButton("Restaurar", "ghost-btn", (eventClick) => {
        eventClick.stopPropagation();
        event.archived = false;
        touch(event);
        saveState();
        renderAll();
      })
    );
  } else {
    actions.append(
      createButton("Arquivar", "ghost-btn", (eventClick) => {
        eventClick.stopPropagation();
        archiveEvent(event);
      })
    );
  }
  row.append(actions);

  row.addEventListener("click", () => selectItem("event", event.id));
  return row;
}

function createInboxRow(item, options = {}) {
  const row = createElement("div", "inbox-row");
  row.addEventListener("mouseenter", () => {
    state.ui.inboxActiveId = item.id;
  });

  if (!options.compact) {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.ui.inboxSelection.includes(item.id);
    checkbox.addEventListener("change", () => {
      toggleInboxSelection(item.id);
    });
    row.append(checkbox);
  } else {
    row.append(createElement("div", "tag", item.kind));
  }

  const info = createElement("div");
  info.append(createElement("div", "task-title", item.title));
  info.append(createElement("div", "list-meta", `Sugestao: ${item.kind}`));
  row.append(info);

  const actions = createElement("div", "inbox-actions");
  actions.append(
    createButton("Processar", "ghost-btn", (event) => {
      event.stopPropagation();
      openProcessModal(item);
    })
  );
  if (!options.compact) {
    actions.append(
      createButton("Arquivar", "ghost-btn", (event) => {
        event.stopPropagation();
        archiveInboxItem(item.id);
      }),
      createButton("Deletar", "ghost-btn danger", (event) => {
        event.stopPropagation();
        deleteInboxItem(item.id);
      })
    );
  }
  row.append(actions);
  return row;
}

function createProjectCard(project) {
  const card = createElement("div", "card");
  card.append(createElement("div", "card-title", project.name));
  if (project.objective) {
    card.append(createElement("div", "card-meta", project.objective));
  }
  const tasks = state.tasks.filter((task) => task.projectId === project.id && !task.archived);
  const done = tasks.filter((task) => task.status === "done").length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const progressWrap = createElement("div", "progress");
  const bar = createElement("div", "progress-bar");
  bar.style.width = `${progress}%`;
  progressWrap.append(bar);
  card.append(progressWrap);
  const next = tasks.find((task) => task.status !== "done");
  if (next) {
    card.append(createElement("div", "card-meta", `Proximo: ${next.title}`));
  }

  const actions = createElement("div", "card-actions");
  if (project.status === "active") {
    actions.append(
      createButton("Pausar", "ghost-btn", (event) => {
        event.stopPropagation();
        project.status = "paused";
        touch(project);
        saveState();
        renderMain();
      }),
      createButton("Concluir", "ghost-btn", (event) => {
        event.stopPropagation();
        project.status = "done";
        touch(project);
        saveState();
        renderMain();
      })
    );
  } else if (project.status === "paused") {
    actions.append(
      createButton("Reativar", "ghost-btn", (event) => {
        event.stopPropagation();
        project.status = "active";
        touch(project);
        saveState();
        renderMain();
      })
    );
  }
  card.append(actions);

  card.addEventListener("click", () => navigate(`/projects/${project.id}`));
  return card;
}

function createAreaCard(area) {
  const card = createElement("div", "card");
  card.append(createElement("div", "card-title", area.name));
  if (area.objective) {
    card.append(createElement("div", "card-meta", area.objective));
  }
  
  const actions = createElement("div", "card-actions");
  actions.append(
    createButton("Editar", "ghost-btn", (event) => {
      event.stopPropagation();
      openAreaEditModal(area);
    }),
    createButton("Deletar", "ghost-btn danger", (event) => {
      event.stopPropagation();
      if (confirm(`Tem certeza que deseja deletar "${area.name}"?`)) {
        deleteArea(area.id);
      }
    })
  );
  card.append(actions);
  
  card.addEventListener("click", () => navigate(`/areas/${area.id}`));
  return card;
}

function renderAreaDetail(root, areaId) {
  const area = getArea(areaId);
  if (!area) {
    root.append(createElement("div", "empty", "Area nao encontrada."));
    return;
  }

  const header = createSection("Resumo da area", "");
  const nameInput = document.createElement("input");
  nameInput.value = area.name;
  nameInput.addEventListener("input", () => {
    area.name = nameInput.value;
    touch(area);
    saveStateDebounced();
    renderSidebar();
  });
  const objectiveInput = document.createElement("textarea");
  objectiveInput.rows = 3;
  objectiveInput.value = area.objective || "";
  objectiveInput.addEventListener("input", () => {
    area.objective = objectiveInput.value;
    touch(area);
    saveStateDebounced();
  });
  
  const deleteBtn = createButton("Deletar area", "ghost-btn danger", () => {
    if (confirm(`Tem certeza que deseja deletar "${area.name}"? Isto nao deletara seus projetos e tarefas.`)) {
      deleteArea(area.id);
      navigate("/areas");
    }
  });
  
  header.body.append(
    buildField("Nome", nameInput),
    buildField("Objetivo", objectiveInput),
    deleteBtn
  );
  root.append(header.section);

  const projects = state.projects.filter((project) => project.areaId === area.id);
  const tasks = state.tasks.filter(
    (task) =>
      task.areaId === area.id && !task.projectId && !task.archived && task.status !== "done"
  );
  const notes = state.notes.filter((note) => note.areaId === area.id && !note.archived);

  const projectsSection = createSection("Projetos da area", "");
  if (!projects.length) {
    projectsSection.body.append(createElement("div", "list-meta", "Sem projetos."));
  } else {
    projects.forEach((project) => projectsSection.body.append(createProjectCard(project)));
  }
  root.append(projectsSection.section);

  const tasksSection = createSection("Tarefas sem projeto", "");
  if (!tasks.length) {
    tasksSection.body.append(createElement("div", "list-meta", "Sem tarefas."));
  } else {
    tasks.forEach((task) => tasksSection.body.append(createTaskRow(task)));
  }
  root.append(tasksSection.section);

  const notesSection = createSection("Notas da area", "");
  if (!notes.length) {
    notesSection.body.append(createElement("div", "list-meta", "Sem notas."));
  } else {
    notes.forEach((note) => notesSection.body.append(createNoteCard(note)));
  }
  root.append(notesSection.section);
}

function renderArchiveView(root) {
  const archivedTasks = state.tasks.filter((task) => task.archived);
  const archivedEvents = state.events.filter((event) => event.archived);
  const archivedNotes = state.notes.filter((note) => note.archived);

  const taskSection = createSection("Tarefas arquivadas", "");
  if (!archivedTasks.length) {
    taskSection.body.append(createElement("div", "list-meta", "Sem tarefas."));
  } else {
    archivedTasks.forEach((task) => taskSection.body.append(createTaskRow(task)));
  }
  root.append(taskSection.section);

  const eventSection = createSection("Eventos arquivados", "");
  if (!archivedEvents.length) {
    eventSection.body.append(createElement("div", "list-meta", "Sem eventos."));
  } else {
    archivedEvents.forEach((event) => eventSection.body.append(createEventRow(event)));
  }
  root.append(eventSection.section);

  const noteSection = createSection("Notas arquivadas", "");
  if (!archivedNotes.length) {
    noteSection.body.append(createElement("div", "list-meta", "Sem notas."));
  } else {
    archivedNotes.forEach((note) => noteSection.body.append(createNoteCard(note)));
  }
  root.append(noteSection.section);
}

function renderDetailsPanel() {
  const selection = getSelectedItem();
  el.detailsBody.innerHTML = "";

  if (!selection.item) {
    el.detailsTitle.textContent = "Nada selecionado";
    setDetailsOpen(false);
    const empty = createElement("div", "empty");
    empty.innerHTML = "<h3>Selecione um item</h3><p>Detalhes aparecem aqui.</p>";
    el.detailsBody.append(empty);
    appendQuickCapturePanel();
+    updateDetailsToggleButton();
    return;
  }

  setDetailsOpen(true);

  if (selection.kind === "task") {
    renderTaskDetails(selection.item);
  } else if (selection.kind === "event") {
    renderEventDetails(selection.item);
  } else if (selection.kind === "note") {
    renderNoteDetails(selection.item);
  }
  appendQuickCapturePanel();
+  updateDetailsToggleButton();
}

function setDetailsOpen(isOpen) {
  document.body.classList.toggle("details-open", isOpen);
  if (el.detailsBackdrop) {
    el.detailsBackdrop.classList.toggle("hidden", !isOpen);
    el.detailsBackdrop.setAttribute("aria-hidden", String(!isOpen));
  }
  if (el.detailsPanel) {
    el.detailsPanel.setAttribute("aria-hidden", String(!isOpen));
  }
  // if panel is being closed fully, also clear minimized visual state
  if (!isOpen) {
    document.body.classList.remove("details-minimized");
    updateDetailsToggleButton();
  }
}

// Hide details panel on mobile view when user scrolls/touch-moving to avoid it covering content
function handleMobileScroll() {
  try {
    if (window.innerWidth > 768) {
      return;
    }
    if (!document.body.classList.contains("details-open")) {
      return;
    }
    // keep selection but hide the panel so it doesn't cover 1/3 of the screen
    setDetailsOpen(false);
  } catch (e) {
    // noop
  }
}

// Toggle minimized visual state (keeps the item selected but frees space)
function toggleDetailsMinimize() {
  const isMin = document.body.classList.toggle("details-minimized");
  updateDetailsToggleButton();
  // when minimizing ensure header remains visible even if previously closed
  if (isMin && !document.body.classList.contains("details-open")) {
    document.body.classList.add("details-open");
    if (el.detailsBackdrop) { el.detailsBackdrop.classList.add("hidden"); el.detailsBackdrop.setAttribute("aria-hidden", "true"); }
    if (el.detailsPanel) { el.detailsPanel.setAttribute("aria-hidden", "false"); }
  }
}

// update button label/aria according to state
function updateDetailsToggleButton() {
  if (!el.detailsToggle) return;
  const minimized = document.body.classList.contains("details-minimized");
  el.detailsToggle.textContent = minimized ? "▴" : "—";
  el.detailsToggle.setAttribute("aria-label", minimized ? "Restaurar painel de detalhes" : "Minimizar painel de detalhes");
}

function renderTaskDetails(task) {
  el.detailsTitle.textContent = task.title || "Tarefa";

  const titleInput = document.createElement("input");
  titleInput.value = task.title;
  titleInput.addEventListener("input", () => {
    task.title = titleInput.value;
    touch(task);
    saveStateDebounced();
    renderMain();
  });

  const statusSelect = createSelect(
    STATUS_ORDER.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
    task.status
  );
  statusSelect.addEventListener("change", () => {
    task.status = statusSelect.value;
    touch(task);
    saveState();
    renderMain();
  });

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = task.dueDate || "";
  dateInput.addEventListener("change", () => {
    task.dueDate = dateInput.value;
    touch(task);
    saveState();
    renderMain();
  });

  const timeInput = document.createElement("input");
  timeInput.type = "time";
  timeInput.value = task.dueTime || "";
  timeInput.addEventListener("change", () => {
    task.dueTime = timeInput.value;
    touch(task);
    saveState();
    renderMain();
  });

  const prioritySelect = createSelect(
    [
      { value: "low", label: "Baixa" },
      { value: "med", label: "Media" },
      { value: "high", label: "Alta" }
    ],
    task.priority
  );
  prioritySelect.addEventListener("change", () => {
    task.priority = prioritySelect.value;
    touch(task);
    saveState();
  });

  const projectSelect = createProjectSelect(task.projectId);
  projectSelect.addEventListener("change", () => {
    task.projectId = projectSelect.value || null;
    touch(task);
    saveState();
    renderMain();
  });

  const areaSelect = createAreaSelect(task.areaId);
  areaSelect.addEventListener("change", () => {
    task.areaId = areaSelect.value || null;
    touch(task);
    saveState();
    renderMain();
  });

  const notesInput = document.createElement("textarea");
  notesInput.rows = 4;
  notesInput.value = task.notes || "";
  notesInput.addEventListener("input", () => {
    task.notes = notesInput.value;
    touch(task);
    saveStateDebounced();
  });

  const linksInput = document.createElement("textarea");
  linksInput.rows = 3;
  linksInput.value = (task.attachments || []).join("\n");
  linksInput.addEventListener("input", () => {
    task.attachments = linksInput.value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    touch(task);
    saveStateDebounced();
  });

  const noteSelect = createNoteSelect(task.linkedNoteId);
  noteSelect.addEventListener("change", () => {
    task.linkedNoteId = noteSelect.value || null;
    touch(task);
    saveState();
  });

  const checklist = createChecklistEditor(task);

  const actions = createElement("div", "card-actions");
  actions.append(
    createButton("Concluir", "ghost-btn", () => {
      task.status = "done";
      touch(task);
      saveState();
      renderAll();
    }),
    createButton("Definir foco", "ghost-btn", () => toggleTaskFocus(task)),
    createButton("Adiar 1 dia", "ghost-btn", () => snoozeTask(task, 1)),
    createButton("Adiar 7 dias", "ghost-btn", () => snoozeTask(task, 7)),
    createButton("Arquivar", "ghost-btn danger", () => archiveTask(task))
  );

  el.detailsBody.append(
    buildField("Titulo", titleInput),
    buildField("Status", statusSelect),
    buildField("Prazo", dateInput),
    buildField("Hora", timeInput),
    buildField("Prioridade", prioritySelect),
    buildField("Projeto", projectSelect),
    buildField("Area", areaSelect),
    buildField("Subtarefas", checklist),
    buildField("Descricao", notesInput),
    buildField("Anexos/links", linksInput),
    buildField("Vinculo com nota", noteSelect),
    buildField("Acoes chave", actions)
  );
}

function renderEventDetails(event) {
  el.detailsTitle.textContent = event.title || "Evento";

  const titleInput = document.createElement("input");
  titleInput.value = event.title;
  titleInput.addEventListener("input", () => {
    event.title = titleInput.value;
    touch(event);
    saveStateDebounced();
    renderMain();
  });

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = event.date;
  dateInput.addEventListener("change", () => {
    event.date = dateInput.value;
    touch(event);
    saveState();
    renderMain();
  });

  const timeInput = document.createElement("input");
  timeInput.type = "time";
  timeInput.value = event.start;
  timeInput.addEventListener("change", () => {
    event.start = timeInput.value;
    touch(event);
    saveState();
    renderMain();
  });

  const durationInput = document.createElement("input");
  durationInput.type = "number";
  durationInput.min = "15";
  durationInput.value = event.duration;
  durationInput.addEventListener("change", () => {
    event.duration = Math.max(15, Number(durationInput.value) || 15);
    touch(event);
    saveState();
    renderMain();
  });

  const recurrenceSelect = createSelect(
    [
      { value: "none", label: "Sem repeticao" },
      { value: "daily", label: "Diario" },
      { value: "weekly", label: "Semanal" },
      { value: "monthly", label: "Mensal" }
    ],
    event.recurrence
  );
  recurrenceSelect.addEventListener("change", () => {
    event.recurrence = recurrenceSelect.value;
    touch(event);
    saveState();
  });

  const locationInput = document.createElement("input");
  locationInput.value = event.location || "";
  locationInput.addEventListener("input", () => {
    event.location = locationInput.value;
    touch(event);
    saveStateDebounced();
  });

  const notesInput = document.createElement("textarea");
  notesInput.rows = 4;
  notesInput.value = event.notes || "";
  notesInput.addEventListener("input", () => {
    event.notes = notesInput.value;
    touch(event);
    saveStateDebounced();
  });

  const projectSelect = createProjectSelect(event.projectId);
  projectSelect.addEventListener("change", () => {
    event.projectId = projectSelect.value || null;
    touch(event);
    saveState();
  });

  const areaSelect = createAreaSelect(event.areaId);
  areaSelect.addEventListener("change", () => {
    event.areaId = areaSelect.value || null;
    touch(event);
    saveState();
  });

  const actions = createElement("div", "card-actions");
  actions.append(
    createButton("Arquivar", "ghost-btn danger", () => archiveEvent(event))
  );

  el.detailsBody.append(
    buildField("Titulo", titleInput),
    buildField("Data", dateInput),
    buildField("Hora", timeInput),
    buildField("Duracao (min)", durationInput),
    buildField("Repeticao", recurrenceSelect),
    buildField("Local", locationInput),
    buildField("Projeto", projectSelect),
    buildField("Area", areaSelect),
    buildField("Notas", notesInput),
    buildField("Acoes chave", actions)
  );
}

function renderNoteDetails(note) {
  el.detailsTitle.textContent = note.title || "Nota";

  const areaSelect
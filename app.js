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
    updateDetailsToggleButton();
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
  updateDetailsToggleButton();
}

// Remover chamadas duplicadas em renderDetailsPanel
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
    updateDetailsToggleButton();
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
  updateDetailsToggleButton();
}

// Completar a lógica de handleMobileScroll
function handleMobileScroll() {
  try {
    if (window.innerWidth > 768) return; // Ignorar em telas grandes
    if (!document.body.classList.contains("details-open")) return;
    setDetailsOpen(false); // Fechar o painel de detalhes
  } catch (e) {
    console.error("Erro ao lidar com o scroll móvel:", e);
  }
}

// update button label/aria according to state
function updateDetailsToggleButton() {
  if (!el.detailsToggle) return;
  const minimized = document.body.classList.contains("details-minimized");
  el.detailsToggle.textContent = minimized ? "▴" : "—";
  el.detailsToggle.setAttribute(
    "aria-label",
    minimized ? "Restaurar painel de detalhes" : "Minimizar painel de detalhes"
  );
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

function createNoteCard(note) {
  const card = createElement("div", "card");
  card.append(createElement("div", "card-title", note.title));
  if (note.blocks.length) {
    const preview = note.blocks[0];
    card.append(createElement("div", "card-meta", getBlockText(preview).slice(0, 80)));
  }
  card.addEventListener("click", () => navigate(`/notes/${note.id}`));
  return card;
}

function createNoteSelect(currentId) {
  const select = createSelect(
    [{ value: "", label: "Nenhuma nota" }].concat(
      state.notes.filter((n) => !n.archived).map((n) => ({ value: n.id, label: n.title }))
    ),
    currentId || ""
  );
  return select;
}

function createProjectSelect(currentId) {
  const select = createSelect(
    [{ value: "", label: "Sem projeto" }].concat(
      state.projects.map((p) => ({ value: p.id, label: p.name }))
    ),
    currentId || ""
  );
  return select;
}

function createAreaSelect(currentId) {
  const select = createSelect(
    [{ value: "", label: "Sem area" }].concat(
      state.areas.map((a) => ({ value: a.id, label: a.name }))
    ),
    currentId || ""
  );
  return select;
}

function createChecklistEditor(task) {
  const wrapper = createElement("div", "card");
  if (!Array.isArray(task.checklist)) {
    task.checklist = [];
  }
  task.checklist.forEach((item, index) => {
    const row = createElement("div", "card-actions");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.checked = item.done || false;
    input.addEventListener("change", () => {
      item.done = input.checked;
      touch(task);
      saveStateDebounced();
    });
    const label = document.createElement("input");
    label.value = item.text || "";
    label.addEventListener("input", () => {
      item.text = label.value;
      touch(task);
      saveStateDebounced();
    });
    const removeBtn = createButton("Remover", "ghost-btn", () => {
      task.checklist.splice(index, 1);
      touch(task);
      saveState();
      renderAll();
    });
    row.append(input, label, removeBtn);
    wrapper.append(row);
  });
  const addBtn = createButton("Adicionar item", "ghost-btn", () => {
    task.checklist.push({ text: "", done: false });
    touch(task);
    saveState();
    renderAll();
  });
  wrapper.append(addBtn);
  return wrapper;
}

function createBlockEditor(note, block, index) {
  const wrapper = createElement("div", "block");
  const toolbar = createElement("div", "block-toolbar");
  const typeSelect = createSelect(BLOCK_TYPES, block.type);
  typeSelect.addEventListener("change", () => {
    block.type = typeSelect.value;
    touch(note);
    saveState();
    renderMain();
  });
  const removeBtn = createButton("Remover", "ghost-btn danger", () => {
    note.blocks.splice(index, 1);
    touch(note);
    saveState();
    renderMain();
  });
  toolbar.append(typeSelect, removeBtn);
  wrapper.append(toolbar);

  if (["text", "heading", "title", "quote"].includes(block.type)) {
    const input = document.createElement("textarea");
    input.rows = 3;
    input.value = block.text || "";
    input.addEventListener("input", () => {
      block.text = input.value;
      touch(note);
      saveStateDebounced();
    });
    wrapper.append(input);
  }
  if (["list", "checklist"].includes(block.type)) {
    const itemsArea = document.createElement("textarea");
    itemsArea.rows = 3;
    itemsArea.placeholder = "Uma linha por item";
    itemsArea.value = (block.items || []).join("\n");
    itemsArea.addEventListener("input", () => {
      block.items = itemsArea.value.split("\n").filter(Boolean);
      touch(note);
      saveStateDebounced();
    });
    wrapper.append(itemsArea);
  }
  return wrapper;
}

function createMilestoneRow(project, milestone) {
  const row = createElement("div", "card");
  const titleInput = document.createElement("input");
  titleInput.value = milestone.title || "";
  titleInput.addEventListener("input", () => {
    milestone.title = titleInput.value;
    touch(project);
    saveStateDebounced();
  });
  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = milestone.dueDate || "";
  dateInput.addEventListener("change", () => {
    milestone.dueDate = dateInput.value;
    touch(project);
    saveState();
  });
  const doneCheckbox = document.createElement("input");
  doneCheckbox.type = "checkbox";
  doneCheckbox.checked = milestone.done || false;
  doneCheckbox.addEventListener("change", () => {
    milestone.done = doneCheckbox.checked;
    touch(project);
    saveState();
  });
  const removeBtn = createButton("Remover", "ghost-btn danger", () => {
    const idx = project.milestones.findIndex((m) => m.id === milestone.id);
    if (idx > -1) {
      project.milestones.splice(idx, 1);
      touch(project);
      saveState();
      renderMain();
    }
  });
  row.append(
    buildField("Marco", titleInput),
    buildField("Data", dateInput),
    doneCheckbox,
    removeBtn
  );
  return row;
}

function groupNotesByArea() {
  const grouped = {};
  state.notes.forEach((note) => {
    if (note.archived) return;
    const key = note.areaId || "";
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(note);
  });
  return grouped;
}

function getScheduledItems(date, time) {
  const items = [];
  state.events.forEach((event) => {
    if (!event.archived && event.date === date && event.start === time) {
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
    if (task.timeBlock.date === date && task.timeBlock.start === time) {
      items.push({
        kind: "task",
        id: task.id,
        title: task.title,
        start: task.timeBlock.start,
        duration: task.timeBlock.duration
      });
    }
  });
  return items;
}

function createCalendarChip(item) {
  const chip = createElement("div", "pill accent", item.title);
  chip.addEventListener("click", (event) => {
    event.stopPropagation();
    selectItem(item.kind, item.id);
  });
  return chip;
}

function renderCalendarWeek() {
  const days = getWeekDays(state.ui.calendarWeekOffset);
  const grid = createElement("div", "calendar-week");
  const query = (state.ui.search || "").trim().toLowerCase();
  days.forEach((day) => {
    const column = createElement("div", "calendar-day");
    const header = createElement("div", "week-header", day.label);
    if (day.isToday) {
      header.classList.add("pill");
    }
    column.append(header);
    const items = getAgendaItems(day.date).filter((item) => matchesQuery(item.title, query));
    items.forEach((item) => {
      const calendarItem = createElement("div", "calendar-item");
      calendarItem.append(createElement("div", "card-title", item.title));
      calendarItem.append(
        createElement("div", "list-meta", `${formatTimeLabel(item.start)}`)
      );
      calendarItem.addEventListener("click", () => selectItem(item.kind, item.id));
      column.append(calendarItem);
    });
    grid.append(column);
  });
  return grid;
}

function renderCalendarMonth() {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() + state.ui.calendarMonthOffset, 1);
  const endDate = new Date(now.getFullYear(), now.getMonth() + state.ui.calendarMonthOffset + 1, 0);
  const monthGrid = createElement("div", "calendar-month");
  const dayLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];
  dayLabels.forEach((label) => {
    const cell = createElement("div", "month-cell");
    cell.append(createElement("div", "section-title", label));
    monthGrid.append(cell);
  });
  const firstDay = startDate.getDay();
  for (let i = 0; i < firstDay; i += 1) {
    monthGrid.append(createElement("div", "month-cell"));
  }
  const daysInMonth = endDate.getDate();
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(startDate.getFullYear(), startDate.getMonth(), day);
    const dateKey = formatDate(date);
    const cell = createElement("div", "month-cell");
    const dayLabel = createElement("div", "section-title", String(day));
    cell.append(dayLabel);
    const items = getAgendaItems(dateKey);
    items.slice(0, 2).forEach((item) => {
      const chip = createElement("div", "pill", item.title);
      chip.style.fontSize = "11px";
      cell.append(chip);
    });
    if (items.length > 2) {
      cell.append(createElement("div", "list-meta", `+${items.length - 2} mais`));
    }
    monthGrid.append(cell);
  }
  return monthGrid;
}

function renderProjectKanban(project) {
  const grid = createElement("div", "kanban-grid");
  STATUS_ORDER.forEach((status) => {
    const column = createElement("div", "kanban-column");
    const title = createElement("div", "section-title", STATUS_LABELS[status]);
    column.append(title);
    const tasks = state.tasks.filter(
      (task) => task.projectId === project.id && task.status === status && !task.archived
    );
    tasks.forEach((task) => {
      const card = createElement("div", "kanban-card");
      card.draggable = true;
      card.append(createElement("div", "card-title", task.title));
      card.addEventListener("dragstart", (event) => {
        setDragData(event, "task", task.id);
      });
      card.addEventListener("click", () => selectItem("task", task.id));
      column.append(card);
    });
    attachDropHandlers(column, { status });
    grid.append(column);
  });
  return grid;
}

function createNotesSidePanel(note) {
  const panel = createElement("div", "notes-panel");
  if (!note) {
    return panel;
  }
  const section = createSection("Propriedades", "");
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
  section.body.append(buildField("Area", areaSelect), buildField("Projeto", projectSelect));
  panel.append(section.section);
  return panel;
}

function selectItem(kind, id) {
  state.ui.selected = { kind, id };
  saveState({ render: false });
  renderDetailsPanel();
}

function clearSelection() {
  state.ui.selected = { kind: null, id: null };
  saveState({ render: false });
  renderDetailsPanel();
}

function openAreaModal() {
  openModal(
    "Nova area",
    "Area",
    {
      name: "",
      objective: ""
    },
    (formData) => {
      const area = createArea(formData);
      state.areas.push(area);
      saveState();
      renderAll();
      navigate("/areas");
    }
  );
}

function openAreaEditModal(area) {
  openModal(
    "Editar area",
    "Area",
    { name: area.name, objective: area.objective },
    (formData) => {
      area.name = formData.name || "Area";
      area.objective = formData.objective || "";
      touch(area);
      saveState();
      renderAll();
    },
    () => deleteArea(area.id)
  );
}

function deleteArea(areaId) {
  state.areas = state.areas.filter((a) => a.id !== areaId);
  state.projects.forEach((p) => {
    if (p.areaId === areaId) {
      p.areaId = null;
    }
  });
  state.tasks.forEach((t) => {
    if (t.areaId === areaId) {
      t.areaId = null;
    }
  });
  state.notes.forEach((n) => {
    if (n.areaId === areaId) {
      n.areaId = null;
    }
  });
  saveState();
  renderAll();
}

function openTaskModal(data = {}) {
  openModal(
    data.id ? "Editar tarefa" : "Nova tarefa",
    "Tarefa",
    {
      title: data.title || "",
      status: data.status || "todo",
      priority: data.priority || "med",
      dueDate: data.dueDate || "",
      dueTime: data.dueTime || "",
      projectId: data.projectId || "",
      areaId: data.areaId || "",
      notes: data.notes || ""
    },
    (formData) => {
      if (data.id) {
        const task = getTask(data.id);
        if (task) {
          task.title = formData.title || "Tarefa";
          task.status = formData.status || "todo";
          task.priority = formData.priority || "med";
          task.dueDate = formData.dueDate || "";
          task.dueTime = formData.dueTime || "";
          task.projectId = formData.projectId || null;
          task.areaId = formData.areaId || null;
          task.notes = formData.notes || "";
          touch(task);
        }
      } else {
        const task = createTask(formData);
        state.tasks.unshift(task);
      }
      saveState();
      renderAll();
    },
    data.id ? () => archiveTask(getTask(data.id)) : null
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
      if (data.id) {
        const event = getEvent(data.id);
        if (event) {
          event.title = formData.title || "Evento";
          event.date = formData.date || formatDate(new Date());
          event.start = formData.start || "09:00";
          event.duration = Math.max(15, Number(formData.duration) || 60);
          event.location = formData.location || "";
          event.notes = formData.notes || "";
          touch(event);
        }
      } else {
        const event = createEvent(formData);
        state.events.push(event);
      }
      saveState();
      renderAll();
    },
    data.id ? () => archiveEvent(getEvent(data.id)) : null
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
    { name: "", objective: "", areaId: "" },
    (formData) => {
      const project = createProject(formData);
      state.projects.push(project);
      saveState();
      renderAll();
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
  const allCommands = [
    { label: "Nova tarefa", action: () => openTaskModal({}) },
    { label: "Novo evento", action: () => openEventModal({}) },
    { label: "Nova nota", action: () => openNoteModal({}) },
    { label: "Novo projeto", action: () => openProjectModal() },
    { label: "Nova area", action: () => openAreaModal() },
    { label: "Ir para hoje", action: () => navigate("/today") },
    { label: "Ir para inbox", action: () => navigate("/inbox") },
    { label: "Ir para semana", action: () => navigate("/week") },
    { label: "Ir para projetos", action: () => navigate("/projects") },
    { label: "Ir para notas", action: () => navigate("/notes") },
    { label: "Ir para calendario", action: () => navigate("/calendar") },
    { label: "Ir para areas", action: () => navigate("/areas") },
    { label: "Sincronizar", action: () => pushState({ silent: false }) }
  ];

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

  const formData = { ...data };
  const fields = Object.keys(data);

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
          { value: "med", label: "Media" },
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
    } else if (key === "start" || key === "dueTime") {
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

  modalState.onSave = () => onSave(formData);
  modalState.onDelete = onDelete;
  modalState.previousFocus = document.activeElement;

  el.modalBackdrop.classList.remove("hidden");
  el.modalSave.focus();
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

function openSettingsModal() {
  el.modalEyebrow.textContent = "Configuracoes";
  el.modalTitle.textContent = "Preferencias";
  el.modalBody.innerHTML = "";
  el.modalDelete.classList.add("hidden");

  const weekStartsMonday = document.createElement("input");
  weekStartsMonday.type = "checkbox";
  weekStartsMonday.checked = state.settings.weekStartsMonday;

  const timeFormat = createSelect(
    [
      { value: "24h", label: "24h" },
      { value: "12h", label: "12h" }
    ],
    state.settings.timeFormat
  );

  const apiUrl = document.createElement("input");
  apiUrl.value = remote.url || "";

  const apiKey = document.createElement("input");
  apiKey.type = "password";
  apiKey.value = remote.apiKey || "";

  const autoSync = document.createElement("input");
  autoSync.type = "checkbox";
  autoSync.checked = remote.autoSync;

  el.modalBody.append(
    buildField("Semana comeca segunda", weekStartsMonday),
    buildField("Formato de hora", timeFormat),
    buildField("URL da API", apiUrl),
    buildField("Chave da API", apiKey),
    buildField("Sincronizacao automatica", autoSync)
  );

  modalState.onSave = () => {
    state.settings.weekStartsMonday = weekStartsMonday.checked;
    state.settings.timeFormat = timeFormat.value;
    remote.url = apiUrl.value;
    remote.apiKey = apiKey.value;
    remote.autoSync = autoSync.checked;
    saveState();
    saveRemoteConfig();
    renderAll();
  };

  el.modalBackdrop.classList.remove("hidden");
}

function openExportModal() {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `meu-node-export-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Dados exportados com sucesso!");
}

function openImportModal() {
  el.modalEyebrow.textContent = "Importar";
  el.modalTitle.textContent = "Importar dados";
  el.modalBody.innerHTML = "";
  el.modalDelete.classList.add("hidden");

  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";

  const info = createElement("div", "empty", "Selecione um arquivo JSON exportado anteriormente.");

  el.modalBody.append(info, input);

  input.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        state = normalizeState(imported);
        saveState();
        closeModal();
        renderAll();
        showToast("Dados importados com sucesso!");
      } catch (error) {
        showToast("Erro ao importar arquivo!");
      }
    };
    reader.readAsText(file);
  });

  modalState.onSave = null;
  el.modalBackdrop.classList.remove("hidden");
}

function openProcessModal(item) {
  const fields = { title: item.title, kind: item.kind };
  openModal(
    "Processar item",
    "Inbox",
    fields,
    (formData) => {
      deleteInboxItem(item.id);
      const kind = formData.kind || "task";
      if (kind === "task") {
        state.tasks.unshift(createTask({ title: formData.title }));
      } else if (kind === "event") {
        state.events.push(createEvent({ title: formData.title }));
      } else if (kind === "note") {
        const note = createNote({ title: formData.title });
        state.notes.push(note);
      }
      saveState();
      renderAll();
      showToast("Item processado!");
    }
  );
}

function openBulkProcessModal(ids) {
  el.modalEyebrow.textContent = "Processar em lote";
  el.modalTitle.textContent = `${ids.length} itens selecionados`;
  el.modalBody.innerHTML = "";
  el.modalDelete.classList.add("hidden");

  const typeSelect = createSelect(
    [
      { value: "task", label: "Converter para tarefas" },
      { value: "event", label: "Converter para eventos" },
      { value: "note", label: "Converter para notas" }
    ],
    "task"
  );

  el.modalBody.append(buildField("Tipo", typeSelect));

  modalState.onSave = () => {
    const kind = typeSelect.value;
    ids.forEach((id) => {
      const item = state.inbox.find((i) => i.id === id);
      if (!item) return;
      if (kind === "task") {
        state.tasks.unshift(createTask({ title: item.title }));
      } else if (kind === "event") {
        state.events.push(createEvent({ title: item.title }));
      } else if (kind === "note") {
        state.notes.push(createNote({ title: item.title }));
      }
    });
    bulkDeleteInbox(ids);
    closeModal();
    showToast("Itens processados!");
  };

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

function setProjectViewMode(mode) {
  state.ui.projectViewMode = mode;
  saveState();
  renderMain();
}

function setCalendarView(view) {
  state.ui.calendarView = view;
  saveState();
  renderMain();
}

function shiftCalendarWeek(offset) {
  state.ui.calendarWeekOffset += offset;
  saveState();
  renderMain();
}

function shiftCalendarMonth(offset) {
  state.ui.calendarMonthOffset += offset;
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

function archiveTask(task) {
  task.archived = true;
  touch(task);
  saveState();
  renderAll();
  showToast("Tarefa arquivada");
}

function archiveEvent(event) {
  event.archived = true;
  touch(event);
  saveState();
  renderAll();
  showToast("Evento arquivado");
}

function archiveNote(note) {
  note.archived = true;
  touch(note);
  saveState();
  clearSelection();
  renderAll();
  showToast("Nota arquivada");
}

function archiveInboxItem(id) {
  state.inbox = state.inbox.filter((item) => item.id !== id);
  saveState();
  renderMain();
  showToast("Item arquivado");
}

function deleteInboxItem(id) {
  state.inbox = state.inbox.filter((item) => item.id !== id);
  saveState();
  renderMain();
}

function bulkArchiveInbox(ids) {
  state.inbox = state.inbox.filter((item) => !ids.includes(item.id));
  state.ui.inboxSelection = [];
  saveState();
  renderMain();
}

function bulkDeleteInbox(ids) {
  state.inbox = state.inbox.filter((item) => !ids.includes(item.id));
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

function handleInboxShortcuts(event) {
  // Implement shortcut handling if needed
}

function matchesTaskSearch(task, query) {
  if (!query) return true;
  return (
    matchesQuery(task.title, query) ||
    matchesQuery(task.notes, query) ||
    (task.projectId && matchesQuery(getProject(task.projectId)?.name, query))
  );
}

function showToast(message) {
  const toast = createElement("div", "toast", message);
  el.toastContainer.append(toast);
  setTimeout(() => {
    toast.remove();
  }, 3000);
}
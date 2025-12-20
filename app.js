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
  syncStatus: document.getElementById("syncStatus"),
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
  header.body.append(buildField("Nome", nameInput), buildField("Objetivo", objectiveInput));
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

// Toggle minimized visual state (keeps the item selected but frees space)
function toggleDetailsMinimize() {
  const isMin = document.body.classList.toggle("details-minimized");
  updateDetailsToggleButton();
  // when minimizing we ensure details panel is visible state-wise
  // but if it was fully closed, open it to show the minimized header
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

// ensure UI reflects minimized state when rendering details
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

function selectItem(kind, id) {
  state.ui.selected = { kind, id };
  saveState();
  renderMain();
  renderDetailsPanel();
}

function clearSelection() {
  state.ui.selected = { kind: null, id: null };
  saveState();
  renderMain();
  renderDetailsPanel();
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
        createButton(task.focus ? "Remover foco" : "Foco", "ghost-btn", (event) => {
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
  card.addEventListener("click", () => navigate(`/areas/${area.id}`));
  return card;
}

function createNoteCard(note) {
  const card = createElement("div", "card");
  card.append(createElement("div", "card-title", note.title));
  const area = note.areaId ? getArea(note.areaId) : null;
  if (area) {
    card.append(createElement("div", "card-meta", area.name));
  }
  if (note.archived) {
    const actions = createElement("div", "card-actions");
    actions.append(
      createButton("Restaurar", "ghost-btn", (event) => {
        event.stopPropagation();
        note.archived = false;
        touch(note);
        saveState();
        renderAll();
      })
    );
    card.append(actions);
  }
  card.addEventListener("click", () => navigate(`/notes/${note.id}`));
  return card;
}

function createChecklistEditor(task) {
  const wrapper = createElement("div");
  const list = createElement("div");
  task.checklist.forEach((item) => {
    const row = createElement("div", "task-row");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(item.done);
    checkbox.addEventListener("change", () => {
      item.done = checkbox.checked;
      touch(task);
      saveState();
    });
    const input = document.createElement("input");
    input.value = item.text || "";
    input.addEventListener("input", () => {
      item.text = input.value;
      touch(task);
      saveStateDebounced();
    });
    row.append(checkbox, input);
    list.append(row);
  });
  const add = createButton("+", "ghost-btn", () => {
    task.checklist.push({ id: uid("sub"), text: "", done: false });
    touch(task);
    saveState();
    renderDetailsPanel();
  });
  wrapper.append(list, add);
  return wrapper;
}

function createBlockEditor(note, block, index) {
  const wrap = createElement("div", "block");
  const toolbar = createElement("div", "block-toolbar");

  const typeSelect = createSelect(BLOCK_TYPES, block.type);
  typeSelect.addEventListener("change", () => {
    block.type = typeSelect.value;
    resetBlockForType(block);
    touch(note);
    saveState();
    renderMain();
  });

  const moveUp = createButton("Cima", "ghost-btn", () => moveBlock(note, index, -1));
  const moveDown = createButton("Baixo", "ghost-btn", () => moveBlock(note, index, 1));
  const toTask = createButton("Converter em tarefa", "ghost-btn", () =>
    convertBlockToTask(note, block)
  );
  const remove = createButton("Excluir", "ghost-btn danger", () => {
    note.blocks.splice(index, 1);
    touch(note);
    saveState();
    renderMain();
  });

  toolbar.append(typeSelect, moveUp, moveDown, toTask, remove);
  wrap.append(toolbar);

  const content = createBlockContent(note, block);
  wrap.append(content);
  return wrap;
}

function createBlockContent(note, block) {
  const container = createElement("div");
  if (["title", "heading"].includes(block.type)) {
    const input = document.createElement("input");
    input.value = block.text || "";
    input.addEventListener("input", () => {
      block.text = input.value;
      touch(note);
      saveStateDebounced();
    });
    container.append(input);
  } else if (["text", "quote"].includes(block.type)) {
    const input = document.createElement("textarea");
    input.rows = 3;
    input.value = block.text || "";
    input.addEventListener("input", () => {
      block.text = input.value;
      touch(note);
      saveStateDebounced();
    });
    container.append(input);
  } else if (block.type === "list") {
    const input = document.createElement("textarea");
    input.rows = 3;
    input.value = (block.items || []).join("\n");
    input.addEventListener("input", () => {
      block.items = input.value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      touch(note);
      saveStateDebounced();
    });
    container.append(input);
  } else if (block.type === "checklist") {
    const list = createElement("div");
    (block.items || []).forEach((item) => {
      const row = createElement("div", "task-row");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = Boolean(item.done);
      checkbox.addEventListener("change", () => {
        item.done = checkbox.checked;
        touch(note);
        saveStateDebounced();
      });
      const input = document.createElement("input");
      input.value = item.text || "";
      input.addEventListener("input", () => {
        item.text = input.value;
        touch(note);
        saveStateDebounced();
      });
      row.append(checkbox, input);
      list.append(row);
    });
    const add = createButton("Adicionar item", "ghost-btn", () => {
      block.items = block.items || [];
      block.items.push({ id: uid("check"), text: "", done: false });
      touch(note);
      saveState();
      renderMain();
    });
    container.append(list, add);
  } else if (block.type === "table") {
    const input = document.createElement("textarea");
    input.rows = 4;
    input.value = (block.rows || []).map((row) => row.join(" | ")).join("\n");
    input.addEventListener("input", () => {
      block.rows = input.value
        .split("\n")
        .map((line) => line.split("|").map((cell) => cell.trim()))
        .filter((row) => row.length && row[0]);
      touch(note);
      saveStateDebounced();
    });
    container.append(input);
  } else if (block.type === "divider") {
    container.append(document.createElement("hr"));
  } else if (block.type === "embed") {
    const input = document.createElement("input");
    input.placeholder = "https://...";
    input.value = block.url || "";
    input.addEventListener("input", () => {
      block.url = input.value;
      touch(note);
      saveStateDebounced();
    });
    container.append(input);
  }
  return container;
}

function createMilestoneRow(project, milestone) {
  const row = createElement("div", "task-row");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = Boolean(milestone.done);
  checkbox.addEventListener("change", () => {
    milestone.done = checkbox.checked;
    touch(project);
    saveState();
  });
  const input = document.createElement("input");
  input.value = milestone.title || "";
  input.addEventListener("input", () => {
    milestone.title = input.value;
    touch(project);
    saveStateDebounced();
  });
  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = milestone.dueDate || "";
  dateInput.addEventListener("change", () => {
    milestone.dueDate = dateInput.value;
    touch(project);
    saveStateDebounced();
  });
  row.append(checkbox, input, dateInput);
  return row;
}

function createCalendarChip(item) {
  const chip = createElement("div", "calendar-item");
  const title = createElement("div", "", item.title);
  const meta = createElement(
    "div",
    "list-meta",
    `${formatTimeLabel(item.start)} / ${item.duration || 60}m`
  );
  const handle = createElement("div", "resize-handle", "||");
  chip.append(title, meta, handle);
  chip.draggable = true;
  chip.addEventListener("dragstart", (event) => setDragData(event, item.kind, item.id));
  chip.addEventListener("click", () => selectItem(item.kind, item.id));
  handle.draggable = true;
  handle.addEventListener("dragstart", (event) => {
    event.stopPropagation();
    setDragData(event, item.kind, item.id, "resize", item.start || "");
  });
  return chip;
}

function resetBlockForType(block) {
  block.text = "";
  block.items = [];
  block.rows = [];
  block.url = "";
  if (block.type === "checklist") {
    block.items = [];
  }
  if (block.type === "list") {
    block.items = [];
  }
  if (block.type === "table") {
    block.rows = [];
  }
  if (block.type === "embed") {
    block.url = "";
  }
}

function moveBlock(note, index, direction) {
  const target = index + direction;
  if (target < 0 || target >= note.blocks.length) {
    return;
  }
  const [block] = note.blocks.splice(index, 1);
  note.blocks.splice(target, 0, block);
  touch(note);
  saveState();
  renderMain();
}

function convertBlockToTask(note, block) {
  const text = getBlockText(block);
  if (!text) {
    showToast("Bloco vazio.");
    return;
  }
  const task = createTask({
    title: text,
    sourceNoteId: note.id,
    linkedNoteId: note.id
  });
  state.tasks.unshift(task);
  saveState();
  showToast("Tarefa criada a partir da nota.");
  renderMain();
}

function toggleInboxSelection(id) {
  const selection = new Set(state.ui.inboxSelection);
  if (selection.has(id)) {
    selection.delete(id);
  } else {
    selection.add(id);
  }
  state.ui.inboxSelection = Array.from(selection);
  saveState();
  renderMain();
}

function bulkArchiveInbox(ids) {
  ids.forEach((id) => archiveInboxItem(id));
  state.ui.inboxSelection = [];
  saveState();
  renderMain();
}

function bulkDeleteInbox(ids) {
  ids.forEach((id) => deleteInboxItem(id));
  state.ui.inboxSelection = [];
  saveState();
  renderMain();
}

function archiveInboxItem(id) {
  state.inbox = state.inbox.filter((item) => item.id !== id);
  showToast("Item arquivado.");
  saveState();
  renderMain();
}

function deleteInboxItem(id) {
  state.inbox = state.inbox.filter((item) => item.id !== id);
  showToast("Item removido.");
  saveState();
  renderMain();
}

function handleInboxShortcuts(event) {
  const route = parseRoute(state.ui.route);
  if (!route || route.name !== "inbox") {
    return;
  }
  if (["input", "textarea", "select"].includes(document.activeElement?.tagName?.toLowerCase())) {
    return;
  }
  const key = event.key.toLowerCase();
  if (!["t", "n", "e"].includes(key)) {
    return;
  }
  event.preventDefault();
  const kind = key === "t" ? "task" : key === "n" ? "note" : "event";
  if (state.ui.inboxSelection.length) {
    openBulkProcessModal(state.ui.inboxSelection, { kind });
    return;
  }
  const activeId = state.ui.inboxActiveId || (state.inbox[0] ? state.inbox[0].id : null);
  if (!activeId) {
    return;
  }
  const item = state.inbox.find((entry) => entry.id === activeId);
  if (item) {
    openProcessModal(item, { kind });
  }
}

function toggleTaskFocus(task) {
  if (!task.focus && countFocusTasks() >= 3) {
    showToast("Limite de 3 focos.");
    return;
  }
  task.focus = !task.focus;
  touch(task);
  saveState();
  renderMain();
}

function snoozeTask(task, days) {
  const base = task.dueDate ? parseDate(task.dueDate) : dateOnly(new Date());
  const next = addDays(base || new Date(), days);
  task.dueDate = formatDate(next);
  task.dueTime = "";
  task.timeBlock = null;
  touch(task);
  saveState();
  renderMain();
}

function archiveTask(task) {
  task.archived = true;
  touch(task);
  saveState();
  clearSelection();
  renderMain();
}

function archiveEvent(event) {
  event.archived = true;
  touch(event);
  saveState();
  clearSelection();
  renderMain();
}

function archiveNote(note) {
  note.archived = true;
  touch(note);
  saveState();
  clearSelection();
  renderMain();
}

function matchesTaskSearch(task, query) {
  if (!query) {
    return true;
  }
  const project = task.projectId ? getProject(task.projectId) : null;
  const area = task.areaId ? getArea(task.areaId) : null;
  const haystack = [
    task.title,
    task.notes,
    project ? project.name : "",
    area ? area.name : ""
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function matchesEventSearch(event, query) {
  if (!query) {
    return true;
  }
  const project = event.projectId ? getProject(event.projectId) : null;
  const area = event.areaId ? getArea(event.areaId) : null;
  const haystack = [
    event.title,
    event.notes,
    event.location,
    project ? project.name : "",
    area ? area.name : ""
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function matchesNoteSearch(note, query) {
  if (!query) {
    return true;
  }
  const blockText = (note.blocks || []).map((block) => getBlockText(block)).join(" ");
  const haystack = [note.title, blockText].join(" ").toLowerCase();
  return haystack.includes(query);
}

function setDragData(event, kind, id, mode = "move", startTime = "") {
  if (event.dataTransfer) {
    const payload = `${mode}|${kind}|${id}|${startTime || ""}`;
    event.dataTransfer.setData("text/plain", payload);
    event.dataTransfer.effectAllowed = "move";
  }
}

function parseDragData(event) {
  if (!event.dataTransfer) {
    return null;
  }
  const raw = event.dataTransfer.getData("text/plain");
  if (!raw) {
    return null;
  }
  if (raw.includes("|")) {
    const [mode, kind, id, start] = raw.split("|");
    if (!mode || !kind || !id) {
      return null;
    }
    return { mode, kind, id, start: start || "" };
  }
  if (raw.includes(":")) {
    const [kind, id] = raw.split(":");
    if (!kind || !id) {
      return null;
    }
    return { mode: "move", kind, id, start: "" };
  }
  return null;
}

function attachDropHandlers(node, { date, time }) {
  let dragDepth = 0;
  node.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "move";
    }
  });
  node.addEventListener("dragenter", () => {
    dragDepth += 1;
    node.classList.add("dropping");
  });
  node.addEventListener("dragleave", () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      node.classList.remove("dropping");
    }
  });
  node.addEventListener("drop", (event) => {
    event.preventDefault();
    dragDepth = 0;
    node.classList.remove("dropping");
    const data = parseDragData(event);
    if (!data) {
      return;
    }
    if (data.mode === "resize") {
      if (time) {
        resizeSchedule(data.kind, data.id, data.start, time);
      }
      return;
    }
    if (data.kind === "task") {
      const task = getTask(data.id);
      if (!task) {
        return;
      }
      scheduleTask(task, date, time);
    }
    if (data.kind === "event") {
      const eventItem = getEvent(data.id);
      if (!eventItem) {
        return;
      }
      scheduleEvent(eventItem, date, time);
    }
  });
}

function scheduleTask(task, date, time) {
  task.dueDate = date || task.dueDate;
  if (time) {
    task.timeBlock = {
      date,
      start: time,
      duration: task.timeBlock ? task.timeBlock.duration : 60
    };
  } else {
    task.timeBlock = null;
  }
  touch(task);
  saveState();
  renderAll();
}

function scheduleEvent(eventItem, date, time) {
  if (date) {
    eventItem.date = date;
  }
  if (time) {
    eventItem.start = time;
  }
  touch(eventItem);
  saveState();
  renderAll();
}

function getScheduledItems(date, time) {
  const items = [];
  state.events.forEach((eventItem) => {
    if (!eventItem.archived && eventItem.date === date && eventItem.start === time) {
      items.push({
        kind: "event",
        id: eventItem.id,
        title: eventItem.title,
        start: eventItem.start,
        duration: eventItem.duration
      });
    }
  });
  state.tasks.forEach((task) => {
    if (
      !task.archived &&
      task.status !== "done" &&
      task.timeBlock &&
      task.timeBlock.date === date &&
      task.timeBlock.start === time
    ) {
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

function resizeSchedule(kind, id, startTime, dropTime) {
  const step = Math.max(15, Number(state.settings.timeStepMinutes) || 30);
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(dropTime);
  const raw = endMinutes - startMinutes;
  const clamped = Math.max(step, raw);
  const duration = Math.ceil(clamped / step) * step;
  if (duration <= 0) {
    return;
  }
  if (kind === "event") {
    const eventItem = getEvent(id);
    if (!eventItem) {
      return;
    }
    eventItem.duration = duration;
    touch(eventItem);
  }
  if (kind === "task") {
    const task = getTask(id);
    if (!task || !task.timeBlock) {
      return;
    }
    task.timeBlock.duration = duration;
    touch(task);
  }
  saveState();
  renderAll();
}

function groupNotesByArea() {
  const grouped = {};
  state.notes
    .filter((note) => !note.archived && matchesNoteSearch(note, state.ui.search))
    .forEach((note) => {
      const key = note.areaId || "";
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(note);
    });
  return grouped;
}

function setWeekTab(tab) {
  state.ui.weekTab = tab;
  saveState();
  renderMain();
}

function shiftWeek(delta) {
  state.ui.weekOffset += delta;
  saveState();
  renderMain();
}

function setProjectFilter(filter) {
  state.ui.projectFilter = filter;
  saveState();
  renderMain();
}

function setCalendarView(view) {
  state.ui.calendarView = view;
  saveState();
  renderMain();
}

function setProjectViewMode(mode) {
  state.ui.projectViewMode = mode;
  saveState();
  renderMain();
}

function shiftCalendarWeek(delta) {
  state.ui.calendarWeekOffset += delta;
  saveState();
  renderMain();
}

function shiftCalendarMonth(delta) {
  state.ui.calendarMonthOffset += delta;
  saveState();
  renderMain();
}

function renderCalendarWeek() {
  const wrapper = createElement("div", "calendar-week");
  const days = getWeekDays(state.ui.calendarWeekOffset);
  const query = (state.ui.search || "").trim().toLowerCase();
  days.forEach((day) => {
    const column = createElement("div", "calendar-day");
    const header = createElement("div", "section-title", day.label);
    column.append(header);
    attachDropHandlers(column, { date: day.date, time: null });

    const dayTasks = state.tasks.filter(
      (task) =>
        !task.archived &&
        task.status !== "done" &&
        task.dueDate === day.date &&
        !task.timeBlock &&
        matchesTaskSearch(task, query)
    );
    dayTasks.forEach((task) => column.append(createTaskRow(task, { compact: true })));

    getCalendarSlots().forEach((time) => {
      const slot = createElement("div", "week-slot");
      slot.append(createElement("div", "list-meta", time));
      const items = getScheduledItems(day.date, time).filter((item) =>
        matchesQuery(item.title, query)
      );
      items.forEach((item) => {
        const chip = createCalendarChip(item);
        slot.append(chip);
      });
      attachDropHandlers(slot, { date: day.date, time });
      column.append(slot);
    });

    wrapper.append(column);
  });
  return wrapper;
}

function renderCalendarMonth() {
  const wrapper = createElement("div", "calendar-month");
  const base = addMonths(new Date(), state.ui.calendarMonthOffset);
  const monthStart = new Date(base.getFullYear(), base.getMonth(), 1);
  const weekStart = getWeekStart(monthStart, state.settings.weekStartsMonday);
  for (let i = 0; i < 42; i += 1) {
    const day = addDays(weekStart, i);
    const dayKey = formatDate(day);
    const cell = createElement("div", "month-cell");
    cell.append(createElement("div", "list-meta", String(day.getDate())));
    const items = [
      ...state.events.filter((event) => event.date === dayKey && !event.archived),
      ...state.tasks.filter(
        (task) =>
          task.dueDate === dayKey && !task.archived && task.status !== "done"
      )
    ];
    if (items.length) {
      cell.append(createElement("div", "card-meta", `${items.length} itens`));
    }
    cell.addEventListener("click", () => {
      openEventModal({ date: dayKey });
    });
    attachDropHandlers(cell, { date: dayKey, time: null });
    wrapper.append(cell);
  }
  return wrapper;
}

function renderProjectKanban(project) {
  const board = createElement("div", "kanban-grid");
  STATUS_ORDER.forEach((status) => {
    const column = createElement("div", "kanban-column");
    const header = createElement("div", "section-header");
    header.append(createElement("div", "section-title", STATUS_LABELS[status]));
    column.append(header);
    column.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
    });
    column.addEventListener("dragenter", () => column.classList.add("dropping"));
    column.addEventListener("dragleave", () => column.classList.remove("dropping"));
    column.addEventListener("drop", (event) => {
      event.preventDefault();
      column.classList.remove("dropping");
      const data = parseDragData(event);
      if (!data || data.kind !== "task") {
        return;
      }
      const task = getTask(data.id);
      if (!task || task.projectId !== project.id) {
        return;
      }
      task.status = status;
      touch(task);
      saveState();
      renderMain();
    });
    const tasks = state.tasks.filter(
      (task) =>
        task.projectId === project.id &&
        !task.archived &&
        task.status === status
    );
    if (!tasks.length) {
      column.append(createElement("div", "list-meta", "Sem tarefas."));
    } else {
      tasks.forEach((task) => column.append(createKanbanCard(task)));
    }
    board.append(column);
  });
  return board;
}

function createKanbanCard(task) {
  const card = createElement("div", "kanban-card");
  card.append(createElement("div", "card-title", task.title));
  const meta = [];
  if (task.dueDate) {
    meta.push(task.dueDate);
  }
  if (task.priority) {
    meta.push(PRIORITY_LABELS[task.priority]);
  }
  if (meta.length) {
    card.append(createElement("div", "card-meta", meta.join(" / ")));
  }
  card.draggable = true;
  card.addEventListener("dragstart", (event) => setDragData(event, "task", task.id));
  card.addEventListener("click", () => selectItem("task", task.id));
  return card;
}

function createNotesSidePanel(note) {
  const panel = createElement("div", "notes-panel");
  if (!note) {
    panel.append(createElement("div", "empty", "Sem nota selecionada."));
    return panel;
  }

  const links = createSection("Links", "");
  const linkedTasks = state.tasks.filter(
    (task) => task.linkedNoteId === note.id || task.sourceNoteId === note.id
  );
  links.append(createElement("div", "section-title", "Tarefas vinculadas"));
  if (!linkedTasks.length) {
    links.body.append(createElement("div", "list-meta", "Sem tarefas vinculadas."));
  } else {
    linkedTasks.forEach((task) => links.body.append(createTaskRow(task, { compact: true })));
  }

  const backlinks = createSection("Backlinks", "");
  const relatedNotes = state.notes.filter(
    (entry) =>
      entry.id !== note.id &&
      !entry.archived &&
      matchesNoteSearch(entry, note.title)
  );
  backlinks.append(createElement("div", "section-title", "Notas relacionadas"));
  if (!relatedNotes.length) {
    backlinks.body.append(createElement("div", "list-meta", "Sem backlinks."));
  } else {
    relatedNotes.forEach((entry) => backlinks.body.append(createNoteCard(entry)));
  }

  const details = createSection("Detalhes", "");
  const area = note.areaId ? getArea(note.areaId) : null;
  const project = note.projectId ? getProject(note.projectId) : null;
  details.body.append(
    createElement("div", "list-meta", `Area: ${area ? area.name : "Sem area"}`),
    createElement("div", "list-meta", `Projeto: ${project ? project.name : "Sem projeto"}`),
    createElement("div", "list-meta", `Criado: ${note.createdAt || "-"}`),
    createElement("div", "list-meta", `Atualizado: ${note.updatedAt || "-"}`)
  );

  panel.append(links.section, backlinks.section, details.section);
  return panel;
}

function createAreaSelect(selectedId) {
  const options = [{ value: "", label: "Sem area" }].concat(
    state.areas.map((area) => ({ value: area.id, label: area.name }))
  );
  return createSelect(options, selectedId || "");
}

function createProjectSelect(selectedId) {
  const options = [{ value: "", label: "Sem projeto" }].concat(
    state.projects.map((project) => ({ value: project.id, label: project.name }))
  );
  return createSelect(options, selectedId || "");
}

function createNoteSelect(selectedId) {
  const options = [{ value: "", label: "Sem nota" }].concat(
    state.notes.map((note) => ({ value: note.id, label: note.title }))
  );
  return createSelect(options, selectedId || "");
}

function openCreateChooser() {
  const body = createElement("div", "card-actions");
  const options = [
    { label: "Tarefa", action: () => openTaskModal({}) },
    { label: "Evento", action: () => openEventModal({}) },
    { label: "Nota", action: () => openNoteModal({}) },
    { label: "Projeto", action: () => openProjectModal({}) },
    { label: "Area", action: () => openAreaModal({}) }
  ];
  options.forEach((option) => {
    const btn = createButton(option.label, "ghost-btn", () => {
      closeModal();
      option.action();
    });
    body.append(btn);
  });
  openModal({
    eyebrow: "Criar",
    title: "O que voce quer criar?",
    body: [body],
    saveLabel: "Fechar",
    onSave: () => true
  });
}

function openTaskModal(options = {}) {
  const titleInput = document.createElement("input");
  titleInput.value = options.title || "";

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = options.dueDate || "";

  const timeInput = document.createElement("input");
  timeInput.type = "time";
  timeInput.value = options.dueTime || "";

  const prioritySelect = createSelect(
    [
      { value: "low", label: "Baixa" },
      { value: "med", label: "Media" },
      { value: "high", label: "Alta" }
    ],
    options.priority || "med"
  );

  const projectSelect = createProjectSelect(options.projectId);
  const areaSelect = createAreaSelect(options.areaId);

  openModal({
    eyebrow: "Nova tarefa",
    title: "Tarefa",
    body: [
      buildField("Titulo", titleInput),
      buildField("Prazo", dateInput),
      buildField("Hora", timeInput),
      buildField("Prioridade", prioritySelect),
      buildField("Projeto", projectSelect),
      buildField("Area", areaSelect)
    ],
    saveLabel: "Criar tarefa",
    onSave: () => {
      const task = createTask({
        title: titleInput.value.trim() || "Nova tarefa",
        dueDate: dateInput.value,
        dueTime: timeInput.value,
        priority: prioritySelect.value,
        projectId: projectSelect.value || null,
        areaId: areaSelect.value || null
      });
      state.tasks.unshift(task);
      state.ui.selected = { kind: "task", id: task.id };
      saveState();
      renderAll();
      return true;
    }
  });
}

function openEventModal(options = {}) {
  const titleInput = document.createElement("input");
  titleInput.value = options.title || "";

  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = options.date || getTodayKey();

  const timeInput = document.createElement("input");
  timeInput.type = "time";
  timeInput.value = options.start || "09:00";

  const durationInput = document.createElement("input");
  durationInput.type = "number";
  durationInput.min = "15";
  durationInput.value = options.duration || state.settings.defaultEventDuration;

  const projectSelect = createProjectSelect(options.projectId);
  const areaSelect = createAreaSelect(options.areaId);

  const locationInput = document.createElement("input");
  locationInput.value = options.location || "";

  const notesInput = document.createElement("textarea");
  notesInput.rows = 3;
  notesInput.value = options.notes || "";

  openModal({
    eyebrow: "Novo evento",
    title: "Evento",
    body: [
      buildField("Titulo", titleInput),
      buildField("Data", dateInput),
      buildField("Hora", timeInput),
      buildField("Duracao (min)", durationInput),
      buildField("Projeto", projectSelect),
      buildField("Area", areaSelect),
      buildField("Local", locationInput),
      buildField("Notas", notesInput)
    ],
    saveLabel: "Criar evento",
    onSave: () => {
      const eventItem = createEvent({
        title: titleInput.value.trim() || "Novo evento",
        date: dateInput.value,
        start: timeInput.value,
        duration: Number(durationInput.value) || state.settings.defaultEventDuration,
        projectId: projectSelect.value || null,
        areaId: areaSelect.value || null,
        location: locationInput.value,
        notes: notesInput.value
      });
      state.events.unshift(eventItem);
      state.ui.selected = { kind: "event", id: eventItem.id };
      saveState();
      renderAll();
      return true;
    }
  });
}

function openNoteModal(options = {}) {
  const titleInput = document.createElement("input");
  titleInput.value = options.title || "";

  const areaSelect = createAreaSelect(options.areaId);
  const projectSelect = createProjectSelect(options.projectId);

  openModal({
    eyebrow: "Nova nota",
    title: "Nota",
    body: [
      buildField("Titulo", titleInput),
      buildField("Area", areaSelect),
      buildField("Projeto", projectSelect)
    ],
    saveLabel: "Criar nota",
    onSave: () => {
      const note = createNote({
        title: titleInput.value.trim() || "Nova nota",
        areaId: areaSelect.value || null,
        projectId: projectSelect.value || null,
        blocks: buildTemplateBlocks(options.template)
      });
      state.notes.unshift(note);
      state.ui.notesNoteId = note.id;
      saveState();
      navigate(`/notes/${note.id}`);
      return true;
    }
  });
}

function openProjectModal() {
  const nameInput = document.createElement("input");
  const objectiveInput = document.createElement("textarea");
  objectiveInput.rows = 3;
  const areaSelect = createAreaSelect();
  openModal({
    eyebrow: "Novo projeto",
    title: "Projeto",
    body: [
      buildField("Nome", nameInput),
      buildField("Objetivo", objectiveInput),
      buildField("Area", areaSelect)
    ],
    saveLabel: "Criar projeto",
    onSave: () => {
      const project = createProject({
        name: nameInput.value.trim() || "Novo projeto",
        objective: objectiveInput.value,
        areaId: areaSelect.value || null
      });
      state.projects.unshift(project);
      saveState();
      navigate(`/projects/${project.id}`);
      return true;
    }
  });
}

function openAreaModal() {
  const nameInput = document.createElement("input");
  const objectiveInput = document.createElement("textarea");
  objectiveInput.rows = 3;
  openModal({
    eyebrow: "Nova area",
    title: "Area",
    body: [buildField("Nome", nameInput), buildField("Objetivo", objectiveInput)],
    saveLabel: "Criar area",
    onSave: () => {
      const area = createArea({
        name: nameInput.value.trim() || "Nova area",
        objective: objectiveInput.value
      });
      state.areas.unshift(area);
      saveState();
      navigate(`/areas/${area.id}`);
      return true;
    }
  });
}

function openSettingsModal() {
  const weekToggle = document.createElement("input");
  weekToggle.type = "checkbox";
  weekToggle.checked = Boolean(state.settings.weekStartsMonday);
  const timeSelect = createSelect(
    [
      { value: "24h", label: "24h" },
      { value: "12h", label: "12h" }
    ],
    state.settings.timeFormat
  );
  const stepSelect = createSelect(
    [
      { value: "15", label: "15 min" },
      { value: "30", label: "30 min" }
    ],
    String(state.settings.timeStepMinutes)
  );
  const durationInput = document.createElement("input");
  durationInput.type = "number";
  durationInput.min = "15";
  durationInput.value = state.settings.defaultEventDuration;
  const apiUrlInput = document.createElement("input");
  apiUrlInput.value = state.settings.apiUrl || "";
  const apiKeyInput = document.createElement("input");
  apiKeyInput.value = state.settings.apiKey || "";
  const autoSyncToggle = document.createElement("input");
  autoSyncToggle.type = "checkbox";
  autoSyncToggle.checked = Boolean(state.settings.autoSync);
  const syncRow = createElement("div", "card-actions");
  syncRow.append(
    createButton("Sync agora", "ghost-btn", async () => {
      refreshSyncStatus("Sincronizando...");
      await pullState({ queuePush: true, pushOnEmpty: true });
    })
  );

  openModal({
    eyebrow: "Preferencias",
    title: "Configuracoes",
    body: [
      buildField("Semana inicia segunda", weekToggle),
      buildField("Formato de hora", timeSelect),
      buildField("Passo de horario", stepSelect),
      buildField("Duracao padrao (min)", durationInput),
      buildField("API URL", apiUrlInput),
      buildField("API Key", apiKeyInput),
      buildField("Auto-sync", autoSyncToggle),
      syncRow
    ],
    saveLabel: "Salvar",
    onSave: () => {
      state.settings.weekStartsMonday = weekToggle.checked;
      state.settings.timeFormat = timeSelect.value;
      state.settings.defaultEventDuration = Math.max(15, Number(durationInput.value) || 60);
      state.settings.timeStepMinutes = Math.max(15, Number(stepSelect.value) || 30);
      state.settings.apiUrl = apiUrlInput.value.trim();
      state.settings.apiKey = apiKeyInput.value.trim();
      state.settings.autoSync = autoSyncToggle.checked;
      remote.url = state.settings.apiUrl;
      remote.apiKey = state.settings.apiKey;
      remote.autoSync = state.settings.autoSync;
      remote.lastError = "";
      saveRemoteConfig();
      scheduleAutoSync();
      saveState();
      renderAll();
      return true;
    }
  });
}

function openExportModal() {
  const textarea = document.createElement("textarea");
  textarea.rows = 12;
  textarea.value = JSON.stringify(state, null, 2);
  const copyBtn = createButton("Copiar", "ghost-btn", async () => {
    try {
      await navigator.clipboard.writeText(textarea.value);
      showToast("Dados copiados.");
    } catch (error) {
      showToast("Nao foi possivel copiar.");
    }
  });
  openModal({
    eyebrow: "Exportar",
    title: "Seus dados",
    body: [textarea, copyBtn],
    saveLabel: "Fechar",
    onSave: () => true
  });
}

function openImportModal() {
  const textarea = document.createElement("textarea");
  textarea.rows = 12;
  textarea.placeholder = "Cole o JSON aqui...";
  openModal({
    eyebrow: "Importar",
    title: "Importar dados",
    body: [textarea],
    saveLabel: "Importar",
    onSave: () => {
      try {
        const parsed = JSON.parse(textarea.value);
        state = normalizeState(parsed);
        saveState();
        renderAll();
        return true;
      } catch (error) {
        showToast("JSON invalido.");
        return false;
      }
    }
  });
}

function buildTemplateBlocks(template) {
  if (template === "meeting") {
    return [
      { id: uid("block"), type: "heading", text: "Participantes" },
      { id: uid("block"), type: "list", items: [] },
      { id: uid("block"), type: "heading", text: "Decisoes" },
      { id: uid("block"), type: "list", items: [] },
      { id: uid("block"), type: "heading", text: "Proximos passos" },
      { id: uid("block"), type: "checklist", items: [] }
    ];
  }
  if (template === "diary") {
    return [
      { id: uid("block"), type: "heading", text: "Resumo" },
      { id: uid("block"), type: "text", text: "" },
      { id: uid("block"), type: "heading", text: "Aprendizados" },
      { id: uid("block"), type: "list", items: [] }
    ];
  }
  if (template === "study") {
    return [
      { id: uid("block"), type: "heading", text: "Tema" },
      { id: uid("block"), type: "text", text: "" },
      { id: uid("block"), type: "heading", text: "Notas" },
      { id: uid("block"), type: "list", items: [] }
    ];
  }
  if (template === "monthly") {
    return [
      { id: uid("block"), type: "heading", text: "Objetivos do mes" },
      { id: uid("block"), type: "checklist", items: [] },
      { id: uid("block"), type: "heading", text: "Projetos em foco" },
      { id: uid("block"), type: "list", items: [] }
    ];
  }
  return [];
}

function openProcessModal(item, options = {}) {
  const kindSelect = createSelect(
    [
      { value: "task", label: "Tarefa" },
      { value: "note", label: "Nota" },
      { value: "event", label: "Evento" }
    ],
    options.kind || item.kind
  );
  const titleInput = document.createElement("input");
  titleInput.value = item.title;
  const areaSelect = createAreaSelect();
  const projectSelect = createProjectSelect();
  const dateInput = document.createElement("input");
  dateInput.type = "date";
  const timeInput = document.createElement("input");
  timeInput.type = "time";
  const durationInput = document.createElement("input");
  durationInput.type = "number";
  durationInput.min = "15";
  durationInput.value = state.settings.defaultEventDuration;

  const extraWrap = createElement("div");

  const renderFields = () => {
    extraWrap.innerHTML = "";
    if (kindSelect.value === "task") {
      extraWrap.append(
        buildField("Area", areaSelect),
        buildField("Projeto", projectSelect),
        buildField("Data", dateInput)
      );
    }
    if (kindSelect.value === "note") {
      extraWrap.append(buildField("Area", areaSelect), buildField("Projeto", projectSelect));
    }
    if (kindSelect.value === "event") {
      extraWrap.append(
        buildField("Area", areaSelect),
        buildField("Projeto", projectSelect),
        buildField("Data", dateInput),
        buildField("Hora", timeInput),
        buildField("Duracao (min)", durationInput)
      );
    }
  };
  kindSelect.addEventListener("change", renderFields);
  renderFields();

  openModal({
    eyebrow: "Processar",
    title: "Processar item",
    body: [buildField("Tipo", kindSelect), buildField("Titulo", titleInput), extraWrap],
    saveLabel: "Salvar",
    onSave: () => {
      processInboxItem(item, kindSelect.value, {
        title: titleInput.value,
        areaId: areaSelect.value || null,
        projectId: projectSelect.value || null,
        date: dateInput.value,
        time: timeInput.value,
        duration: Number(durationInput.value) || state.settings.defaultEventDuration
      });
      return true;
    }
  });
}

function openBulkProcessModal(ids, options = {}) {
  const kindSelect = createSelect(
    [
      { value: "task", label: "Tarefa" },
      { value: "note", label: "Nota" },
      { value: "event", label: "Evento" }
    ],
    options.kind || "task"
  );
  const areaSelect = createAreaSelect();
  const projectSelect = createProjectSelect();
  const dateInput = document.createElement("input");
  dateInput.type = "date";
  const timeInput = document.createElement("input");
  timeInput.type = "time";
  const durationInput = document.createElement("input");
  durationInput.type = "number";
  durationInput.min = "15";
  durationInput.value = state.settings.defaultEventDuration;

  const extraWrap = createElement("div");
  const renderFields = () => {
    extraWrap.innerHTML = "";
    if (kindSelect.value === "task") {
      extraWrap.append(
        buildField("Area", areaSelect),
        buildField("Projeto", projectSelect),
        buildField("Data", dateInput)
      );
    }
    if (kindSelect.value === "note") {
      extraWrap.append(buildField("Area", areaSelect), buildField("Projeto", projectSelect));
    }
    if (kindSelect.value === "event") {
      extraWrap.append(
        buildField("Area", areaSelect),
        buildField("Projeto", projectSelect),
        buildField("Data", dateInput),
        buildField("Hora", timeInput),
        buildField("Duracao (min)", durationInput)
      );
    }
  };
  kindSelect.addEventListener("change", renderFields);
  renderFields();

  openModal({
    eyebrow: "Processar lote",
    title: `${ids.length} itens`,
    body: [buildField("Tipo", kindSelect), extraWrap],
    saveLabel: "Processar",
    onSave: () => {
      ids.forEach((id) => {
        const item = state.inbox.find((entry) => entry.id === id);
        if (!item) {
          return;
        }
        processInboxItem(item, kindSelect.value, {
          title: item.title,
          areaId: areaSelect.value || null,
          projectId: projectSelect.value || null,
          date: dateInput.value,
          time: timeInput.value,
          duration: Number(durationInput.value) || state.settings.defaultEventDuration
        }, { silent: true });
      });
      state.ui.inboxSelection = [];
      saveState();
      renderMain();
      return true;
    }
  });
}

function processInboxItem(item, kind, data, options = {}) {
  if (kind === "task") {
    state.tasks.unshift(
      createTask({
        title: data.title || item.title,
        dueDate: data.date || "",
        projectId: data.projectId,
        areaId: data.areaId
      })
    );
  } else if (kind === "note") {
    state.notes.unshift(
      createNote({
        title: data.title || item.title,
        areaId: data.areaId,
        projectId: data.projectId,
        blocks: [
          { id: uid("block"), type: "text", text: item.title }
        ]
      })
    );
  } else if (kind === "event") {
    state.events.unshift(
      createEvent({
        title: data.title || item.title,
        date: data.date || getTodayKey(),
        start: data.time || "09:00",
        duration: data.duration,
        projectId: data.projectId,
        areaId: data.areaId
      })
    );
  }
  state.inbox = state.inbox.filter((entry) => entry.id !== item.id);
  state.ui.inboxSelection = state.ui.inboxSelection.filter((id) => id !== item.id);
  if (!options.silent) {
    saveState();
    renderAll();
  }
}

function openModal({ eyebrow, title, body, onSave, onDelete, saveLabel }) {
  el.modalEyebrow.textContent = eyebrow || "Editor";
  el.modalTitle.textContent = title || "Editar";
  el.modalBody.innerHTML = "";
  if (Array.isArray(body)) {
    body.forEach((node) => {
      if (node) {
        el.modalBody.append(node);
      }
    });
  }
  el.modalSave.textContent = saveLabel || "Salvar";
  el.modalDelete.classList.toggle("hidden", !onDelete);
  modalState.onSave = onSave || null;
  modalState.onDelete = onDelete || null;
  el.modalBackdrop.classList.remove("hidden");
  modalState.previousFocus = document.activeElement;
  focusModal();
}

function closeModal() {
  el.modalBackdrop.classList.add("hidden");
  el.modalBody.innerHTML = "";
  modalState.onSave = null;
  modalState.onDelete = null;
  const previousFocus = modalState.previousFocus;
  modalState.previousFocus = null;
  el.modalSave.textContent = "Salvar";
  el.modalDelete.classList.add("hidden");
  if (previousFocus && document.body.contains(previousFocus)) {
    previousFocus.focus();
  }
}

function handleModalSave() {
  if (!modalState.onSave) {
    closeModal();
    return;
  }
  const shouldClose = modalState.onSave();
  if (shouldClose === false) {
    return;
  }
  closeModal();
}

function handleModalDelete() {
  if (!modalState.onDelete) {
    return;
  }
  const shouldClose = modalState.onDelete();
  if (shouldClose === false) {
    return;
  }
  closeModal();
}

function isModalOpen() {
  return !el.modalBackdrop.classList.contains("hidden");
}

function focusModal() {
  const focusable = getFocusableElements(el.modalBody);
  const target = focusable[0] || el.modalClose;
  if (target) {
    target.focus();
  }
}

function trapTabKey(event) {
  const modal = el.modalBackdrop.querySelector(".modal");
  const focusable = getFocusableElements(modal);
  if (!focusable.length) {
    event.preventDefault();
    return;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;
  if (event.shiftKey) {
    if (active === first || !modal.contains(active)) {
      event.preventDefault();
      last.focus();
    }
    return;
  }
  if (active === last) {
    event.preventDefault();
    first.focus();
  }
}

function getFocusableElements(container) {
  if (!container) {
    return [];
  }
  const selector =
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(container.querySelectorAll(selector)).filter(
    (element) => !element.classList.contains("hidden") && element.offsetParent !== null
  );
}

function openCommandPalette() {
  if (!el.commandPalette || !el.commandInput || !el.commandList) {
    return;
  }
  commandState.previousFocus = document.activeElement;
  commandState.open = true;
  el.commandPalette.classList.remove("hidden");
  el.commandInput.value = "";
  commandState.index = 0;
  commandState.filtered = buildCommands();
  renderCommandList();
  el.commandInput.focus();
  el.commandInput.addEventListener("input", handleCommandInput);
}

function closeCommandPalette(options = {}) {
  if (!el.commandPalette || !el.commandInput) {
    return;
  }
  commandState.open = false;
  el.commandPalette.classList.add("hidden");
  el.commandInput.removeEventListener("input", handleCommandInput);
  if (options.restoreFocus !== false && commandState.previousFocus) {
    commandState.previousFocus.focus();
  }
  commandState.previousFocus = null;
}

function handleCommandInput() {
  const query = el.commandInput.value.trim().toLowerCase();
  const commands = buildCommands();
  commandState.filtered = query
    ? commands.filter((cmd) => cmd.label.toLowerCase().includes(query))
    : commands;
  commandState.index = 0;
  renderCommandList();
}

function handleCommandPaletteKeydown(event) {
  if (!commandState.open) {
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeCommandPalette();
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    commandState.index = Math.min(commandState.index + 1, commandState.filtered.length - 1);
    renderCommandList();
    return;
  }
  if (event.key === "ArrowUp") {
    event.preventDefault();
    commandState.index = Math.max(commandState.index - 1, 0);
    renderCommandList();
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    const command = commandState.filtered[commandState.index];
    if (command) {
      command.action();
      closeCommandPalette();
    }
  }
}

function renderCommandList() {
  if (!el.commandList) {
    return;
  }
  el.commandList.innerHTML = "";
  if (!commandState.filtered.length) {
    el.commandList.append(createElement("div", "list-meta", "Nenhum comando."));
    return;
  }
  commandState.filtered.forEach((command, index) => {
    const row = createElement("div", "command-item");
    if (index === commandState.index) {
      row.classList.add("active");
    }
    row.append(createElement("div", "", command.label));
    row.append(createElement("div", "command-hint", command.hint || ""));
    row.addEventListener("click", () => {
      command.action();
      closeCommandPalette();
    });
    el.commandList.append(row);
  });
}

function buildCommands() {
  return [
    { label: "Ir para Hoje", hint: "/today", action: () => navigate("/today") },
    { label: "Ir para Inbox", hint: "/inbox", action: () => navigate("/inbox") },
    { label: "Ir para Semana", hint: "/week", action: () => navigate("/week") },
    { label: "Ir para Projetos", hint: "/projects", action: () => navigate("/projects") },
    { label: "Ir para Notas", hint: "/notes", action: () => navigate("/notes") },
    { label: "Ir para Calendario", hint: "/calendar", action: () => navigate("/calendar") },
    { label: "Ir para Areas", hint: "/areas", action: () => navigate("/areas") },
    { label: "Ir para Arquivo", hint: "/archive", action: () => navigate("/archive") },
    { label: "Nova tarefa", hint: "Criar", action: () => openTaskModal({}) },
    { label: "Novo evento", hint: "Criar", action: () => openEventModal({}) },
    { label: "Nova nota", hint: "Criar", action: () => openNoteModal({}) },
    { label: "Novo projeto", hint: "Criar", action: () => openProjectModal({}) },
    { label: "Nova area", hint: "Criar", action: () => openAreaModal({}) },
    { label: "Abrir configuracoes", hint: "Preferencias", action: () => openSettingsModal() }
  ];
}

function showToast(message) {
  if (!el.toastContainer) {
    return;
  }
  const toast = createElement("div", "toast", message);
  el.toastContainer.append(toast);
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 3000);
}

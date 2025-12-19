"use strict";

const STORAGE_KEY = "meu-node-rebuild-v1";
const REMOTE_KEY = "meu-node-remote-v1";

const STATUS_ORDER = ["todo", "doing", "done"];
const STATUS_LABELS = {
  todo: "A fazer",
  doing: "Em progresso",
  done: "Feito"
};

const FLOW_VIEWS = [
  { id: "inbox", label: "Inbox", icon: "IN" },
  { id: "today", label: "Hoje", icon: "H" },
  { id: "next7", label: "Próximos 7 dias", icon: "7" },
  { id: "overdue", label: "Atrasados", icon: "!" },
  { id: "nodue", label: "Sem prazo", icon: "S" },
  { id: "doing", label: "Em progresso", icon: ">" }
];

const el = {
  appRoot: document.getElementById("appRoot"),
  authScreen: document.getElementById("authScreen"),
  authTabLogin: document.getElementById("authTabLogin"),
  authTabRegister: document.getElementById("authTabRegister"),
  loginForm: document.getElementById("loginForm"),
  loginEmail: document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  registerForm: document.getElementById("registerForm"),
  registerName: document.getElementById("registerName"),
  registerEmail: document.getElementById("registerEmail"),
  registerPassword: document.getElementById("registerPassword"),
  authApiUrl: document.getElementById("authApiUrl"),
  authMessage: document.getElementById("authMessage"),
  globalSearch: document.getElementById("globalSearch"),
  quickInput: document.getElementById("quickInput"),
  quickType: document.getElementById("quickType"),
  quickAdd: document.getElementById("quickAdd"),
  newItem: document.getElementById("newItem"),
  newType: document.getElementById("newType"),
  newView: document.getElementById("newView"),
  openSettings: document.getElementById("openSettings"),
  addArea: document.getElementById("addArea"),
  addView: document.getElementById("addView"),
  addType: document.getElementById("addType"),
  areasList: document.getElementById("areasList"),
  viewsList: document.getElementById("viewsList"),
  typesList: document.getElementById("typesList"),
  flowList: document.getElementById("flowList"),
  mainTitle: document.getElementById("mainTitle"),
  activeFilters: document.getElementById("activeFilters"),
  mainActionsExtra: document.getElementById("mainActionsExtra"),
  syncStatus: document.getElementById("syncStatus"),
  selectionBar: document.getElementById("selectionBar"),
  layoutSelect: document.getElementById("layoutSelect"),
  sortSelect: document.getElementById("sortSelect"),
  emptyState: document.getElementById("emptyState"),
  emptyNewType: document.getElementById("emptyNewType"),
  emptyNewArea: document.getElementById("emptyNewArea"),
  triagePanel: document.getElementById("triagePanel"),
  itemsList: document.getElementById("itemsList"),
  itemsBoard: document.getElementById("itemsBoard"),
  calendarView: document.getElementById("calendarView"),
  detailsEmpty: document.getElementById("detailsEmpty"),
  detailsForm: document.getElementById("detailsForm"),
  detailsQuickActions: document.getElementById("detailsQuickActions"),
  advancedToggle: document.getElementById("advancedToggle"),
  advancedSection: document.getElementById("advancedSection"),
  returnInbox: document.getElementById("returnInbox"),
  deleteItem: document.getElementById("deleteItem"),
  itemTitle: document.getElementById("itemTitle"),
  itemType: document.getElementById("itemType"),
  itemArea: document.getElementById("itemArea"),
  statusRow: document.getElementById("statusRow"),
  itemStatus: document.getElementById("itemStatus"),
  itemDue: document.getElementById("itemDue"),
  itemTags: document.getElementById("itemTags"),
  progressRow: document.getElementById("progressRow"),
  itemProgress: document.getElementById("itemProgress"),
  itemProgressValue: document.getElementById("itemProgressValue"),
  checklistRow: document.getElementById("checklistRow"),
  addChecklist: document.getElementById("addChecklist"),
  checklistList: document.getElementById("checklistList"),
  customFields: document.getElementById("customFields"),
  itemRecurrence: document.getElementById("itemRecurrence"),
  itemRecurrenceInterval: document.getElementById("itemRecurrenceInterval"),
  recurrenceIntervalRow: document.getElementById("recurrenceIntervalRow"),
  recurrenceSource: document.getElementById("recurrenceSource"),
  itemNotes: document.getElementById("itemNotes"),
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

let state = normalizeSelection(loadState());
let remote = normalizeRemote(loadRemoteConfig());
let auth = normalizeAuth(loadAuth());
const sync = { timer: null, busy: false };
const authUi = { tab: "login", busy: false };
const commandState = { open: false, index: 0, filtered: [], previousFocus: null };
let openMenu = null;

function init() {
  bindEvents();
  // Não inicializar sincronização automaticamente por segurança.
  // remote defaults are loaded from localStorage via loadRemoteConfig().
  renderAll();
  applyAuthState();
  // Apenas puxar estado se o usuário explicitamente configurou autoSync e URL.
  if (auth.token && remote.url && remote.autoSync) {
    pullState();
  }
}

function bindEvents() {
  el.globalSearch.addEventListener("input", () => {
    state.ui.search = el.globalSearch.value;
    saveState();
    renderMain();
  });

  el.quickAdd.addEventListener("click", handleQuickAdd);
  el.quickInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleQuickAdd();
    }
  });
  el.quickType.addEventListener("change", () => {
    state.ui.quickTypeId = el.quickType.value || null;
    saveState();
  });

  el.newItem.addEventListener("click", () => openNewItemModal());
  el.newType.addEventListener("click", () => openTypeModal());
  el.newView.addEventListener("click", () => openViewModal());
  el.openSettings.addEventListener("click", () => openSettingsModal());

  if (el.authTabLogin) {
    el.authTabLogin.addEventListener("click", () => setAuthTab("login"));
  }
  if (el.authTabRegister) {
    el.authTabRegister.addEventListener("click", () => setAuthTab("register"));
  }
  if (el.loginForm) {
    el.loginForm.addEventListener("submit", handleLogin);
  }
  if (el.registerForm) {
    el.registerForm.addEventListener("submit", handleRegister);
  }
  if (el.authApiUrl) {
    el.authApiUrl.addEventListener("change", () => {
      remote.url = el.authApiUrl.value.trim();
      saveRemoteConfig();
    });
  }

  el.addArea.addEventListener("click", () => openAreaModal());
  el.addView.addEventListener("click", () => openViewModal());
  el.addType.addEventListener("click", () => openTypeModal());

  el.emptyNewType.addEventListener("click", () => openTypeModal());
  el.emptyNewArea.addEventListener("click", () => openAreaModal());

  el.layoutSelect.addEventListener("change", () => {
    setLayout(el.layoutSelect.value);
  });

  el.sortSelect.addEventListener("change", () => {
    state.ui.sort = el.sortSelect.value;
    saveState();
    renderMain();
  });

  el.itemTitle.addEventListener("input", () => {
    const item = getSelectedItem();
    if (!item) {
      return;
    }
    item.title = el.itemTitle.value;
    touchItem(item);
    saveState();
    renderMain();
  });

  el.itemType.addEventListener("change", () => {
    const item = getSelectedItem();
    if (!item) {
      return;
    }
    item.typeId = el.itemType.value || null;
    autoTriageItem(item);
    touchItem(item);
    saveState();
    renderSidebar();
    renderMain();
    renderDetails();
  });

  el.itemArea.addEventListener("change", () => {
    const item = getSelectedItem();
    if (!item) {
      return;
    }
    item.areaId = el.itemArea.value || null;
    autoTriageItem(item);
    touchItem(item);
    saveState();
    renderSidebar();
    renderMain();
  });

  el.itemStatus.addEventListener("change", () => {
    const item = getSelectedItem();
    if (!item) {
      return;
    }
    updateItemStatus(item, el.itemStatus.value);
  });

  el.itemDue.addEventListener("change", () => {
    const item = getSelectedItem();
    if (!item) {
      return;
    }
    item.due = el.itemDue.value;
    touchItem(item);
    saveState();
    renderSidebar();
    renderMain();
  });

  el.itemTags.addEventListener("change", () => {
    const item = getSelectedItem();
    if (!item) {
      return;
    }
    item.tags = parseList(el.itemTags.value);
    touchItem(item);
    saveState();
    renderSidebar();
    renderMain();
  });

  el.itemNotes.addEventListener("input", () => {
    const item = getSelectedItem();
    if (!item) {
      return;
    }
    item.notes = el.itemNotes.value;
    touchItem(item);
    saveState();
  });

  if (el.itemRecurrence) {
    el.itemRecurrence.addEventListener("change", () => {
      const item = getSelectedItem();
      if (!item) {
        return;
      }
      const value = el.itemRecurrence.value;
      if (!value) {
        item.recurrence = null;
      } else if (value === "interval") {
        const interval = Number(el.itemRecurrenceInterval.value) || 1;
        item.recurrence = { freq: "interval", intervalDays: Math.max(1, interval) };
      } else {
        item.recurrence = { freq: value };
      }
      touchItem(item);
      saveState();
      renderMain();
      renderDetails();
    });
  }

  if (el.itemRecurrenceInterval) {
    el.itemRecurrenceInterval.addEventListener("change", () => {
      const item = getSelectedItem();
      if (!item || !item.recurrence || item.recurrence.freq !== "interval") {
        return;
      }
      const interval = Math.max(1, Number(el.itemRecurrenceInterval.value) || 1);
      item.recurrence.intervalDays = interval;
      touchItem(item);
      saveState();
      renderMain();
    });
  }

  el.itemProgress.addEventListener("input", () => {
    const item = getSelectedItem();
    if (!item) {
      return;
    }
    item.progress = clamp(Number(el.itemProgress.value), 0, 100);
    el.itemProgressValue.textContent = `${item.progress}%`;
    touchItem(item);
    saveState();
    renderMain();
  });

  el.addChecklist.addEventListener("click", () => {
    const item = getSelectedItem();
    if (!item) {
      return;
    }
    if (!Array.isArray(item.checklist)) {
      item.checklist = [];
    }
    item.checklist.push({ id: uid("check"), text: "", done: false });
    touchItem(item);
    saveState();
    renderDetails();
  });

  el.deleteItem.addEventListener("click", () => {
    const item = getSelectedItem();
    if (!item) {
      return;
    }
    confirmWithModal("Excluir item?", () => {
      state.items = state.items.filter((entry) => entry.id !== item.id);
      state.selectedItemId = null;
      saveState();
      renderAll();
    }, { confirmLabel: "Excluir" });
  });

  el.modalClose.addEventListener("click", closeModal);
  el.modalCancel.addEventListener("click", closeModal);
  el.modalSave.addEventListener("click", handleModalSave);
  el.modalDelete.addEventListener("click", handleModalDelete);
  el.modalBackdrop.addEventListener("click", (event) => {
    if (event.target === el.modalBackdrop) {
      closeModal();
    }
  });

  document.addEventListener("keydown", handleModalKeydown);
  document.addEventListener("keydown", handleGlobalShortcuts);
  document.addEventListener("click", handleGlobalClick);

  document.querySelectorAll(".toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleSection(btn.dataset.toggle);
    });
  });

  if (el.advancedToggle) {
    el.advancedToggle.addEventListener("click", () => toggleAdvancedSection());
  }

  if (el.returnInbox) {
    el.returnInbox.addEventListener("click", () => {
      const item = getSelectedItem();
      if (!item) {
        return;
      }
      item.inbox = true;
      touchItem(item);
      saveState();
      showToast("Item movido para Inbox.");
      renderSidebar();
      renderMain();
      renderDetails();
    });
  }
}
function renderAll() {
  state = normalizeSelection(state);
  el.globalSearch.value = state.ui.search || "";
  renderQuick();
  renderSidebar();
  renderMain();
  renderDetails();
}

function renderQuick() {
  el.quickType.innerHTML = "";
  if (state.types.length === 0) {
    const option = document.createElement("option");
    option.textContent = "Sem tipos";
    option.value = "";
    el.quickType.append(option);
    el.quickInput.disabled = true;
    el.quickType.disabled = true;
    el.quickAdd.disabled = true;
    return;
  }

  const emptyOption = document.createElement("option");
  emptyOption.textContent = "Sem tipo";
  emptyOption.value = "";
  el.quickType.append(emptyOption);

  state.types.forEach((type) => {
    const option = document.createElement("option");
    option.value = type.id;
    option.textContent = type.name;
    el.quickType.append(option);
  });

  el.quickInput.disabled = false;
  el.quickType.disabled = false;
  el.quickAdd.disabled = false;

  el.quickType.value = state.ui.quickTypeId || "";
}

function renderSidebar() {
  renderFlowList();
  renderAreas();
  renderViews();
  renderTypes();
  updateToggleButtons();
}

function renderFlowList() {
  if (!el.flowList) {
    return;
  }
  el.flowList.innerHTML = "";
  const counts = getFlowCounts();
  FLOW_VIEWS.forEach((flow) => {
    const node = createListItem({
      name: flow.label,
      count: counts[flow.id] || 0,
      active: state.ui.specialView === flow.id,
      onSelect: () => setSpecialView(flow.id),
      icon: flow.icon,
      extraClass: "flow-item"
    });
    el.flowList.append(node);
  });
}

function renderAreas() {
  el.areasList.innerHTML = "";
  const allItem = createListItem({
    name: "Todas as áreas",
    count: state.items.length,
    active: !state.ui.areaId,
    onSelect: () => setAreaFilter(null)
  });
  el.areasList.append(allItem);

  state.areas.forEach((area) => {
    const count = state.items.filter((item) => item.areaId === area.id).length;
    const node = createListItem({
      name: area.name,
      count,
      active: state.ui.areaId === area.id,
      onSelect: () => setAreaFilter(area.id),
      onEdit: () => openAreaModal(area)
    });
    el.areasList.append(node);
  });

  setHidden(el.areasList, state.ui.collapsed.areas);
}

function renderViews() {
  el.viewsList.innerHTML = "";
  const allItem = createListItem({
    name: "Todas as visões",
    count: state.items.length,
    active: !state.ui.viewId,
    onSelect: () => setView(null)
  });
  el.viewsList.append(allItem);

  state.views.forEach((view) => {
    const count = getItemsForView(view).length;
    const node = createListItem({
      name: view.name,
      count,
      active: state.ui.viewId === view.id,
      onSelect: () => setView(view.id),
      onEdit: () => openViewModal(view)
    });
    el.viewsList.append(node);
  });

  setHidden(el.viewsList, state.ui.collapsed.views);
}

function renderTypes() {
  el.typesList.innerHTML = "";
  const allItem = createListItem({
    name: "Todos os tipos",
    count: state.items.length,
    active: !state.ui.typeId,
    onSelect: () => setTypeFilter(null)
  });
  el.typesList.append(allItem);

  state.types.forEach((type) => {
    const count = state.items.filter((item) => item.typeId === type.id).length;
    const node = createListItem({
      name: type.name,
      count,
      active: state.ui.typeId === type.id,
      onSelect: () => setTypeFilter(type.id),
      onEdit: () => openTypeModal(type)
    });
    el.typesList.append(node);
  });

  setHidden(el.typesList, state.ui.collapsed.types);
}

function updateToggleButtons() {
  document.querySelectorAll(".toggle").forEach((btn) => {
    const key = btn.dataset.toggle;
    btn.textContent = state.ui.collapsed[key] ? "+" : "-";
    try {
      // aria-expanded should reflect whether the section is open
      const expanded = !Boolean(state.ui.collapsed[key]);
      btn.setAttribute("aria-expanded", String(expanded));
    } catch (e) {
      // ignore
    }
  });
}
function renderMain() {
  const items = getFilteredItems();
  const layout = getCurrentLayout();

  el.mainTitle.textContent = buildMainTitle();
  el.layoutSelect.value = layout;
  el.sortSelect.value = state.ui.sort;
  renderActiveFiltersBar();
  renderMainHeaderActions();
  syncSelection(items);
  renderSelectionBar();

  updateEmptyState(items);

  if (state.ui.specialView === "inbox" && state.ui.triageMode) {
    setHidden(el.emptyState, true);
    setHidden(el.triagePanel, false);
    setHidden(el.itemsBoard, true);
    setHidden(el.itemsList, true);
    setHidden(el.calendarView, true);
    renderTriagePanel(items);
    return;
  }

  setHidden(el.triagePanel, true);

  if (layout === "board") {
    setHidden(el.itemsBoard, false);
    setHidden(el.itemsList, true);
    setHidden(el.calendarView, true);
    renderBoard(items);
  } else if (layout === "calendar") {
    setHidden(el.itemsBoard, true);
    setHidden(el.itemsList, true);
    setHidden(el.calendarView, false);
    renderCalendar(items);
  } else {
    setHidden(el.itemsBoard, true);
    setHidden(el.itemsList, false);
    setHidden(el.calendarView, true);
    renderList(items);
  }
}

function renderActiveFiltersBar() {
  if (!el.activeFilters) {
    return;
  }

  const view = getCurrentView();
  const area = state.ui.areaId ? getArea(state.ui.areaId) : null;
  const type = state.ui.typeId ? getType(state.ui.typeId) : null;
  const search = (state.ui.search || "").trim();
  const hasFilters = Boolean(view || area || type || search || state.ui.specialView);

  el.activeFilters.innerHTML = "";
  setHidden(el.activeFilters, !hasFilters);
  if (!hasFilters) {
    return;
  }

  if (view) {
    el.activeFilters.append(
      createFilterChip(buildViewFilterLabel(view), () => setView(null))
    );
  }
  if (state.ui.specialView) {
    el.activeFilters.append(
      createFilterChip(`Fluxo: ${getSpecialViewLabel(state.ui.specialView)}`, () =>
        setSpecialView(null)
      )
    );
  }
  if (area) {
    el.activeFilters.append(createFilterChip(`Área: ${area.name}`, () => setAreaFilter(null)));
  }
  if (type) {
    el.activeFilters.append(createFilterChip(`Tipo: ${type.name}`, () => setTypeFilter(null)));
  }
  if (search) {
    el.activeFilters.append(
      createFilterChip(`Busca: ${search}`, () => {
        state.ui.search = "";
        el.globalSearch.value = "";
        saveState();
        renderMain();
      })
    );
  }

  const clearButton = document.createElement("button");
  clearButton.type = "button";
  clearButton.className = "chip-clear";
  clearButton.textContent = "Limpar tudo";
  clearButton.addEventListener("click", () => {
    state.ui.viewId = null;
    state.ui.specialView = null;
    state.ui.triageMode = false;
    state.ui.areaId = null;
    state.ui.typeId = null;
    state.ui.search = "";
    el.globalSearch.value = "";
    saveState();
    renderMain();
    renderSidebar();
  });
  el.activeFilters.append(clearButton);
}

function createFilterChip(label, onRemove) {
  const chip = document.createElement("div");
  chip.className = "filter-chip";

  const text = document.createElement("span");
  text.textContent = label;

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "chip-remove";
  remove.textContent = "x";
  remove.setAttribute("aria-label", `Remover ${label}`);
  remove.addEventListener("click", (event) => {
    event.stopPropagation();
    onRemove();
  });

  chip.append(text, remove);
  return chip;
}

function buildViewFilterLabel(view) {
  const filters = view.filters || {};
  const details = [];
  if (filters.areaId) {
    const area = getArea(filters.areaId);
    if (area) {
      details.push(`Área: ${area.name}`);
    }
  }
  if (filters.typeId) {
    const type = getType(filters.typeId);
    if (type) {
      details.push(`Tipo: ${type.name}`);
    }
  }
  if (filters.status && filters.status !== "any") {
    const label = STATUS_LABELS[filters.status] || filters.status;
    details.push(`Status: ${label}`);
  }
  if (filters.due && filters.due !== "any") {
    details.push(`Prazo: ${formatDueFilterLabel(filters.due)}`);
  }
  if (filters.tag) {
    details.push(`Tag: ${filters.tag}`);
  }
  if (!details.length) {
    return `Visão: ${view.name}`;
  }
  return `Visão: ${view.name} (${details.join("; ")})`;
}

function formatDueFilterLabel(value) {
  const labels = {
    withdate: "Com prazo",
    nodate: "Sem prazo",
    overdue: "Atrasado",
    today: "Hoje",
    week: "7 dias"
  };
  return labels[value] || value;
}

function updateEmptyState(items) {
  const title = el.emptyState.querySelector("h3");
  const text = el.emptyState.querySelector("p");
  const layout = getCurrentLayout();

  if (state.types.length === 0) {
    title.textContent = "Nenhum tipo ainda";
    text.textContent = "Crie seu primeiro tipo para organizar.";
    setHidden(el.emptyNewType, false);
  } else if (state.ui.specialView === "inbox") {
    title.textContent = "Inbox vazia";
    text.textContent = "Capture algo no topo ou crie um item.";
    setHidden(el.emptyNewType, true);
  } else if (state.ui.specialView === "today") {
    title.textContent = "Nada para hoje";
    text.textContent = "Quer planejar a semana no Calendário?";
    setHidden(el.emptyNewType, true);
  } else if (layout === "board") {
    title.textContent = "Quadro vazio";
    text.textContent = "Arraste cards entre colunas ou crie um item.";
    setHidden(el.emptyNewType, true);
  } else {
    title.textContent = "Nenhum item aqui";
    text.textContent = "Crie um item ou ajuste filtros.";
    setHidden(el.emptyNewType, true);
  }

  setHidden(el.emptyNewArea, false);
  const showEmpty = layout !== "calendar" && (state.types.length === 0 || items.length === 0);
  setHidden(el.emptyState, !showEmpty);
}

function renderMainHeaderActions() {
  if (!el.mainActionsExtra) {
    return;
  }
  el.mainActionsExtra.innerHTML = "";
  if (state.ui.specialView === "inbox") {
    const triageButton = document.createElement("button");
    triageButton.className = "ghost-btn";
    triageButton.textContent = state.ui.triageMode ? "Sair da triagem" : "Triar Inbox";
    triageButton.addEventListener("click", () => {
      state.ui.triageMode = !state.ui.triageMode;
      saveState();
      renderMain();
    });
    el.mainActionsExtra.append(triageButton);
  }
  if (state.ui.specialView === "today" || state.ui.specialView === "next7") {
    const calendarButton = document.createElement("button");
    calendarButton.className = "ghost-btn";
    calendarButton.textContent = "Abrir no Calendário";
    calendarButton.addEventListener("click", () => {
      const target = new Date();
      state.ui.calendarMonth = formatCalendarMonth(target);
      setLayout("calendar");
    });
    el.mainActionsExtra.append(calendarButton);
  }
  // Atualiza indicador de sincronização no header, se presente
  if (el.syncStatus) {
    el.syncStatus.textContent = buildSyncStatus();
  }
}

function renderSelectionBar() {
  if (!el.selectionBar) {
    return;
  }
  const selection = getSelectionSet();
  if (getCurrentLayout() !== "list" || selection.size === 0 || state.ui.triageMode) {
    setHidden(el.selectionBar, true);
    return;
  }
  setHidden(el.selectionBar, false);
  el.selectionBar.innerHTML = "";

  const count = document.createElement("div");
  count.className = "list-meta";
  count.textContent = `${selection.size} selecionado${selection.size > 1 ? "s" : ""}`;

  const statusSelect = document.createElement("select");
  [
    { value: "", label: "Status..." },
    { value: "todo", label: STATUS_LABELS.todo },
    { value: "doing", label: STATUS_LABELS.doing },
    { value: "done", label: STATUS_LABELS.done }
  ].forEach((optionData) => {
    const option = document.createElement("option");
    option.value = optionData.value;
    option.textContent = optionData.label;
    statusSelect.append(option);
  });
  statusSelect.addEventListener("change", () => {
    if (!statusSelect.value) {
      return;
    }
    batchUpdateStatus(statusSelect.value);
    statusSelect.value = "";
  });

  const areaSelect = document.createElement("select");
  fillSelect(areaSelect, state.areas, "", true, "Mover para área...");
  areaSelect.addEventListener("change", () => {
    if (!areaSelect.value) {
      return;
    }
    applyToSelection((item) => {
      item.areaId = areaSelect.value;
      autoTriageItem(item);
      touchItem(item);
    });
    areaSelect.value = "";
    saveState();
    renderAll();
    showToast("Área atualizada.");
  });

  const typeSelect = document.createElement("select");
  fillSelect(typeSelect, state.types, "", true, "Definir tipo...");
  typeSelect.addEventListener("change", () => {
    if (!typeSelect.value) {
      return;
    }
    applyToSelection((item) => {
      item.typeId = typeSelect.value;
      autoTriageItem(item);
      touchItem(item);
    });
    typeSelect.value = "";
    saveState();
    renderAll();
    showToast("Tipo atualizado.");
  });

  const tagWrap = document.createElement("div");
  tagWrap.className = "field";
  const tagInput = document.createElement("input");
  tagInput.type = "text";
  tagInput.placeholder = "Adicionar tag";
  const tagButton = document.createElement("button");
  tagButton.className = "ghost-btn";
  tagButton.type = "button";
  tagButton.textContent = "Aplicar";
  tagButton.addEventListener("click", () => {
    const value = tagInput.value.trim();
    if (!value) {
      return;
    }
    applyToSelection((item) => {
      const tags = new Set([...(item.tags || []), value]);
      item.tags = Array.from(tags);
      touchItem(item);
    });
    tagInput.value = "";
    saveState();
    renderAll();
    showToast("Tag adicionada.");
  });
  tagInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      tagButton.click();
    }
  });
  tagWrap.append(tagInput, tagButton);

  const dueWrap = document.createElement("div");
  dueWrap.className = "field";
  const dueInput = document.createElement("input");
  dueInput.type = "date";
  const dueButton = document.createElement("button");
  dueButton.className = "ghost-btn";
  dueButton.type = "button";
  dueButton.textContent = "Definir prazo";
  dueButton.addEventListener("click", () => {
    if (!dueInput.value) {
      return;
    }
    applyToSelection((item) => {
      item.due = dueInput.value;
      touchItem(item);
    });
    dueInput.value = "";
    saveState();
    renderAll();
    showToast("Prazo atualizado.");
  });
  dueInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      dueButton.click();
    }
  });
  dueWrap.append(dueInput, dueButton);

  const clearButton = document.createElement("button");
  clearButton.className = "ghost-btn";
  clearButton.type = "button";
  clearButton.textContent = "Limpar seleção";
  clearButton.addEventListener("click", () => {
    state.ui.selection = [];
    saveState();
    renderMain();
  });

  el.selectionBar.append(count, statusSelect, areaSelect, typeSelect, tagWrap, dueWrap, clearButton);
}

function getSelectionSet() {
  return new Set(Array.isArray(state.ui.selection) ? state.ui.selection : []);
}

function toggleSelection(itemId, index) {
  const selection = getSelectionSet();
  if (selection.has(itemId)) {
    selection.delete(itemId);
  } else {
    selection.add(itemId);
  }
  state.ui.selection = Array.from(selection);
  state.ui.selectionAnchor = Number.isFinite(index) ? index : null;
  saveState();
  renderMain();
}

function selectRange(index, listIds) {
  if (!Number.isFinite(index) || !Array.isArray(listIds) || !listIds.length) {
    return;
  }
  const anchor = Number.isFinite(state.ui.selectionAnchor)
    ? state.ui.selectionAnchor
    : index;
  const start = Math.min(anchor, index);
  const end = Math.max(anchor, index);
  const selection = getSelectionSet();
  for (let i = start; i <= end; i += 1) {
    if (listIds[i]) {
      selection.add(listIds[i]);
    }
  }
  state.ui.selection = Array.from(selection);
  saveState();
  renderMain();
}

function syncSelection(items) {
  if (!Array.isArray(state.ui.selection) || state.ui.selection.length === 0) {
    return;
  }
  const available = new Set(items.map((item) => item.id));
  const next = state.ui.selection.filter((id) => available.has(id));
  if (next.length !== state.ui.selection.length) {
    state.ui.selection = next;
    saveState();
  }
}

function applyToSelection(fn) {
  const selection = getSelectionSet();
  if (!selection.size) {
    return;
  }
  state.items.forEach((item) => {
    if (selection.has(item.id)) {
      fn(item);
    }
  });
}

function batchUpdateStatus(status) {
  applyToSelection((item) => {
    const current = getItemStatus(item);
    if (current === status) {
      return;
    }
    item.status = status;
    touchItem(item);
    if (status === "done") {
      maybeGenerateRecurringItem(item);
    }
  });
  saveState();
  renderSidebar();
  renderMain();
  renderDetails();
  showToast("Itens atualizados.");
}

function renderTriagePanel(items) {
  if (!el.triagePanel) {
    return;
  }
  el.triagePanel.innerHTML = "";
  if (items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.innerHTML = "<h3>Inbox vazia</h3><p>Capture algo no topo ou crie um item.</p>";
    el.triagePanel.append(empty);
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "triage-row";

    const title = document.createElement("div");
    title.className = "triage-title";
    title.textContent = item.title || "Sem título";

    const areaSelect = document.createElement("select");
    fillSelect(areaSelect, state.areas, item.areaId || "", true, "Área");
    areaSelect.addEventListener("change", () => {
      item.areaId = areaSelect.value || null;
      autoTriageItem(item, { silent: true });
      touchItem(item);
      saveState();
      renderMain();
      renderSidebar();
    });

    const typeSelect = document.createElement("select");
    fillSelect(typeSelect, state.types, item.typeId || "", true, "Tipo");
    typeSelect.addEventListener("change", () => {
      item.typeId = typeSelect.value || null;
      autoTriageItem(item, { silent: true });
      touchItem(item);
      saveState();
      renderMain();
      renderSidebar();
    });

    const statusSelect = document.createElement("select");
    [
      { value: "todo", label: STATUS_LABELS.todo },
      { value: "doing", label: STATUS_LABELS.doing },
      { value: "done", label: STATUS_LABELS.done }
    ].forEach((optionData) => {
      const option = document.createElement("option");
      option.value = optionData.value;
      option.textContent = optionData.label;
      statusSelect.append(option);
    });
    statusSelect.value = getItemStatus(item);
    statusSelect.addEventListener("change", () => {
      updateItemStatus(item, statusSelect.value, { silent: true });
    });

    const dueInput = document.createElement("input");
    dueInput.type = "date";
    dueInput.value = item.due || "";
    dueInput.addEventListener("change", () => {
      item.due = dueInput.value;
      touchItem(item);
      saveState();
      renderMain();
    });

    const doneButton = document.createElement("button");
    doneButton.className = "ghost-btn";
    doneButton.type = "button";
    doneButton.textContent = "Concluir";
    doneButton.disabled = !canAutoTriage(item);
    doneButton.addEventListener("click", () => {
      if (!canAutoTriage(item)) {
        return;
      }
      item.inbox = false;
      touchItem(item);
      saveState();
      renderMain();
      renderSidebar();
      showToast("Triagem concluída.");
    });

    row.append(title, areaSelect, typeSelect, statusSelect, dueInput, doneButton);
    el.triagePanel.append(row);
  });
}

function renderCalendar(items) {
  if (!el.calendarView) {
    return;
  }
  el.calendarView.innerHTML = "";

  const current = getCalendarMonth();
  const monthStart = new Date(current.year, current.month, 1);
  const monthLabel = monthStart.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric"
  });

  const header = document.createElement("div");
  header.className = "calendar-header";

  const title = document.createElement("div");
  title.className = "item-title";
  title.textContent = monthLabel;

  const nav = document.createElement("div");
  nav.className = "calendar-nav";
  const prev = document.createElement("button");
  prev.className = "mini-btn";
  prev.textContent = "◀";
  prev.addEventListener("click", () => {
    shiftCalendarMonth(-1);
  });
  const next = document.createElement("button");
  next.className = "mini-btn";
  next.textContent = "▶";
  next.addEventListener("click", () => {
    shiftCalendarMonth(1);
  });
  nav.append(prev, next);

  header.append(title, nav);
  el.calendarView.append(header);

  const weekdays = document.createElement("div");
  weekdays.className = "calendar-weekdays";
  ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].forEach((day) => {
    const label = document.createElement("div");
    label.className = "calendar-weekday";
    label.textContent = day;
    weekdays.append(label);
  });
  el.calendarView.append(weekdays);

  const grid = document.createElement("div");
  grid.className = "calendar-grid";

  const firstDay = monthStart.getDay();
  const daysInMonth = new Date(current.year, current.month + 1, 0).getDate();
  const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
  const startDate = addDays(monthStart, -firstDay);

  const itemsByDate = groupItemsByDate(items);

  for (let i = 0; i < totalCells; i += 1) {
    const dayDate = addDays(startDate, i);
    const dayKey = formatDateInput(dayDate);
    const cell = document.createElement("div");
    cell.className = "calendar-cell";
    if (dayDate.getMonth() !== current.month) {
      cell.classList.add("other-month");
    }
    cell.dataset.date = dayKey;

    cell.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
    });
    cell.addEventListener("dragenter", () => {
      cell.classList.add("dropping");
    });
    cell.addEventListener("dragleave", () => {
      cell.classList.remove("dropping");
    });
    cell.addEventListener("drop", (event) => {
      event.preventDefault();
      cell.classList.remove("dropping");
      const itemId = event.dataTransfer ? event.dataTransfer.getData("text/plain") : "";
      const item = state.items.find((entry) => entry.id === itemId);
      if (!item) {
        return;
      }
      item.due = dayKey;
      touchItem(item);
      saveState();
      showToast(`Prazo definido para ${formatDateDisplay(dayKey)}.`);
      renderMain();
      renderDetails();
    });

    const dateLabel = document.createElement("div");
    dateLabel.className = "calendar-date";
    dateLabel.textContent = String(dayDate.getDate());
    cell.append(dateLabel);

    const itemsWrap = document.createElement("div");
    itemsWrap.className = "calendar-items";
    const dayItems = itemsByDate[dayKey] || [];
    dayItems.slice(0, 3).forEach((item) => {
      const mini = document.createElement("div");
      mini.className = "calendar-item";
      mini.textContent = item.title || "Sem título";
      mini.setAttribute("role", "button");
      mini.tabIndex = 0;
      mini.addEventListener("click", (event) => {
        event.stopPropagation();
        state.selectedItemId = item.id;
        saveState();
        renderMain();
        renderDetails();
      });
      mini.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          state.selectedItemId = item.id;
          saveState();
          renderMain();
          renderDetails();
        }
      });
      mini.draggable = true;
      mini.addEventListener("dragstart", (event) => {
        if (event.dataTransfer) {
          event.dataTransfer.setData("text/plain", item.id);
          event.dataTransfer.effectAllowed = "move";
        }
      });
      itemsWrap.append(mini);
    });
    if (dayItems.length > 3) {
      const more = document.createElement("div");
      more.className = "calendar-more";
      more.textContent = `+${dayItems.length - 3} mais`;
      more.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      itemsWrap.append(more);
    }
    cell.append(itemsWrap);

    cell.addEventListener("click", () => {
      openNewItemModal({ due: dayKey, inbox: false });
    });

    grid.append(cell);
  }

  el.calendarView.append(grid);
}

function renderList(items) {
  el.itemsList.innerHTML = "";
  const listIds = items.map((item) => item.id);
  items.forEach((item, index) => {
    el.itemsList.append(createItemCard(item, { mode: "list", index, listIds }));
  });
}

function renderBoard(items) {
  el.itemsBoard.innerHTML = "";
  STATUS_ORDER.forEach((status) => {
    const column = document.createElement("div");
    column.className = "board-column";
    column.dataset.status = status;
    let dragDepth = 0;
    column.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
    });
    column.addEventListener("dragenter", () => {
      dragDepth += 1;
      column.classList.add("dropping");
    });
    column.addEventListener("dragleave", () => {
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) {
        column.classList.remove("dropping");
      }
    });
    column.addEventListener("drop", (event) => {
      event.preventDefault();
      dragDepth = 0;
      column.classList.remove("dropping");
      const itemId = event.dataTransfer ? event.dataTransfer.getData("text/plain") : "";
      if (!itemId) {
        return;
      }
      const item = state.items.find((entry) => entry.id === itemId);
      if (!item) {
        return;
      }
      if (getItemStatus(item) === status) {
        return;
      }
      updateItemStatus(item, status, { silent: true });
    });
    const columnItems = items.filter((item) => getItemStatus(item) === status);
    const header = document.createElement("div");
    header.className = "board-header";
    const headerTitle = document.createElement("div");
    headerTitle.textContent = STATUS_LABELS[status];
    const headerMeta = document.createElement("div");
    headerMeta.className = "list-meta";
    headerMeta.textContent = String(columnItems.length);
    header.append(headerTitle, headerMeta);
    column.append(header);
    columnItems.forEach((item) => {
      column.append(createItemCard(item, { mode: "board" }));
    });
    el.itemsBoard.append(column);
  });
}
function renderDetails() {
  const item = getSelectedItem();
  if (!item) {
    setHidden(el.detailsEmpty, false);
    setHidden(el.detailsForm, true);
    el.deleteItem.disabled = true;
    if (el.returnInbox) {
      el.returnInbox.disabled = true;
      setHidden(el.returnInbox, true);
    }
    return;
  }

  el.deleteItem.disabled = false;
  setHidden(el.detailsEmpty, true);
  setHidden(el.detailsForm, false);

  fillSelect(el.itemType, state.types, item.typeId, true, "Sem tipo");
  fillSelect(el.itemArea, state.areas, item.areaId, true, "Sem área");

  el.itemTitle.value = item.title || "";
  el.itemStatus.value = getItemStatus(item);
  el.itemDue.value = item.due || "";
  el.itemTags.value = (item.tags || []).join(", ");
  el.itemNotes.value = item.notes || "";
  el.itemProgress.value = String(item.progress || 0);
  el.itemProgressValue.textContent = `${item.progress || 0}%`;

  const type = getType(item.typeId);
  const features = type ? type.features || {} : {};
  const showStatus = Boolean(features.status);
  const showDue = Boolean(features.due);
  const showProgress = Boolean(features.progress);
  const showChecklist = Boolean(features.checklist);
  const showCustom = Boolean(type && Array.isArray(type.customFields) && type.customFields.length);

  const statusLabel = el.itemStatus.closest("label");
  const dueLabel = el.itemDue.closest("label");
  if (statusLabel) {
    setHidden(statusLabel, !showStatus);
  }
  if (dueLabel) {
    setHidden(dueLabel, !showDue);
  }

  setHidden(el.statusRow, !(showStatus || showDue));
  setHidden(el.progressRow, !showProgress);
  setHidden(el.checklistRow, !showChecklist);

  renderChecklist(item, showChecklist);
  renderCustomFields(item, type);

  if (el.returnInbox) {
    setHidden(el.returnInbox, Boolean(item.inbox));
    el.returnInbox.disabled = Boolean(item.inbox);
  }

  renderDetailsQuickActions(item);
  renderRecurrenceFields(item);

  const hasCustomData = item.custom && Object.keys(item.custom).length > 0;
  const hasAdvancedData = Boolean(
    (showProgress && item.progress) ||
      (showChecklist && Array.isArray(item.checklist) && item.checklist.length) ||
      (showCustom && hasCustomData) ||
      item.recurrence ||
      item.recurrenceParentId
  );
  const shouldOpenAdvanced = Boolean(state.ui.detailsSections.advancedOpen || hasAdvancedData);
  if (el.advancedSection) {
    setHidden(el.advancedSection, !shouldOpenAdvanced);
  }
  if (el.advancedToggle) {
    el.advancedToggle.querySelector(".toggle-icon").textContent = shouldOpenAdvanced ? "-" : "+";
  }
}

function renderChecklist(item, enabled) {
  el.checklistList.innerHTML = "";
  if (!enabled) {
    return;
  }
  if (!Array.isArray(item.checklist)) {
    item.checklist = [];
  }

  item.checklist.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "check-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(entry.done);
    checkbox.addEventListener("change", () => {
      entry.done = checkbox.checked;
      touchItem(item);
      saveState();
    });

    const text = document.createElement("input");
    text.type = "text";
    text.placeholder = "Item";
    text.value = entry.text || "";
    text.addEventListener("input", () => {
      entry.text = text.value;
      touchItem(item);
      saveState();
    });

    const remove = document.createElement("button");
    remove.className = "mini-btn";
    remove.textContent = "x";
    remove.addEventListener("click", () => {
      item.checklist = item.checklist.filter((check) => check.id !== entry.id);
      touchItem(item);
      saveState();
      renderDetails();
    });

    row.append(checkbox, text, remove);
    el.checklistList.append(row);
  });
}

function renderCustomFields(item, type) {
  el.customFields.innerHTML = "";
  const fields = type && Array.isArray(type.customFields) ? type.customFields : [];
  if (!fields.length) {
    return;
  }

  fields.forEach((field) => {
    const wrapper = document.createElement("label");
    wrapper.className = "field";
    const label = document.createElement("span");
    label.textContent = field.label || "Campo";

    let input;
    if (field.kind === "select") {
      input = document.createElement("select");
      const options = parseList(field.options);
      options.forEach((optionValue) => {
        const option = document.createElement("option");
        option.value = optionValue;
        option.textContent = optionValue;
        input.append(option);
      });
    } else if (field.kind === "number") {
      input = document.createElement("input");
      input.type = "number";
    } else if (field.kind === "date") {
      input = document.createElement("input");
      input.type = "date";
    } else if (field.kind === "checkbox") {
      input = document.createElement("input");
      input.type = "checkbox";
    } else {
      input = document.createElement("input");
      input.type = "text";
    }

    const customValue = item.custom ? item.custom[field.id] : undefined;
    if (input.type === "checkbox") {
      input.checked = Boolean(customValue);
    } else if (customValue !== undefined && customValue !== null) {
      input.value = String(customValue);
    }

    input.addEventListener("input", () => {
      if (!item.custom) {
        item.custom = {};
      }
      if (input.type === "checkbox") {
        item.custom[field.id] = input.checked;
      } else {
        item.custom[field.id] = input.value;
      }
      touchItem(item);
      saveState();
    });

    wrapper.append(label, input);
    el.customFields.append(wrapper);
  });
}

function renderDetailsQuickActions(item) {
  if (!el.detailsQuickActions) {
    return;
  }
  el.detailsQuickActions.innerHTML = "";
  const snooze = createSnoozeMenu(item, { label: "Adiar" });
  el.detailsQuickActions.append(snooze);
}

function renderRecurrenceFields(item) {
  if (!el.itemRecurrence || !el.itemRecurrenceInterval || !el.recurrenceIntervalRow) {
    return;
  }
  if (item.recurrence && item.recurrence.freq) {
    el.itemRecurrence.value = item.recurrence.freq;
  } else {
    el.itemRecurrence.value = "";
  }
  if (item.recurrence && item.recurrence.freq === "interval") {
    el.recurrenceIntervalRow.classList.remove("hidden");
    el.itemRecurrenceInterval.value = String(item.recurrence.intervalDays || 1);
  } else {
    el.recurrenceIntervalRow.classList.add("hidden");
    el.itemRecurrenceInterval.value = "1";
  }
  if (el.recurrenceSource) {
    setHidden(el.recurrenceSource, !item.recurrenceParentId);
  }
}

function toggleAdvancedSection() {
  state.ui.detailsSections.advancedOpen = !state.ui.detailsSections.advancedOpen;
  saveState();
  renderDetails();
}
function handleQuickAdd() {
  if (!ensureTypeReady()) {
    return;
  }
  const raw = el.quickInput.value.trim();
  if (!raw) {
    return;
  }
  const typeId = el.quickType.value || null;
  const parsed = parseQuickInput(raw);
  const item = createItem({
    title: parsed.title,
    typeId,
    areaId: getDefaultAreaId(),
    tags: parsed.tags,
    due: parsed.due
  });
  state.items.unshift(item);
  state.selectedItemId = item.id;
  el.quickInput.value = "";
  saveState();
  renderAll();
  el.itemTitle.focus();
}

function handleNewItem() {
  openNewItemModal();
}

function ensureTypeReady() {
  if (state.types.length === 0) {
    openTypeModal();
    return false;
  }
  return true;
}

function openNewItemModal(options = {}) {
  if (!ensureTypeReady()) {
    return;
  }

  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.placeholder = "Título do item";

  const typeSelect = document.createElement("select");
  const initialType = options.typeId || state.ui.typeId || "";
  fillSelect(typeSelect, state.types, initialType, true, "Sem tipo");

  const areaSelect = document.createElement("select");
  const initialArea = options.areaId || state.ui.areaId || "";
  fillSelect(areaSelect, state.areas, initialArea, true, "Sem área");

  const dueInput = document.createElement("input");
  dueInput.type = "date";
  dueInput.value = options.due || "";

  function applyTypeDefaultsToForm() {
    const type = getType(typeSelect.value);
    if (!type) {
      return;
    }
    if (!dueInput.value && Number.isFinite(type.defaultDueOffsetDays)) {
      dueInput.value = formatDateInput(addDays(new Date(), type.defaultDueOffsetDays));
    }
  }

  typeSelect.addEventListener("change", () => {
    applyTypeDefaultsToForm();
  });

  applyTypeDefaultsToForm();

  const row = document.createElement("div");
  row.className = "field-row";
  row.append(buildField("Tipo", typeSelect), buildField("Área", areaSelect));

  openModal({
    eyebrow: "Item",
    title: "Novo item",
    body: [
      buildField("Título", titleInput),
      row,
      buildField("Prazo", dueInput)
    ],
    saveLabel: "Criar item",
    onSave: () => {
      const item = createItem(
        {
          title: titleInput.value.trim() || "Novo item",
          typeId: typeSelect.value || null,
          areaId: areaSelect.value || null,
          due: dueInput.value || ""
        },
        { inbox: options.inbox }
      );
      state.items.unshift(item);
      state.selectedItemId = item.id;
      saveState();
      renderAll();
      el.itemTitle.focus();
      return true;
    }
  });
}

function setAreaFilter(id) {
  state.ui.areaId = id || null;
  saveState();
  renderMain();
  renderSidebar();
}

function setTypeFilter(id) {
  state.ui.typeId = id || null;
  saveState();
  renderMain();
  renderSidebar();
}

function setView(id) {
  state.ui.viewId = id || null;
  if (state.ui.viewId) {
    state.ui.specialView = null;
    state.ui.triageMode = false;
  }
  saveState();
  renderMain();
  renderSidebar();
}

function setSpecialView(id) {
  state.ui.specialView = id || null;
  if (state.ui.specialView) {
    state.ui.viewId = null;
  }
  if (state.ui.specialView !== "inbox") {
    state.ui.triageMode = false;
  }
  saveState();
  renderMain();
  renderSidebar();
}

function getFlowCounts() {
  const counts = {
    inbox: 0,
    today: 0,
    next7: 0,
    overdue: 0,
    nodue: 0,
    doing: 0
  };
  const today = dateOnly(new Date());
  const weekEnd = addDays(today, 7);
  state.items.forEach((item) => {
    const status = getItemStatus(item);
    const dueDate = parseDate(item.due);
    if (item.inbox) {
      counts.inbox += 1;
    }
    if (status === "doing") {
      counts.doing += 1;
    }
    if (!item.due) {
      counts.nodue += 1;
      return;
    }
    if (!dueDate) {
      return;
    }
    if (sameDay(dueDate, today)) {
      counts.today += 1;
    }
    if (dueDate >= today && dueDate <= weekEnd) {
      counts.next7 += 1;
    }
    if (dueDate < today && status !== "done") {
      counts.overdue += 1;
    }
  });
  return counts;
}

function canAutoTriage(item) {
  return Boolean(item.areaId || item.typeId);
}

function autoTriageItem(item, options = {}) {
  if (!canAutoTriage(item)) {
    item.inbox = true;
    return;
  }
  if (item.inbox) {
    item.inbox = false;
    if (!options.silent) {
      showToast("Triagem concluída.");
    }
  }
}

function toggleSection(section) {
  if (!state.ui.collapsed) {
    state.ui.collapsed = { areas: false, views: false, types: false };
  }
  state.ui.collapsed[section] = !state.ui.collapsed[section];
  saveState();
  renderSidebar();
}
function openAreaModal(area) {
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "Nome da área";
  nameInput.value = area ? area.name : "";

  openModal({
    eyebrow: "Área",
    title: area ? "Editar área" : "Nova área",
    body: [buildField("Nome", nameInput)],
    onSave: () => {
      const name = nameInput.value.trim();
      if (!name) {
        alert("Informe um nome.");
        return false;
      }
      if (area) {
        area.name = name;
      } else {
        const newArea = { id: uid("area"), name };
        state.areas.push(newArea);
        if (!state.ui.areaId) {
          state.ui.areaId = newArea.id;
        }
      }
      saveState();
      renderAll();
      return true;
    },
    onDelete: area
      ? () => {
          confirmWithModal("Excluir área?", () => {
            state.areas = state.areas.filter((entry) => entry.id !== area.id);
            state.items.forEach((item) => {
              if (item.areaId === area.id) {
                item.areaId = null;
              }
            });
            state.views.forEach((view) => {
              if (view.filters && view.filters.areaId === area.id) {
                view.filters.areaId = null;
              }
            });
            if (state.ui.areaId === area.id) {
              state.ui.areaId = null;
            }
            saveState();
            renderAll();
          }, { confirmLabel: "Excluir" });
          return false;
        }
      : null
  });
}
function openTypeModal(type) {
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "Nome do tipo";
  nameInput.value = type ? type.name : "";

  const baseFeatures = {
    status: true,
    due: true,
    checklist: false,
    progress: false
  };
  const initialFeatures = type ? { ...baseFeatures, ...(type.features || {}) } : baseFeatures;

  const statusToggle = createToggleLine("Status", initialFeatures.status);
  const dueToggle = createToggleLine("Prazo", initialFeatures.due);
  const checklistToggle = createToggleLine("Checklist", initialFeatures.checklist);
  const progressToggle = createToggleLine("Progresso", initialFeatures.progress);

  const featureGroup = document.createElement("div");
  featureGroup.className = "field-list";
  featureGroup.append(statusToggle.wrapper, dueToggle.wrapper, checklistToggle.wrapper, progressToggle.wrapper);

  let localFields = type ? cloneFields(type.customFields) : [];
  const fieldList = document.createElement("div");
  fieldList.className = "field-list";

  const addFieldButton = document.createElement("button");
  addFieldButton.className = "ghost-btn";
  addFieldButton.textContent = "Adicionar campo";
  addFieldButton.addEventListener("click", () => {
    localFields.push({
      id: uid("field"),
      label: "Campo",
      kind: "text",
      options: []
    });
    renderFieldList();
  });

  function renderFieldList() {
    fieldList.innerHTML = "";
    localFields.forEach((field) => {
      const row = document.createElement("div");
      row.className = "field-row-inline";

      const labelInput = document.createElement("input");
      labelInput.type = "text";
      labelInput.value = field.label || "";
      labelInput.placeholder = "Nome do campo";
      labelInput.addEventListener("input", () => {
        field.label = labelInput.value;
      });

      const kindSelect = document.createElement("select");
      ["text", "number", "date", "select", "checkbox"].forEach((kind) => {
        const option = document.createElement("option");
        option.value = kind;
        option.textContent = kind;
        kindSelect.append(option);
      });
      kindSelect.value = field.kind || "text";
      kindSelect.addEventListener("change", () => {
        field.kind = kindSelect.value;
        renderFieldList();
      });

      const optionsInput = document.createElement("input");
      optionsInput.type = "text";
      optionsInput.placeholder = "opcao1, opcao2";
      optionsInput.value = Array.isArray(field.options) ? field.options.join(", ") : "";
      optionsInput.addEventListener("input", () => {
        field.options = parseList(optionsInput.value);
      });
      setHidden(optionsInput, kindSelect.value !== "select");

      const removeButton = document.createElement("button");
      removeButton.className = "mini-btn";
      removeButton.textContent = "x";
      removeButton.addEventListener("click", () => {
        localFields = localFields.filter((entry) => entry.id !== field.id);
        renderFieldList();
      });

      row.append(labelInput, kindSelect, optionsInput, removeButton);
      fieldList.append(row);
    });
  }
  renderFieldList();

  const fieldsSection = document.createElement("div");
  fieldsSection.append(fieldList, addFieldButton);

  const defaultStatusSelect = document.createElement("select");
  [
    { value: "todo", label: STATUS_LABELS.todo },
    { value: "doing", label: STATUS_LABELS.doing },
    { value: "done", label: STATUS_LABELS.done }
  ].forEach((optionData) => {
    const option = document.createElement("option");
    option.value = optionData.value;
    option.textContent = optionData.label;
    defaultStatusSelect.append(option);
  });
  defaultStatusSelect.value = type && type.defaultStatus ? type.defaultStatus : "todo";

  const defaultTagsInput = document.createElement("input");
  defaultTagsInput.type = "text";
  defaultTagsInput.placeholder = "tag1, tag2";
  defaultTagsInput.value = Array.isArray(type?.defaultTags) ? type.defaultTags.join(", ") : "";

  const defaultDueInput = document.createElement("input");
  defaultDueInput.type = "number";
  defaultDueInput.placeholder = "Ex.: 3";
  defaultDueInput.value =
    type && Number.isFinite(type.defaultDueOffsetDays) ? String(type.defaultDueOffsetDays) : "";

  const defaultChecklistInput = document.createElement("textarea");
  defaultChecklistInput.rows = 4;
  defaultChecklistInput.placeholder = "Um item por linha";
  defaultChecklistInput.value = Array.isArray(type?.defaultChecklist)
    ? type.defaultChecklist.join("\n")
    : "";

  const defaultNotesInput = document.createElement("textarea");
  defaultNotesInput.rows = 4;
  defaultNotesInput.placeholder = "Notas padrão";
  defaultNotesInput.value = type && type.defaultNotes ? type.defaultNotes : "";

  openModal({
    eyebrow: "Tipo",
    title: type ? "Editar tipo" : "Novo tipo",
    body: [
      buildField("Nome", nameInput),
      buildSectionLabel("Recursos"),
      featureGroup,
      buildSectionLabel("Campos personalizados"),
      fieldsSection,
      buildSectionLabel("Padrões do tipo"),
      buildField("Status padrão", defaultStatusSelect),
      buildField("Tags padrão", defaultTagsInput),
      buildField("Prazo padrão (dias)", defaultDueInput),
      buildField("Checklist padrão", defaultChecklistInput),
      buildField("Notas padrão", defaultNotesInput)
    ],
    onSave: () => {
      const name = nameInput.value.trim();
      if (!name) {
        alert("Informe um nome.");
        return false;
      }
      const defaultDueOffset = defaultDueInput.value.trim();
      const defaultDueOffsetDays = defaultDueOffset ? Number(defaultDueOffset) : null;
      const defaultChecklist = defaultChecklistInput.value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      const payload = {
        id: type ? type.id : uid("type"),
        name,
        features: {
          status: statusToggle.input.checked,
          due: dueToggle.input.checked,
          checklist: checklistToggle.input.checked,
          progress: progressToggle.input.checked
        },
        customFields: localFields.map(sanitizeField),
        defaultStatus: defaultStatusSelect.value,
        defaultTags: parseList(defaultTagsInput.value),
        defaultDueOffsetDays: Number.isFinite(defaultDueOffsetDays) ? defaultDueOffsetDays : null,
        defaultChecklist,
        defaultNotes: defaultNotesInput.value.trim()
      };
      if (type) {
        Object.assign(type, payload);
      } else {
        state.types.push(payload);
        if (!state.ui.typeId) {
          state.ui.typeId = payload.id;
        }
      }
      saveState();
      renderAll();
      return true;
    },
    onDelete: type
      ? () => {
          confirmWithModal("Excluir tipo?", () => {
            state.types = state.types.filter((entry) => entry.id !== type.id);
            state.items.forEach((item) => {
              if (item.typeId === type.id) {
                item.typeId = null;
              }
            });
            state.views.forEach((view) => {
              if (view.filters && view.filters.typeId === type.id) {
                view.filters.typeId = null;
              }
            });
            if (state.ui.typeId === type.id) {
              state.ui.typeId = null;
            }
            if (state.ui.quickTypeId === type.id) {
              state.ui.quickTypeId = null;
            }
            saveState();
            renderAll();
          }, { confirmLabel: "Excluir" });
          return false;
        }
      : null
  });
}
function openViewModal(view) {
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "Nome da visão";
  nameInput.value = view ? view.name : "";

  const areaSelect = document.createElement("select");
  fillSelect(areaSelect, state.areas, view?.filters?.areaId || "", true, "Qualquer área");

  const typeSelect = document.createElement("select");
  fillSelect(typeSelect, state.types, view?.filters?.typeId || "", true, "Qualquer tipo");

  const statusSelect = document.createElement("select");
  [
    { value: "any", label: "Qualquer" },
    { value: "todo", label: STATUS_LABELS.todo },
    { value: "doing", label: STATUS_LABELS.doing },
    { value: "done", label: STATUS_LABELS.done }
  ].forEach((optionData) => {
    const option = document.createElement("option");
    option.value = optionData.value;
    option.textContent = optionData.label;
    statusSelect.append(option);
  });
  statusSelect.value = view?.filters?.status || "any";

  const dueSelect = document.createElement("select");
  [
    { value: "any", label: "Qualquer" },
    { value: "withdate", label: "Com prazo" },
    { value: "nodate", label: "Sem prazo" },
    { value: "overdue", label: "Atrasado" },
    { value: "today", label: "Hoje" },
    { value: "week", label: "7 dias" }
  ].forEach((optionData) => {
    const option = document.createElement("option");
    option.value = optionData.value;
    option.textContent = optionData.label;
    dueSelect.append(option);
  });
  dueSelect.value = view?.filters?.due || "any";

  const tagInput = document.createElement("input");
  tagInput.type = "text";
  tagInput.placeholder = "tag";
  tagInput.value = view?.filters?.tag || "";

  const layoutSelect = document.createElement("select");
  [
    { value: "list", label: "Lista" },
    { value: "board", label: "Quadro" },
    { value: "calendar", label: "Calendário" }
  ].forEach((optionData) => {
    const option = document.createElement("option");
    option.value = optionData.value;
    option.textContent = optionData.label;
    layoutSelect.append(option);
  });
  layoutSelect.value = view?.layout || state.ui.layout;

  const rowOne = document.createElement("div");
  rowOne.className = "field-row";
  rowOne.append(buildField("Área", areaSelect), buildField("Tipo", typeSelect));

  const rowTwo = document.createElement("div");
  rowTwo.className = "field-row";
  rowTwo.append(buildField("Status", statusSelect), buildField("Prazo", dueSelect));

  const rowThree = document.createElement("div");
  rowThree.className = "field-row";
  rowThree.append(buildField("Layout", layoutSelect), buildField("Tag", tagInput));

  const cardDefaults = defaultCardFields();
  const cardFields = view && view.cardFields ? view.cardFields : cardDefaults;
  const cardSection = buildSectionLabel("Campos no card");
  const cardToggleType = createToggleLine("Tipo", cardFields.showType);
  const cardToggleArea = createToggleLine("Área", cardFields.showArea);
  const cardToggleStatus = createToggleLine("Status", cardFields.showStatus);
  const cardToggleDue = createToggleLine("Prazo", cardFields.showDue);
  const cardToggleProgress = createToggleLine("Progresso", cardFields.showProgress);
  const cardToggleTags = createToggleLine("Tags", cardFields.showTags);

  openModal({
    eyebrow: "Visão",
    title: view ? "Editar visão" : "Nova visão",
    body: [
      buildField("Nome", nameInput),
      rowOne,
      rowTwo,
      rowThree,
      cardSection,
      cardToggleType.wrapper,
      cardToggleArea.wrapper,
      cardToggleStatus.wrapper,
      cardToggleDue.wrapper,
      cardToggleProgress.wrapper,
      cardToggleTags.wrapper
    ],
    onSave: () => {
      const name = nameInput.value.trim();
      if (!name) {
        alert("Informe um nome.");
        return false;
      }
      const filters = {
        areaId: areaSelect.value || null,
        typeId: typeSelect.value || null,
        status: statusSelect.value || "any",
        due: dueSelect.value || "any",
        tag: tagInput.value.trim() || null
      };
      const payload = {
        id: view ? view.id : uid("view"),
        name,
        filters,
        layout: layoutSelect.value,
        cardFields: {
          showType: cardToggleType.input.checked,
          showArea: cardToggleArea.input.checked,
          showStatus: cardToggleStatus.input.checked,
          showDue: cardToggleDue.input.checked,
          showProgress: cardToggleProgress.input.checked,
          showTags: cardToggleTags.input.checked
        }
      };
      if (view) {
        Object.assign(view, payload);
      } else {
        state.views.push(payload);
        state.ui.viewId = payload.id;
      }
      saveState();
      renderAll();
      return true;
    },
    onDelete: view
      ? () => {
          confirmWithModal("Excluir visão?", () => {
            state.views = state.views.filter((entry) => entry.id !== view.id);
            if (state.ui.viewId === view.id) {
              state.ui.viewId = null;
            }
            saveState();
            renderAll();
          }, { confirmLabel: "Excluir" });
          return false;
        }
      : null
  });
}

function applyAuthState() {
  showAuthScreen(!auth.token);
}

function showAuthScreen(show) {
  if (!el.authScreen || !el.appRoot) {
    return;
  }
  setHidden(el.authScreen, !show);
  setHidden(el.appRoot, show);
  if (show) {
    if (el.authApiUrl) {
      el.authApiUrl.value = remote.url || "";
    }
    setAuthTab(authUi.tab);
  }
}

function setAuthTab(tab) {
  const next = tab === "register" ? "register" : "login";
  authUi.tab = next;
  const isLogin = next === "login";
  if (el.authTabLogin) {
    el.authTabLogin.classList.toggle("active", isLogin);
  }
  if (el.authTabRegister) {
    el.authTabRegister.classList.toggle("active", !isLogin);
  }
  setHidden(el.loginForm, !isLogin);
  setHidden(el.registerForm, isLogin);
  setAuthMessage("");
}

function setAuthMessage(message, isError = false) {
  if (!el.authMessage) {
    return;
  }
  el.authMessage.textContent = message || "";
  el.authMessage.classList.toggle("error", Boolean(isError));
}

function setAuthBusy(busy) {
  authUi.busy = busy;
  [el.loginForm, el.registerForm].forEach((form) => {
    if (!form) {
      return;
    }
    form.querySelectorAll("input, button").forEach((node) => {
      node.disabled = busy;
    });
  });
}

function applyAuthUrl() {
  const url = el.authApiUrl ? el.authApiUrl.value.trim() : remote.url || "";
  if (url !== remote.url) {
    remote.url = url;
    saveRemoteConfig();
  }
  return url;
}

async function handleLogin(event) {
  event.preventDefault();
  if (authUi.busy) {
    return;
  }
  const apiUrl = applyAuthUrl();
  if (!apiUrl) {
    setAuthMessage("Informe a URL da API.", true);
    return;
  }
  const email = el.loginEmail ? el.loginEmail.value.trim() : "";
  const password = el.loginPassword ? el.loginPassword.value : "";
  if (!email || !password) {
    setAuthMessage("Informe email e senha.", true);
    return;
  }

  setAuthBusy(true);
  setAuthMessage("Entrando...");
  const result = await authRequest("/auth/login", { email, password });
  if (!result.ok) {
    setAuthBusy(false);
    setAuthMessage(result.error, true);
    return;
  }
  setAuthMessage("Carregando dados...");
  await completeAuth(result.data);
  setAuthBusy(false);
}

async function handleRegister(event) {
  event.preventDefault();
  if (authUi.busy) {
    return;
  }
  const apiUrl = applyAuthUrl();
  if (!apiUrl) {
    setAuthMessage("Informe a URL da API.", true);
    return;
  }
  const name = el.registerName ? el.registerName.value.trim() : "";
  const email = el.registerEmail ? el.registerEmail.value.trim() : "";
  const password = el.registerPassword ? el.registerPassword.value : "";
  if (!name || !email || !password) {
    setAuthMessage("Preencha nome, email e senha.", true);
    return;
  }

  setAuthBusy(true);
  setAuthMessage("Criando conta...");
  const result = await authRequest("/auth/register", { name, email, password });
  if (!result.ok) {
    setAuthBusy(false);
    setAuthMessage(result.error, true);
    return;
  }
  setAuthMessage("Carregando dados...");
  await completeAuth(result.data);
  setAuthBusy(false);
}

async function completeAuth(data) {
  auth = normalizeAuth({ token: data.token, user: data.user });
  saveAuth();
  remote.lastError = "";
  saveRemoteConfig();
  await syncAfterAuth();
  showAuthScreen(false);
}

async function syncAfterAuth() {
  if (!remote.url || !auth.token || !remote.autoSync) {
    return;
  }
  const result = await pullState();
  if (!result.ok && result.code === "empty") {
    await pushState();
  }
}

async function authRequest(path, payload) {
  const url = buildApiUrl(path);
  if (!url) {
    return { ok: false, error: "Informe a URL da API." };
  }
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const code = data && data.error ? data.error : `HTTP ${response.status}`;
      return { ok: false, error: mapAuthError(code) };
    }
    if (!data || !data.token) {
      return { ok: false, error: "Resposta inválida." };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, error: "Falha de rede." };
  }
}

function mapAuthError(code) {
  if (code === "invalid_payload") {
    return "Preencha todos os campos.";
  }
  if (code === "invalid_email") {
    return "Email inválido.";
  }
  if (code === "weak_password") {
    return "Senha muito curta.";
  }
  if (code === "email_taken") {
    return "Email já cadastrado.";
  }
  if (code === "invalid_credentials") {
    return "Email ou senha incorretos.";
  }
  if (code && code.startsWith("HTTP")) {
    return code;
  }
  return "Falha ao autenticar.";
}

function handleLogout() {
  clearAuth();
  remote.lastError = "";
  saveRemoteConfig();
  applyAuthState();
  setAuthMessage("Sessão encerrada.");
}

function handleAuthFailure(message) {
  clearAuth();
  applyAuthState();
  setAuthMessage(message || "Sessão expirada.", true);
}

function openSettingsModal() {
  const info = document.createElement("div");
  info.className = "list-meta";
  info.textContent = "Backup local do navegador.";

  const textArea = document.createElement("textarea");
  textArea.rows = 10;
  textArea.placeholder = "Cole o JSON aqui para importar.";

  const exportButton = document.createElement("button");
  exportButton.className = "ghost-btn";
  exportButton.textContent = "Gerar JSON";
  exportButton.addEventListener("click", () => {
    textArea.value = JSON.stringify(state, null, 2);
  });

  const importButton = document.createElement("button");
  importButton.className = "ghost-btn";
  importButton.textContent = "Importar JSON";
  importButton.addEventListener("click", () => {
    const raw = textArea.value.trim();
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      state = normalizeSelection(normalizeState(parsed));
      saveState({ skipSync: true });
      renderAll();
      textArea.value = "";
    } catch (error) {
      alert("JSON inválido.");
    }
  });

  const resetButton = document.createElement("button");
  resetButton.className = "ghost-btn danger";
  resetButton.textContent = "Limpar tudo";
  resetButton.addEventListener("click", () => {
    confirmWithModal("Limpar todos os dados?", () => {
      state = normalizeSelection(defaultState());
      saveState();
      renderAll();
      closeModal();
    }, { confirmLabel: "Limpar" });
  });

  const actionRow = document.createElement("div");
  actionRow.className = "main-actions";
  actionRow.append(exportButton, importButton, resetButton);

  const syncLabel = buildSectionLabel("Sincronização online");

  const urlInput = document.createElement("input");
  urlInput.type = "text";
  urlInput.placeholder = "https://sua-api.com";
  urlInput.value = remote.url || "";

  const autoToggle = createToggleLine("Sincronização automática", remote.autoSync);

  const authStatus = document.createElement("div");
  authStatus.className = "list-meta";
  authStatus.textContent = auth.user
    ? `Conectado como ${auth.user.name || auth.user.email}`
    : "Sem login";

  const authButton = document.createElement("button");
  authButton.className = "ghost-btn";
  authButton.textContent = auth.user ? "Sair" : "Entrar";

  const authRow = document.createElement("div");
  authRow.className = "main-actions";
  authRow.append(authButton);

  const syncStatus = document.createElement("div");
  syncStatus.className = "list-meta";
  syncStatus.textContent = buildSyncStatus();

  const syncRow = document.createElement("div");
  syncRow.className = "main-actions";

  const testButton = document.createElement("button");
  testButton.className = "ghost-btn";
  testButton.textContent = "Testar";

  const pullButton = document.createElement("button");
  pullButton.className = "ghost-btn";
  pullButton.textContent = "Baixar";

  const pushButton = document.createElement("button");
  pushButton.className = "ghost-btn";
  pushButton.textContent = "Enviar";

  syncRow.append(testButton, pullButton, pushButton);

  function applyRemoteInputs() {
    remote.url = urlInput.value.trim();
    remote.autoSync = autoToggle.input.checked;
    saveRemoteConfig();
    if (el.authApiUrl) {
      el.authApiUrl.value = remote.url || "";
    }
  }

  function refreshSyncStatus(message) {
    syncStatus.textContent = message || buildSyncStatus();
  }

  testButton.addEventListener("click", async () => {
    applyRemoteInputs();
    refreshSyncStatus("Testando...");
    const result = await testConnection();
    refreshSyncStatus(result.ok ? "Conectado" : buildSyncStatus());
  });

  pullButton.addEventListener("click", async () => {
    applyRemoteInputs();
    refreshSyncStatus("Baixando...");
    const result = await pullState();
    refreshSyncStatus(result.ok ? "Dados atualizados" : buildSyncStatus());
  });

  pushButton.addEventListener("click", async () => {
    applyRemoteInputs();
    refreshSyncStatus("Enviando...");
    const result = await pushState();
    refreshSyncStatus(result.ok ? "Dados enviados" : buildSyncStatus());
  });

  authButton.addEventListener("click", () => {
    closeModal();
    if (auth.user) {
      handleLogout();
      return;
    }
    showAuthScreen(true);
  });

  openModal({
    eyebrow: "Ajustes",
    title: "Ajustes",
    body: [
      info,
      actionRow,
      textArea,
      syncLabel,
      buildField("API URL", urlInput),
      autoToggle.wrapper,
      authStatus,
      authRow,
      syncStatus,
      syncRow
    ],
    saveLabel: "Salvar ajustes",
    onSave: () => {
      applyRemoteInputs();
      return true;
    }
  });
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

function handleModalKeydown(event) {
  if (!isModalOpen()) {
    return;
  }
  if (event.key === "Escape") {
    event.preventDefault();
    closeModal();
    return;
  }
  if (event.key === "Tab") {
    trapTabKey(event);
  }
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

// Abre um modal de confirmação acessível. `onConfirm` é executado quando
// o usuário confirma. Retorna sem bloquear (modal lida com o fluxo).
function confirmWithModal(message, onConfirm, options = {}) {
  const desc = document.createElement("div");
  desc.textContent = message;
  openModal({
    eyebrow: "Confirmar",
    title: message,
    body: [desc],
    saveLabel: options.confirmLabel || "Confirmar",
    onSave: () => {
      try {
        onConfirm();
      } catch (e) {
        console.error(e);
      }
      return true;
    },
    onDelete: null
  });
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

function handleGlobalShortcuts(event) {
  if (commandState.open) {
    handleCommandPaletteKeydown(event);
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    openCommandPalette();
  }
}

function handleGlobalClick(event) {
  if (openMenu && !openMenu.contains(event.target)) {
    openMenu.classList.add("hidden");
    openMenu = null;
  }
  if (commandState.open && el.commandPalette) {
    const card = el.commandPalette.querySelector(".command-card");
    if (card && !card.contains(event.target)) {
      closeCommandPalette();
    }
  }
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
  const restoreFocus = options.restoreFocus !== false;
  commandState.open = false;
  el.commandPalette.classList.add("hidden");
  el.commandInput.removeEventListener("input", handleCommandInput);
  if (restoreFocus && commandState.previousFocus && document.body.contains(commandState.previousFocus)) {
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
    if (!commandState.filtered.length) {
      return;
    }
    event.preventDefault();
    commandState.index = Math.min(commandState.index + 1, commandState.filtered.length - 1);
    renderCommandList();
    return;
  }
  if (event.key === "ArrowUp") {
    if (!commandState.filtered.length) {
      return;
    }
    event.preventDefault();
    commandState.index = Math.max(commandState.index - 1, 0);
    renderCommandList();
    return;
  }
  if (event.key === "Enter") {
    event.preventDefault();
    const command = commandState.filtered[commandState.index];
    if (command) {
      closeCommandPalette();
      command.action();
    }
  }
}

function renderCommandList() {
  if (!el.commandList) {
    return;
  }
  el.commandList.innerHTML = "";
  if (!commandState.filtered.length) {
    const empty = document.createElement("div");
    empty.className = "list-meta";
    empty.textContent = "Nenhum comando encontrado.";
    el.commandList.append(empty);
    return;
  }
  commandState.index = Math.min(commandState.index, commandState.filtered.length - 1);
  commandState.filtered.forEach((command, index) => {
    const row = document.createElement("div");
    row.className = "command-item";
    if (index === commandState.index) {
      row.classList.add("active");
    }
    const label = document.createElement("div");
    label.textContent = command.label;
    const hint = document.createElement("div");
    hint.className = "command-hint";
    hint.textContent = command.hint || "";
    row.append(label, hint);
    row.addEventListener("click", () => {
      closeCommandPalette();
      command.action();
    });
    el.commandList.append(row);
  });
}

function buildCommands() {
  return [
    {
      label: "Criar item",
      hint: "Novo item",
      action: () => openNewItemModal()
    },
    ...FLOW_VIEWS.map((flow) => ({
      label: `Ir para ${flow.label}`,
      hint: "Fluxo",
      action: () => setSpecialView(flow.id)
    })),
    {
      label: "Layout: Lista",
      hint: "Visualização",
      action: () => setLayout("list")
    },
    {
      label: "Layout: Quadro",
      hint: "Visualização",
      action: () => setLayout("board")
    },
    {
      label: "Layout: Calendário",
      hint: "Visualização",
      action: () => setLayout("calendar")
    },
    {
      label: "Criar área",
      hint: "Sidebar",
      action: () => openAreaModal()
    },
    {
      label: "Criar tipo",
      hint: "Sidebar",
      action: () => openTypeModal()
    },
    {
      label: "Criar visão",
      hint: "Sidebar",
      action: () => openViewModal()
    },
    {
      label: "Buscar",
      hint: "Focar busca",
      action: () => el.globalSearch.focus()
    }
  ];
}

function setLayout(layout) {
  const view = getCurrentView();
  if (view) {
    view.layout = layout;
  }
  state.ui.layout = layout;
  saveState();
  renderMain();
}

function createItemCard(item, options = {}) {
  const mode = options.mode || "list";
  const listIds = Array.isArray(options.listIds) ? options.listIds : [];
  const index = Number.isFinite(options.index) ? options.index : null;
  const selection = getSelectionSet();
  const selectionActive = selection.size > 0;

  const card = document.createElement("div");
  card.className = `item-card${item.id === state.selectedItemId ? " active" : ""}`;
  card.dataset.mode = mode;
  if (selection.has(item.id)) {
    card.classList.add("selected");
  }
  if (selectionActive) {
    card.classList.add("selection-active");
  }
  card.setAttribute("role", "button");
  card.tabIndex = 0;

  const selectItem = () => {
    state.selectedItemId = item.id;
    saveState();
    renderMain();
    renderDetails();
  };

  const handleSelectionClick = (event) => {
    if (mode !== "list") {
      return false;
    }
    if (event.shiftKey) {
      event.preventDefault();
      selectRange(index, listIds);
      return true;
    }
    if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      toggleSelection(item.id, index);
      return true;
    }
    return false;
  };

  card.addEventListener("click", (event) => {
    if (event.target.closest("button") || event.target.closest("input")) {
      return;
    }
    if (handleSelectionClick(event)) {
      return;
    }
    selectItem();
  });
  card.addEventListener("keydown", (event) => {
    if (event.target !== card) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectItem();
    }
  });

  card.draggable = mode !== "calendar";
  card.addEventListener("dragstart", (event) => {
    if (event.dataTransfer) {
      event.dataTransfer.setData("text/plain", item.id);
      event.dataTransfer.effectAllowed = "move";
    }
  });

  const selectWrap = document.createElement("div");
  selectWrap.className = "card-select";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = selection.has(item.id);
  checkbox.addEventListener("click", (event) => event.stopPropagation());
  checkbox.addEventListener("change", () => toggleSelection(item.id, index));
  selectWrap.append(checkbox);

  const info = document.createElement("div");
  const title = document.createElement("div");
  title.className = "item-title";
  title.textContent = item.title || "Sem título";
  const meta = document.createElement("div");
  meta.className = "item-meta";

  const cardFields = getCardFieldConfig();
  const type = getType(item.typeId);
  if (type && cardFields.showType) {
    meta.append(createBadge(type.name));
  }
  const area = getArea(item.areaId);
  if (area && cardFields.showArea) {
    meta.append(createBadge(area.name));
  }
  if (item.due && cardFields.showDue) {
    meta.append(createBadge(`Prazo ${item.due}`));
  }
  if (cardFields.showStatus) {
    const statusLabel = STATUS_LABELS[getItemStatus(item)];
    if (statusLabel) {
      if (mode === "list") {
        const statusButton = document.createElement("button");
        statusButton.type = "button";
        statusButton.className = "badge badge-action";
        statusButton.textContent = statusLabel;
        statusButton.setAttribute("aria-label", "Alternar status");
        statusButton.addEventListener("click", (event) => {
          event.stopPropagation();
          cycleItemStatus(item);
        });
        statusButton.addEventListener("keydown", (event) => {
          event.stopPropagation();
        });
        meta.append(statusButton);
      } else {
        meta.append(createBadge(statusLabel));
      }
    }
  }
  if (item.progress && cardFields.showProgress) {
    meta.append(createBadge(`${item.progress}%`));
  }
  if (item.recurrence) {
    const recurBadge = createBadge("↻");
    recurBadge.title = "Recorrência";
    meta.append(recurBadge);
  }
  if (item.recurrenceParentId) {
    meta.append(createBadge("Gerado"));
  }
  if (cardFields.showTags) {
    (item.tags || []).slice(0, 3).forEach((tag) => {
      meta.append(createBadge(`#${tag}`));
    });
  }

  info.append(title, meta);

  const side = document.createElement("div");
  side.className = "item-side";
  const updated = document.createElement("div");
  updated.className = "list-meta";
  updated.textContent = formatUpdated(item.updatedAt);
  if (mode === "list") {
    const snooze = createSnoozeMenu(item, { label: "Adiar", compact: true });
    side.append(snooze, updated);
  } else {
    side.append(updated);
  }

  card.append(selectWrap, info, side);
  return card;
}

function updateItemStatus(item, status, options = {}) {
  const current = getItemStatus(item);
  if (current === status) {
    return;
  }
  item.status = status;
  touchItem(item);
  if (status === "done") {
    maybeGenerateRecurringItem(item);
  }
  saveState();
  renderSidebar();
  renderMain();
  if (state.selectedItemId === item.id) {
    renderDetails();
  }
  if (!options.silent) {
    showToast(`Status atualizado para ${STATUS_LABELS[status] || status}.`);
  }
}

function cycleItemStatus(item) {
  const current = getItemStatus(item);
  const index = STATUS_ORDER.indexOf(current);
  const next = STATUS_ORDER[(index + 1) % STATUS_ORDER.length] || STATUS_ORDER[0];
  updateItemStatus(item, next);
}

function maybeGenerateRecurringItem(item) {
  if (!item.recurrence) {
    return;
  }
  const alreadyGenerated = state.items.some(
    (entry) => entry.recurrenceParentId && entry.recurrenceParentId === item.id
  );
  if (alreadyGenerated) {
    return;
  }
  const nextDue = computeNextDueDate(item);
  const nextChecklist = Array.isArray(item.checklist)
    ? item.checklist.map((entry) => ({
        id: uid("check"),
        text: entry.text || "",
        done: false
      }))
    : [];
  const nextItem = createItem(
    {
      title: item.title || "Novo item",
      typeId: item.typeId || null,
      areaId: item.areaId || null,
      tags: Array.isArray(item.tags) ? [...item.tags] : [],
      notes: item.notes || "",
      due: nextDue || "",
      status: "todo",
      progress: 0,
      checklist: nextChecklist,
      custom: {}
    },
    { inbox: false, applyDefaults: false }
  );
  nextItem.recurrence = item.recurrence;
  nextItem.recurrenceParentId = item.id;
  state.items.unshift(nextItem);
  showToast("Recorrência criada.");
}

function computeNextDueDate(item) {
  const base = parseDate(item.due) || dateOnly(new Date());
  if (!item.recurrence || !item.recurrence.freq) {
    return "";
  }
  const freq = item.recurrence.freq;
  if (freq === "daily") {
    return formatDateInput(addDays(base, 1));
  }
  if (freq === "weekly") {
    return formatDateInput(addDays(base, 7));
  }
  if (freq === "monthly") {
    return formatDateInput(addMonths(base, 1));
  }
  if (freq === "interval") {
    const interval = Number(item.recurrence.intervalDays) || 1;
    return formatDateInput(addDays(base, interval));
  }
  return "";
}

function addMonths(date, amount) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const targetMonth = month + amount;
  const lastDay = new Date(year, targetMonth + 1, 0).getDate();
  const safeDay = Math.min(day, lastDay);
  return new Date(year, targetMonth, safeDay);
}

function createBadge(text) {
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = text;
  return badge;
}

function createSnoozeMenu(item, options = {}) {
  const wrapper = document.createElement("div");
  wrapper.className = "snooze";

  const button = document.createElement("button");
  button.type = "button";
  button.className = options.compact ? "mini-btn" : "ghost-btn";
  button.textContent = options.label || "Adiar";
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleMenu(menu);
  });

  const menu = document.createElement("div");
  menu.className = "snooze-menu hidden";

  const today = formatDateInput(new Date());
  const tomorrow = formatDateInput(addDays(new Date(), 1));
  const nextWeek = formatDateInput(addDays(new Date(), 7));

  menu.append(
    buildSnoozeAction("Mais tarde (hoje)", () => {
      applySnooze(item, today);
      toggleMenu(menu, false);
    }),
    buildSnoozeAction("Amanhã", () => {
      applySnooze(item, tomorrow);
      toggleMenu(menu, false);
    }),
    buildSnoozeAction("Próxima semana", () => {
      applySnooze(item, nextWeek);
      toggleMenu(menu, false);
    })
  );

  const customWrap = document.createElement("div");
  const customLabel = document.createElement("div");
  customLabel.className = "list-meta";
  customLabel.textContent = "Escolher data";
  const customInput = document.createElement("input");
  customInput.type = "date";
  customInput.addEventListener("change", () => {
    if (!customInput.value) {
      return;
    }
    applySnooze(item, customInput.value);
    toggleMenu(menu, false);
  });
  customWrap.append(customLabel, customInput);
  menu.append(customWrap);

  wrapper.append(button, menu);
  return wrapper;
}

function buildSnoozeAction(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "ghost-btn";
  button.textContent = label;
  button.addEventListener("click", () => {
    onClick();
  });
  return button;
}

function applySnooze(item, dateValue) {
  item.due = dateValue;
  touchItem(item);
  saveState();
  renderMain();
  if (state.selectedItemId === item.id) {
    renderDetails();
  }
  showToast(`Prazo definido para ${formatDateDisplay(dateValue)}.`);
}

function toggleMenu(menu, shouldOpen) {
  const isOpen = !menu.classList.contains("hidden");
  const openNow = typeof shouldOpen === "boolean" ? shouldOpen : !isOpen;
  if (openMenu && openMenu !== menu) {
    openMenu.classList.add("hidden");
  }
  if (openNow) {
    menu.classList.remove("hidden");
    openMenu = menu;
  } else {
    menu.classList.add("hidden");
    if (openMenu === menu) {
      openMenu = null;
    }
  }
}

function createListItem({ name, count, active, onSelect, onEdit, icon, extraClass }) {
  const item = document.createElement("div");
  const extra = extraClass ? ` ${extraClass}` : "";
  item.className = `list-item${active ? " active" : ""}${extra}`;
  item.setAttribute("role", "button");
  item.tabIndex = 0;
  item.addEventListener("click", onSelect);
  item.addEventListener("keydown", (event) => {
    if (event.target !== item) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect();
    }
  });

  const content = document.createElement("div");
  const title = document.createElement("div");
  title.textContent = name;
  const meta = document.createElement("div");
  meta.className = "list-meta";
  meta.textContent = String(count);
  if (icon) {
    const iconEl = document.createElement("span");
    iconEl.className = "list-icon";
    iconEl.textContent = icon;
    const row = document.createElement("div");
    row.className = "list-row";
    row.append(iconEl, title);
    content.append(row, meta);
  } else {
    content.append(title, meta);
  }

  item.append(content);

  if (onEdit) {
    const editButton = document.createElement("button");
    editButton.className = "mini-btn";
    editButton.textContent = "...";
    editButton.addEventListener("click", (event) => {
      event.stopPropagation();
      onEdit();
    });
    item.append(editButton);
  }

  return item;
}

function buildField(labelText, inputEl) {
  const label = document.createElement("label");
  label.className = "field";
  const span = document.createElement("span");
  span.textContent = labelText;
  label.append(span, inputEl);
  return label;
}

function buildSectionLabel(text) {
  const label = document.createElement("div");
  label.className = "eyebrow";
  label.textContent = text;
  return label;
}

function createToggleLine(text, checked) {
  const wrapper = document.createElement("div");
  wrapper.className = "check-item";
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = Boolean(checked);
  const label = document.createElement("span");
  label.textContent = text;
  wrapper.append(input, label);
  return { wrapper, input };
}

function fillSelect(select, options, selected, allowEmpty, emptyLabel) {
  select.innerHTML = "";
  if (allowEmpty) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = emptyLabel || "Nenhum";
    select.append(option);
  }
  options.forEach((entry) => {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = entry.name;
    select.append(option);
  });
  select.value = selected || "";
}

function getCurrentView() {
  return state.views.find((view) => view.id === state.ui.viewId) || null;
}

function defaultCardFields() {
  return {
    showType: true,
    showArea: true,
    showStatus: true,
    showDue: true,
    showProgress: true,
    showTags: true
  };
}

function getCardFieldConfig() {
  const view = getCurrentView();
  if (view && view.cardFields) {
    return view.cardFields;
  }
  return defaultCardFields();
}

function getSelectedItem() {
  return state.items.find((item) => item.id === state.selectedItemId) || null;
}

function getArea(id) {
  return state.areas.find((area) => area.id === id) || null;
}

function getType(id) {
  return state.types.find((type) => type.id === id) || null;
}

function getCurrentLayout() {
  const view = getCurrentView();
  if (view && ["list", "board", "calendar"].includes(view.layout)) {
    return view.layout;
  }
  return state.ui.layout;
}
function getFilteredItems() {
  let items = [...state.items];
  const view = getCurrentView();

  if (state.ui.areaId) {
    items = items.filter((item) => item.areaId === state.ui.areaId);
  }
  if (state.ui.typeId) {
    items = items.filter((item) => item.typeId === state.ui.typeId);
  }
  if (state.ui.specialView) {
    items = items.filter((item) => matchesSpecialView(item, state.ui.specialView));
  }
  if (view) {
    items = items.filter((item) => matchViewFilters(item, view));
  }
  if (state.ui.search) {
    items = items.filter((item) => matchesSearch(item, state.ui.search));
  }

  return sortItems(items);
}

function getItemsForView(view) {
  return state.items.filter((item) => matchViewFilters(item, view));
}

function matchViewFilters(item, view) {
  const filters = view.filters || {};
  if (filters.areaId && item.areaId !== filters.areaId) {
    return false;
  }
  if (filters.typeId && item.typeId !== filters.typeId) {
    return false;
  }
  if (filters.status && filters.status !== "any" && getItemStatus(item) !== filters.status) {
    return false;
  }
  if (filters.tag) {
    const tags = item.tags || [];
    if (!tags.includes(filters.tag)) {
      return false;
    }
  }
  if (!matchDueFilter(item.due, filters.due || "any")) {
    return false;
  }
  return true;
}

function matchesSpecialView(item, specialView) {
  const today = dateOnly(new Date());
  const dueDate = parseDate(item.due);
  const status = getItemStatus(item);
  if (specialView === "inbox") {
    return Boolean(item.inbox);
  }
  if (specialView === "today") {
    return Boolean(dueDate && sameDay(dueDate, today));
  }
  if (specialView === "next7") {
    if (!dueDate) {
      return false;
    }
    const end = addDays(today, 7);
    return dueDate >= today && dueDate <= end;
  }
  if (specialView === "overdue") {
    return Boolean(dueDate && dueDate < today && status !== "done");
  }
  if (specialView === "nodue") {
    return !item.due;
  }
  if (specialView === "doing") {
    return status === "doing";
  }
  return true;
}

function getSpecialViewLabel(value) {
  const entry = FLOW_VIEWS.find((flow) => flow.id === value);
  return entry ? entry.label : "Fluxo";
}

function matchesSearch(item, query) {
  const value = query.trim().toLowerCase();
  if (!value) {
    return true;
  }
  const area = getArea(item.areaId);
  const type = getType(item.typeId);
  const haystack = [
    item.title,
    item.notes,
    (item.tags || []).join(" "),
    area ? area.name : "",
    type ? type.name : ""
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(value);
}

function sortItems(items) {
  const sorted = [...items];
  if (state.ui.sort === "title") {
    sorted.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    return sorted;
  }
  if (state.ui.sort === "due") {
    sorted.sort((a, b) => {
      const dateA = parseDate(a.due);
      const dateB = parseDate(b.due);
      if (!dateA && !dateB) {
        return 0;
      }
      if (!dateA) {
        return 1;
      }
      if (!dateB) {
        return -1;
      }
      return dateA - dateB;
    });
    return sorted;
  }
  sorted.sort((a, b) => {
    const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return timeB - timeA;
  });
  return sorted;
}

function buildMainTitle() {
  const view = getCurrentView();
  let title = state.ui.specialView
    ? getSpecialViewLabel(state.ui.specialView)
    : view
      ? view.name
      : "Tudo";
  const parts = [];
  if (state.ui.areaId) {
    const area = getArea(state.ui.areaId);
    if (area) {
      parts.push(area.name);
    }
  }
  if (state.ui.typeId) {
    const type = getType(state.ui.typeId);
    if (type) {
      parts.push(type.name);
    }
  }
  if (parts.length) {
    title = `${title} - ${parts.join(" / ")}`;
  }
  return title;
}

function getItemStatus(item) {
  const status = item.status || "todo";
  return STATUS_ORDER.includes(status) ? status : "todo";
}

function matchDueFilter(value, filter) {
  if (!filter || filter === "any") {
    return true;
  }
  const hasDue = Boolean(value);
  if (filter === "withdate") {
    return hasDue;
  }
  if (filter === "nodate") {
    return !hasDue;
  }
  if (!hasDue) {
    return false;
  }
  const dueDate = parseDate(value);
  if (!dueDate) {
    return false;
  }
  const today = dateOnly(new Date());
  if (filter === "overdue") {
    return dueDate < today;
  }
  if (filter === "today") {
    return sameDay(dueDate, today);
  }
  if (filter === "week") {
    const end = addDays(today, 7);
    return dueDate >= today && dueDate <= end;
  }
  return true;
}
function parseQuickInput(text) {
  const parts = text.trim().split(/\s+/);
  const tags = [];
  let due = "";
  const titleParts = [];
  parts.forEach((part) => {
    if (part.startsWith("#")) {
      const tag = part.slice(1).trim().toLowerCase();
      if (tag) {
        tags.push(tag);
      }
      return;
    }
    if (part.startsWith("@")) {
      const parsed = parseDueToken(part);
      if (parsed) {
        due = parsed;
        return;
      }
    }
    titleParts.push(part);
  });
  const title = titleParts.join(" ").trim() || text.trim();
  return { title, tags, due };
}

function parseDueToken(token) {
  const lower = token.toLowerCase();
  if (lower === "@today") {
    return formatDateInput(new Date());
  }
  if (lower === "@tomorrow") {
    return formatDateInput(addDays(new Date(), 1));
  }
  if (/^@\d{4}-\d{2}-\d{2}$/.test(lower)) {
    return lower.slice(1);
  }
  return "";
}

function createItem(data = {}, options = {}) {
  const typeId = data.typeId || null;
  const areaId = data.areaId || null;
  const item = {
    id: uid("item"),
    title: data.title || "Novo item",
    typeId,
    areaId,
    status: data.status || "todo",
    due: data.due || "",
    tags: Array.isArray(data.tags) ? data.tags : [],
    notes: data.notes || "",
    progress: data.progress || 0,
    checklist: Array.isArray(data.checklist) ? data.checklist : [],
    custom: data.custom && typeof data.custom === "object" ? data.custom : {},
    inbox: typeof options.inbox === "boolean" ? options.inbox : !(typeId || areaId),
    recurrence: data.recurrence || null,
    recurrenceParentId: data.recurrenceParentId || null,
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  if (options.applyDefaults !== false && typeId) {
    applyTypeDefaults(item, getType(typeId), {
      hasExplicitDue: Boolean(data.due),
      hasExplicitStatus: Boolean(data.status),
      hasExplicitNotes: Boolean(data.notes),
      hasExplicitChecklist: Array.isArray(data.checklist) && data.checklist.length > 0,
      hasExplicitTags: Array.isArray(data.tags) && data.tags.length > 0
    });
  }
  item.inbox = typeof options.inbox === "boolean" ? options.inbox : !(item.typeId || item.areaId);
  return item;
}

function applyTypeDefaults(item, type, options = {}) {
  if (!type) {
    return;
  }
  const hasExplicitStatus = Boolean(options.hasExplicitStatus);
  const hasExplicitTags = Boolean(options.hasExplicitTags);
  const hasExplicitDue = Boolean(options.hasExplicitDue);
  const hasExplicitNotes = Boolean(options.hasExplicitNotes);
  const hasExplicitChecklist = Boolean(options.hasExplicitChecklist);

  if (!hasExplicitStatus && type.defaultStatus) {
    item.status = type.defaultStatus;
  }

  const tags = new Set([...(type.defaultTags || []), ...(item.tags || [])]);
  item.tags = Array.from(tags).filter(Boolean);

  if (!hasExplicitDue && !item.due && Number.isFinite(type.defaultDueOffsetDays)) {
    item.due = formatDateInput(addDays(new Date(), type.defaultDueOffsetDays));
  }

  if (!hasExplicitNotes && !item.notes && type.defaultNotes) {
    item.notes = type.defaultNotes;
  }

  if (
    !hasExplicitChecklist &&
    (!item.checklist || item.checklist.length === 0) &&
    type.features &&
    type.features.checklist
  ) {
    const defaults = Array.isArray(type.defaultChecklist) ? type.defaultChecklist : [];
    if (defaults.length) {
      item.checklist = defaults.map((text) => ({
        id: uid("check"),
        text: String(text),
        done: false
      }));
    }
  }
}

function sanitizeField(field) {
  const label = field.label && field.label.trim() ? field.label.trim() : "Campo";
  const kindList = ["text", "number", "date", "select", "checkbox"];
  const kind = kindList.includes(field.kind) ? field.kind : "text";
  return {
    id: field.id || uid("field"),
    label,
    kind,
    options: kind === "select" ? parseList(field.options) : []
  };
}

function cloneFields(fields) {
  if (!Array.isArray(fields)) {
    return [];
  }
  return fields.map((field) => ({
    id: field.id,
    label: field.label,
    kind: field.kind,
    options: Array.isArray(field.options) ? [...field.options] : []
  }));
}

function parseList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (!value || typeof value !== "string") {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatUpdated(value) {
  if (!value) {
    return "";
  }
  return value.slice(0, 10);
}
function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(value) {
  const parsed = parseDate(value);
  if (!parsed) {
    return value || "";
  }
  return parsed.toLocaleDateString("pt-BR");
}

function formatCalendarMonth(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getCalendarMonth() {
  if (state.ui.calendarMonth && /^\d{4}-\d{2}$/.test(state.ui.calendarMonth)) {
    const [year, month] = state.ui.calendarMonth.split("-").map(Number);
    return { year, month: month - 1 };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

function shiftCalendarMonth(offset) {
  const current = getCalendarMonth();
  const next = new Date(current.year, current.month + offset, 1);
  state.ui.calendarMonth = formatCalendarMonth(next);
  saveState();
  renderMain();
}

function groupItemsByDate(items) {
  return items.reduce((acc, item) => {
    if (!item.due) {
      return acc;
    }
    if (!acc[item.due]) {
      acc[item.due] = [];
    }
    acc[item.due].push(item);
    return acc;
  }, {});
}

function parseDate(value) {
  if (!value) {
    return null;
  }
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function dateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function nowIso() {
  return new Date().toISOString();
}

function touchItem(item) {
  item.updatedAt = nowIso();
}

function clamp(value, min, max) {
  if (Number.isNaN(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, value));
}

function setHidden(node, hidden) {
  if (!node) {
    return;
  }
  node.classList.toggle("hidden", hidden);
}

function getDefaultAreaId() {
  if (state.ui.areaId) {
    return state.ui.areaId;
  }
  const view = getCurrentView();
  if (view && view.filters && view.filters.areaId) {
    return view.filters.areaId;
  }
  return null;
}
function normalizeSelection(current) {
  if (!current || typeof current !== "object") {
    return defaultState();
  }
  if (current.selectedItemId && !current.items.find((item) => item.id === current.selectedItemId)) {
    current.selectedItemId = null;
  }
  if (current.ui.viewId && !current.views.find((view) => view.id === current.ui.viewId)) {
    current.ui.viewId = null;
  }
  if (current.ui.areaId && !current.areas.find((area) => area.id === current.ui.areaId)) {
    current.ui.areaId = null;
  }
  if (current.ui.typeId && !current.types.find((type) => type.id === current.ui.typeId)) {
    current.ui.typeId = null;
  }
  if (current.ui.specialView && !FLOW_VIEWS.find((entry) => entry.id === current.ui.specialView)) {
    current.ui.specialView = null;
  }
  if (typeof current.ui.quickTypeId !== "string" || !current.ui.quickTypeId) {
    current.ui.quickTypeId = null;
  }
  if (
    current.ui.quickTypeId &&
    !current.types.find((type) => type.id === current.ui.quickTypeId)
  ) {
    current.ui.quickTypeId = null;
  }
  if (!["list", "board", "calendar"].includes(current.ui.layout)) {
    current.ui.layout = "list";
  }
  if (!["updated", "due", "title"].includes(current.ui.sort)) {
    current.ui.sort = "updated";
  }
  if (!current.ui.collapsed) {
    current.ui.collapsed = { areas: false, views: false, types: false };
  }
  if (!current.ui.detailsSections) {
    current.ui.detailsSections = { advancedOpen: false };
  }
  if (!Array.isArray(current.ui.selection)) {
    current.ui.selection = [];
  }
  if (!Number.isFinite(current.ui.selectionAnchor)) {
    current.ui.selectionAnchor = null;
  }
  if (current.ui.calendarMonth && typeof current.ui.calendarMonth !== "string") {
    current.ui.calendarMonth = null;
  }
  return current;
}

function defaultState() {
  return {
    areas: [],
    types: [],
    views: [],
    items: [],
    selectedItemId: null,
    ui: {
      viewId: null,
      areaId: null,
      typeId: null,
      specialView: null,
      layout: "list",
      sort: "updated",
      search: "",
      quickTypeId: null,
      triageMode: false,
      calendarMonth: null,
      selection: [],
      selectionAnchor: null,
      detailsSections: { advancedOpen: false },
      collapsed: {
        areas: false,
        views: false,
        types: false
      }
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
  ui.collapsed = {
    ...base.ui.collapsed,
    ...((data.ui && data.ui.collapsed) || {})
  };
  ui.detailsSections = {
    ...base.ui.detailsSections,
    ...((data.ui && data.ui.detailsSections) || {})
  };
  ui.selection = Array.isArray(ui.selection) ? ui.selection : [];
  ui.selectionAnchor = Number.isFinite(ui.selectionAnchor) ? ui.selectionAnchor : null;
  return {
    areas: Array.isArray(data.areas) ? data.areas : [],
    types: Array.isArray(data.types) ? data.types.map(normalizeType).filter(Boolean) : [],
    views: Array.isArray(data.views) ? data.views.map(normalizeView).filter(Boolean) : [],
    items: Array.isArray(data.items) ? data.items.map(normalizeItem).filter(Boolean) : [],
    selectedItemId: data.selectedItemId || null,
    ui
  };
}

function normalizeItem(item) {
  if (!item || typeof item !== "object") {
    return null;
  }
  const normalized = { ...item };
  normalized.inbox = typeof normalized.inbox === "boolean" ? normalized.inbox : false;
  normalized.recurrenceParentId =
    typeof normalized.recurrenceParentId === "string" ? normalized.recurrenceParentId : null;
  if (normalized.recurrence && typeof normalized.recurrence === "object") {
    const freqList = ["daily", "weekly", "monthly", "interval"];
    const freq = freqList.includes(normalized.recurrence.freq) ? normalized.recurrence.freq : null;
    if (freq) {
      const intervalDays =
        freq === "interval" && Number.isFinite(normalized.recurrence.intervalDays)
          ? Math.max(1, Math.floor(normalized.recurrence.intervalDays))
          : undefined;
      normalized.recurrence = freq === "interval" ? { freq, intervalDays } : { freq };
    } else {
      normalized.recurrence = null;
    }
  } else {
    normalized.recurrence = null;
  }
  normalized.tags = Array.isArray(normalized.tags) ? normalized.tags : [];
  normalized.checklist = Array.isArray(normalized.checklist) ? normalized.checklist : [];
  normalized.custom =
    normalized.custom && typeof normalized.custom === "object" ? normalized.custom : {};
  return normalized;
}

function normalizeType(type) {
  if (!type || typeof type !== "object") {
    return null;
  }
  const normalized = { ...type };
  normalized.features = normalized.features && typeof normalized.features === "object"
    ? normalized.features
    : {};
  normalized.customFields = Array.isArray(normalized.customFields) ? normalized.customFields : [];
  normalized.defaultStatus = STATUS_ORDER.includes(normalized.defaultStatus)
    ? normalized.defaultStatus
    : "todo";
  normalized.defaultTags = Array.isArray(normalized.defaultTags) ? normalized.defaultTags : [];
  normalized.defaultDueOffsetDays = Number.isFinite(normalized.defaultDueOffsetDays)
    ? Math.floor(normalized.defaultDueOffsetDays)
    : null;
  normalized.defaultNotes = typeof normalized.defaultNotes === "string" ? normalized.defaultNotes : "";
  normalized.defaultChecklist = Array.isArray(normalized.defaultChecklist)
    ? normalized.defaultChecklist
    : [];
  return normalized;
}

function normalizeView(view) {
  if (!view || typeof view !== "object") {
    return null;
  }
  const normalized = { ...view };
  const defaults = {
    showType: true,
    showArea: true,
    showStatus: true,
    showDue: true,
    showProgress: true,
    showTags: true
  };
  normalized.cardFields = {
    ...defaults,
    ...((normalized.cardFields && typeof normalized.cardFields === "object") ? normalized.cardFields : {})
  };
  return normalized;
}

function defaultAuth() {
  return {
    token: "",
    user: null
  };
}

function loadAuth() {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) {
    return defaultAuth();
  }
  try {
    return normalizeAuth(JSON.parse(raw));
  } catch (error) {
    return defaultAuth();
  }
}

function normalizeAuth(data) {
  const base = defaultAuth();
  if (!data || typeof data !== "object") {
    return base;
  }
  const token = typeof data.token === "string" ? data.token : base.token;
  const user = data.user && typeof data.user === "object"
    ? {
        id: typeof data.user.id === "string" ? data.user.id : "",
        name: typeof data.user.name === "string" ? data.user.name : "",
        email: typeof data.user.email === "string" ? data.user.email : ""
      }
    : null;
  return {
    token,
    user: user && user.id ? user : null
  };
}

function saveAuth() {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

function clearAuth() {
  auth = defaultAuth();
  localStorage.removeItem(AUTH_KEY);
}

function defaultRemoteConfig() {
  return {
    url: "",
    apiKey: "",
    autoSync: false,
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
    autoSync: Boolean(data.autoSync),
    lastSyncAt: Number.isFinite(data.lastSyncAt) ? data.lastSyncAt : base.lastSyncAt,
    lastError: typeof data.lastError === "string" ? data.lastError : base.lastError
  };
}

function saveRemoteConfig() {
  localStorage.setItem(REMOTE_KEY, JSON.stringify(remote));
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

function buildHealthUrl() {
  return buildApiUrl("/health");
}

function getAuthHeaders() {
  const headers = {
    "Content-Type": "application/json"
  };
  if (auth.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }
  return headers;
}

function scheduleAutoSync() {
  if (!remote.autoSync || !remote.url || !auth.token) {
    return;
  }
  if (sync.timer) {
    clearTimeout(sync.timer);
  }
  sync.timer = setTimeout(() => {
    pushState({ silent: true });
  }, 1200);
}

async function pushState(options = {}) {
  const url = buildStateUrl();
  if (!url) {
    remote.lastError = "Configure URL";
    saveRemoteConfig();
    return { ok: false, error: remote.lastError };
  }
  if (!auth.token) {
    remote.lastError = "Faça login";
    saveRemoteConfig();
    return { ok: false, error: remote.lastError, code: "unauthorized" };
  }
  if (sync.busy) {
    return { ok: false, error: "Sincronização em andamento" };
  }
  sync.busy = true;
  try {
    const payload = { state, updatedAt: Date.now() };
    const response = await fetch(url, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    if (response.status === 401 || response.status === 403) {
      remote.lastError = "Sessão expirada";
      saveRemoteConfig();
      handleAuthFailure(remote.lastError);
      return { ok: false, error: remote.lastError, code: "unauthorized" };
    }
    if (!response.ok) {
      remote.lastError = `HTTP ${response.status}`;
      saveRemoteConfig();
      return { ok: false, error: remote.lastError };
    }
    const data = await response.json().catch(() => ({}));
    remote.lastSyncAt = Number.isFinite(data.updatedAt) ? data.updatedAt : Date.now();
    remote.lastError = "";
    saveRemoteConfig();
    return { ok: true };
  } catch (error) {
    remote.lastError = "Falha de rede";
    saveRemoteConfig();
    return { ok: false, error: remote.lastError };
  } finally {
    sync.busy = false;
  }
}

async function pullState() {
  const url = buildStateUrl();
  if (!url) {
    remote.lastError = "Configure URL";
    saveRemoteConfig();
    return { ok: false, error: remote.lastError };
  }
  if (!auth.token) {
    remote.lastError = "Faça login";
    saveRemoteConfig();
    return { ok: false, error: remote.lastError, code: "unauthorized" };
  }
  if (sync.busy) {
    return { ok: false, error: "Sincronização em andamento" };
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
      return { ok: false, error: remote.lastError, code: "empty" };
    }
    if (response.status === 401 || response.status === 403) {
      remote.lastError = "Sessão expirada";
      saveRemoteConfig();
      handleAuthFailure(remote.lastError);
      return { ok: false, error: remote.lastError, code: "unauthorized" };
    }
    if (!response.ok) {
      remote.lastError = `HTTP ${response.status}`;
      saveRemoteConfig();
      return { ok: false, error: remote.lastError };
    }
    const data = await response.json().catch(() => null);
    if (!data || !data.state || typeof data.state !== "object") {
      remote.lastError = "Resposta inválida";
      saveRemoteConfig();
      return { ok: false, error: remote.lastError };
    }
    state = normalizeSelection(normalizeState(data.state));
    saveState({ skipSync: true });
    renderAll();
    remote.lastSyncAt = Number.isFinite(data.updatedAt) ? data.updatedAt : Date.now();
    remote.lastError = "";
    saveRemoteConfig();
    return { ok: true };
  } catch (error) {
    remote.lastError = "Falha de rede";
    saveRemoteConfig();
    return { ok: false, error: remote.lastError };
  } finally {
    sync.busy = false;
  }
}

async function testConnection() {
  const url = buildHealthUrl();
  if (!url) {
    remote.lastError = "Configure URL";
    saveRemoteConfig();
    return { ok: false, error: remote.lastError };
  }
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: getAuthHeaders()
    });
    if (!response.ok) {
      remote.lastError = `HTTP ${response.status}`;
      saveRemoteConfig();
      return { ok: false, error: remote.lastError };
    }
    remote.lastError = "";
    saveRemoteConfig();
    return { ok: true };
  } catch (error) {
    remote.lastError = "Falha de rede";
    saveRemoteConfig();
    return { ok: false, error: remote.lastError };
  }
}

function formatSyncTime(timestamp) {
  if (!timestamp) {
    return "";
  }
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function buildSyncStatus() {
  if (!remote.url) {
    return "Sync desativado (configure nos Ajustes)";
  }
  if (remote.lastError) {
    return `Erro: ${remote.lastError}`;
  }
  if (remote.lastSyncAt) {
    return `Último sync: ${formatSyncTime(remote.lastSyncAt)}`;
  }
  if (!remote.autoSync) {
    return "Sync manual (auto-sync desativado)";
  }
  if (!auth.token) {
    return "Faça login para sincronizar";
  }
  return "Sync pronto";
}

function saveState(options = {}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!options.skipSync) {
    scheduleAutoSync();
  }
}

function showToast(message) {
  if (!el.toastContainer) {
    return;
  }
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  el.toastContainer.append(toast);
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 3000);
}

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

init();

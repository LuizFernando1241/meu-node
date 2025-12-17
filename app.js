"use strict";

const STORAGE_KEY = "meu-node-rebuild-v1";
const REMOTE_KEY = "meu-node-remote-v1";

const STATUS_ORDER = ["todo", "doing", "done"];
const STATUS_LABELS = {
  todo: "A fazer",
  doing: "Em progresso",
  done: "Feito"
};

const el = {
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
  mainTitle: document.getElementById("mainTitle"),
  layoutSelect: document.getElementById("layoutSelect"),
  sortSelect: document.getElementById("sortSelect"),
  emptyState: document.getElementById("emptyState"),
  emptyNewType: document.getElementById("emptyNewType"),
  emptyNewArea: document.getElementById("emptyNewArea"),
  itemsList: document.getElementById("itemsList"),
  itemsBoard: document.getElementById("itemsBoard"),
  detailsEmpty: document.getElementById("detailsEmpty"),
  detailsForm: document.getElementById("detailsForm"),
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
  itemNotes: document.getElementById("itemNotes"),
  modalBackdrop: document.getElementById("modalBackdrop"),
  modalEyebrow: document.getElementById("modalEyebrow"),
  modalTitle: document.getElementById("modalTitle"),
  modalBody: document.getElementById("modalBody"),
  modalClose: document.getElementById("modalClose"),
  modalCancel: document.getElementById("modalCancel"),
  modalSave: document.getElementById("modalSave"),
  modalDelete: document.getElementById("modalDelete")
};

const modalState = {
  onSave: null,
  onDelete: null
};

let state = normalizeSelection(loadState());
let remote = normalizeRemote(loadRemoteConfig());
const sync = { timer: null, busy: false };

function init() {
  bindEvents();
  renderAll();
  if (remote.autoSync && remote.url) {
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

  el.newItem.addEventListener("click", handleNewItem);
  el.newType.addEventListener("click", () => openTypeModal());
  el.newView.addEventListener("click", () => openViewModal());
  el.openSettings.addEventListener("click", () => openSettingsModal());

  el.addArea.addEventListener("click", () => openAreaModal());
  el.addView.addEventListener("click", () => openViewModal());
  el.addType.addEventListener("click", () => openTypeModal());

  el.emptyNewType.addEventListener("click", () => openTypeModal());
  el.emptyNewArea.addEventListener("click", () => openAreaModal());

  el.layoutSelect.addEventListener("change", () => {
    const layout = el.layoutSelect.value;
    const view = getCurrentView();
    if (view) {
      view.layout = layout;
    }
    state.ui.layout = layout;
    saveState();
    renderMain();
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
    item.status = el.itemStatus.value;
    touchItem(item);
    saveState();
    renderSidebar();
    renderMain();
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
    if (!confirm("Excluir item?")) {
      return;
    }
    state.items = state.items.filter((entry) => entry.id !== item.id);
    state.selectedItemId = null;
    saveState();
    renderAll();
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

  document.querySelectorAll(".toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleSection(btn.dataset.toggle);
    });
  });
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

  state.types.forEach((type) => {
    const option = document.createElement("option");
    option.value = type.id;
    option.textContent = type.name;
    el.quickType.append(option);
  });

  el.quickInput.disabled = false;
  el.quickType.disabled = false;
  el.quickAdd.disabled = false;

  if (!state.ui.quickTypeId) {
    state.ui.quickTypeId = state.types[0].id;
    saveState();
  }
  el.quickType.value = state.ui.quickTypeId;
}

function renderSidebar() {
  renderAreas();
  renderViews();
  renderTypes();
  updateToggleButtons();
}

function renderAreas() {
  el.areasList.innerHTML = "";
  const allItem = createListItem({
    name: "Todas as areas",
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
    name: "Todas as visoes",
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
  });
}
function renderMain() {
  const items = getFilteredItems();
  const layout = getCurrentLayout();

  el.mainTitle.textContent = buildMainTitle();
  el.layoutSelect.value = layout;
  el.sortSelect.value = state.ui.sort;

  updateEmptyState(items);

  if (layout === "board") {
    setHidden(el.itemsBoard, false);
    setHidden(el.itemsList, true);
    renderBoard(items);
  } else {
    setHidden(el.itemsBoard, true);
    setHidden(el.itemsList, false);
    renderList(items);
  }
}

function updateEmptyState(items) {
  const title = el.emptyState.querySelector("h3");
  const text = el.emptyState.querySelector("p");

  if (state.types.length === 0) {
    title.textContent = "Nenhum tipo ainda";
    text.textContent = "Crie seu primeiro tipo para organizar.";
    setHidden(el.emptyNewType, false);
  } else {
    title.textContent = "Nenhum item aqui";
    text.textContent = "Crie um item ou ajuste filtros.";
    setHidden(el.emptyNewType, true);
  }

  setHidden(el.emptyNewArea, false);
  setHidden(el.emptyState, !(state.types.length === 0 || items.length === 0));
}

function renderList(items) {
  el.itemsList.innerHTML = "";
  items.forEach((item) => {
    el.itemsList.append(createItemCard(item));
  });
}

function renderBoard(items) {
  el.itemsBoard.innerHTML = "";
  STATUS_ORDER.forEach((status) => {
    const column = document.createElement("div");
    column.className = "board-column";
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
      column.append(createItemCard(item));
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
    return;
  }

  el.deleteItem.disabled = false;
  setHidden(el.detailsEmpty, true);
  setHidden(el.detailsForm, false);

  fillSelect(el.itemType, state.types, item.typeId, true, "Sem tipo");
  fillSelect(el.itemArea, state.areas, item.areaId, true, "Sem area");

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
function handleQuickAdd() {
  if (!ensureTypeReady()) {
    return;
  }
  const raw = el.quickInput.value.trim();
  if (!raw) {
    return;
  }
  const typeId = el.quickType.value || state.types[0].id;
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
  if (!ensureTypeReady()) {
    return;
  }
  const typeId = state.ui.typeId || state.ui.quickTypeId || state.types[0].id;
  const item = createItem({
    title: "Novo item",
    typeId,
    areaId: getDefaultAreaId()
  });
  state.items.unshift(item);
  state.selectedItemId = item.id;
  saveState();
  renderAll();
  el.itemTitle.focus();
}

function ensureTypeReady() {
  if (state.types.length === 0) {
    openTypeModal();
    return false;
  }
  return true;
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
  saveState();
  renderMain();
  renderSidebar();
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
  nameInput.placeholder = "Nome da area";
  nameInput.value = area ? area.name : "";

  openModal({
    eyebrow: "Area",
    title: area ? "Editar area" : "Nova area",
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
          if (!confirm("Excluir area?")) {
            return false;
          }
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
          return true;
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

  openModal({
    eyebrow: "Tipo",
    title: type ? "Editar tipo" : "Novo tipo",
    body: [
      buildField("Nome", nameInput),
      buildSectionLabel("Recursos"),
      featureGroup,
      buildSectionLabel("Campos personalizados"),
      fieldsSection
    ],
    onSave: () => {
      const name = nameInput.value.trim();
      if (!name) {
        alert("Informe um nome.");
        return false;
      }
      const payload = {
        id: type ? type.id : uid("type"),
        name,
        features: {
          status: statusToggle.input.checked,
          due: dueToggle.input.checked,
          checklist: checklistToggle.input.checked,
          progress: progressToggle.input.checked
        },
        customFields: localFields.map(sanitizeField)
      };
      if (type) {
        Object.assign(type, payload);
      } else {
        state.types.push(payload);
        if (!state.ui.typeId) {
          state.ui.typeId = payload.id;
        }
        if (!state.ui.quickTypeId) {
          state.ui.quickTypeId = payload.id;
        }
      }
      saveState();
      renderAll();
      return true;
    },
    onDelete: type
      ? () => {
          if (!confirm("Excluir tipo?")) {
            return false;
          }
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
          return true;
        }
      : null
  });
}
function openViewModal(view) {
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "Nome da visao";
  nameInput.value = view ? view.name : "";

  const areaSelect = document.createElement("select");
  fillSelect(areaSelect, state.areas, view?.filters?.areaId || "", true, "Qualquer area");

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
    { value: "board", label: "Quadro" }
  ].forEach((optionData) => {
    const option = document.createElement("option");
    option.value = optionData.value;
    option.textContent = optionData.label;
    layoutSelect.append(option);
  });
  layoutSelect.value = view?.layout || state.ui.layout;

  const rowOne = document.createElement("div");
  rowOne.className = "field-row";
  rowOne.append(buildField("Area", areaSelect), buildField("Tipo", typeSelect));

  const rowTwo = document.createElement("div");
  rowTwo.className = "field-row";
  rowTwo.append(buildField("Status", statusSelect), buildField("Prazo", dueSelect));

  const rowThree = document.createElement("div");
  rowThree.className = "field-row";
  rowThree.append(buildField("Layout", layoutSelect), buildField("Tag", tagInput));

  openModal({
    eyebrow: "Visao",
    title: view ? "Editar visao" : "Nova visao",
    body: [buildField("Nome", nameInput), rowOne, rowTwo, rowThree],
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
        layout: layoutSelect.value
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
          if (!confirm("Excluir visao?")) {
            return false;
          }
          state.views = state.views.filter((entry) => entry.id !== view.id);
          if (state.ui.viewId === view.id) {
            state.ui.viewId = null;
          }
          saveState();
          renderAll();
          return true;
        }
      : null
  });
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
      alert("JSON invalido.");
    }
  });

  const resetButton = document.createElement("button");
  resetButton.className = "ghost-btn danger";
  resetButton.textContent = "Limpar tudo";
  resetButton.addEventListener("click", () => {
    if (!confirm("Limpar todos os dados?")) {
      return;
    }
    state = normalizeSelection(defaultState());
    saveState();
    renderAll();
    closeModal();
  });

  const actionRow = document.createElement("div");
  actionRow.className = "main-actions";
  actionRow.append(exportButton, importButton, resetButton);

  const syncLabel = buildSectionLabel("Sincronizacao online");

  const urlInput = document.createElement("input");
  urlInput.type = "text";
  urlInput.placeholder = "https://sua-api.com";
  urlInput.value = remote.url || "";

  const keyInput = document.createElement("input");
  keyInput.type = "text";
  keyInput.placeholder = "API key";
  keyInput.value = remote.apiKey || "";

  const autoToggle = createToggleLine("Auto sync", remote.autoSync);

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
    remote.apiKey = keyInput.value.trim();
    remote.autoSync = autoToggle.input.checked;
    saveRemoteConfig();
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

  openModal({
    eyebrow: "Ajustes",
    title: "Ajustes",
    body: [
      info,
      actionRow,
      textArea,
      syncLabel,
      buildField("API URL", urlInput),
      buildField("API Key", keyInput),
      autoToggle.wrapper,
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
}

function closeModal() {
  el.modalBackdrop.classList.add("hidden");
  el.modalBody.innerHTML = "";
  modalState.onSave = null;
  modalState.onDelete = null;
  el.modalSave.textContent = "Salvar";
  el.modalDelete.classList.add("hidden");
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

function createItemCard(item) {
  const card = document.createElement("div");
  card.className = `item-card${item.id === state.selectedItemId ? " active" : ""}`;
  card.addEventListener("click", () => {
    state.selectedItemId = item.id;
    saveState();
    renderMain();
    renderDetails();
  });

  const info = document.createElement("div");
  const title = document.createElement("div");
  title.className = "item-title";
  title.textContent = item.title || "Sem titulo";
  const meta = document.createElement("div");
  meta.className = "item-meta";

  const type = getType(item.typeId);
  if (type) {
    meta.append(createBadge(type.name));
  }
  const area = getArea(item.areaId);
  if (area) {
    meta.append(createBadge(area.name));
  }
  if (item.due) {
    meta.append(createBadge(`Prazo ${item.due}`));
  }
  const statusLabel = STATUS_LABELS[getItemStatus(item)];
  if (statusLabel) {
    meta.append(createBadge(statusLabel));
  }
  if (item.progress) {
    meta.append(createBadge(`${item.progress}%`));
  }
  (item.tags || []).slice(0, 3).forEach((tag) => {
    meta.append(createBadge(`#${tag}`));
  });

  info.append(title, meta);

  const side = document.createElement("div");
  side.className = "list-meta";
  side.textContent = formatUpdated(item.updatedAt);

  card.append(info, side);
  return card;
}
function createBadge(text) {
  const badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = text;
  return badge;
}

function createListItem({ name, count, active, onSelect, onEdit }) {
  const item = document.createElement("div");
  item.className = `list-item${active ? " active" : ""}`;
  item.addEventListener("click", onSelect);

  const content = document.createElement("div");
  const title = document.createElement("div");
  title.textContent = name;
  const meta = document.createElement("div");
  meta.className = "list-meta";
  meta.textContent = String(count);
  content.append(title, meta);

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
  return view && view.layout ? view.layout : state.ui.layout;
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
  let title = view ? view.name : "Tudo";
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

function createItem({ title, typeId, areaId, tags, due }) {
  return {
    id: uid("item"),
    title: title || "Novo item",
    typeId: typeId || null,
    areaId: areaId || null,
    status: "todo",
    due: due || "",
    tags: Array.isArray(tags) ? tags : [],
    notes: "",
    progress: 0,
    checklist: [],
    custom: {},
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
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
  if (
    current.ui.quickTypeId &&
    !current.types.find((type) => type.id === current.ui.quickTypeId)
  ) {
    current.ui.quickTypeId = null;
  }
  if (current.types.length && !current.ui.quickTypeId) {
    current.ui.quickTypeId = current.types[0].id;
  }
  if (current.ui.layout !== "list" && current.ui.layout !== "board") {
    current.ui.layout = "list";
  }
  if (!["updated", "due", "title"].includes(current.ui.sort)) {
    current.ui.sort = "updated";
  }
  if (!current.ui.collapsed) {
    current.ui.collapsed = { areas: false, views: false, types: false };
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
      layout: "list",
      sort: "updated",
      search: "",
      quickTypeId: null,
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
  return {
    areas: Array.isArray(data.areas) ? data.areas : [],
    types: Array.isArray(data.types) ? data.types : [],
    views: Array.isArray(data.views) ? data.views : [],
    items: Array.isArray(data.items) ? data.items : [],
    selectedItemId: data.selectedItemId || null,
    ui
  };
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
    apiKey: typeof data.apiKey === "string" ? data.apiKey : base.apiKey,
    autoSync: Boolean(data.autoSync),
    lastSyncAt: Number.isFinite(data.lastSyncAt) ? data.lastSyncAt : base.lastSyncAt,
    lastError: typeof data.lastError === "string" ? data.lastError : base.lastError
  };
}

function saveRemoteConfig() {
  localStorage.setItem(REMOTE_KEY, JSON.stringify(remote));
}

function buildStateUrl() {
  const base = (remote.url || "").trim();
  if (!base) {
    return "";
  }
  return base.replace(/\/+$/, "") + "/state";
}

function buildHealthUrl() {
  const base = (remote.url || "").trim();
  if (!base) {
    return "";
  }
  return base.replace(/\/+$/, "") + "/health";
}

function getAuthHeaders() {
  const headers = {
    "Content-Type": "application/json"
  };
  if (remote.apiKey) {
    headers["X-API-Key"] = remote.apiKey;
  }
  return headers;
}

function scheduleAutoSync() {
  if (!remote.autoSync || !remote.url) {
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
  if (sync.busy) {
    return { ok: false, error: "Sincronizacao em andamento" };
  }
  sync.busy = true;
  try {
    const payload = { state, updatedAt: Date.now() };
    const response = await fetch(url, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
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
  if (sync.busy) {
    return { ok: false, error: "Sincronizacao em andamento" };
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
      return { ok: false, error: remote.lastError };
    }
    if (!response.ok) {
      remote.lastError = `HTTP ${response.status}`;
      saveRemoteConfig();
      return { ok: false, error: remote.lastError };
    }
    const data = await response.json().catch(() => null);
    if (!data || !data.state || typeof data.state !== "object") {
      remote.lastError = "Resposta invalida";
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
  if (remote.lastError) {
    return `Erro: ${remote.lastError}`;
  }
  if (remote.lastSyncAt) {
    return `Ultimo sync: ${formatSyncTime(remote.lastSyncAt)}`;
  }
  return "Sem sync";
}

function saveState(options = {}) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!options.skipSync) {
    scheduleAutoSync();
  }
}

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`;
}

init();

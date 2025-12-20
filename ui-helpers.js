// Helper functions para renderização da UI

function createElement(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function createButton(label, className, onClick) {
  const btn = document.createElement("button");
  btn.className = className || "ghost-btn";
  btn.textContent = label;
  if (onClick) btn.addEventListener("click", onClick);
  return btn;
}

function createSelect(options, value) {
  const select = document.createElement("select");
  options.forEach((opt) => {
    const option = document.createElement("option");
    option.value = opt.value;
    option.textContent = opt.label;
    if (opt.value === value) option.selected = true;
    select.append(option);
  });
  return select;
}

function buildField(label, input) {
  const wrapper = document.createElement("div");
  wrapper.className = "form-field";
  const labelEl = document.createElement("label");
  labelEl.textContent = label;
  labelEl.className = "form-label";
  wrapper.append(labelEl, input);
  return wrapper;
}

function createSection(title, subtitle) {
  const section = document.createElement("div");
  section.className = "section";
  
  const header = document.createElement("div");
  header.className = "section-header";
  
  const titleEl = document.createElement("div");
  titleEl.className = "section-title";
  titleEl.textContent = title;
  header.append(titleEl);
  
  if (subtitle) {
    const subtitleEl = document.createElement("div");
    subtitleEl.className = "list-meta";
    subtitleEl.textContent = subtitle;
    header.append(subtitleEl);
  }
  
  const body = document.createElement("div");
  body.className = "section-body";
  
  section.append(header, body);
  
  return { section, body };
}

function createTaskCard(task, options = {}) {
  const card = document.createElement("div");
  card.className = "card";
  
  const title = document.createElement("div");
  title.className = "card-title";
  title.textContent = task.title;
  card.append(title);
  
  const meta = document.createElement("div");
  meta.className = "list-meta";
  meta.textContent = `${STATUS_LABELS[task.status] || task.status} • ${PRIORITY_LABELS[task.priority] || task.priority}`;
  card.append(meta);
  
  card.addEventListener("click", () => selectItem("task", task.id));
  
  return card;
}

function createTaskRow(task, options = {}) {
  const row = document.createElement("div");
  row.className = "task-row";
  
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = task.status === "done";
  checkbox.addEventListener("change", () => {
    task.status = checkbox.checked ? "done" : "todo";
    touch(task);
    saveState();
    renderMain();
  });
  
  const content = document.createElement("div");
  content.className = "task-content";
  
  const title = document.createElement("div");
  title.className = "task-title";
  title.textContent = task.title;
  content.append(title);
  
  if (task.dueDate && !options.compact) {
    const meta = document.createElement("div");
    meta.className = "list-meta";
    meta.textContent = task.dueDate;
    content.append(meta);
  }
  
  row.append(checkbox, content);
  row.addEventListener("click", (e) => {
    if (e.target !== checkbox) selectItem("task", task.id);
  });
  
  return row;
}

function createProjectCard(project) {
  const card = document.createElement("div");
  card.className = "card";
  
  const title = document.createElement("div");
  title.className = "card-title";
  title.textContent = project.name;
  card.append(title);
  
  const meta = document.createElement("div");
  meta.className = "list-meta";
  const statusLabel = project.status === "active" ? "Ativo" : project.status === "paused" ? "Pausado" : "Concluído";
  meta.textContent = statusLabel;
  card.append(meta);
  
  return card;
}

function createAreaCard(area) {
  const card = document.createElement("div");
  card.className = "card";
  
  const title = document.createElement("div");
  title.className = "card-title";
  title.textContent = area.name;
  card.append(title);
  
  if (area.objective) {
    const meta = document.createElement("div");
    meta.className = "list-meta";
    meta.textContent = area.objective.slice(0, 80);
    card.append(meta);
  }
  
  return card;
}

function createEventRow(event) {
  const row = document.createElement("div");
  row.className = "task-row";
  
  const content = document.createElement("div");
  content.className = "task-content";
  
  const title = document.createElement("div");
  title.className = "task-title";
  title.textContent = event.title;
  content.append(title);
  
  const meta = document.createElement("div");
  meta.className = "list-meta";
  meta.textContent = `${event.date} ${event.start}`;
  content.append(meta);
  
  row.append(content);
  row.addEventListener("click", () => selectItem("event", event.id));
  
  return row;
}

function createInboxRow(item, options = {}) {
  const row = document.createElement("div");
  row.className = "task-row";
  
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = state.ui.inboxSelection.includes(item.id);
  checkbox.addEventListener("change", () => toggleInboxSelection(item.id));
  
  const content = document.createElement("div");
  content.className = "task-content";
  
  const title = document.createElement("div");
  title.className = "task-title";
  title.textContent = item.title;
  content.append(title);
  
  const meta = document.createElement("div");
  meta.className = "list-meta";
  meta.textContent = item.kind;
  content.append(meta);
  
  const actions = document.createElement("div");
  actions.className = "card-actions";
  
  const processBtn = createButton("Processar", "ghost-btn", () => openProcessModal(item));
  const archiveBtn = createButton("Arquivar", "ghost-btn", () => archiveInboxItem(item.id));
  
  actions.append(processBtn, archiveBtn);
  
  row.append(checkbox, content, actions);
  
  return row;
}

function setCount(element, count) {
  if (!element) return;
  element.textContent = count > 0 ? count : "";
}

function setDetailsOpen(open) {
  if (open) {
    document.body.classList.add("details-open");
  } else {
    document.body.classList.remove("details-open");
  }
}

function toggleDetailsMinimize() {
  document.body.classList.toggle("details-minimized");
}

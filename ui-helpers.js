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
    meta.textContent = `${STATUS_LABELS[task.status] || task.status} - ${PRIORITY_LABELS[task.priority] || task.priority}`;
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
    const previous = task.status;
    task.status = checkbox.checked ? "done" : "todo";
    touch(task);
    saveState();
    renderMain();
    if (checkbox.checked) {
      showActionToast("Tarefa concluida.", "Desfazer", () => {
        task.status = previous;
        touch(task);
        saveState();
        renderMain();
      });
    }
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
    if (e.target !== checkbox && !e.target.closest(".task-actions")) {
      selectItem("task", task.id);
    }
  });

  if (!options.compact) {
    const actions = document.createElement("div");
    actions.className = "task-actions";
    const focusBtn = createButton(task.focus ? "F*" : "F", "ghost-btn", (event) => {
      event.stopPropagation();
      toggleTaskFocus(task);
      renderMain();
    });
    focusBtn.title = "Foco";
    focusBtn.setAttribute("aria-label", "Foco");
    const snoozeBtn = createButton("1d", "ghost-btn", (event) => {
      event.stopPropagation();
      snoozeTask(task, 1);
    });
    snoozeBtn.title = "Amanha";
    snoozeBtn.setAttribute("aria-label", "Amanha");
    const weekBtn = createButton("7d", "ghost-btn", (event) => {
      event.stopPropagation();
      snoozeTask(task, 7);
    });
    weekBtn.title = "Adicionar 7 dias";
    weekBtn.setAttribute("aria-label", "Adicionar 7 dias");
    const scheduleBtn = createButton("Cal", "ghost-btn", (event) => {
      event.stopPropagation();
      openTaskScheduleModal(task);
    });
    scheduleBtn.title = "Agendar";
    scheduleBtn.setAttribute("aria-label", "Agendar");
    const menuBtn = createButton("...", "ghost-btn", (event) => {
      event.stopPropagation();
      openContextMenu("task", task);
    });
    menuBtn.title = "Mais acoes";
    menuBtn.setAttribute("aria-label", "Mais acoes");
    actions.append(focusBtn, snoozeBtn, weekBtn, scheduleBtn, menuBtn);
    row.append(actions);
  }
  
  return row;
}



function createAreaCard(area) {
  const card = document.createElement("div");
  card.className = "card";

  const title = document.createElement("div");
  title.className = "card-title";
  title.textContent = area.name;
  card.append(title);

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

  const actions = document.createElement("div");
  actions.className = "task-actions";
  const editBtn = createButton("E", "ghost-btn", (ev) => {
    ev.stopPropagation();
    openEventModal(event);
  });
  editBtn.title = "Editar";
  editBtn.setAttribute("aria-label", "Editar");
  const deleteBtn = createButton("X", "ghost-btn danger", (ev) => {
    ev.stopPropagation();
    if (confirm("Deletar evento?")) {
      state.events = state.events.filter((item) => item.id !== event.id);
      markDeleted("events", event.id);
      saveState();
      renderMain();
    }
  });
  deleteBtn.title = "Deletar";
  deleteBtn.setAttribute("aria-label", "Deletar");
  const menuBtn = createButton("...", "ghost-btn", (ev) => {
    ev.stopPropagation();
    openContextMenu("event", event);
  });
  menuBtn.title = "Mais acoes";
  menuBtn.setAttribute("aria-label", "Mais acoes");
  actions.append(editBtn, deleteBtn, menuBtn);
  row.append(actions);

  row.addEventListener("click", (e) => {
    if (!e.target.closest(".task-actions")) {
      selectItem("event", event.id);
    }
  });
  
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
  
  const kindLabel = item.kind === "event" ? "Evento" : item.kind === "note" ? "Nota" : "Tarefa";
  const meta = document.createElement("span");
  meta.className = `kind-chip kind-${item.kind || "task"}`;
  meta.textContent = kindLabel;
  content.append(meta);
  
  const actions = document.createElement("div");
  actions.className = "card-actions";
  
  const processBtn = createButton("Processar", "ghost-btn", () => openProcessModal(item));
  const archiveBtn = createButton("Arquivar", "ghost-btn", () => archiveInboxItem(item.id));
  const deleteBtn = createButton("Apagar", "ghost-btn danger", () => deleteInboxItem(item.id));
  
  actions.append(processBtn, archiveBtn, deleteBtn);
  
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

function createProjectCard(project) {
  const card = document.createElement("div");
  card.className = "card";

  const title = document.createElement("div");
  title.className = "card-title";
  title.textContent = project.title;
  card.append(title);

  if (project.objective) {
    const objective = document.createElement("div");
    objective.className = "list-meta";
    objective.textContent = project.objective;
    card.append(objective);
  }

  const meta = document.createElement("div");
  meta.className = "list-meta";
  const statusLabel = project.status === "active" ? "Ativo" : project.status === "paused" ? "Pausado" : "Concluido";
  meta.textContent = statusLabel;
  card.append(meta);

  const nextTask = state.tasks.find(
    (task) => task.projectId === project.id && task.status !== "done"
  );
  if (nextTask) {
    const next = document.createElement("div");
    next.className = "list-meta";
    next.textContent = `Proximo passo: ${nextTask.title}`;
    card.append(next);
  }

  const activeTasks = state.tasks.filter(
    (task) => task.projectId === project.id && task.status !== "done"
  ).length;
  const overdueTasks = state.tasks.filter((task) => {
    if (task.projectId !== project.id || task.status === "done" || !task.dueDate) {
      return false;
    }
    const due = parseDate(task.dueDate);
    return due && due < dateOnly(new Date());
  }).length;
  const counts = document.createElement("div");
  counts.className = "list-meta";
  counts.textContent = `${activeTasks} ativas - ${overdueTasks} atrasadas`;
  card.append(counts);

  return card;
}








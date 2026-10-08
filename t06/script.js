const API_URL = "https://sckjbblzivbcoofabhqd.supabase.co/functions/v1/t06-pds";

let appState = null;
let currentPlanId = null;

const $ = (selector) => document.querySelector(selector);
const priorityRank = { high: 0, medium: 1, low: 2 };
const priorityLabel = { high: "높음", medium: "보통", low: "낮음" };

async function api(action, payload = {}) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...payload })
  });
  const data = await response.json().catch(() => ({ ok: false, error: "INVALID_JSON" }));
  if (!response.ok || !data.ok) throw new Error(data.error || "API_ERROR");
  return data;
}

function setConnection(text, type = "") {
  const node = $("#connectionState");
  node.textContent = text;
  node.className = "status-pill" + (type ? " " + type : "");
}

function formatKst(value) {
  if (!value) return "없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false
  }).format(date) + " KST";
}

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined && text !== null) node.textContent = String(text);
  if (className) node.className = className;
  return node;
}

function fieldBox(label, value, wide = false) {
  const box = el("div", null, "info-box" + (wide ? " wide" : ""));
  box.append(el("strong", label), el("span", value));
  return box;
}

function getActivePlan() {
  return appState?.plans?.find((plan) => plan.id === appState.active_plan_id) || null;
}

function taskBlocked(taskId) {
  return (appState?.executions || []).some((item) =>
    item.task_id === taskId && String(item.blocker_reason || "").trim()
  );
}

function completionCount(taskId) {
  return (appState?.completions || []).filter((item) => item.task_id === taskId).length;
}

async function loadState(planId = currentPlanId) {
  setConnection("DB 불러오는 중…");
  try {
    appState = await api("state", planId ? { plan_id: planId } : {});
    currentPlanId = appState.active_plan_id;
    renderAll();
    setConnection("서버 DB 연결됨", "ok");
  } catch (error) {
    setConnection("DB 연결 실패: " + error.message, "error");
    throw error;
  }
}

function renderAll() {
  renderPlanSelector();
  renderPlan();
  renderRevisions();
  renderTaskSelectors();
  renderTasks();
  renderExecutions();
  renderReview();
  renderReflections();
  renderSecurityCheck();
  setDateDefaults();
}

function renderSecurityCheck() {
  const node = $("#securityCheckLiteral");
  if (!node) return;
  const row = (appState.security_checks || []).find((item) => item.check_key === "xss-literal");
  node.textContent = row ? row.stored_text : "저장된 검사 문자열 없음";
}

function renderPlanSelector() {
  const select = $("#planSelect");
  select.replaceChildren();
  (appState.plans || []).forEach((plan) => {
    const option = el("option", plan.title);
    option.value = plan.id;
    option.selected = plan.id === appState.active_plan_id;
    select.append(option);
  });
}

function renderPlan() {
  const plan = getActivePlan();
  const host = $("#planSummary");
  host.replaceChildren();

  if (!plan) {
    host.append(el("p", "저장된 계획이 없습니다.", "empty"));
    resetPlanForm();
    return;
  }

  host.append(
    fieldBox("계획 ID", plan.id),
    fieldBox("기간", plan.start_date + " → " + plan.end_date),
    fieldBox("우선순위", priorityLabel[plan.priority] || plan.priority),
    fieldBox("예상 시간", plan.expected_minutes + "분"),
    fieldBox("수정 시각", formatKst(plan.updated_at)),
    fieldBox("성공 기준", plan.success_criteria, true)
  );
  if (plan.next_from_reflection) {
    host.append(fieldBox("이전 돌아보기에서 넘어온 한 줄", plan.next_from_reflection, true));
  }

  $("#planId").value = plan.id;
  $("#planTitle").value = plan.title;
  $("#planStart").value = plan.start_date;
  $("#planEnd").value = plan.end_date;
  $("#planPriority").value = plan.priority;
  $("#planExpected").value = plan.expected_minutes;
  $("#planCriteria").value = plan.success_criteria;
  $("#planNextNote").value = plan.next_from_reflection || "";
}

function resetPlanForm() {
  $("#planForm").reset();
  $("#planId").value = "";
  $("#planPriority").value = "medium";
  $("#planFormState").textContent = "새 계획 모드";
}

function renderRevisions() {
  const host = $("#revisionList");
  host.replaceChildren();
  const revisions = appState.revisions || [];
  if (!revisions.length) {
    host.append(el("p", "아직 수정 전 이력이 없습니다.", "empty"));
    return;
  }

  revisions.forEach((revision) => {
    const snap = revision.snapshot || {};
    const item = el("article", null, "stack-item");
    item.append(
      el("strong", "수정 전 계획 · revision " + revision.revision_no),
      el("p", "보존 시각: " + formatKst(revision.changed_at)),
      el("p", "기간: " + (snap.start_date || "-") + " → " + (snap.end_date || "-")),
      el("p", "우선순위: " + (priorityLabel[snap.priority] || snap.priority || "-")),
      el("p", "예상 시간: " + (snap.expected_minutes ?? 0) + "분"),
      el("p", "성공 기준: " + (snap.success_criteria || "-"))
    );
    host.append(item);
  });
}

function renderTaskSelectors() {
  const select = $("#executionTask");
  const selected = select.value;
  select.replaceChildren();
  (appState.tasks || []).forEach((task) => {
    const option = el("option", task.title);
    option.value = task.id;
    if (task.id === selected) option.selected = true;
    select.append(option);
  });
}

function taskMatchesFilter(task, filter) {
  if (filter === "done") return task.completed;
  if (filter === "todo") return !task.completed;
  if (filter === "overdue") return !task.completed && task.due_date < appState.today;
  if (filter === "blocked") return taskBlocked(task.id);
  return true;
}

function sortedTasks() {
  const search = $("#taskSearch").value.trim().toLowerCase();
  const filter = $("#taskFilter").value;
  return (appState.tasks || [])
    .filter((task) => {
      const haystack = [task.title, ...(task.tags || [])].join(" ").toLowerCase();
      return (!search || haystack.includes(search)) && taskMatchesFilter(task, filter);
    })
    .sort((a, b) =>
      a.due_date.localeCompare(b.due_date) ||
      (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9) ||
      a.created_at.localeCompare(b.created_at)
    );
}

function renderTasks() {
  const host = $("#taskList");
  host.replaceChildren();
  const tasks = sortedTasks();
  if (!tasks.length) {
    host.append(el("p", "조건에 맞는 할 일이 없습니다.", "empty"));
    return;
  }

  tasks.forEach((task) => {
    const overdue = !task.completed && task.due_date < appState.today;
    const card = el("article", null, "task-card" + (task.completed ? " done" : "") + (overdue ? " overdue" : ""));
    card.dataset.taskId = task.id;

    const main = el("div");
    const title = el("h3", task.title);
    const meta = el("div", null, "meta");
    meta.append(
      el("span", "마감 " + task.due_date),
      el("span", "우선순위 " + (priorityLabel[task.priority] || task.priority)),
      el("span", "예상 " + task.expected_minutes + "분"),
      el("span", task.completed ? "완료" : overdue ? "지연" : "진행 중"),
      el("span", "완료기록 " + completionCount(task.id) + "건")
    );
    if (taskBlocked(task.id)) meta.append(el("span", "막힘 기록 있음"));
    (task.tags || []).forEach((tag) => meta.append(el("span", tag, "tag")));
    main.append(title, meta);

    const actions = el("div", null, "task-actions");
    const complete = el("button", task.completed ? "진행 중으로 되돌리기" : "완료", "button " + (task.completed ? "ghost" : "success"));
    complete.type = "button";
    complete.addEventListener("click", async () => {
      complete.disabled = true;
      try {
        await api("set_completed", { id: task.id, completed: !task.completed });
        await loadState(currentPlanId);
      } catch (error) {
        alert("상태 변경 실패: " + error.message);
        complete.disabled = false;
      }
    });

    const edit = el("button", "고치기", "button ghost");
    edit.type = "button";
    edit.addEventListener("click", () => editTask(task));

    const remove = el("button", "지우기", "button danger");
    remove.type = "button";
    remove.addEventListener("click", async () => {
      if (!confirm("이 할 일을 지울까요? 실행 기록은 서버에 남아 있어도 현재 계획 집계에서는 제외됩니다.")) return;
      remove.disabled = true;
      try {
        await api("delete_task", { id: task.id });
        await loadState(currentPlanId);
      } catch (error) {
        alert("삭제 실패: " + error.message);
        remove.disabled = false;
      }
    });

    actions.append(complete, edit, remove);
    card.append(main, actions);
    host.append(card);
  });
}

function editTask(task) {
  $("#taskId").value = task.id;
  $("#taskTitle").value = task.title;
  $("#taskDue").value = task.due_date;
  $("#taskPriority").value = task.priority;
  $("#taskExpected").value = task.expected_minutes;
  $("#taskTags").value = (task.tags || []).join(", ");
  $("#taskFormState").textContent = "수정 모드";
  $("#taskForm").scrollIntoView({ behavior: "smooth", block: "center" });
}

function resetTaskForm() {
  $("#taskForm").reset();
  $("#taskId").value = "";
  $("#taskPriority").value = "medium";
  $("#taskDue").value = appState?.today || "";
  $("#taskFormState").textContent = "새 할 일 모드";
}

function renderExecutions() {
  const host = $("#executionList");
  host.replaceChildren();
  const executions = appState.executions || [];
  $("#executionCount").textContent = executions.length + "건";

  if (!executions.length) {
    host.append(el("p", "실행 기록이 없습니다.", "empty"));
    return;
  }

  const taskMap = new Map((appState.tasks || []).map((task) => [task.id, task]));
  executions.forEach((record) => {
    const task = taskMap.get(record.task_id);
    const item = el("article", null, "stack-item");
    item.dataset.executionTaskId = record.task_id;
    item.append(
      el("strong", task?.title || "삭제된 할 일"),
      el("p", "시작 " + formatKst(record.started_at) + " · 종료 " + formatKst(record.ended_at)),
      el("p", "실제 " + record.actual_minutes + "분"),
      el("p", "막힘: " + (record.blocker_reason || "없음"))
    );
    host.append(item);
  });
}

function reviewButton(label, value, small, onClick) {
  const button = el("button", null, "review-card");
  button.type = "button";
  button.append(el("span", label), el("strong", value), el("small", small));
  button.addEventListener("click", onClick);
  return button;
}

function focusTasks(filter) {
  $("#taskFilter").value = filter;
  renderTasks();
  $("#tasks").scrollIntoView({ behavior: "smooth" });
}

function renderReview() {
  const s = appState.summary;
  $("#reviewDate").textContent = appState.today + " · KST";
  const host = $("#reviewCards");
  host.replaceChildren();

  host.append(
    reviewButton("계획 수(할 일)", s.plan_count, "지우지 않은 할 일", () => focusTasks("all")),
    reviewButton("완료 수", s.completed_count, "현재 완료 상태", () => focusTasks("done")),
    reviewButton("지연 수", s.delayed_count, "미완료 + KST 오늘 이전", () => focusTasks("overdue")),
    reviewButton("막힘 수", s.blocked_count, "막힘 이유가 있는 할 일", () => focusTasks("blocked")),
    reviewButton("예상 시간", s.expected_minutes + "분", "할 일 예상 합계", () => focusTasks("all")),
    reviewButton("실제 시간", s.actual_minutes + "분", "실행 기록 합계", () => $("#do").scrollIntoView({ behavior: "smooth" })),
    reviewButton("차이", (s.difference_minutes >= 0 ? "+" : "") + s.difference_minutes + "분", "실제 - 예상", () => $("#do").scrollIntoView({ behavior: "smooth" }))
  );
}

function renderReflections() {
  const host = $("#reflectionList");
  host.replaceChildren();
  const rows = appState.reflections || [];
  if (!rows.length) {
    host.append(el("p", "아직 다음 계획으로 넘긴 고칠 점이 없습니다.", "empty"));
    return;
  }

  const planMap = new Map((appState.plans || []).map((plan) => [plan.id, plan]));
  rows.forEach((row) => {
    const item = el("article", null, "stack-item");
    item.append(
      el("strong", row.improvement_note),
      el("p", "기록 시각: " + formatKst(row.created_at))
    );
    const next = planMap.get(row.next_plan_id);
    if (next) {
      const open = el("button", "다음 계획 열기 · " + next.title, "button secondary");
      open.type = "button";
      open.addEventListener("click", async () => {
        await loadState(next.id);
        $("#plan").scrollIntoView({ behavior: "smooth" });
      });
      item.append(open);
    }
    host.append(item);
  });
}

function datePlus(dateText, days) {
  const base = new Date(dateText + "T12:00:00+09:00");
  base.setUTCDate(base.getUTCDate() + days);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(base);
}

function toLocalInput(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate()) +
    "T" + pad(date.getHours()) + ":" + pad(date.getMinutes());
}

function setDateDefaults() {
  if (!appState?.today) return;
  if (!$("#taskDue").value) $("#taskDue").value = appState.today;
  if (!$("#nextPlanStart").value) $("#nextPlanStart").value = datePlus(appState.today, 1);
  if (!$("#nextPlanEnd").value) $("#nextPlanEnd").value = datePlus(appState.today, 3);

  const end = new Date();
  const start = new Date(end.getTime() - 30 * 60 * 1000);
  if (!$("#executionStart").value) $("#executionStart").value = toLocalInput(start);
  if (!$("#executionEnd").value) $("#executionEnd").value = toLocalInput(end);
  if (!$("#executionMinutes").value) $("#executionMinutes").value = "30";
}

$("#planSelect").addEventListener("change", () => loadState($("#planSelect").value));
$("#newPlanButton").addEventListener("click", () => {
  resetPlanForm();
  document.querySelector("#plan details").open = true;
});

$("#planForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("#planId").value;
  const payload = {
    id,
    title: $("#planTitle").value,
    start_date: $("#planStart").value,
    end_date: $("#planEnd").value,
    priority: $("#planPriority").value,
    success_criteria: $("#planCriteria").value,
    expected_minutes: Number($("#planExpected").value),
    next_from_reflection: $("#planNextNote").value
  };
  $("#planFormState").textContent = "저장 중…";
  try {
    const result = await api(id ? "update_plan" : "create_plan", payload);
    $("#planFormState").textContent = "서버 DB 저장 완료";
    await loadState(result.plan.id || id);
  } catch (error) {
    $("#planFormState").textContent = "실패: " + error.message;
  }
});

$("#taskForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentPlanId) return;
  const id = $("#taskId").value;
  const payload = {
    id,
    plan_id: currentPlanId,
    title: $("#taskTitle").value,
    due_date: $("#taskDue").value,
    priority: $("#taskPriority").value,
    tags: $("#taskTags").value.split(",").map((x) => x.trim()).filter(Boolean),
    expected_minutes: Number($("#taskExpected").value)
  };
  $("#taskFormState").textContent = "저장 중…";
  try {
    await api(id ? "update_task" : "create_task", payload);
    $("#taskFormState").textContent = "서버 DB 저장 완료";
    resetTaskForm();
    await loadState(currentPlanId);
  } catch (error) {
    $("#taskFormState").textContent = "실패: " + error.message;
  }
});

$("#resetTaskForm").addEventListener("click", resetTaskForm);
$("#taskSearch").addEventListener("input", renderTasks);
$("#taskFilter").addEventListener("change", renderTasks);
$("#clearReviewFilter").addEventListener("click", () => {
  $("#taskFilter").value = "all";
  $("#taskSearch").value = "";
  renderTasks();
});

$("#executionForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#executionFormState").textContent = "저장 중…";
  try {
    await api("add_execution", {
      task_id: $("#executionTask").value,
      started_at: new Date($("#executionStart").value).toISOString(),
      ended_at: new Date($("#executionEnd").value).toISOString(),
      actual_minutes: Number($("#executionMinutes").value),
      blocker_reason: $("#executionBlocker").value
    });
    $("#executionFormState").textContent = "실행 기록 저장 완료";
    $("#executionBlocker").value = "";
    $("#executionStart").value = "";
    $("#executionEnd").value = "";
    $("#executionMinutes").value = "";
    await loadState(currentPlanId);
  } catch (error) {
    $("#executionFormState").textContent = "실패: " + error.message;
  }
});

$("#reflectionForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  $("#reflectionFormState").textContent = "저장 중…";
  try {
    const result = await api("carry_reflection", {
      plan_id: currentPlanId,
      improvement_note: $("#reflectionNote").value,
      next_title: $("#nextPlanTitle").value,
      next_start_date: $("#nextPlanStart").value,
      next_end_date: $("#nextPlanEnd").value,
      next_expected_minutes: Number($("#nextPlanExpected").value),
      next_success_criteria: $("#nextPlanCriteria").value
    });
    $("#reflectionFormState").textContent = "다음 계획으로 전달 완료";
    $("#reflectionForm").reset();
    await loadState(result.next_plan.id);
  } catch (error) {
    $("#reflectionFormState").textContent = "실패: " + error.message;
  }
});

$("#doubleCompleteButton").addEventListener("click", async () => {
  const stateBox = $("#doubleCompleteState");
  const candidate = (appState.tasks || []).find((task) =>
    !task.completed && (task.tags || []).includes("보안")
  ) || (appState.tasks || []).find((task) => !task.completed);

  stateBox.hidden = false;
  stateBox.className = "test-result";
  if (!candidate) {
    stateBox.textContent = "검사할 미완료 할 일이 없습니다. 완료 항목 하나를 진행 중으로 되돌린 뒤 다시 실행하세요.";
    return;
  }

  const beforeEvents = completionCount(candidate.id);
  const beforeCompleted = appState.summary.completed_count;
  stateBox.textContent = "같은 완료 요청 2건을 연속 전송 중… · 대상: " + candidate.title;
  $("#doubleCompleteButton").disabled = true;

  try {
    await Promise.all([
      api("set_completed", { id: candidate.id, completed: true }),
      api("set_completed", { id: candidate.id, completed: true })
    ]);
    await loadState(currentPlanId);
    const afterEvents = completionCount(candidate.id);
    const afterCompleted = appState.summary.completed_count;
    const pass = afterEvents === beforeEvents + 1 && afterCompleted === beforeCompleted + 1;
    stateBox.hidden = false;
    stateBox.className = "test-result " + (pass ? "pass" : "fail");
    stateBox.textContent = (pass ? "PASS" : "FAIL") +
      " · 완료 요청 2건 → 완료 기록 " + beforeEvents + "→" + afterEvents +
      "건 · 돌아보기 완료 수 " + beforeCompleted + "→" + afterCompleted + " (정확히 +1)";
  } catch (error) {
    stateBox.hidden = false;
    stateBox.className = "test-result fail";
    stateBox.textContent = "검사 실패: " + error.message;
  } finally {
    $("#doubleCompleteButton").disabled = false;
  }
});

$("#exportButton").addEventListener("click", async () => {
  const button = $("#exportButton");
  button.disabled = true;
  button.textContent = "전체 자료 모으는 중…";
  try {
    const planIds = (appState.plans || []).map((plan) => plan.id);
    const datasets = [];
    for (const planId of planIds) datasets.push(await api("state", { plan_id: planId }));
    const payload = {
      exported_at: new Date().toISOString(),
      timezone: "Asia/Seoul",
      schema_contract: "../contracts/pds-schema-v2.json",
      plans: datasets
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "t06-plan-do-see-export-" + appState.today + ".json";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    alert("내보내기 실패: " + error.message);
  } finally {
    button.disabled = false;
    button.textContent = "전체 자료 JSON 내보내기";
  }
});

loadState().catch(() => {});

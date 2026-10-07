const GAME_SECONDS = 30;
const DIFFICULTY_GATES = { before: 8, after: 10 };
const STORAGE_KEY = "t02-gate-sprint-save-v2";
const COLORS = [
  { id: "blue", label: "파란색" },
  { id: "orange", label: "주황색" },
];

function defaultSave() {
  return {
    version: 2,
    totalPlays: 0,
    wins: 0,
    bestGates: 0,
    effectReduced: false,
    experiment: {
      mode: "before",
      before: [],
      after: [],
      finalDifficulty: 8,
      finalReason: "",
    },
  };
}

function isRunRecord(item) {
  return item &&
    (item.result === "success" || item.result === "failed") &&
    Number.isFinite(item.gates) &&
    Number.isFinite(item.elapsed) &&
    typeof item.reason === "string";
}

function validateSave(data) {
  if (!data || data.version !== 2) return false;
  if (!Number.isFinite(data.totalPlays) || data.totalPlays < 0) return false;
  if (!Number.isFinite(data.wins) || data.wins < 0) return false;
  if (!Number.isFinite(data.bestGates) || data.bestGates < 0) return false;
  if (typeof data.effectReduced !== "boolean") return false;
  if (!data.experiment || !["before", "after"].includes(data.experiment.mode)) return false;
  if (!Array.isArray(data.experiment.before) || !Array.isArray(data.experiment.after)) return false;
  if (!data.experiment.before.every(isRunRecord) || !data.experiment.after.every(isRunRecord)) return false;
  if (![8, 10].includes(Number(data.experiment.finalDifficulty))) return false;
  if (typeof data.experiment.finalReason !== "string") return false;
  return true;
}

function readSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null || raw.trim() === "") {
      return { data: defaultSave(), recovery: "기본값" };
    }
    const parsed = JSON.parse(raw);
    if (!validateSave(parsed)) {
      return { data: defaultSave(), recovery: "손상 복구" };
    }
    parsed.experiment.before = parsed.experiment.before.slice(0, 10);
    parsed.experiment.after = parsed.experiment.after.slice(0, 10);
    return { data: parsed, recovery: "정상" };
  } catch (error) {
    return { data: defaultSave(), recovery: "손상 복구" };
  }
}

const loaded = readSave();
let saveData = loaded.data;
let storageRecovery = loaded.recovery;

const state = {
  phase: "ready",
  progress: 0,
  targetGates: DIFFICULTY_GATES[saveData.experiment.mode],
  deadline: 0,
  remainingMs: GAME_SECONDS * 1000,
  targetColor: null,
  leftColor: null,
  rightColor: null,
  timerId: null,
  roundLocked: false,
  inputCount: 0,
  autoPaused: false,
  failureReason: "",
  diagnostic: false,
};

const statusBadge = document.querySelector("#statusBadge");
const stateText = document.querySelector("#stateText");
const timeText = document.querySelector("#timeText");
const progressText = document.querySelector("#progressText");
const targetGateText = document.querySelector("#targetGateText");
const inputText = document.querySelector("#inputText");
const targetText = document.querySelector("#targetText");
const leftDoor = document.querySelector("#leftDoor");
const rightDoor = document.querySelector("#rightDoor");
const leftColor = document.querySelector("#leftColor");
const rightColor = document.querySelector("#rightColor");
const roundMessage = document.querySelector("#roundMessage");
const startButton = document.querySelector("#startButton");
const pauseButton = document.querySelector("#pauseButton");
const restartButton = document.querySelector("#restartButton");
const arena = document.querySelector("#arena");
const motionButton = document.querySelector("#motionButton");

const storageState = document.querySelector("#storageState");
const totalPlayText = document.querySelector("#totalPlayText");
const winText = document.querySelector("#winText");
const bestGateText = document.querySelector("#bestGateText");
const recoveryText = document.querySelector("#recoveryText");

const beforeModeButton = document.querySelector("#beforeModeButton");
const afterModeButton = document.querySelector("#afterModeButton");
const experimentState = document.querySelector("#experimentState");
const beforeSummary = document.querySelector("#beforeSummary");
const afterSummary = document.querySelector("#afterSummary");
const beforeStats = document.querySelector("#beforeStats");
const afterStats = document.querySelector("#afterStats");
const experimentTable = document.querySelector("#experimentTable");
const finalDifficulty = document.querySelector("#finalDifficulty");
const saveFinalButton = document.querySelector("#saveFinalButton");
const choiceReason = document.querySelector("#choiceReason");

const burstTestButton = document.querySelector("#burstTestButton");
const burstTestResult = document.querySelector("#burstTestResult");

function persistSave() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
    storageState.textContent = "정상";
    storageRecovery = "정상";
    return true;
  } catch (error) {
    storageState.textContent = "저장 제한";
    return false;
  }
}

function colorById(id) {
  return COLORS.find((color) => color.id === id);
}

function setPhase(phase, message) {
  state.phase = phase;
  const labels = {
    ready: "시작 전",
    playing: "플레이 중",
    paused: "일시정지",
    success: "성공",
    failed: "실패",
  };

  stateText.textContent = labels[phase];
  statusBadge.textContent = labels[phase];
  statusBadge.dataset.state = phase;

  if (message) {
    roundMessage.textContent = message;
  }

  pauseButton.disabled = !["playing", "paused"].includes(phase);
  pauseButton.textContent = phase === "paused" ? "재개" : "일시정지";

  const gameActive = phase === "playing" || phase === "paused";
  beforeModeButton.disabled = gameActive;
  afterModeButton.disabled = gameActive;
  burstTestButton.disabled = gameActive;
}

function renderProgress() {
  progressText.textContent = String(state.progress);
  targetGateText.textContent = String(state.targetGates);
  inputText.textContent = String(state.inputCount);
}

function renderDoors() {
  const left = colorById(state.leftColor);
  const right = colorById(state.rightColor);
  const target = colorById(state.targetColor);

  leftColor.textContent = left ? left.label : "?";
  rightColor.textContent = right ? right.label : "?";
  targetText.textContent = target ? target.label + " 문" : "게임을 시작하세요";

  leftColor.dataset.color = left ? left.id : "";
  rightColor.dataset.color = right ? right.id : "";

  const enabled = state.phase === "playing" && !state.roundLocked;
  leftDoor.disabled = !enabled;
  rightDoor.disabled = !enabled;
}

function makeRound() {
  if (state.diagnostic) {
    state.targetColor = "blue";
    state.leftColor = "blue";
    state.rightColor = "orange";
  } else {
    const targetIndex = Math.random() < 0.5 ? 0 : 1;
    const target = COLORS[targetIndex];
    const other = COLORS[1 - targetIndex];
    const targetOnLeft = Math.random() < 0.5;
    state.targetColor = target.id;
    state.leftColor = targetOnLeft ? target.id : other.id;
    state.rightColor = targetOnLeft ? other.id : target.id;
  }

  state.roundLocked = false;
  roundMessage.className = "round-message";
  roundMessage.textContent = "목표 색과 같은 문을 선택하세요.";
  renderDoors();
}

function stopTimer() {
  if (state.timerId !== null) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
}

function currentRemainingMs() {
  if (state.phase === "playing") {
    return Math.max(0, state.deadline - performance.now());
  }
  return Math.max(0, state.remainingMs);
}

function updateTimer() {
  if (state.phase !== "playing") return;
  state.remainingMs = currentRemainingMs();
  timeText.textContent = (state.remainingMs / 1000).toFixed(1);

  if (state.remainingMs <= 0) {
    timeText.textContent = "0.0";
    state.failureReason = "시간 종료";
    finishGame(false, "시간 종료! 30초 안에 모든 관문을 통과하지 못했습니다.");
  }
}

function startTimerFromRemaining() {
  state.deadline = performance.now() + state.remainingMs;
  stopTimer();
  state.timerId = setInterval(updateTimer, 100);
  updateTimer();
}

function median(values) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function runStats(records) {
  const wins = records.filter((record) => record.result === "success");
  const medianTime = median(wins.map((record) => record.elapsed));
  const reasonCounts = {};
  records.filter((record) => record.result === "failed").forEach((record) => {
    reasonCounts[record.reason] = (reasonCounts[record.reason] || 0) + 1;
  });
  const repeatedReason = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])[0];
  return {
    successRate: records.length ? wins.length / records.length : 0,
    medianTime,
    repeatedReason: repeatedReason ? repeatedReason[0] + " " + repeatedReason[1] + "회" : "없음",
  };
}

function renderExperiment() {
  const before = saveData.experiment.before;
  const after = saveData.experiment.after;
  const total = before.length + after.length;
  experimentState.textContent = total + " / 20";
  beforeSummary.textContent = before.length + "/10 기록";
  afterSummary.textContent = after.length + "/10 기록";

  const beforeData = runStats(before);
  const afterData = runStats(after);

  beforeStats.textContent = before.length
    ? "성공률 " + Math.round(beforeData.successRate * 100) + "% · 성공 중앙값 " + (beforeData.medianTime === null ? "-" : beforeData.medianTime.toFixed(1) + "초") + " · 반복 실패 " + beforeData.repeatedReason
    : "플레이 기록을 기다리는 중";

  afterStats.textContent = after.length
    ? "성공률 " + Math.round(afterData.successRate * 100) + "% · 성공 중앙값 " + (afterData.medianTime === null ? "-" : afterData.medianTime.toFixed(1) + "초") + " · 반복 실패 " + afterData.repeatedReason
    : "플레이 기록을 기다리는 중";

  beforeModeButton.classList.toggle("is-active", saveData.experiment.mode === "before");
  beforeModeButton.setAttribute("aria-pressed", String(saveData.experiment.mode === "before"));
  afterModeButton.classList.toggle("is-active", saveData.experiment.mode === "after");
  afterModeButton.setAttribute("aria-pressed", String(saveData.experiment.mode === "after"));

  finalDifficulty.value = String(saveData.experiment.finalDifficulty);
  choiceReason.textContent = saveData.experiment.finalReason ||
    "20회 기록이 쌓이면 성공률·성공 시간 중앙값·반복 실패 원인을 바탕으로 선택 이유를 표시합니다.";

  const combined = before.map((record, index) => ({ ...record, phase: "변경 전", order: index + 1 }))
    .concat(after.map((record, index) => ({ ...record, phase: "변경 후", order: index + 1 })));

  experimentTable.replaceChildren();

  if (!combined.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 6;
    cell.textContent = "아직 플레이 기록이 없습니다.";
    row.appendChild(cell);
    experimentTable.appendChild(row);
    return;
  }

  combined.forEach((record) => {
    const row = document.createElement("tr");
    [
      record.order,
      record.phase,
      record.gates,
      record.result === "success" ? "성공" : "실패",
      record.elapsed.toFixed(1) + "초",
      record.reason || "-",
    ].forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = String(value);
      row.appendChild(cell);
    });
    experimentTable.appendChild(row);
  });
}

function renderSaveStats() {
  totalPlayText.textContent = String(saveData.totalPlays);
  winText.textContent = String(saveData.wins);
  bestGateText.textContent = String(saveData.bestGates);
  recoveryText.textContent = storageRecovery;
  storageState.textContent = storageRecovery === "정상" ? "정상" : storageRecovery;
}

function recordCompletedGame(success) {
  if (state.diagnostic) return;

  saveData.totalPlays += 1;
  if (success) saveData.wins += 1;
  saveData.bestGates = Math.max(saveData.bestGates, state.progress);

  const mode = saveData.experiment.mode;
  const bucket = saveData.experiment[mode];
  if (bucket.length < 10) {
    const elapsed = Math.max(0, GAME_SECONDS - state.remainingMs / 1000);
    bucket.push({
      result: success ? "success" : "failed",
      gates: state.targetGates,
      elapsed: Math.round(elapsed * 10) / 10,
      reason: success ? "" : state.failureReason || "오답",
    });
  }

  persistSave();
  renderSaveStats();
  renderExperiment();
}

function triggerSuccessEffect() {
  if (saveData.effectReduced) return;
  arena.classList.remove("success-effect");
  void arena.offsetWidth;
  arena.classList.add("success-effect");
  window.setTimeout(() => arena.classList.remove("success-effect"), 520);
}

function finishGame(success, message) {
  state.remainingMs = currentRemainingMs();
  stopTimer();
  state.roundLocked = true;
  setPhase(success ? "success" : "failed", message);
  roundMessage.className = success ? "round-message success" : "round-message fail";
  leftDoor.disabled = true;
  rightDoor.disabled = true;
  startButton.hidden = true;
  restartButton.hidden = false;

  if (success) triggerSuccessEffect();
  recordCompletedGame(success);

  if (!state.diagnostic) restartButton.focus();
}

function pauseGame(autoPause) {
  if (state.phase !== "playing") return;
  state.remainingMs = currentRemainingMs();
  stopTimer();
  state.autoPaused = Boolean(autoPause);
  setPhase("paused", autoPause ? "창을 벗어나 자동으로 일시정지했습니다." : "일시정지했습니다. P 또는 재개 버튼으로 계속하세요.");
  renderDoors();
}

function resumeGame() {
  if (state.phase !== "paused") return;
  state.autoPaused = false;
  setPhase("playing", "재개했습니다. 목표 색과 같은 문을 선택하세요.");
  startTimerFromRemaining();
  renderDoors();
}

function resetGame() {
  stopTimer();
  state.progress = 0;
  state.targetGates = DIFFICULTY_GATES[saveData.experiment.mode];
  state.deadline = 0;
  state.remainingMs = GAME_SECONDS * 1000;
  state.targetColor = null;
  state.leftColor = null;
  state.rightColor = null;
  state.roundLocked = false;
  state.inputCount = 0;
  state.autoPaused = false;
  state.failureReason = "";

  renderProgress();
  timeText.textContent = GAME_SECONDS.toFixed(1);
  setPhase("ready", "시작 버튼을 누르면 첫 관문이 열립니다.");
  roundMessage.className = "round-message";
  startButton.hidden = false;
  restartButton.hidden = true;
  startButton.disabled = false;
  renderDoors();
}

function startGame() {
  resetGame();
  setPhase("playing", "목표 색과 같은 문을 선택하세요.");
  startButton.hidden = true;
  restartButton.hidden = true;
  makeRound();
  startTimerFromRemaining();
  arena.focus();
}

function chooseDoor(side) {
  if (state.phase !== "playing" || state.roundLocked) return;

  state.roundLocked = true;
  state.inputCount += 1;
  renderProgress();

  const selectedColor = side === "left" ? state.leftColor : state.rightColor;
  const correct = selectedColor === state.targetColor;

  if (!correct) {
    state.failureReason = "오답";
    finishGame(false, "잘못된 문입니다. 실패!");
    return;
  }

  state.progress += 1;
  renderProgress();

  if (state.progress >= state.targetGates) {
    finishGame(true, "성공! " + state.targetGates + "개의 관문을 모두 통과했습니다.");
    return;
  }

  roundMessage.className = "round-message success";
  roundMessage.textContent = "통과! 다음 관문으로 이동합니다.";
  makeRound();
}

function switchExperimentMode(mode) {
  if (!["before", "after"].includes(mode)) return;
  if (state.phase === "playing" || state.phase === "paused") return;

  saveData.experiment.mode = mode;
  persistSave();
  resetGame();
  renderExperiment();
}

function buildFinalReason(selected) {
  const beforeData = runStats(saveData.experiment.before);
  const afterData = runStats(saveData.experiment.after);
  return [
    "8문 성공률 " + Math.round(beforeData.successRate * 100) + "%, 성공 시간 중앙값 " + (beforeData.medianTime === null ? "-" : beforeData.medianTime.toFixed(1) + "초") + ", 반복 실패 " + beforeData.repeatedReason + ".",
    "10문 성공률 " + Math.round(afterData.successRate * 100) + "%, 성공 시간 중앙값 " + (afterData.medianTime === null ? "-" : afterData.medianTime.toFixed(1) + "초") + ", 반복 실패 " + afterData.repeatedReason + ".",
    "이 20회 기록을 비교해 최종값을 " + selected + "문으로 선택했습니다.",
  ].join(" ");
}

function saveFinalDifficulty() {
  if (saveData.experiment.before.length < 10 || saveData.experiment.after.length < 10) {
    choiceReason.textContent = "최종 선택 전에 변경 전 10회와 변경 후 10회를 모두 기록해야 합니다.";
    return;
  }

  const selected = Number(finalDifficulty.value);
  saveData.experiment.finalDifficulty = selected;
  saveData.experiment.finalReason = buildFinalReason(selected);
  saveData.experiment.mode = selected === 8 ? "before" : "after";
  persistSave();
  resetGame();
  renderExperiment();
}

function runBurstTest() {
  if (state.phase === "playing" || state.phase === "paused") return;

  resetGame();
  state.diagnostic = true;
  state.targetGates = 20;
  state.progress = 0;
  state.inputCount = 0;
  state.remainingMs = GAME_SECONDS * 1000;
  state.deadline = performance.now() + state.remainingMs;
  setPhase("playing", "연속 입력 자체검사 중");
  makeRound();

  const started = performance.now();
  for (let i = 0; i < 10; i += 1) {
    arena.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
  }
  const elapsed = performance.now() - started;
  const passed = state.inputCount === 10 && state.progress === 10 && elapsed < 1000;

  state.diagnostic = false;
  stopTimer();
  resetGame();

  burstTestResult.textContent = passed
    ? "PASS · 10건 → 10회 처리 · " + elapsed.toFixed(1) + "ms"
    : "FAIL · 입력 " + state.inputCount + "회 / 진행 " + state.progress + "회";
  burstTestResult.style.color = passed ? "var(--success)" : "var(--danger)";
}

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);
pauseButton.addEventListener("click", () => {
  if (state.phase === "playing") pauseGame(false);
  else if (state.phase === "paused") resumeGame();
});
leftDoor.addEventListener("click", () => chooseDoor("left"));
rightDoor.addEventListener("click", () => chooseDoor("right"));

arena.addEventListener("keydown", (event) => {
  if (event.repeat) return;

  const key = event.key.toLowerCase();
  if (event.key === "ArrowLeft" || key === "a") {
    event.preventDefault();
    chooseDoor("left");
  } else if (event.key === "ArrowRight" || key === "d") {
    event.preventDefault();
    chooseDoor("right");
  } else if (key === "p") {
    event.preventDefault();
    if (state.phase === "playing") pauseGame(false);
    else if (state.phase === "paused") resumeGame();
  }
});

beforeModeButton.addEventListener("click", () => switchExperimentMode("before"));
afterModeButton.addEventListener("click", () => switchExperimentMode("after"));
saveFinalButton.addEventListener("click", saveFinalDifficulty);
burstTestButton.addEventListener("click", runBurstTest);

motionButton.addEventListener("click", () => {
  saveData.effectReduced = !saveData.effectReduced;
  document.documentElement.dataset.motion = saveData.effectReduced ? "reduced" : "full";
  motionButton.setAttribute("aria-pressed", String(saveData.effectReduced));
  motionButton.textContent = saveData.effectReduced ? "효과: 줄임" : "효과: 켬";
  if (saveData.effectReduced) arena.classList.remove("success-effect");
  persistSave();
});

window.addEventListener("blur", () => {
  if (state.phase === "playing") pauseGame(true);
});

window.addEventListener("focus", () => {
  if (state.phase === "paused" && state.autoPaused) resumeGame();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.phase === "playing") pauseGame(true);
  if (!document.hidden && state.phase === "paused" && state.autoPaused) resumeGame();
});

document.documentElement.dataset.motion = saveData.effectReduced ? "reduced" : "full";
motionButton.setAttribute("aria-pressed", String(saveData.effectReduced));
motionButton.textContent = saveData.effectReduced ? "효과: 줄임" : "효과: 켬";
renderSaveStats();
renderExperiment();
resetGame();

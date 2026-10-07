const GAME_SECONDS = 30;
const TARGET_GATES = 8;
const COLORS = [
  { id: "blue", label: "파란색" },
  { id: "orange", label: "주황색" },
];

const state = {
  phase: "ready",
  progress: 0,
  deadline: 0,
  targetColor: null,
  leftColor: null,
  rightColor: null,
  timerId: null,
  roundLocked: false,
};

const statusBadge = document.querySelector("#statusBadge");
const stateText = document.querySelector("#stateText");
const timeText = document.querySelector("#timeText");
const progressText = document.querySelector("#progressText");
const targetText = document.querySelector("#targetText");
const leftDoor = document.querySelector("#leftDoor");
const rightDoor = document.querySelector("#rightDoor");
const leftColor = document.querySelector("#leftColor");
const rightColor = document.querySelector("#rightColor");
const roundMessage = document.querySelector("#roundMessage");
const startButton = document.querySelector("#startButton");
const restartButton = document.querySelector("#restartButton");
const arena = document.querySelector("#arena");

function colorById(id) {
  return COLORS.find((color) => color.id === id);
}

function setPhase(phase, message) {
  state.phase = phase;
  const labels = {
    ready: "시작 전",
    playing: "플레이 중",
    success: "성공",
    failed: "실패",
  };

  stateText.textContent = labels[phase];
  statusBadge.textContent = labels[phase];
  statusBadge.dataset.state = phase;

  if (message) {
    roundMessage.textContent = message;
  }
}

function renderProgress() {
  progressText.textContent = String(state.progress);
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
  const targetIndex = Math.random() < 0.5 ? 0 : 1;
  const target = COLORS[targetIndex];
  const other = COLORS[1 - targetIndex];
  const targetOnLeft = Math.random() < 0.5;

  state.targetColor = target.id;
  state.leftColor = targetOnLeft ? target.id : other.id;
  state.rightColor = targetOnLeft ? other.id : target.id;
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

function finishGame(success, message) {
  stopTimer();
  state.roundLocked = true;
  setPhase(success ? "success" : "failed", message);
  roundMessage.className = success ? "round-message success" : "round-message fail";
  leftDoor.disabled = true;
  rightDoor.disabled = true;
  startButton.hidden = true;
  restartButton.hidden = false;
  restartButton.focus();
}

function updateTimer() {
  if (state.phase !== "playing") return;

  const remainingMs = Math.max(0, state.deadline - performance.now());
  timeText.textContent = (remainingMs / 1000).toFixed(1);

  if (remainingMs <= 0) {
    timeText.textContent = "0.0";
    finishGame(false, "시간 종료! 30초 안에 모든 관문을 통과하지 못했습니다.");
  }
}

function resetGame() {
  stopTimer();
  state.progress = 0;
  state.deadline = 0;
  state.targetColor = null;
  state.leftColor = null;
  state.rightColor = null;
  state.roundLocked = false;

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
  state.progress = 0;
  state.deadline = performance.now() + GAME_SECONDS * 1000;
  setPhase("playing", "목표 색과 같은 문을 선택하세요.");
  startButton.hidden = true;
  restartButton.hidden = true;
  renderProgress();
  makeRound();
  updateTimer();
  state.timerId = setInterval(updateTimer, 100);
  arena.focus();
}

function chooseDoor(side) {
  if (state.phase !== "playing" || state.roundLocked) return;

  state.roundLocked = true;
  leftDoor.disabled = true;
  rightDoor.disabled = true;

  const selectedColor = side === "left" ? state.leftColor : state.rightColor;
  const correct = selectedColor === state.targetColor;

  if (!correct) {
    finishGame(false, "잘못된 문입니다. 실패!");
    return;
  }

  state.progress += 1;
  renderProgress();

  if (state.progress >= TARGET_GATES) {
    finishGame(true, "성공! 8개의 관문을 모두 통과했습니다.");
    return;
  }

  roundMessage.className = "round-message success";
  roundMessage.textContent = "통과! 다음 관문으로 이동합니다.";

  window.setTimeout(() => {
    if (state.phase === "playing") {
      makeRound();
    }
  }, 180);
}

startButton.addEventListener("click", startGame);
restartButton.addEventListener("click", startGame);
leftDoor.addEventListener("click", () => chooseDoor("left"));
rightDoor.addEventListener("click", () => chooseDoor("right"));

arena.addEventListener("keydown", (event) => {
  if (event.repeat || state.phase !== "playing") return;

  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") {
    event.preventDefault();
    chooseDoor("left");
  }

  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") {
    event.preventDefault();
    chooseDoor("right");
  }
});

resetGame();

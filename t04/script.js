const API_URL = "/api/t04-live";
const HISTORY_URL = "./data/live-history.json";
const ASSET_BASE = "./assets/";

const liveStatus = document.querySelector("#liveStatus");
const liveValue = document.querySelector("#liveValue");
const liveUnit = document.querySelector("#liveUnit");
const sourceLink = document.querySelector("#sourceLink");
const sourceTime = document.querySelector("#sourceTime");
const fetchedAt = document.querySelector("#fetchedAt");
const recordDate = document.querySelector("#recordDate");
const freshness = document.querySelector("#freshness");
const liveMessage = document.querySelector("#liveMessage");
const refreshLiveButton = document.querySelector("#refreshLiveButton");

const dayCount = document.querySelector("#dayCount");
const liveHistoryBody = document.querySelector("#liveHistoryBody");
const deltaValue = document.querySelector("#deltaValue");
const deltaExplanation = document.querySelector("#deltaExplanation");
const twoDayNote = document.querySelector("#twoDayNote");

const rawPreview = document.querySelector("#rawPreview");
const storedPreview = document.querySelector("#storedPreview");
const displayPreview = document.querySelector("#displayPreview");
const matchState = document.querySelector("#matchState");

const verifyHashesButton = document.querySelector("#verifyHashesButton");
const hashState = document.querySelector("#hashState");
const hashList = document.querySelector("#hashList");

const replayStatus = document.querySelector("#replayStatus");
const replayFreshness = document.querySelector("#replayFreshness");
const replayError = document.querySelector("#replayError");
const replayValue = document.querySelector("#replayValue");
const replayRows = document.querySelector("#replayRows");
const replayDelta = document.querySelector("#replayDelta");
const replayFixture = document.querySelector("#replayFixture");
const replayMessage = document.querySelector("#replayMessage");
const replayHistoryBody = document.querySelector("#replayHistoryBody");
const recoverButton = document.querySelector("#recoverButton");
const successSequenceButton = document.querySelector("#successSequenceButton");
const resetReplayButton = document.querySelector("#resetReplayButton");

const MANIFEST_URL = ASSET_BASE + "asset-manifest.json";

const FIXTURE_PATHS = {
  "normal-d1-a": "fixtures/normal-d1-a.json",
  "normal-d1-b": "fixtures/normal-d1-b.json",
  "normal-d2": "fixtures/normal-d2.json",
  "timeout": "fixtures/timeout.json",
  "auth-401": "fixtures/auth-401.json",
  "rate-429": "fixtures/rate-429.json",
  "offline": "fixtures/offline.json",
  "schema-break": "fixtures/schema-break.json",
  "recover-d2": "fixtures/recover-d2.json"
};

const ERROR_COPY = {
  timeout: "외부 응답이 제한시간을 넘겼습니다. 마지막 정상값을 오래된 값으로 표시하고 다시 시도할 수 있습니다.",
  auth: "외부 데이터 원천이 401/403으로 거절했습니다. 앱 로그인 오류가 아니며 마지막 정상값을 유지합니다.",
  rate_limit: "외부 원천의 호출 제한입니다. 잠시 뒤 다시 시도해야 하며 마지막 정상값을 유지합니다.",
  offline: "네트워크가 끊긴 합성 상태입니다. 연결을 확인한 뒤 다시 시도하며 마지막 정상값을 유지합니다.",
  schema_error: "응답 형식이 계약과 달라 저장을 거부했습니다. 마지막 정상값은 바꾸지 않습니다."
};

let committedHistory = [];
let currentLive = null;
let replayState = resetReplayState();

function formatDateTime(value) {
  if (!value) return "시각 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date) + " KST";
}

function setPill(node, text, type) {
  node.textContent = text;
  node.className = "state-pill" + (type ? " " + type : "");
}

function escapeJson(value) {
  return JSON.stringify(value, null, 2);
}

async function loadCommittedHistory() {
  try {
    const response = await fetch(HISTORY_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("history HTTP " + response.status);
    const payload = await response.json();
    committedHistory = Array.isArray(payload.records) ? payload.records.slice() : [];
  } catch (error) {
    committedHistory = [];
  }
  renderHistory();
  renderMatch();
}

function renderHistory() {
  committedHistory.sort((a, b) => a.record_date.localeCompare(b.record_date));
  const count = committedHistory.length;
  setPill(dayCount, count + " / 2", count === 2 ? "success" : "stale");

  liveHistoryBody.replaceChildren();
  if (!count) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.textContent = "아직 저장소에 봉인한 실제 날짜 기록이 없습니다.";
    row.appendChild(cell);
    liveHistoryBody.appendChild(row);
  } else {
    committedHistory.forEach((item) => {
      const row = document.createElement("tr");
      [
        item.record_date,
        item.normalized_value + " " + item.unit,
        formatDateTime(item.source_observed_at),
        formatDateTime(item.server_created_at)
      ].forEach((value) => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.appendChild(cell);
      });
      liveHistoryBody.appendChild(row);
    });
  }

  if (count === 2) {
    const first = committedHistory[0];
    const second = committedHistory[1];
    if (first.unit === second.unit) {
      const signed = second.normalized_value - first.normalized_value;
      const direction = signed > 0 ? "증가" : signed < 0 ? "감소" : "변화 없음";
      deltaValue.textContent = (signed > 0 ? "+" : "") + signed.toFixed(1) + " " + second.unit;
      deltaExplanation.textContent =
        first.record_date + " " + first.normalized_value + " → " +
        second.record_date + " " + second.normalized_value + " · " + direction +
        " · 계산식: " + second.normalized_value + " - " + first.normalized_value;
      twoDayNote.textContent = "서로 다른 실제 KST 날짜 2건이 보존되어 있습니다. 합성 fixture와 분리되어 있습니다.";
    } else {
      deltaValue.textContent = "단위 불일치";
      deltaExplanation.textContent = "두 실제 기록의 단위가 달라 변화값을 계산하지 않았습니다.";
    }
  } else {
    deltaValue.textContent = "계산 대기";
    deltaExplanation.textContent = "서로 다른 실제 KST 날짜 2건이 모이면 저장된 두 값으로 다시 계산합니다.";
    twoDayNote.textContent = count === 1
      ? "첫 실제 날짜 1건만 보존했습니다. 다음 KST 날짜가 되기 전에는 두 번째 기록을 만들지 않습니다."
      : "합성 D1/D2는 실제 날짜 기록을 대신하지 않습니다.";
  }
}

async function fetchLive() {
  refreshLiveButton.disabled = true;
  setPill(liveStatus, "조회 중", "");
  liveMessage.textContent = "비밀키 없는 서버 경로에서 Open-Meteo를 조회하고 있습니다.";

  try {
    const response = await fetch(API_URL, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error_code || "live_error");
    }

    currentLive = payload;
    const r = payload.reading;
    liveValue.textContent = String(r.normalized_value);
    liveUnit.textContent = r.unit;
    sourceLink.textContent = r.source_name;
    sourceLink.href = r.source_url;
    sourceTime.textContent = formatDateTime(r.source_time);
    fetchedAt.textContent = formatDateTime(r.fetched_at);
    recordDate.textContent = r.record_date;
    freshness.textContent = payload.status.freshness + " / " + payload.status.error_code;
    setPill(liveStatus, "fresh", "success");
    liveMessage.textContent = "정상 조회입니다. 현재 조회는 화면에 표시되며, 실제 날짜 증거는 저장소에 봉인된 기록만 집계합니다.";
    renderMatch();
  } catch (error) {
    setPill(liveStatus, "실패", "error");
    freshness.textContent = "stale / " + error.message;
    liveMessage.textContent = "실제 원천을 지금 조회하지 못했습니다. 보존된 실제 날짜 기록은 삭제하지 않습니다.";
  } finally {
    refreshLiveButton.disabled = false;
  }
}

function renderMatch() {
  const record = committedHistory.length ? committedHistory[committedHistory.length - 1] : null;
  if (record) {
    rawPreview.textContent = escapeJson(record.raw);
    storedPreview.textContent = escapeJson({
      source_url: record.source_url,
      source_observed_at: record.source_observed_at,
      normalized_value: record.normalized_value,
      unit: record.unit,
      record_date: record.record_date,
      server_created_at: record.server_created_at
    });
    displayPreview.textContent = record.normalized_value + " " + record.unit + "\n" +
      "출처 시각: " + formatDateTime(record.source_observed_at) + "\n" +
      "조회 시각: " + formatDateTime(record.server_created_at);
    setPill(matchState, "일치", "success");
    return;
  }

  if (currentLive) {
    rawPreview.textContent = escapeJson(currentLive.raw);
    storedPreview.textContent = escapeJson(currentLive.reading);
    displayPreview.textContent = currentLive.reading.normalized_value + " " + currentLive.reading.unit;
    setPill(matchState, "현재 조회", "stale");
  }
}

async function sha256Bytes(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function loadIntegrityAsset(path) {
  const response = await fetch(ASSET_BASE + path, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("ASSET_HTTP_" + response.status);
  }
  return { bytes: await response.arrayBuffer() };
}

async function verifyPackageHashes() {
  verifyHashesButton.disabled = true;
  hashList.replaceChildren();
  setPill(hashState, "검사 중", "");

  try {
    const manifestResponse = await fetch(MANIFEST_URL, { cache: "no-store" });
    if (!manifestResponse.ok) throw new Error("MANIFEST_HTTP_" + manifestResponse.status);
    const manifest = await manifestResponse.json();

    const report = await PackageIntegrity.verifyPackage(
      manifest,
      loadIntegrityAsset,
      sha256Bytes
    );

    report.results.forEach((item) => {
      const row = document.createElement("div");
      row.className = "hash-item";

      const name = document.createElement("span");
      name.textContent = item.path;

      const code = document.createElement("code");
      code.textContent = item.actual_sha256 || item.status;

      const result = document.createElement("strong");
      result.textContent = item.status;
      if (item.status !== "PASS") result.style.color = "var(--danger)";

      row.append(name, code, result);
      hashList.appendChild(row);
    });

    setPill(
      hashState,
      report.total + "개 · " + report.pass_count + " PASS · " + report.fail_count + " FAIL",
      report.overall === "PASS" ? "success" : "error"
    );
  } catch (error) {
    setPill(hashState, "manifest 검사 실패", "error");
    const row = document.createElement("div");
    row.className = "hash-item";
    row.textContent = String(error.message || error);
    hashList.appendChild(row);
  } finally {
    verifyHashesButton.disabled = false;
  }
}

function resetReplayState() {
  return {
    daily_readings: [],
    current_reading: null,
    status: null,
    last_delta: null,
    last_comparison: { state: "insufficient", direction: null, magnitude: null, unit: null },
    last_run: null
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function validateNormalizedReading(reading) {
  if (!reading || typeof reading !== "object") throw new Error("schema");
  const required = ["signal_id","normalized_value","unit","source_name","source_url","source_time","fetched_at","record_timezone","record_date"];
  if (Object.keys(reading).length !== required.length || required.some((key) => !(key in reading))) throw new Error("schema");
  if (typeof reading.normalized_value !== "number" || !Number.isFinite(reading.normalized_value)) throw new Error("schema");
  if (typeof reading.unit !== "string" || !reading.unit) throw new Error("schema");
  if (reading.record_timezone !== "Asia/Seoul") throw new Error("schema");
  return true;
}

function comparisonFor(rows, current) {
  const previous = rows
    .filter((row) => row.signal_id === current.signal_id && row.record_date < current.record_date)
    .sort((a, b) => b.record_date.localeCompare(a.record_date))[0];

  if (!previous) return { state: "insufficient", direction: null, magnitude: null, unit: null };
  if (previous.unit !== current.unit) return { state: "unit_mismatch", direction: null, magnitude: null, unit: null };

  const signed = current.normalized_value - previous.normalized_value;
  return {
    state: "comparable",
    direction: signed > 0 ? "increase" : signed < 0 ? "decrease" : "unchanged",
    magnitude: Math.abs(signed),
    unit: current.unit
  };
}

function applySuccess(state, reading, fixtureId) {
  validateNormalizedReading(reading);
  const next = clone(state);
  const index = next.daily_readings.findIndex(
    (row) => row.signal_id === reading.signal_id && row.record_date === reading.record_date
  );
  const existing = index >= 0 ? next.daily_readings[index] : null;
  const row = {
    record_id: existing ? existing.record_id : "demo-" + reading.signal_id + "-" + reading.record_date,
    signal_id: reading.signal_id,
    record_date: reading.record_date,
    normalized_value: reading.normalized_value,
    unit: reading.unit,
    first_fetched_at: existing ? existing.first_fetched_at : reading.fetched_at,
    last_fetched_at: reading.fetched_at,
    reading: clone(reading)
  };

  if (index >= 0) next.daily_readings[index] = row;
  else next.daily_readings.push(row);

  next.daily_readings.sort((a, b) => a.record_date.localeCompare(b.record_date));
  next.current_reading = clone(reading);
  next.status = { freshness: "fresh", error_code: "none" };
  next.last_comparison = comparisonFor(next.daily_readings, row);
  next.last_delta = next.last_comparison.magnitude;
  next.last_run = { fixture_id: fixtureId, outcome: "success", error_code: "none" };
  return next;
}

function applyError(state, errorCode, fixtureId) {
  const next = clone(state);
  next.status = { freshness: "stale", error_code: errorCode };
  next.last_run = { fixture_id: fixtureId, outcome: "error", error_code: errorCode };
  return next;
}

function runFixture(state, fixture) {
  if (fixture.transport.mode === "timeout") return applyError(state, "timeout", fixture.fixture_id);
  if (fixture.transport.mode === "offline") return applyError(state, "offline", fixture.fixture_id);
  if (fixture.transport.status === 401 || fixture.transport.status === 403) return applyError(state, "auth", fixture.fixture_id);
  if (fixture.transport.status === 429) return applyError(state, "rate_limit", fixture.fixture_id);
  if (fixture.transport.status >= 200 && fixture.transport.status < 300) {
    try {
      return applySuccess(state, fixture.payload, fixture.fixture_id);
    } catch (error) {
      return applyError(state, "schema_error", fixture.fixture_id);
    }
  }
  return applyError(state, "schema_error", fixture.fixture_id);
}

async function loadFixture(name) {
  const path = FIXTURE_PATHS[name];
  const response = await fetch(ASSET_BASE + path, { cache: "no-store" });
  if (!response.ok) throw new Error("fixture HTTP " + response.status);
  return response.json();
}

function renderReplay() {
  const status = replayState.status;
  const current = replayState.current_reading;
  replayFreshness.textContent = status ? status.freshness : "none";
  replayError.textContent = status ? status.error_code : "none";
  replayValue.textContent = current ? current.normalized_value + " " + current.unit : "--";
  replayRows.textContent = String(replayState.daily_readings.length);
  replayDelta.textContent = replayState.last_delta === null ? "--" :
    replayState.last_delta + " " + (replayState.last_comparison.unit || "");
  replayFixture.textContent = replayState.last_run ? replayState.last_run.fixture_id : "--";

  if (!status) setPill(replayStatus, "reset", "");
  else if (status.freshness === "fresh") setPill(replayStatus, "fresh / none", "success");
  else setPill(replayStatus, "stale / " + status.error_code, "stale");

  replayHistoryBody.replaceChildren();
  if (!replayState.daily_readings.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = "합성 행 없음";
    row.appendChild(cell);
    replayHistoryBody.appendChild(row);
  } else {
    replayState.daily_readings.forEach((item) => {
      const row = document.createElement("tr");
      [item.record_id, item.record_date, item.normalized_value + " " + item.unit, item.first_fetched_at, item.last_fetched_at]
        .forEach((value) => {
          const cell = document.createElement("td");
          cell.textContent = value;
          row.appendChild(cell);
        });
      replayHistoryBody.appendChild(row);
    });
  }
}

async function baseline() {
  replayState = resetReplayState();
  replayState = runFixture(replayState, await loadFixture("normal-d1-a"));
  replayState = runFixture(replayState, await loadFixture("normal-d1-b"));
}

async function replayFailure(name) {
  await baseline();
  const fixture = await loadFixture(name);
  replayState = runFixture(replayState, fixture);
  const code = replayState.status.error_code;
  replayMessage.textContent = ERROR_COPY[code] || fixture.description_ko;
  recoverButton.disabled = false;
  renderReplay();
}

async function recoverReplay() {
  replayState = runFixture(replayState, await loadFixture("recover-d2"));
  replayMessage.textContent =
    "복구 완료: fresh / none, 일별 행 2건, 저장값 120 pt, 다음 합성 날짜 신규 행 1건입니다.";
  recoverButton.disabled = true;
  renderReplay();
}

async function runSuccessSequence() {
  replayState = resetReplayState();
  replayState = runFixture(replayState, await loadFixture("normal-d1-a"));
  replayState = runFixture(replayState, await loadFixture("normal-d1-b"));
  replayState = runFixture(replayState, await loadFixture("normal-d1-b"));
  const sameDayRows = replayState.daily_readings.length;
  replayState = runFixture(replayState, await loadFixture("normal-d2"));
  replayMessage.textContent =
    "같은 합성 날짜 성공 3회 뒤 행 " + sameDayRows +
    "건 유지 → 다음 합성 날짜 성공 뒤 행 " + replayState.daily_readings.length +
    "건. 같은 날은 upsert, 다음 날만 insert 됩니다.";
  recoverButton.disabled = true;
  renderReplay();
}

document.querySelectorAll("[data-fixture]").forEach((button) => {
  button.addEventListener("click", () => replayFailure(button.dataset.fixture));
});
recoverButton.addEventListener("click", recoverReplay);
successSequenceButton.addEventListener("click", runSuccessSequence);
resetReplayButton.addEventListener("click", () => {
  replayState = resetReplayState();
  replayMessage.textContent = "합성 상태만 reset했습니다. 실제 보존 기록에는 영향을 주지 않습니다.";
  recoverButton.disabled = true;
  renderReplay();
});
verifyHashesButton.addEventListener("click", verifyPackageHashes);
refreshLiveButton.addEventListener("click", fetchLive);

renderReplay();
loadCommittedHistory();
fetchLive();

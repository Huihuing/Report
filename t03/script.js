const canvas = document.querySelector("#previewCanvas");
const ctx = canvas.getContext("2d");
const canvasWrap = document.querySelector("#canvasWrap");
const imageInput = document.querySelector("#imageInput");
const dropZone = document.querySelector("#dropZone");
const fileMeta = document.querySelector("#fileMeta");
const fileStatus = document.querySelector("#fileStatus");
const previewState = document.querySelector("#previewState");
const captionInput = document.querySelector("#captionInput");
const xInput = document.querySelector("#xInput");
const yInput = document.querySelector("#yInput");
const sizeInput = document.querySelector("#sizeInput");
const colorInput = document.querySelector("#colorInput");
const xValue = document.querySelector("#xValue");
const yValue = document.querySelector("#yValue");
const sizeValue = document.querySelector("#sizeValue");
const colorValue = document.querySelector("#colorValue");
const downloadButton = document.querySelector("#downloadButton");
const ratioButtons = Array.from(document.querySelectorAll(".ratio-button"));

const templateName = document.querySelector("#templateName");
const createTemplateButton = document.querySelector("#createTemplateButton");
const createSamplesButton = document.querySelector("#createSamplesButton");
const templateList = document.querySelector("#templateList");
const templateStatus = document.querySelector("#templateStatus");
const exportJsonButton = document.querySelector("#exportJsonButton");
const jsonInput = document.querySelector("#jsonInput");
const jsonStatus = document.querySelector("#jsonStatus");

const RATIOS = {
  square: { label: "1:1", width: 1080, height: 1080 },
  portrait: { label: "4:5", width: 1080, height: 1350 },
  story: { label: "9:16", width: 1080, height: 1920 }
};
const supportedTypes = new Set(["image/png", "image/jpeg"]);
const STORAGE_KEY = "t03-card-templates-v1";
const editor = { image: null, imageName: "", imageType: "", width: 0, height: 0, ratio: "square" };
let templates = readTemplates();

function setFileStatus(message, type) {
  fileStatus.textContent = message;
  fileStatus.className = "file-status" + (type ? " " + type : "");
}
function setManagerStatus(node, message, type) {
  node.textContent = message;
  node.className = "manager-status" + (type ? " " + type : "");
}
function updateOutputs() {
  xValue.textContent = xInput.value + "%";
  yValue.textContent = yInput.value + "%";
  sizeValue.textContent = sizeInput.value + "px";
  colorValue.textContent = colorInput.value.toLowerCase();
}
function applyCanvasSize() {
  const ratio = RATIOS[editor.ratio];
  canvas.width = ratio.width;
  canvas.height = ratio.height;
  canvasWrap.style.aspectRatio = ratio.width + " / " + ratio.height;
  ratioButtons.forEach(function(button) {
    const active = button.dataset.ratio === editor.ratio;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}
function drawPlaceholder() {
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#25303b");
  gradient.addColorStop(1, "#11171d");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#788797";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 34px system-ui, sans-serif";
  ctx.fillText("PNG 또는 JPEG 이미지를 불러오세요", canvas.width / 2, canvas.height / 2 - 20);
}
function drawImageCover(image) {
  const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
  const w = image.naturalWidth * scale;
  const h = image.naturalHeight * scale;
  ctx.drawImage(image, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
}
function graphemes(text) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    return Array.from(new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(text), function(item) { return item.segment; });
  }
  return Array.from(text);
}
function wrapParagraph(paragraph, maxWidth) {
  if (paragraph === "") return [""];
  const units = graphemes(paragraph);
  const lines = [];
  let line = "";
  units.forEach(function(unit) {
    const candidate = line + unit;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = unit;
    } else {
      line = candidate;
    }
  });
  if (line || !lines.length) lines.push(line);
  return lines;
}
function getWrappedLines(text, maxWidth) {
  const result = [];
  text.split("\n").forEach(function(paragraph) {
    wrapParagraph(paragraph, maxWidth).forEach(function(line) { result.push(line); });
  });
  return result.slice(0, 20);
}
function drawCaption() {
  const text = captionInput.value;
  if (!text.trim()) return;
  const requestedSize = Number(sizeInput.value);
  const x = canvas.width * Number(xInput.value) / 100;
  const y = canvas.height * Number(yInput.value) / 100;
  const margin = canvas.width * 0.04;
  const edgeWidth = Math.max(60, Math.min(canvas.width * 0.86, (Math.min(x, canvas.width - x) - margin) * 2));
  let fontSize = requestedSize;
  let lines = [];

  while (fontSize >= 18) {
    ctx.font = "800 " + fontSize + "px system-ui, sans-serif";
    lines = getWrappedLines(text, edgeWidth);
    const totalHeight = lines.length * fontSize * 1.18;
    if (totalHeight <= canvas.height * 0.78 || fontSize === 18) break;
    fontSize -= 2;
  }

  const lineHeight = fontSize * 1.18;
  const blockHeight = lines.length * lineHeight;
  const centerY = Math.min(canvas.height - blockHeight / 2 - margin, Math.max(blockHeight / 2 + margin, y));
  const startY = centerY - ((lines.length - 1) * lineHeight) / 2;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "800 " + fontSize + "px system-ui, sans-serif";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(0,0,0,.72)";
  ctx.lineWidth = Math.max(4, fontSize * .11);
  ctx.fillStyle = colorInput.value;
  lines.forEach(function(line, index) {
    const lineY = startY + index * lineHeight;
    ctx.strokeText(line, x, lineY, edgeWidth);
    ctx.fillText(line, x, lineY, edgeWidth);
  });
  ctx.restore();
}
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (editor.image) drawImageCover(editor.image); else drawPlaceholder();
  drawCaption();
  previewState.textContent = RATIOS[editor.ratio].label + " · " + (editor.image ? "이미지 편집 중" : "이미지 대기");
}
function rejectFile(reason) {
  setFileStatus("불러오지 않음: " + reason + " 기존 작업은 그대로 유지됩니다.", "error");
  imageInput.value = "";
  render();
}
function validateImageFile(file) {
  if (!file) return "선택된 파일이 없습니다.";
  if (!supportedTypes.has(file.type)) return "PNG 또는 JPEG만 지원합니다. 선택한 형식: " + (file.type || "알 수 없음");
  if (file.size <= 0) return "빈 파일은 사용할 수 없습니다.";
  if (file.size > 20 * 1024 * 1024) return "20MB를 넘는 이미지는 받지 않습니다.";
  return "";
}
function loadFile(file) {
  const invalid = validateImageFile(file);
  if (invalid) return rejectFile(invalid);
  const url = URL.createObjectURL(file);
  const candidate = new Image();
  candidate.onload = function() {
    URL.revokeObjectURL(url);
    if (!candidate.naturalWidth || !candidate.naturalHeight) return rejectFile("이미지 크기를 확인할 수 없습니다.");
    editor.image = candidate;
    editor.imageName = file.name;
    editor.imageType = file.type;
    editor.width = candidate.naturalWidth;
    editor.height = candidate.naturalHeight;
    fileMeta.textContent = file.name + " · " + (file.type === "image/png" ? "PNG" : "JPEG") + " · " + editor.width + "×" + editor.height;
    setFileStatus("이미지를 불러왔습니다. 원본 메타데이터는 저장 PNG에 전달하지 않습니다.", "success");
    render();
  };
  candidate.onerror = function() { URL.revokeObjectURL(url); rejectFile("확장자는 맞지만 실제 이미지 데이터를 읽을 수 없습니다."); };
  candidate.src = url;
}
function settingsSnapshot() {
  return {
    caption: captionInput.value,
    x: Number(xInput.value),
    y: Number(yInput.value),
    size: Number(sizeInput.value),
    color: colorInput.value.toLowerCase(),
    ratio: editor.ratio
  };
}
function applySettings(settings) {
  captionInput.value = settings.caption;
  xInput.value = settings.x;
  yInput.value = settings.y;
  sizeInput.value = settings.size;
  colorInput.value = settings.color;
  editor.ratio = settings.ratio;
  updateOutputs();
  applyCanvasSize();
  render();
}
function validSettings(s) {
  return s && typeof s.caption === "string" && s.caption.length <= 500 &&
    Number.isFinite(s.x) && s.x >= 5 && s.x <= 95 &&
    Number.isFinite(s.y) && s.y >= 8 && s.y <= 92 &&
    Number.isFinite(s.size) && s.size >= 18 && s.size <= 96 &&
    typeof s.color === "string" && /^#[0-9a-fA-F]{6}$/.test(s.color) &&
    Object.prototype.hasOwnProperty.call(RATIOS, s.ratio);
}
function readTemplates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(function(item) {
      return item && typeof item.id === "string" && typeof item.name === "string" && item.name.length > 0 && item.name.length <= 40 && validSettings(item.settings);
    });
  } catch (error) {
    return [];
  }
}
function persistTemplates(next) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  templates = next;
  renderTemplateList();
}
function newId() {
  if (crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
function renderTemplateList() {
  templateList.replaceChildren();
  if (!templates.length) {
    setManagerStatus(templateStatus, "저장된 템플릿이 없습니다.", "");
    return;
  }
  setManagerStatus(templateStatus, templates.length + "개의 템플릿이 이 브라우저에 저장되어 있습니다.", "success");
  templates.forEach(function(item) {
    const row = document.createElement("div");
    row.className = "template-item";
    const name = document.createElement("strong");
    name.textContent = item.name;
    const load = document.createElement("button");
    load.type = "button"; load.textContent = "불러오기";
    load.addEventListener("click", function() { applySettings(item.settings); templateName.value = item.name; setManagerStatus(templateStatus, item.name + " 불러오기 완료", "success"); });
    const update = document.createElement("button");
    update.type = "button"; update.textContent = "수정";
    update.addEventListener("click", function() {
      const next = templates.map(function(t) { return t.id === item.id ? { id:t.id, name:templateName.value.trim() || t.name, settings:settingsSnapshot(), updatedAt:new Date().toISOString() } : t; });
      persistTemplates(next); setManagerStatus(templateStatus, item.name + " 수정 완료", "success");
    });
    const remove = document.createElement("button");
    remove.type = "button"; remove.textContent = "삭제"; remove.className = "delete";
    remove.addEventListener("click", function() { persistTemplates(templates.filter(function(t) { return t.id !== item.id; })); setManagerStatus(templateStatus, item.name + " 삭제 완료", "success"); });
    row.append(name, load, update, remove);
    templateList.append(row);
  });
}
function createTemplate(name, settings) {
  const clean = name.trim();
  if (!clean) { setManagerStatus(templateStatus, "템플릿 이름을 입력하세요.", "error"); return false; }
  if (clean.length > 40 || !validSettings(settings)) { setManagerStatus(templateStatus, "템플릿 데이터가 올바르지 않습니다.", "error"); return false; }
  persistTemplates(templates.concat({ id:newId(), name:clean, settings:settings, updatedAt:new Date().toISOString() }));
  return true;
}
function validateImportPayload(parsed) {
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.templates)) throw new Error("version 1과 templates 배열이 필요합니다.");
  const ids = new Set();
  const normalized = parsed.templates.map(function(item, index) {
    if (!item || typeof item.id !== "string" || !item.id || ids.has(item.id)) throw new Error((index + 1) + "번째 템플릿 ID가 없거나 중복입니다.");
    if (typeof item.name !== "string" || !item.name.trim() || item.name.length > 40) throw new Error((index + 1) + "번째 템플릿 이름이 잘못되었습니다.");
    if (!validSettings(item.settings)) throw new Error((index + 1) + "번째 템플릿 필수 설정이 빠졌거나 범위를 벗어났습니다.");
    ids.add(item.id);
    return { id:item.id, name:item.name.trim(), settings:item.settings, updatedAt:typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString() };
  });
  return normalized;
}
async function downloadCurrentPng() {
  if (document.fonts && document.fonts.ready) await document.fonts.ready;
  render();
  const ratio = RATIOS[editor.ratio].label.replace(":", "x");
  canvas.toBlob(function(blob) {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "t03-card-" + ratio + ".png";
    a.click();
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
  }, "image/png");
}
function createExample(width, height, title, subtitle) {
  const c = document.createElement("canvas"); c.width = width; c.height = height;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0,0,width,height);
  grad.addColorStop(0,"#263b46"); grad.addColorStop(1,"#241c2b");
  g.fillStyle = grad; g.fillRect(0,0,width,height);
  g.fillStyle = "#78dce8"; g.beginPath(); g.arc(width*.5,height*.48,Math.min(width,height)*.13,0,Math.PI*2); g.fill();
  g.fillStyle = "#ffffff"; g.textAlign = "center"; g.textBaseline = "middle";
  g.font = "900 " + Math.round(width*.07) + "px system-ui, sans-serif"; g.fillText(title,width*.5,height*.16);
  g.font = "700 " + Math.round(width*.045) + "px system-ui, sans-serif"; g.fillText(subtitle,width*.5,height*.82);
  return c.toDataURL("image/png");
}
function initExamples() {
  [
    ["exampleSquare","exampleSquareDownload",1080,1080,"BUILD / TEST","1:1 · SELF MADE"],
    ["examplePortrait","examplePortraitDownload",1080,1350,"MAKE IT CLEAR","4:5 · SELF MADE"],
    ["exampleStory","exampleStoryDownload",1080,1920,"ONE STEP","9:16 · SELF MADE"]
  ].forEach(function(spec) {
    const data = createExample(spec[2],spec[3],spec[4],spec[5]);
    document.querySelector("#" + spec[0]).src = data;
    document.querySelector("#" + spec[1]).href = data;
  });
}

imageInput.addEventListener("change", function(event) { loadFile(event.target.files[0]); });
["dragenter","dragover"].forEach(function(name) { dropZone.addEventListener(name,function(event){ event.preventDefault(); dropZone.classList.add("is-over"); }); });
["dragleave","drop"].forEach(function(name) { dropZone.addEventListener(name,function(event){ event.preventDefault(); dropZone.classList.remove("is-over"); }); });
dropZone.addEventListener("drop", function(event) { loadFile(event.dataTransfer.files[0]); });
dropZone.addEventListener("click", function() { imageInput.click(); });
dropZone.addEventListener("keydown", function(event) { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); imageInput.click(); } });
[captionInput,xInput,yInput,sizeInput,colorInput].forEach(function(control) { control.addEventListener("input", function() { updateOutputs(); render(); }); });
ratioButtons.forEach(function(button) { button.addEventListener("click", function() { editor.ratio = button.dataset.ratio; applyCanvasSize(); render(); }); });
downloadButton.addEventListener("click", downloadCurrentPng);

createTemplateButton.addEventListener("click", function() {
  if (createTemplate(templateName.value, settingsSnapshot())) { templateName.value = ""; setManagerStatus(templateStatus, "템플릿 생성 완료", "success"); }
});
createSamplesButton.addEventListener("click", function() {
  const samples = [
    { id:newId(), name:"정사각 공지", settings:{caption:"정사각 카드",x:50,y:82,size:54,color:"#ffffff",ratio:"square"}, updatedAt:new Date().toISOString() },
    { id:newId(), name:"세로 피드", settings:{caption:"4:5 피드 카드",x:50,y:78,size:58,color:"#ffffff",ratio:"portrait"}, updatedAt:new Date().toISOString() },
    { id:newId(), name:"스토리", settings:{caption:"9:16 스토리",x:50,y:74,size:64,color:"#ffffff",ratio:"story"}, updatedAt:new Date().toISOString() }
  ];
  persistTemplates(templates.concat(samples));
  setManagerStatus(templateStatus, "검사용 템플릿 3개 생성 완료", "success");
});
exportJsonButton.addEventListener("click", function() {
  const blob = new Blob([JSON.stringify({version:1,templates:templates}, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "t03-templates.json"; a.click();
  setTimeout(function(){URL.revokeObjectURL(url);},1000);
});
jsonInput.addEventListener("change", async function(event) {
  const file = event.target.files[0];
  if (!file) return;
  const beforeCount = templates.length;
  try {
    const parsed = JSON.parse(await file.text());
    const normalized = validateImportPayload(parsed);
    persistTemplates(normalized);
    setManagerStatus(jsonStatus, "정상 JSON 복원 완료: " + normalized.length + "개 템플릿", "success");
  } catch (error) {
    setManagerStatus(jsonStatus, "가져오기 거부: " + error.message + " 기존 " + beforeCount + "개 템플릿은 유지됩니다.", "error");
  } finally {
    jsonInput.value = "";
  }
});

updateOutputs();
applyCanvasSize();
render();
renderTemplateList();
initExamples();

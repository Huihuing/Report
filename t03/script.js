const canvas = document.querySelector("#previewCanvas");
const ctx = canvas.getContext("2d");

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

const supportedTypes = new Set(["image/png", "image/jpeg"]);

const editor = {
  image: null,
  imageName: "",
  imageType: "",
  width: 0,
  height: 0,
};

function setStatus(message, type) {
  fileStatus.textContent = message;
  fileStatus.className = "file-status" + (type ? " " + type : "");
}

function updateOutputs() {
  xValue.textContent = xInput.value + "%";
  yValue.textContent = yInput.value + "%";
  sizeValue.textContent = sizeInput.value + "px";
  colorValue.textContent = colorInput.value.toLowerCase();
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
  ctx.font = "500 25px system-ui, sans-serif";
  ctx.fillText("문구 편집은 지금 바로 시험할 수 있습니다", canvas.width / 2, canvas.height / 2 + 30);
}

function drawImageCover(image) {
  const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const x = (canvas.width - drawWidth) / 2;
  const y = (canvas.height - drawHeight) / 2;
  ctx.drawImage(image, x, y, drawWidth, drawHeight);
}

function drawCaption() {
  const text = captionInput.value.trim();
  if (!text) return;

  const x = canvas.width * Number(xInput.value) / 100;
  const y = canvas.height * Number(yInput.value) / 100;
  const size = Number(sizeInput.value);

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "800 " + size + "px system-ui, sans-serif";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(0, 0, 0, 0.72)";
  ctx.lineWidth = Math.max(4, size * 0.11);
  ctx.fillStyle = colorInput.value;

  const lines = text.split(/\n/).slice(0, 4);
  const lineHeight = size * 1.18;
  const startY = y - ((lines.length - 1) * lineHeight) / 2;

  lines.forEach(function(line, index) {
    const safeLine = line.slice(0, 60);
    const lineY = startY + index * lineHeight;
    ctx.strokeText(safeLine, x, lineY, canvas.width * 0.9);
    ctx.fillText(safeLine, x, lineY, canvas.width * 0.9);
  });

  ctx.restore();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (editor.image) {
    drawImageCover(editor.image);
    previewState.textContent = "이미지 편집 중";
  } else {
    drawPlaceholder();
    previewState.textContent = "이미지 대기";
  }

  drawCaption();
}

function rejectFile(reason) {
  setStatus("불러오지 않음: " + reason + " 기존 작업은 그대로 유지됩니다.", "error");
  imageInput.value = "";
  render();
}

function validateFile(file) {
  if (!file) return "선택된 파일이 없습니다.";
  if (!supportedTypes.has(file.type)) {
    return "PNG 또는 JPEG만 지원합니다. 선택한 형식: " + (file.type || "알 수 없음");
  }
  if (file.size <= 0) return "빈 파일은 사용할 수 없습니다.";
  if (file.size > 20 * 1024 * 1024) return "20MB를 넘는 이미지는 이 편집기에서 받지 않습니다.";
  return "";
}

function loadFile(file) {
  const invalidReason = validateFile(file);
  if (invalidReason) {
    rejectFile(invalidReason);
    return;
  }

  const objectUrl = URL.createObjectURL(file);
  const candidate = new Image();

  candidate.onload = function() {
    URL.revokeObjectURL(objectUrl);

    if (!candidate.naturalWidth || !candidate.naturalHeight) {
      rejectFile("이미지 크기를 확인할 수 없습니다.");
      return;
    }

    editor.image = candidate;
    editor.imageName = file.name;
    editor.imageType = file.type;
    editor.width = candidate.naturalWidth;
    editor.height = candidate.naturalHeight;

    fileMeta.textContent =
      file.name + " · " +
      (file.type === "image/png" ? "PNG" : "JPEG") + " · " +
      editor.width + "×" + editor.height;

    setStatus("이미지를 불러왔습니다. 캔버스에 다시 그려 미리보기에 반영했습니다.", "success");
    render();
  };

  candidate.onerror = function() {
    URL.revokeObjectURL(objectUrl);
    rejectFile("파일 확장자는 맞지만 실제 이미지 데이터를 읽을 수 없습니다.");
  };

  candidate.src = objectUrl;
}

imageInput.addEventListener("change", function(event) {
  loadFile(event.target.files[0]);
});

["dragenter", "dragover"].forEach(function(eventName) {
  dropZone.addEventListener(eventName, function(event) {
    event.preventDefault();
    dropZone.classList.add("is-over");
  });
});

["dragleave", "drop"].forEach(function(eventName) {
  dropZone.addEventListener(eventName, function(event) {
    event.preventDefault();
    dropZone.classList.remove("is-over");
  });
});

dropZone.addEventListener("drop", function(event) {
  loadFile(event.dataTransfer.files[0]);
});

dropZone.addEventListener("click", function() {
  imageInput.click();
});

dropZone.addEventListener("keydown", function(event) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    imageInput.click();
  }
});

[captionInput, xInput, yInput, sizeInput, colorInput].forEach(function(control) {
  control.addEventListener("input", function() {
    updateOutputs();
    render();
  });
});

updateOutputs();
render();

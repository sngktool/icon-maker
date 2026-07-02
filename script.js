// ================================
// FrameLab User Interface (Optimized)
// ================================

// ▼ Worker API
const WORKER_LIST_API = "https://framelab.sngk-tool.workers.dev?mode=list";

// ▼ DOM elements
const imageInput = document.getElementById("imageInput");
const frameSelect = document.getElementById("frameSelect");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");

// ▼ Image objects
let baseImage = null;
let frameImage = null;

// ▼ Transform parameters
let scale = 1;
let minScale = 0.3;
let maxScale = 4;
let offsetX = 0;
let offsetY = 0;

// ▼ Offscreen canvas（高速化の要）
const offCanvas = document.createElement("canvas");
const offCtx = offCanvas.getContext("2d");

// ▼ Redraw制御（requestAnimationFrame）
let redrawRequested = false;
function requestRedraw() {
  if (!redrawRequested) {
    redrawRequested = true;
    requestAnimationFrame(() => {
      redrawRequested = false;
      redraw();
    });
  }
}

// ================================
// ▼ Fetch frame list
// ================================
async function loadFrames() {
  try {
    const res = await fetch(WORKER_LIST_API, { cache: "no-store" });
    const data = await res.json();

    const frames = data?.data?.frames || [];

    const frag = document.createDocumentFragment();
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "未選択";
    frag.appendChild(empty);

    frames.forEach(frame => {
      const option = document.createElement("option");
      option.textContent = frame.displayName || frame.filename || "名称未設定";
      option.value = frame.url;
      frag.appendChild(option);
    });

    frameSelect.innerHTML = "";
    frameSelect.appendChild(frag);

  } catch (err) {
    console.error("フレーム一覧取得エラー:", err);
    frameSelect.innerHTML = '<option value="">未選択</option>';
  }
}

// ================================
// ▼ Canvas resizing
// ================================
function resizeCanvas() {
  const size = canvas.clientWidth;
  if (!size) return;

  canvas.width = size;
  canvas.height = size;

  offCanvas.width = size;
  offCanvas.height = size;

  requestRedraw();
}

window.addEventListener("DOMContentLoaded", () => {
  loadFrames();
  setTimeout(resizeCanvas, 50);
});

window.addEventListener("resize", () => {
  setTimeout(resizeCanvas, 50);
});

// ================================
// ▼ Load baseImage
// ================================
imageInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    baseImage = new Image();
    baseImage.onload = () => {
      const cw = canvas.width;
      const ch = canvas.height;
      const iw = baseImage.width;
      const ih = baseImage.height;

      const fitScale = Math.min(cw / iw, ch / ih);
      scale = fitScale;
      minScale = fitScale * 0.3;

      offsetX = cw / 2 - (iw * scale) / 2;
      offsetY = ch / 2 - (ih * scale) / 2;

      requestRedraw();
    };
    baseImage.src = reader.result;
  };
  reader.readAsDataURL(file);
});

// ================================
// ▼ Frame selection
// ================================
frameSelect.addEventListener("change", () => {
  const value = frameSelect.value;
  if (!value) {
    frameImage = null;
    requestRedraw();
    return;
  }

  frameImage = new Image();
  frameImage.crossOrigin = "anonymous";
  frameImage.onload = requestRedraw;
  frameImage.src = value + "?t=" + Date.now();
});

// ================================
// ▼ Touch / Mouse interactions
// ================================
function getDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getCenter(touches) {
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2
  };
}

let isDragging = false;
let lastX = null;
let lastY = null;
let lastDist = null;

// ▼ Touch start
canvas.addEventListener("touchstart", (e) => {
  const rect = canvas.getBoundingClientRect();

  if (e.touches.length === 1) {
    isDragging = true;
    lastX = e.touches[0].clientX - rect.left;
    lastY = e.touches[0].clientY - rect.top;
  }

  if (e.touches.length === 2) {
    lastDist = getDistance(e.touches);
  }
});

// ▼ Touch move
canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();

  if (e.touches.length === 2) {
    const dist = getDistance(e.touches);
    const center = getCenter(e.touches);
    const cx = center.x - rect.left;
    const cy = center.y - rect.top;

    const oldScale = scale;
    const delta = (dist - lastDist) * 0.004;
    scale = Math.max(minScale, Math.min(maxScale, scale + delta));

    const zoomRatio = scale / oldScale;
    offsetX = cx - (cx - offsetX) * zoomRatio;
    offsetY = cy - (cy - offsetY) * zoomRatio;

    lastDist = dist;
    requestRedraw();
    return;
  }

  if (e.touches.length === 1 && isDragging) {
    const x = e.touches[0].clientX - rect.left;
    const y = e.touches[0].clientY - rect.top;
    offsetX += x - lastX;
    offsetY += y - lastY;
    lastX = x;
    lastY = y;
    requestRedraw();
  }
}, { passive: false });

// ▼ Touch end
canvas.addEventListener("touchend", () => {
  isDragging = false;
  lastX = null;
  lastY = null;
  lastDist = null;
});

// ▼ Mouse drag
canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  isDragging = true;
  lastX = e.clientX - rect.left;
  lastY = e.clientY - rect.top;
});

canvas.addEventListener("mousemove", (e) => {
  if (!isDragging) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  offsetX += x - lastX;
  offsetY += y - lastY;

  lastX = x;
  lastY = y;

  requestRedraw();
});

canvas.addEventListener("mouseup", () => {
  isDragging = false;
});

canvas.addEventListener("mouseleave", () => {
  isDragging = false;
});

// ▼ Wheel zoom
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  const oldScale = scale;
  const delta = e.deltaY > 0 ? -0.05 : 0.05;

  scale = Math.max(minScale, Math.min(maxScale, scale + delta));
  const zoomRatio = scale / oldScale;

  offsetX = mx - (mx - offsetX) * zoomRatio;
  offsetY = my - (my - offsetY) * zoomRatio;

  requestRedraw();
});

// ================================
// ▼ Drawing process (Optimized)
// ================================
function redraw() {
  offCtx.clearRect(0, 0, offCanvas.width, offCanvas.height);

  if (baseImage) {
    const drawW = baseImage.width * scale;
    const drawH = baseImage.height * scale;
    offCtx.drawImage(baseImage, offsetX, offsetY, drawW, drawH);
  }

  if (frameImage && frameImage.complete) {
    offCtx.drawImage(frameImage, 0, 0, offCanvas.width, offCanvas.height);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(offCanvas, 0, 0);
}

// ================================
// ▼ High-resolution save
// ================================
function saveHighRes() {
  if (!baseImage) {
    alert("画像が選択されていません。");
    return;
  }

  const scaleFactor = 3;
  const saveCanvas = document.createElement("canvas");
  saveCanvas.width = canvas.width * scaleFactor;
  saveCanvas.height = canvas.height * scaleFactor;
  const sctx = saveCanvas.getContext("2d");

  sctx.fillStyle = "#ffffff";
  sctx.fillRect(0, 0, saveCanvas.width, saveCanvas.height);

  const drawW = baseImage.width * scale * scaleFactor;
  const drawH = baseImage.height * scale * scaleFactor;
  const x = offsetX * scaleFactor;
  const y = offsetY * scaleFactor;

  sctx.drawImage(baseImage, x, y, drawW, drawH);

  if (frameImage && frameImage.complete) {
    sctx.drawImage(frameImage, 0, 0, saveCanvas.width, saveCanvas.height);
  }

  const now = new Date();
  const filename = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}.png`;

  saveCanvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, "image/png");
}

// ================================
// ▼ Full reset
// ================================
resetBtn.addEventListener("click", () => {
  baseImage = null;
  frameImage = null;

  scale = 1;
  offsetX = 0;
  offsetY = 0;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  imageInput.value = "";
  frameSelect.selectedIndex = 0;

  console.log("Full reset completed");
});

// ================================
// ▼ Save button
// ================================
saveBtn.addEventListener("click", saveHighRes);

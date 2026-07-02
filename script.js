// ================================
// FrameLab User Interface
// ================================

// ▼ Worker API (Fetch frame list)
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

// ================================
// ▼ Fetch frame list from Worker
// ================================
async function loadFrames() {
  try {
    const res = await fetch(WORKER_LIST_API, { cache: "no-store" });
    const data = await res.json(); 

    if (!data.success) {
      frameSelect.innerHTML = '<option value="">未選択</option>';
      return;
    }

    const frames = data.data.frames;

    frameSelect.innerHTML = '<option value="">未選択</option>';

    frames.forEach(frame => {
      const option = document.createElement("option");

      option.textContent = frame.displayName || frame.filename || "名称未設定";
      option.value = frame.url;

      frameSelect.appendChild(option);
    });

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

  redraw();
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

      redraw();
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
    redraw();
    return;
  }

  frameImage = new Image();
  frameImage.crossOrigin = "anonymous";
  frameImage.onload = redraw;

  frameImage.src = value; // キャッシュ禁止削除済み
});

// ================================
// ▼ Pinch distance
// ================================
function getDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

// ▼ Pinch center
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

// ================================
// ▼ Touch start
// ================================
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

// ================================
// ▼ Touch move (pinch + drag)
// ================================
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
    redraw();
    return;
  }

  if (e.touches.length === 1 && isDragging) {
    const x = e.touches[0].clientX - rect.left;
    const y = e.touches[0].clientY - rect.top;
    offsetX += x - lastX;
    offsetY += y - lastY;
    lastX = x;
    lastY = y;
    redraw();
  }
}, { passive: false });

// ================================
// ▼ Touch end
// ================================
canvas.addEventListener("touchend", () => {
  isDragging = false;
  lastX = null;
  lastY = null;
  lastDist = null;
});

// ================================
// ▼ PC: Drag move
// ================================
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

  redraw();
});

canvas.addEventListener("mouseup", () => {
  isDragging = false;
});

canvas.addEventListener("mouseleave", () => {
  isDragging = false;
});

// ================================
// ▼ PC: Wheel zoom
// ================================
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

  redraw();
});

// ================================
// ▼ Drawing process（マスク処理統合版）
// ================================
function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!frameImage) return;

  // ▼ 黒背景（フレーム外側）
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // ▼ マスク処理開始
  ctx.save();

  const maskCanvas = document.createElement("canvas");
  const maskCtx = maskCanvas.getContext("2d");
  maskCanvas.width = canvas.width;
  maskCanvas.height = canvas.height;
  maskCtx.drawImage(frameImage, 0, 0, canvas.width, canvas.height);

  const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);
  const data = maskData.data;

  ctx.beginPath();
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4 + 3;
      if (data[i] < 10) ctx.rect(x, y, 1, 1);
    }
  }
  ctx.clip();

  if (baseImage) {
    const drawW = baseImage.width * scale;
    const drawH = baseImage.height * scale;
    ctx.drawImage(baseImage, offsetX, offsetY, drawW, drawH);
  }

  ctx.restore();

  ctx.drawImage(frameImage, 0, 0, canvas.width, canvas.height);
}

// ================================
// ▼ High-resolution save（マスク処理統合版）
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

  // ▼ 黒背景（フレーム外側）
  sctx.fillStyle = "black";
  sctx.fillRect(0, 0, saveCanvas.width, saveCanvas.height);

  // ▼ マスク処理開始
  const maskCanvas = document.createElement("canvas");
  const maskCtx = maskCanvas.getContext("2d");
  maskCanvas.width = saveCanvas.width;
  maskCanvas.height = saveCanvas.height;
  maskCtx.drawImage(frameImage, 0, 0, saveCanvas.width, saveCanvas.height);

  const maskData = maskCtx.getImageData(0, 0, saveCanvas.width, saveCanvas.height);
  const data = maskData.data;

  sctx.save();
  sctx.beginPath();

  for (let y = 0; y < saveCanvas.height; y++) {
    for (let x = 0; x < saveCanvas.width; x++) {
      const i = (y * saveCanvas.width + x) * 4 + 3;
      if (data[i] < 10) sctx.rect(x, y, 1, 1);
    }
  }

  sctx.clip();

  // ▼ clip 内側だけに baseImage を描画
  const drawW = baseImage.width * scale * scaleFactor;
  const drawH = baseImage.height * scale * scaleFactor;
  const x = offsetX * scaleFactor;
  const y = offsetY * scaleFactor;

  sctx.drawImage(baseImage, x, y, drawW, drawH);

  sctx.restore();

  // ▼ 最後にフレームを重ねる
  sctx.drawImage(frameImage, 0, 0, saveCanvas.width, saveCanvas.height);

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

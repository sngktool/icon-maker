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

// ▼ マスク（複雑形状対応）
let maskCanvas = null;
let maskCtx = null;

// ================================
// ▼ フレームから透明領域マスク生成（canvasに完全フィット）
// ================================
function buildMaskFromFrame(frameImage) {
  maskCanvas = document.createElement("canvas");
  maskCanvas.width = canvas.width;
  maskCanvas.height = canvas.height;
  maskCtx = maskCanvas.getContext("2d");

  // frameImage を canvas にフィットさせて描画
  maskCtx.drawImage(frameImage, 0, 0, canvas.width, canvas.height);

  const imgData = maskCtx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  // 透明部分だけ白（不透明）にする
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha === 0) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = 255;
    } else {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
    }
  }

  maskCtx.putImageData(imgData, 0, 0);
}

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
    maskCanvas = null;
    redraw();
    return;
  }

  frameImage = new Image();
  frameImage.crossOrigin = "anonymous";

  frameImage.onload = () => {
    buildMaskFromFrame(frameImage);
    redraw();
  };

  frameImage.src = value + "?t=" + Date.now();
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
// ▼ Drawing process（マスク統合版）
// ================================
function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (baseImage) {
    const drawW = baseImage.width * scale;
    const drawH = baseImage.height * scale;

    // ① ベース画像
    ctx.drawImage(baseImage, offsetX, offsetY, drawW, drawH);

    // ② マスク適用（ズーム・ドラッグに完全追従）
    if (maskCanvas) {
      ctx.save();
      ctx.globalCompositeOperation = "destination-in";

      ctx.drawImage(
        maskCanvas,
        0, 0, maskCanvas.width, maskCanvas.height,
        offsetX, offsetY, drawW, drawH
      );

      ctx.restore();
    }
  }

  // ③ フレーム
  if (frameImage && frameImage.complete) {
    ctx.drawImage(frameImage, 0, 0, canvas.width, canvas.height);
  }
}

// ================================
// ▼ High-resolution save（マスク追従）
// ================================
function saveHighRes() {
  if (!baseImage) return;

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

  // ベース画像
  sctx.drawImage(baseImage, x, y, drawW, drawH);

  // マスク適用（保存時も完全追従）
  if (maskCanvas) {
    sctx.save();
    sctx.globalCompositeOperation = "destination-in";

    sctx.drawImage(
      maskCanvas,
      0, 0, maskCanvas.width, maskCanvas.height,
      x, y, drawW, drawH
    );

    sctx.restore();
  }

  // フレーム
  if (frameImage && frameImage.complete) {
    sctx.drawImage(frameImage, 0, 0, saveCanvas.width, saveCanvas.height);
  }

  saveCanvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "framelab.png";
    a.click();
    URL.revokeObjectURL(url);
  });
}

// ================================
// ▼ Full reset
// ================================
resetBtn.addEventListener("click", () => {
  baseImage = null;
  frameImage = null;
  maskCanvas = null;
  maskCtx = null;

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

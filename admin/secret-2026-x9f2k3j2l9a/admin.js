// ================================
// FrameLab Admin Panel admin.js
// ================================

const WORKER_ENDPOINT = "https://framelab-uploader.narun091525-b98.workers.dev";

// ▼ Mode switch elements
const addModeBtn = document.getElementById("addModeBtn");
const deleteModeBtn = document.getElementById("deleteModeBtn");
const addModeCard = document.getElementById("addModeCard");
const deleteModeCard = document.getElementById("deleteModeCard");
const modeSelect = document.getElementById("modeSelect");

// ▼ Back buttons
const backToSelectFromAdd = document.getElementById("backToSelectFromAdd");
const backToSelectFromDelete = document.getElementById("backToSelectFromDelete");

// ▼ Fade-in display
function showCard(card) {
  card.style.display = "block";
  requestAnimationFrame(() => card.classList.add("show"));
}

function hideCard(card) {
  card.classList.remove("show");
  setTimeout(() => (card.style.display = "none"), 300);
}

// ▼ Mode switching
addModeBtn.addEventListener("click", () => {
  hideCard(modeSelect);
  hideCard(deleteModeCard);
  showCard(addModeCard);
});

deleteModeBtn.addEventListener("click", () => {
  hideCard(modeSelect);
  hideCard(addModeCard);
  showCard(deleteModeCard);
  loadFrameList();
});

backToSelectFromAdd.addEventListener("click", () => {
  hideCard(addModeCard);
  showCard(modeSelect);
});

backToSelectFromDelete.addEventListener("click", () => {
  hideCard(deleteModeCard);
  showCard(modeSelect);
});

// ================================
// ▼ Add Mode
// ================================
const uploadBtn = document.getElementById("uploadBtn");
const frameInput = document.getElementById("frameInput");
const frameNameInput = document.getElementById("frameName");
const resultBox = document.getElementById("result");
const previewBox = document.getElementById("previewBox");
const previewImage = document.getElementById("previewImage");

// Base64 conversion
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ▼ Preview
frameInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) {
    previewBox.style.display = "none";
    previewImage.src = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    previewImage.src = reader.result;
    previewBox.style.display = "block";
    previewImage.classList.add("show");
  };
  reader.readAsDataURL(file);
});

// ▼ Generate random alphanumeric filename
function randomFilename() {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let name = "";
  for (let i = 0; i < 12; i++) name += chars[Math.floor(Math.random() * chars.length)];
  return name + ".png";
}

// ▼ Upload process
uploadBtn.addEventListener("click", async () => {
  const file = frameInput.files[0];
  const frameName = frameNameInput.value.trim();

  if (!file) return (resultBox.textContent = "⚠ No file selected.");
  if (!frameName) return (resultBox.textContent = "⚠ Please enter a frame name.");

  uploadFrame(file, frameName);
});

// ▼ Actual upload
async function uploadFrame(file, frameName) {
  uploadBtn.disabled = true;
  uploadBtn.innerHTML = `<span class="loading-spinner"></span>Uploading…`;

  try {
    const base64Data = await toBase64(file);
    const randomName = randomFilename();

    const response = await fetch(WORKER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: randomName,      // ← Random alphanumeric filename
        displayName: frameName,    // ← Frame name (Japanese allowed)
        content: base64Data
      })
    });

    const data = await response.json();

    if (data.success) {
      const rawUrl = data.data.url;
      const userPageUrl = "https://framesynth.github.io/icon-maker/";

      resultBox.innerHTML = `
        <div class="success-box fade-in">
          <div class="success-icon">✓</div>
          <div class="success-text">
            Upload completed.<br>
            Please check if it has been reflected.
          </div>
        </div>

        <div class="success-links fade-in">
          <p>[GitHub File URL]</p>
          <a href="${rawUrl}" target="_blank">${rawUrl}</a>

          <p>[User Page]</p>
          <a href="${userPageUrl}" target="_blank">${userPageUrl}</a>

          <button id="checkReflectBtn" class="reflect-btn">Check Reflection</button>
          <div id="reflectStatus"></div>
        </div>
      `;
    } else {
      resultBox.innerHTML = `❌ Error: ${data.error?.message || "Unknown error"}`;
    }
  } catch {
    resultBox.textContent = "⚠ A network error occurred.";
  }

  uploadBtn.disabled = false;
  uploadBtn.innerHTML = "Upload";
}

// ▼ Reflection check
document.addEventListener("click", async (e) => {
  if (e.target.id !== "checkReflectBtn") return;

  const statusBox = document.getElementById("reflectStatus");
  statusBox.textContent = "⏳ Checking…";

  const rawUrl = document.querySelector("#result a").href;

  try {
    const res = await fetch(rawUrl + "?t=" + Date.now(), {
      method: "HEAD",
      cache: "no-store"
    });

    if (res.status === 200) {
      statusBox.innerHTML = `✅ Reflected successfully.`;
      statusBox.style.color = "#0a8a0a";
    } else {
      statusBox.innerHTML = `⌛ Not reflected yet (${res.status})`;
      statusBox.style.color = "#b8860b";
    }
  } catch {
    statusBox.innerHTML = `⚠ An error occurred during checking.`;
    statusBox.style.color = "#c0392b";
  }
});

// ================================
// ▼ Delete Mode
// ================================
async function loadFrameList() {
  const url = WORKER_ENDPOINT + "?mode=list&t=" + Date.now();
  const listBox = document.getElementById("frameList");

  listBox.innerHTML = "Loading…";

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (!data.success || !data.data.frames.length) {
      listBox.innerHTML = "There are currently no frames available for deletion.";
      return;
    }

    listBox.innerHTML = "";

    data.data.frames.forEach(item => {
      const div = document.createElement("div");
      div.className = "frame-item";

      div.innerHTML = `
        <input type="checkbox" class="frame-checkbox" data-name="${item.filename}">
        <img src="${item.url}" class="frame-thumb">
        <div class="frame-name">${item.displayName || item.filename}</div>
      `;

      listBox.appendChild(div);
    });

  } catch {
    listBox.innerHTML = "⚠ Failed to retrieve frame list.";
  }
}

// ▼ Delete multiple frames
document.getElementById("deleteSelectedBtn")?.addEventListener("click", async () => {
  const checked = [...document.querySelectorAll(".frame-checkbox:checked")];
  if (checked.length === 0) {
    alert("Please select frames to delete.");
    return;
  }

  if (!confirm(`Delete ${checked.length} frame(s)?`)) return;

  for (const checkbox of checked) {
    const filename = checkbox.dataset.name;

    try {
      const res = await fetch(WORKER_ENDPOINT, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename })
      });

      const data = await res.json();

      if (data.success) {
        checkbox.closest(".frame-item").remove();
      } else {
        alert(`Delete failed: ${filename} (${data.error.message})`);
      }
    } catch {
      alert(`Network error: ${filename}`);
    }
  }

  alert("Deletion completed.");
});

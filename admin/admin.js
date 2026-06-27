// ================================
// FrameLab Admin Panel admin.js
// ================================

const WORKER_ENDPOINT = "https://framelab.sngk-tool.workers.dev";

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

  if (!file) return (resultBox.textContent = "⚠ ファイルが選択されていません。");
  if (!frameName) return (resultBox.textContent = "⚠ フレーム名を入力してください。");

  uploadFrame(file, frameName);
});

// ▼ Actual upload
async function uploadFrame(file, frameName) {
  uploadBtn.disabled = true;
  uploadBtn.innerHTML = `<span class="loading-spinner"></span>アップロード中…`;

  try {
    const base64Data = await toBase64(file);
    const randomName = randomFilename();

    const response = await fetch(WORKER_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: randomName,      // ← ランダム英数字
        displayName: frameName,    // ← 日本語フレーム名
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
            アップロードが完了しました。<br>
            反映をご確認ください。
          </div>
        </div>

        <div class="success-links fade-in">
          <p>【GitHub 反映URL】</p>
          <a href="${rawUrl}" target="_blank">${rawUrl}</a>

          <p>【ユーザー画面】</p>
          <a href="${userPageUrl}" target="_blank">${userPageUrl}</a>

          <button id="checkReflectBtn" class="reflect-btn">反映チェック</button>
          <div id="reflectStatus"></div>
        </div>
      `;
    } else {
      resultBox.innerHTML = `❌ エラー：${data.error?.message || "不明なエラー"}`;
    }
  } catch {
    resultBox.textContent = "⚠ 通信エラーが発生しました。";
  }

  uploadBtn.disabled = false;
  uploadBtn.innerHTML = "アップロード";
}

// ▼ Reflection check
document.addEventListener("click", async (e) => {
  if (e.target.id !== "checkReflectBtn") return;

  const statusBox = document.getElementById("reflectStatus");
  statusBox.textContent = "⏳ チェック中…";

  const rawUrl = document.querySelector("#result a").href;

  try {
    const res = await fetch(rawUrl + "?t=" + Date.now(), {
      method: "HEAD",
      cache: "no-store"
    });

    if (res.status === 200) {
      statusBox.innerHTML = `✅ 反映されています。`;
      statusBox.style.color = "#0a8a0a";
    } else {
      statusBox.innerHTML = `⌛ まだ反映されていません（${res.status}）`;
      statusBox.style.color = "#b8860b";
    }
  } catch {
    statusBox.innerHTML = `⚠ チェック中にエラーが発生しました`;
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
      listBox.innerHTML = "現在、削除できるフレームはありません。";
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
    listBox.innerHTML = "⚠ フレーム一覧の取得に失敗しました。";
  }
}

// ▼ Delete multiple frames
document.getElementById("deleteSelectedBtn")?.addEventListener("click", async () => {
  const checked = [...document.querySelectorAll(".frame-checkbox:checked")];
  if (checked.length === 0) {
    alert("削除するフレームを選択してください。");
    return;
  }

  if (!confirm(`${checked.length} 件のフレームを削除しますか？`)) return;

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
        alert(`削除失敗: ${filename} (${data.error.message})`);
      }
    } catch {
      alert(`通信エラー: ${filename}`);
    }
  }

  alert("削除が完了しました。");
});

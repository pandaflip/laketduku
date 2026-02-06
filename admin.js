const ADMIN_TOKEN = prompt('Admin passcode?');
const statusEl = document.getElementById('adminStatus');
const form = document.getElementById('adminForm');
const entriesEl = document.getElementById('entries');
const canvas = document.getElementById('editorCanvas');
const wrap = document.getElementById('editorWrap');
const ctx = canvas.getContext('2d');

let currentImageDataUrl = '';
let img = null;
let dragStart = null;
let rect = null;

function setStatus(t) { statusEl.textContent = t; }

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'x-admin-token': ADMIN_TOKEN, ...(options.headers || {}) }
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function draw() {
  if (!img) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  if (rect) {
    ctx.strokeStyle = '#00ff99';
    ctx.lineWidth = 2;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  }
}

function updateFocusFromRect() {
  if (!rect) return;
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  document.getElementById('focusX').value = Math.max(0, Math.min(100, Math.round((cx / canvas.width) * 100)));
  document.getElementById('focusY').value = Math.max(0, Math.min(100, Math.round((cy / canvas.height) * 100)));
}

canvas.addEventListener('mousedown', (e) => {
  const r = canvas.getBoundingClientRect();
  dragStart = { x: e.clientX - r.left, y: e.clientY - r.top };
});
canvas.addEventListener('mousemove', (e) => {
  if (!dragStart) return;
  const r = canvas.getBoundingClientRect();
  const x2 = e.clientX - r.left;
  const y2 = e.clientY - r.top;
  rect = {
    x: Math.min(dragStart.x, x2),
    y: Math.min(dragStart.y, y2),
    w: Math.abs(x2 - dragStart.x),
    h: Math.abs(y2 - dragStart.y)
  };
  draw();
});
canvas.addEventListener('mouseup', () => {
  dragStart = null;
  updateFocusFromRect();
});

async function loadEntries() {
  try {
    const data = await api('/api/admin/entries');
    entriesEl.innerHTML = data.map((e) => `<tr><td>${e.name}</td><td>${e.game}</td><td>${e.skin}</td><td>${e.focusX},${e.focusY}</td><td><button data-del="${e.id}">Delete</button></td></tr>`).join('');
    setStatus(`Loaded ${data.length} entries.`);
    form.classList.remove('hidden');
  } catch (error) {
    setStatus(`Unauthorized or error: ${error.message}`);
  }
}

entriesEl.addEventListener('click', async (e) => {
  const id = e.target.getAttribute('data-del');
  if (!id) return;
  await api(`/api/admin/entries/${id}`, { method: 'DELETE' });
  loadEntries();
});

document.getElementById('file').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    currentImageDataUrl = reader.result;
    img = new Image();
    img.onload = () => {
      wrap.classList.remove('hidden');
      rect = null;
      draw();
      setStatus('Drag a rectangle on the image to set focus point.');
    };
    img.src = currentImageDataUrl;
  };
  reader.readAsDataURL(file);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!currentImageDataUrl) return setStatus('Upload image first.');
  const payload = {
    name: document.getElementById('name').value.trim(),
    game: document.getElementById('game').value.trim(),
    skin: document.getElementById('skin').value.trim(),
    image: currentImageDataUrl,
    focusX: Number(document.getElementById('focusX').value),
    focusY: Number(document.getElementById('focusY').value)
  };
  await api('/api/admin/entries', { method: 'POST', body: JSON.stringify(payload) });
  setStatus('Saved entry.');
  form.reset();
  currentImageDataUrl = '';
  wrap.classList.add('hidden');
  loadEntries();
});

loadEntries();

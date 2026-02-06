const TOTAL_ROUNDS = 5;
const START_VISIBLE_PERCENT = 5;
const VISIBLE_STEP = 1;
const SKIP_PENALTY = 15;

const ui = {
  roundLabel: document.getElementById("roundLabel"),
  guessCountEl: document.getElementById("guessCount"),
  totalPointsEl: document.getElementById("totalPoints"),
  champImage: document.getElementById("champImage"),
  guessInput: document.getElementById("guessInput"),
  guessBtn: document.getElementById("guessBtn"),
  revealBtn: document.getElementById("revealBtn"),
  messageEl: document.getElementById("message"),
  endScreen: document.getElementById("endScreen"),
  finalScore: document.getElementById("finalScore"),
  scoreBreakdown: document.getElementById("scoreBreakdown"),
  restartBtn: document.getElementById("restartBtn"),
  controls: document.getElementById("controls"),
  datalist: document.getElementById("champions"),
  tabs: [...document.querySelectorAll(".tab")],
  panels: { solo: document.getElementById("soloPanel"), online: document.getElementById("onlinePanel") },
  nickInput: document.getElementById("nickInput"),
  connectBtn: document.getElementById("connectBtn"),
  createRoomBtn: document.getElementById("createRoomBtn"),
  roomCodeInput: document.getElementById("roomCodeInput"),
  joinRoomBtn: document.getElementById("joinRoomBtn"),
  startOnlineBtn: document.getElementById("startOnlineBtn"),
  onlineStatus: document.getElementById("onlineStatus"),
  onlinePlayers: document.getElementById("onlinePlayers")
};

const state = {
  entries: [], rounds: [], roundIndex: 0, visiblePercent: START_VISIBLE_PERCENT,
  guessesThisRound: 0, totalPoints: 0, perRoundPoints: [], mode: "solo",
  socket: null, playerId: null, roomCode: null, players: []
};

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

async function loadEntries() {
  const res = await fetch('/api/public-entries');
  state.entries = await res.json();
  ui.datalist.innerHTML = state.entries.map((e) => `<option value="${e.name}"></option>`).join("");
}

function setMessage(text, tone = "info") {
  ui.messageEl.textContent = text;
  ui.messageEl.style.color = tone === "good" ? "#b8ffbe" : tone === "bad" ? "#ffb4b4" : "#ffe4a8";
}

function updateHUD() {
  ui.roundLabel.textContent = `${state.roundIndex + 1}/${TOTAL_ROUNDS}`;
  ui.guessCountEl.textContent = `${state.guessesThisRound}`;
  ui.totalPointsEl.textContent = `${state.totalPoints}`;
}

function updateImageTransform(x, y) {
  const scale = Math.max(1, 100 / state.visiblePercent);
  ui.champImage.style.transformOrigin = `${x}% ${y}%`;
  ui.champImage.style.transform = `scale(${scale})`;
}

function startRound() {
  if (state.roundIndex >= TOTAL_ROUNDS) return finishGame();
  state.guessesThisRound = 0;
  state.visiblePercent = START_VISIBLE_PERCENT;
  const current = state.rounds[state.roundIndex];
  ui.champImage.src = current.image;
  updateImageTransform(current.focusX, current.focusY);
  ui.guessInput.value = "";
  setMessage("Take your best shot.");
  updateHUD();
}

function revealFullImage() {
  state.visiblePercent = 100;
  updateImageTransform(50, 50);
}

function scoreRound(points, msg, tone) {
  const current = state.rounds[state.roundIndex];
  state.totalPoints += points;
  state.perRoundPoints.push({ champion: current.name, skin: current.skin, points });
  setMessage(msg, tone);
  updateHUD();
  setTimeout(() => { state.roundIndex += 1; startRound(); }, 900);
}

function submitGuess() {
  const guess = ui.guessInput.value.trim();
  if (!guess) return setMessage("Type a champion name first.", "bad");
  state.guessesThisRound += 1;
  updateHUD();
  const current = state.rounds[state.roundIndex];
  if (norm(guess) === norm(current.name)) {
    revealFullImage();
    return scoreRound(state.guessesThisRound, `Correct: ${current.name}. +${state.guessesThisRound}`, "good");
  }
  state.visiblePercent = Math.min(100, state.visiblePercent + VISIBLE_STEP);
  updateImageTransform(current.focusX, current.focusY);
  if (state.visiblePercent >= 100) {
    revealFullImage();
    return scoreRound(state.guessesThisRound + 5, `Out of zoom. ${current.name}. +${state.guessesThisRound + 5}`, "bad");
  }
  setMessage(`Nope. ${state.visiblePercent}% visible`, "bad");
}

function skipRound() {
  const current = state.rounds[state.roundIndex];
  revealFullImage();
  scoreRound(SKIP_PENALTY, `Skipped. ${current.name}. +${SKIP_PENALTY}`, "bad");
}

function finishGame() {
  ui.controls.classList.add('hidden');
  ui.endScreen.classList.remove('hidden');
  ui.finalScore.textContent = `Final: ${state.totalPoints} points.`;
  ui.scoreBreakdown.innerHTML = state.perRoundPoints.map((r) => `<li>${r.champion} (${r.skin}): ${r.points}</li>`).join('');

  if (state.mode === 'online' && state.socket && state.roomCode) {
    state.socket.send(JSON.stringify({ type: 'submit_score', roomCode: state.roomCode, score: state.totalPoints }));
  }
}

function restartGame(mode = 'solo', forcedRounds = null) {
  state.mode = mode;
  state.roundIndex = 0; state.totalPoints = 0; state.perRoundPoints = [];
  ui.controls.classList.remove('hidden');
  ui.endScreen.classList.add('hidden');
  state.rounds = forcedRounds || shuffle(state.entries).slice(0, TOTAL_ROUNDS);
  startRound();
}

function setTab(name) {
  ui.tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  Object.entries(ui.panels).forEach(([k, el]) => el.classList.toggle('active', k === name));
}

function setOnlineStatus(text) { ui.onlineStatus.textContent = text; }

function renderOnlinePlayers() {
  ui.onlinePlayers.innerHTML = state.players.map((p) => `<li>${p.name}${p.id === state.playerId ? ' (you)' : ''}</li>`).join('');
}

function connectSocket() {
  if (state.socket && state.socket.readyState === WebSocket.OPEN) return;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  state.socket = new WebSocket(`${proto}://${location.host}`);
  state.socket.onopen = () => setOnlineStatus('Connected to matchmaking server.');
  state.socket.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.type === 'connected') { state.playerId = msg.playerId; }
    if (msg.type === 'room_update') {
      state.roomCode = msg.roomCode; state.players = msg.players;
      setOnlineStatus(`Room ${msg.roomCode} (${msg.players.length}/2)`);
      renderOnlinePlayers();
    }
    if (msg.type === 'match_start') {
      setOnlineStatus('Match started.');
      setTab('solo');
      restartGame('online', msg.rounds);
    }
    if (msg.type === 'match_result') {
      setOnlineStatus(msg.text);
    }
    if (msg.type === 'error') setOnlineStatus(`Error: ${msg.text}`);
  };
}

function wire() {
  ui.guessBtn.addEventListener('click', submitGuess);
  ui.revealBtn.addEventListener('click', skipRound);
  ui.restartBtn.addEventListener('click', () => restartGame('solo'));
  ui.guessInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submitGuess(); } });

  ui.tabs.forEach((tab) => tab.addEventListener('click', () => setTab(tab.dataset.tab)));

  ui.connectBtn.addEventListener('click', connectSocket);
  ui.createRoomBtn.addEventListener('click', () => {
    connectSocket();
    state.socket.send(JSON.stringify({ type: 'create_room', name: ui.nickInput.value.trim() || 'Player' }));
  });
  ui.joinRoomBtn.addEventListener('click', () => {
    connectSocket();
    state.socket.send(JSON.stringify({ type: 'join_room', roomCode: ui.roomCodeInput.value.trim().toUpperCase(), name: ui.nickInput.value.trim() || 'Player' }));
  });
  ui.startOnlineBtn.addEventListener('click', () => {
    if (!state.roomCode) return setOnlineStatus('Create or join a room first.');
    const rounds = shuffle(state.entries).slice(0, TOTAL_ROUNDS);
    state.socket.send(JSON.stringify({ type: 'start_match', roomCode: state.roomCode, rounds }));
  });
}

(async function boot() {
  await loadEntries();
  wire();
  restartGame('solo');
})();

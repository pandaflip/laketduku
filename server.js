import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const DATA_PATH = path.join(__dirname, 'data', 'entries.json');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'change-me-admin-token';

app.use(express.json({ limit: '20mb' }));
app.use(express.static(__dirname));

function readEntries() {
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
}

function writeEntries(entries) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(entries, null, 2));
}

app.get('/api/public-entries', (_req, res) => {
  res.json(readEntries());
});

function checkAdmin(req, res, next) {
  if (req.header('x-admin-token') !== ADMIN_TOKEN) return res.status(401).send('unauthorized');
  next();
}

app.get('/api/admin/entries', checkAdmin, (_req, res) => res.json(readEntries()));

app.post('/api/admin/entries', checkAdmin, (req, res) => {
  const entries = readEntries();
  const entry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: req.body.name,
    game: req.body.game,
    skin: req.body.skin,
    image: req.body.image,
    focusX: Number(req.body.focusX),
    focusY: Number(req.body.focusY)
  };
  entries.push(entry);
  writeEntries(entries);
  res.json(entry);
});

app.delete('/api/admin/entries/:id', checkAdmin, (req, res) => {
  const entries = readEntries().filter((entry) => entry.id !== req.params.id);
  writeEntries(entries);
  res.json({ ok: true });
});

const rooms = new Map();
const clients = new Map();

function send(ws, obj) { ws.send(JSON.stringify(obj)); }
function code() { return Math.random().toString(36).slice(2, 6).toUpperCase(); }

function roomBroadcast(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const players = room.players.map((player) => ({ id: player.id, name: player.name }));
  room.players.forEach((player) => send(player.ws, { type: 'room_update', roomCode, players }));
}

function announceResult(room) {
  if (room.scores.length < 2) return;
  const a = room.scores[0];
  const b = room.scores[1];
  let text = `${a.name}: ${a.score} | ${b.name}: ${b.score}. `;
  if (a.score < b.score) text += `${a.name} wins.`;
  else if (b.score < a.score) text += `${b.name} wins.`;
  else text += 'Tie.';
  room.players.forEach((player) => send(player.ws, { type: 'match_result', text }));
  room.scores = [];
}

wss.on('connection', (ws) => {
  const playerId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  clients.set(ws, { playerId, roomCode: null, name: 'Player' });
  send(ws, { type: 'connected', playerId });

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    const client = clients.get(ws);

    if (msg.type === 'create_room') {
      const roomCode = code();
      const room = { players: [{ id: client.playerId, ws, name: msg.name || 'Host' }], hostId: client.playerId, scores: [] };
      rooms.set(roomCode, room);
      client.roomCode = roomCode;
      client.name = msg.name || 'Host';
      roomBroadcast(roomCode);
    }

    if (msg.type === 'join_room') {
      const room = rooms.get(msg.roomCode);
      if (!room) return send(ws, { type: 'error', text: 'Room not found.' });
      if (room.players.length >= 2) return send(ws, { type: 'error', text: 'Room is full.' });
      room.players.push({ id: client.playerId, ws, name: msg.name || 'Guest' });
      client.roomCode = msg.roomCode;
      client.name = msg.name || 'Guest';
      roomBroadcast(msg.roomCode);
    }

    if (msg.type === 'start_match') {
      const room = rooms.get(msg.roomCode);
      if (!room) return;
      if (room.hostId !== client.playerId) return;
      if (room.players.length < 2) return send(ws, { type: 'error', text: 'Need 2 players.' });
      room.scores = [];
      room.players.forEach((player) => send(player.ws, { type: 'match_start', rounds: msg.rounds }));
    }

    if (msg.type === 'submit_score') {
      const room = rooms.get(msg.roomCode);
      if (!room) return;
      const existing = room.scores.find((score) => score.id === client.playerId);
      if (existing) existing.score = msg.score;
      else room.scores.push({ id: client.playerId, name: client.name, score: msg.score });
      announceResult(room);
    }
  });

  ws.on('close', () => {
    const client = clients.get(ws);
    if (!client) return;
    if (client.roomCode) {
      const room = rooms.get(client.roomCode);
      if (room) {
        room.players = room.players.filter((p) => p.id !== client.playerId);
        if (!room.players.length) rooms.delete(client.roomCode);
        else roomBroadcast(client.roomCode);
      }
    }
    clients.delete(ws);
  });
});

const PORT = process.env.PORT || 4173;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});


const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// room code -> { members: Map(socketId -> name), source, playback }
const rooms = new Map();
const MAX_PER_ROOM = 2;

function expectedTime(pb) {
  return pb.playing ? pb.time + (Date.now() - pb.at) / 1000 : pb.time;
}

io.on('connection', (socket) => {
  let roomCode = null;
  let userName = 'Guest';

  socket.on('join', (data, ack) => {
    const reply = typeof ack === 'function' ? ack : () => {};
    const code = String((data && data.room) || '').trim().toUpperCase().slice(0, 12);
    const name = String((data && data.name) || '').trim().slice(0, 24) || 'Guest';
    if (!code) return reply({ error: 'Room code likho.' });

    let room = rooms.get(code);
    if (!room) {
      room = { members: new Map(), source: null, playback: { playing: false, time: 0, at: Date.now() } };
      rooms.set(code, room);
    }
    if (room.members.size >= MAX_PER_ROOM) {
      return reply({ error: 'Ye room full hai (max 2 log).' });
    }

    roomCode = code;
    userName = name;
    room.members.set(socket.id, name);
    socket.join(code);

    const others = [...room.members.entries()].filter(([id]) => id !== socket.id).map(([, n]) => n);
    socket.to(code).emit('peer-joined', { name });

    reply({
      ok: true,
      room: code,
      peers: others,
      source: room.source,
      playback: { playing: room.playback.playing, time: expectedTime(room.playback) },
    });
  });

  socket.on('source', (src) => {
    const room = rooms.get(roomCode);
    if (!room || !src) return;
    room.source = src;
    room.playback = { playing: false, time: 0, at: Date.now() };
    socket.to(roomCode).emit('source', { source: src, from: userName });
  });

  socket.on('playback', (pb) => {
    const room = rooms.get(roomCode);
    if (!room || !pb) return;
    room.playback = { playing: !!pb.playing, time: Number(pb.time) || 0, at: Date.now() };
    socket.to(roomCode).emit('playback', { playing: room.playback.playing, time: room.playback.time, from: userName });
  });

  socket.on('chat', (text) => {
    if (!roomCode) return;
    const clean = String(text || '').slice(0, 500);
    if (!clean.trim()) return;
    io.to(roomCode).emit('chat', { name: userName, text: clean, at: Date.now() });
  });

  socket.on('signal', (payload) => {
    if (roomCode) socket.to(roomCode).emit('signal', payload);
  });

  socket.on('disconnect', () => {
    const room = rooms.get(roomCode);
    if (!room) return;
    room.members.delete(socket.id);
    socket.to(roomCode).emit('peer-left', { name: userName });
    if (room.members.size === 0) rooms.delete(roomCode);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Saath Dekho chal raha hai: http://localhost:${PORT}`));

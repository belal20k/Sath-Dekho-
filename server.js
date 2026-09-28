const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
    cors: { origin: "*" }
});

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('A user connected: ' + socket.id);

    // Room join karne ke liye
    socket.on('join-room', (roomName) => {
        socket.join(roomName);
        console.log(`${socket.id} joined room: ${roomName}`);
    });

    // Room ke andar video action sync karne ke liye
    socket.on('video-action', (data) => {
        if (data.room) {
            socket.to(data.room).emit('video-action', data);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected: ' + socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

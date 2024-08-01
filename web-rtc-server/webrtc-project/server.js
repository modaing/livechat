const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');

// 익스프레스 앱 설정
const app = express();
const corsOptions = {
    origin: 'http://localhost:3000', // 특정 도메인 허용
    methods: 'GET,POST,PUT,DELETE', // 허용할 HTTP 메서드
    allowedHeaders: 'Content-Type,Authorization' // 허용할 HTTP 헤더
};

app.use(cors(corsOptions));
// app.use(cors())
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 8080;

app.use(express.static('public'));
// CORS 설정



// 클라이언트가 연결되었을 때 실행
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // 클라이언트로부터 'collabo' 이벤트를 수신
    socket.on('collabo', (room) => {
        console.log('Received request to create or join room', room);
        // 'create or join' 이벤트를 발생시켜 방에 참여하도록 함
        socket.emit('create or join', room);
    });

    // 클라이언트가 방에 들어가거나 방을 생성하려고 할 때
    socket.on('create or join', (room) => {
        const clientsInRoom = io.sockets.adapter.rooms.get(room);
        const numClients = clientsInRoom ? clientsInRoom.size : 0;
        console.log(`Room ${room} now has ${numClients} client(s)`);

        if (numClients === 0) {
            socket.join(room);
            console.log(`Client ID ${socket.id} created room ${room}`);
            socket.emit('created', room, socket.id);
        } else if (numClients === 1) {
            socket.join(room);
            console.log(`Client ID ${socket.id} joined room ${room}`);
            io.to(room).emit('join', room);
            socket.emit('joined', room, socket.id);
            io.to(room).emit('ready', room);
        } else {
            socket.emit('full', room);
        }
    });

    // 클라이언트로부터 'message' 이벤트를 수신
    socket.on('message', (message) => {
        console.log('Client said:', message);
        socket.broadcast.emit('message', message);
    });

    // 클라이언트가 연결을 끊을 때 실행
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

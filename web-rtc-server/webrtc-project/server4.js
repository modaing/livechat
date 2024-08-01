// 'use strict';

var os = require('os');
var nodeStatic = require('node-static');
var http = require('http');
const path = require('path')
var socketIO = require('socket.io');

function generateRoomId() {
    return Math.random().toString(36).substr(2, 9); // Generate a random string
}

var fileServer = new nodeStatic.Server();
const express = require('express');
const app = express();
const port = 8080;

// 정적 파일을 제공할 폴더 설정
app.use(express.static(path.join(__dirname, '../../../LingoBell-FrontEnd/dist')));


// 루트 URL 요청 처리
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, '../../../LingoBell-FrontEnd/dist/index.html')
    const file = require('fs').readFileSync(indexPath, 'utf-8')

    res.status(200).send(file)
//   res.send('Hello, World!');
});

const server = http.createServer(app);

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Socket.IO 서버 설정
const io = socketIO(server, {
    cors: {
        origin: 'https://73b8-59-10-8-230.ngrok-free.app',    // 허용할 클라이언트의 URL
        methods: ['GET', 'POST'],           // 허용할 HTTP 메서드
        allowedHeaders: ['Content-Type'],   // 허용할 HTTP 헤더
    }
});

io.sockets.on('connection', function (socket) {
    console.log('A user connected:', socket.id);

    // convenience function to log server messages on the client
    function log() {
        var array = ['Message from server:'];
        array.push.apply(array, arguments);
        socket.emit('log', array);
    }

    socket.on('message', function (message) {
        console.log('messgae ')
        console.log(message)
        // console.log('Client said: ', message);
        // for a real app, would be room-only (not broadcast)
        socket.broadcast.emit('message', message);
    });

    socket.on('OFFER', function (message) {
        console.log('offer meesage ')
        socket.broadcast.emit('OFFER_RECEIVED', message)
    })

    socket.on('ANSWER', function (message) {
        console.log('ANSWER meesage ')
        socket.broadcast.emit('ANSWER_RECEIVED', message)
    })

    socket.on('CREATE_OR_JOIN', function (room) {
        console.log('Received request to create or join room ' + room); // 동작1

        var clientsInRoom = io.sockets.adapter.rooms.get(room);
        console.log('ddddddddddddddd', io.sockets.adapter.rooms.get(room)); // 동작2
        var numClients = clientsInRoom ? clientsInRoom.size : 0;

        // mapObject = io.sockets.adapter.rooms // return Map Js Object
        // console.log('dddddddddddddddd',mapObject);
        // clientsInRoom = new Set(mapObject.get(room))

        // var numClients = clientsInRoom ? clientsInRoom.size : 0;

        console.log('clientsInRoom', clientsInRoom);    // 동작3
        console.log('Room ' + room + ' now has ' + numClients + ' client(s)');  // 동작4

        if (numClients === 0) {
            console.log('new room', room);
            socket.join(room);
            console.log('Client ID ' + socket.id + ' created room ' + room);
            socket.emit('CREATED', room, socket.id);

        } else if (numClients === 1) {
            console.log('Client ID ' + socket.id + ' joined room ' + room);
            io.sockets.in(room).emit('JOIN', room);
            socket.join(room);
            // socket.emit('JOINED', room, socket.id);
            io.sockets.to(room).emit('ready');
            
        } else { // max two clients
            socket.emit('full', room);
        }
        console.log('Current clients in room: ' + room);
        console.log('clientsInRoom', clientsInRoom);
        console.log('\n\n\n\n\n')
        // console.log(`roomCount ${room} now has ${io.sockets.adapter.rooms[room]} client(s)`);
    });

    socket.on('CANDIDATE', function (message) {
        socket.broadcast.emit('CANDIDATE_RECEIVED', message)
    })

    socket.on('ipaddr', function () {
        var ifaces = os.networkInterfaces();
        for (var dev in ifaces) {
            ifaces[dev].forEach(function (details) {
                if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
                    socket.emit('ipaddr', details.address);
                }
            });
        }
    });

    // 클라이언트 연결 해제 처리
    socket.on('disconnect', () => {

        socket.broadcast.emit('OPP_DISCONNECTED')
        console.log('User disconnected:', socket.id);
    });

});
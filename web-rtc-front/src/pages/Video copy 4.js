import React, { useRef, useEffect } from "react";
import io from "socket.io-client";


/**
 * 
 * 준
 */
function Video() {
    const socket = useRef(null);
    const localVideo = useRef(null);
    const remoteVideo = useRef(null);
    let isInitiator = false;
    let isChannelReady = false; // 1. 방이 성립되었음을 의미 하는 것으로 보임
    let localStream; // 2. localStream까지 생성
    let isStarted = false; // 3. peerConnection이 생성되었음을 의미하는 것으로 보임
    let pc;
    let remoteStream;

    const pcConfig = {
        'iceServers': [{
            urls: 'stun:stun.l.google.com:19302'
        },
        {
            urls: "turn:numb.viagenie.ca",
            credential: "muazkh",
            username: "webrtc@live.com"
        }]
    };

    const sdpConstraints = {
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
    };

    useEffect(() => {
        socket.current = io.connect("http://localhost:8080"); // 서버 URL을 자신의 서버 URL로 변경하세요

        const roomName = "room1";
        // 0. 접속
        socket.current.on('connection', function () {
            console.log('서버에 연결됨');
            socket.current.emit("connection", socket.current.id);
        });

        // 1. 방을 만들든지 join 하든지 상황에 따라서
        socket.current.emit('create or join', roomName);
        console.log('Attempted to create or join room', roomName);

        // 1.1. caller의  경우 created
        socket.current.on('created', function (room) {
            console.log('Created room ' + room);
            isInitiator = true;
            isChannelReady = true;
        });

        socket.current.on('full', function (room) {
            console.log('Room ' + room + ' is full');
        });

        socket.current.on('join', function (room) {
            console.log('Another peer made a request to join room ' + room);
            console.log('This peer is the initiator of room ' + room + '!');
            isInitiator = true;
            isChannelReady = true;
        });
        
        // 1.2. callee의 경우 joined
        socket.current.on('joined', function (room) {
            console.log('joined: ' + room);
            isChannelReady = true;
        });

        socket.current.on('log', function (array) {
            console.log.apply(console, array);
        });

        socket.current.on('message', function (message) {
            console.log('Client received message:', message);
            
            if (message === 'got user media') {
                maybeStart();

            } else if (message.type === 'offer') {
                if (!isInitiator && !isStarted) {
                    maybeStart();
                }
                pc.setRemoteDescription(new RTCSessionDescription(message)).then(() => {
                    doAnswer();
                }).catch(e => console.error(e));

            } else if (message.type === 'answer' && isStarted) {
                pc.setRemoteDescription(new RTCSessionDescription(message)).catch(e => console.error(e));

            } else if (message.type === 'candidate' && isStarted) {
                var candidate = new RTCIceCandidate({
                    sdpMLineIndex: message.label,
                    candidate: message.candidate
                });
                pc.addIceCandidate(candidate).catch(e => console.error(e));

            } else if (message === 'bye' && isStarted) {
                handleRemoteHangup();
            }
        });


        function sendMessage(message) {
            console.log('Client sending message: ', message);
            socket.current.emit('message', message);
        }
        // 0. 준비작업이 먼저 시작됨
        navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true
        })
            .then(gotStream)
            .catch(function (e) {
                alert('getUserMedia() error: ' + e.name);
            });

        function gotStream(stream) {
            console.log('Adding local stream.');
            localStream = stream;
            if (localVideo.current) {
                localVideo.current.srcObject = stream;
            }

            // 유저의 미디어가 나오기 시작한 순간을 의미
            sendMessage('got user media');
            // socket.current.emit('create or join');
            if (isInitiator) {
                console.log('isInitiator', isInitiator);
                maybeStart();
            }
        }
        /**
         * peerconnection을 만들 수 있는지 여부를 계속 체킹함
         */
        function maybeStart() {
            // console.log('>>>>>>> maybeStart() ', isStarted, localStream, isChannelReady);
            // console.log('aaaaaaaaaaaaaaaa', isStarted);
            // console.log('bbbbbbbbbbbbbbbbbbb', localStream);
            // console.log('ccccccccccccccccc', isChannelReady);

            
            if (!isStarted && !!localStream && isChannelReady) {
                console.log('>>>>>> creating peer connection');
                createPeerConnection();
                // pc.addStream(localStream);
                localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
                isStarted = true;
                console.log('isStarted', isStarted);
                console.log('isInitiator', isInitiator);
                console.log('isChannelReady', isChannelReady);
                if (isInitiator) {
                    doCall();
                }
            }
        }

        function createPeerConnection() {
            try {
                pc = new RTCPeerConnection(pcConfig);
                pc.onicecandidate = handleIceCandidate;
                pc.onaddstream = handleRemoteStreamAdded;
                pc.onremovestream = handleRemoteStreamRemoved;
                console.log('Created RTCPeerConnnection');
            } catch (e) {
                console.log('Failed to create PeerConnection, exception: ' + e.message);
                alert('Cannot create RTCPeerConnection object.');
                return;
            }
        }

        function handleIceCandidate(event) {
            console.log('icecandidate event: ', event);
            if (event.candidate) {
                console.log('handleIceCandidate 함수 잘 호출됨~');
                sendMessage({
                    type: 'candidate',
                    label: event.candidate.sdpMLineIndex,
                    id: event.candidate.sdpMid,
                    candidate: event.candidate.candidate
                });
            } else {
                console.log('End of candidates.');
            }
        }

        function handleCreateOfferError(event) {
            console.log('createOffer() error: ', event);
        }

        function doCall() {
            // 5.1. caller가 콜을 보냄
            console.log('Sending offer to peer');
            pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
        }

        // 5.2. callee가 답변을 보냄
        function doAnswer() {
            console.log('Sending answer to peer.');
            pc.createAnswer().then(
                setLocalAndSendMessage,
                onCreateSessionDescriptionError
            );
        }

        function setLocalAndSendMessage(sessionDescription) {
            
            // pc.setLocalDescription(sessionDescription);
            // console.log('setLocalAndSendMessage sending message', sessionDescription);
            // sendMessage(sessionDescription);
            console.log('setLocalAndSendMessage setting local description and sending message', sessionDescription);
            pc.setLocalDescription(sessionDescription).then(() => {
                sendMessage(sessionDescription);
            }).catch(e => console.error('Error setting local description:', e));
        }

        function onCreateSessionDescriptionError(error) {
            console.log('Failed to create session description: ' + error.toString());
        }

        function handleRemoteStreamAdded(event) {
            console.log('Remote stream added.', event.stream);
            remoteStream = event.stream;
            if (remoteVideo.current) {
                remoteVideo.current.srcObject = remoteStream;
            }
        }

        function handleRemoteStreamRemoved(event) {
            console.log('Remote stream removed. Event: ', event);
        }

        function hangup() {
            console.log('Hanging up.');
            stop();
            sendMessage('bye');
        }

        function handleRemoteHangup() {
            console.log('Session terminated.');
            stop();
            isInitiator = false;
        }

        function stop() {
            isStarted = false;
            pc.close();
            pc = null;
        }

        return () => {
            if (socket.current) {
                socket.current.disconnect();
            }

            if (isStarted) {
                stop();
            }
        };
    }, []);

    return (
        <>
            <video ref={localVideo} playsInline id="left_cam" controls preload="metadata" autoPlay></video>
            <video ref={remoteVideo} playsInline id="right_cam" controls preload="metadata" autoPlay></video>
        </>
    );
}

export default Video;

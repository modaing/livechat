import React, { useRef, useEffect } from "react";
import io from "socket.io-client";

function Video() {
    const socket = useRef(null);
    const localVideo = useRef(null);
    const remoteVideo = useRef(null);
    const localStream = useRef(null);
    const peerConnection = useRef(null)
    const remoteStream = useRef(null)
    let isChannelReady = false;
    let isCaller = false
    let isStarted = false

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
        // room name 은 서버에서 받아와야함
        const roomName = "room1";

        socket.current.on('connection', function () {
            socket.current.emit("connection", socket.current.id);
        });

        // 1. 방을 만들거나 join을 하는 코드
        socket.current.emit('create or join', roomName);

        // 2-1. 생성 성공(초대한 사람이 될듯)
        socket.current.on('created', function (room) {
            isCaller = true;
            isChannelReady = true;
        });

        socket.current.on('full', function (room) {
            console.log('Room ' + room + ' is full');
        });

        socket.current.on('join', function (room) {
            isCaller = true;
            isChannelReady = true;
        });
        // 2-2., 방에 들어가는 데에 성공함
        socket.current.on('joined', function (room) {
            console.log('joined: ' + room);
            isChannelReady = true;
        });

        socket.current.on('log', function (array) {
            console.log.apply(console, array);
        });

        socket.current.on('message', function (message) {
            console.log('Client received message:', message);
            // 3.1 둘 다의 미디어를 성공적으로 가져온 경우를 말하는듯
            if (message === 'GOT_USERS_MEDIA') {
                maybeStart();
            
            } else if (message.type === 'offer') {
                if (!isCaller && !isStarted) {
                    maybeStart();
                }
                peerConnection.current.setRemoteDescription(new RTCSessionDescription(message)).then(() => {
                    doAnswer();
                }).catch(e => console.error(e));
            // 3.2. callee가 
            } else if (message.type === 'answer' && isStarted) {
                peerConnection.current.setRemoteDescription(new RTCSessionDescription(message)).catch(e => console.error(e));

            } else if (message.type === 'candidate' && isStarted) {
                var candidate = new RTCIceCandidate({
                    sdpMLineIndex: message.label,
                    candidate: message.candidate
                });
                peerConnection.current.addIceCandidate(candidate).catch(e => console.error(e));

            } else if (message === 'bye' && isStarted) {
                handleRemoteHangup();
            }
        });


        function sendMessage(message) {
            console.log('Client sending message: ', message);
            socket.current.emit('message', message);
        }

        navigator.mediaDevices.getUserMedia({
            audio: false,
            video: true
        })
            .then(gotStream)
            .catch(function (e) {
                console.log(e)
                alert('getUserMedia() error: ' + e.name);
            });

        function gotStream(stream) {
            console.log('Adding local stream.');
            localStream.current = stream;
            if (localVideo.current) {
                localVideo.current.srcObject = stream;
            }
            sendMessage('GOT_USERS_MEDIA');
            // socket.current.emit('create or join');
            if (isCaller) {
                maybeStart();
            }
        }

        function maybeStart() {
            
            if (!isStarted && typeof localStream.current !== 'undefined' && isChannelReady) {
                console.log('>>>>>> creating peer connection');
                createPeerConnection();
                // pc.addStream(localStream);
                localStream.current.getTracks().forEach(track => peerConnection.current.addTrack(track, localStream.current));
                isStarted = true;
                // console.log('isStarted', isStarted);
                // console.log('isInitiator', isCaller);
                // console.log('isChannelReady', isChannelReady);
                if (isCaller) {
                    doCall();
                }
            }
        }

        function createPeerConnection() {
            try {
                peerConnection.current = new RTCPeerConnection(pcConfig);
                peerConnection.current.onicecandidate = handleIceCandidate;
                peerConnection.current.onaddstream = handleRemoteStreamAdded;
                peerConnection.current.onremovestream = handleRemoteStreamRemoved;
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
            console.log('Sending offer to peer');
            peerConnection.current.createOffer(setLocalAndSendMessage, handleCreateOfferError);
        }

        function doAnswer() {
            console.log('Sending answer to peer.');
            peerConnection.current.createAnswer().then(
                setLocalAndSendMessage,
                onCreateSessionDescriptionError
            );
        }

        function setLocalAndSendMessage(sessionDescription) {
            // pc.setLocalDescription(sessionDescription);
            // console.log('setLocalAndSendMessage sending message', sessionDescription);
            // sendMessage(sessionDescription);
            console.log('setLocalAndSendMessage setting local description and sending message', sessionDescription);
            peerConnection.current.setLocalDescription(sessionDescription).then(() => {
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
            isCaller = false;
        }

        function stop() {
            isStarted = false;
            peerConnection.current.close();
            peerConnection.current = null;
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

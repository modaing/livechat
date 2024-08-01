import React, { useRef, useEffect } from "react";
import io from "socket.io-client";


/**
 * 
 * 준
 */
function Video() {
    const socket = useRef(null);
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    let isInitiator = false;
    let isChannelReady = false; // 1. 방이 성립되었음을 의미 하는 것으로 보임
    let localStream; // 2. localStream까지 생성
    let isStarted = false; // 3. peerConnection이 생성되었음을 의미하는 것으로 보임
    let pc;
    let remoteStream;

    const peerConnection = useRef()
    const dataChannel = useRef()

    const roomName = 'room1'

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
        socket.current = io.connect('http://localhost:8080')
        peerConnection.current = new RTCPeerConnection(pcConfig)
        peerConnection.current.onicecandidate = (event) => {
            if (event.candidate) {
                socket.current.emit('CANDIDATE', {
                    candidate: event.candidate,
                    roomName
                })
            }
        }
        peerConnection.current.onaddstream = (event) => {
            const remoteStream = event.stream;
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = remoteStream;
            }
            // remoteVideoRef.current.srcObject = stream;
            // remoteVideoRef.current.play();
        };
        peerConnection.current.ondatachannel = (event) =>{
            console.log("on data channel")
            let receiveChannel = event.channel;
            // receiveChannel.onopen = handleDataChannelOpen;
            receiveChannel.onmessage = (event) => {
                console.log('face data')
                const faceData = JSON.parse(event.data)
                console.log(faceData)
            }
            // receiveChannel.onerror = handleDataChannelError;
        
        };
        
        function sendMessage(message) {
            console.log('Client sending message: ', message);
            socket.current.emit('message', message);
        }
        // dataChannel
        dataChannel.current = peerConnection.current.createDataChannel('faceDataChannel')
        dataChannel.current.onopen = () => {
            console.log('data channel opened')
        }
        dataChannel.current.onmessage = (event) => {
            console.log('face data')
            const faceData = JSON.parse(event.data)
            console.log(faceData)
        }

        peerConnection.current.onicecandidate = event => {
            console.log('iddddkdkdkdkdk', event)
            if (event.candidate) {
                socket.current.emit('CANDIDATE', {
                    label: event.candidate.sdpMLineIndex,
                    id: event.candidate.sdpMid,
                    candidate: event.candidate.candidate
                })
            }
        }

        socket.current.emit('CREATE_OR_JOIN', roomName)

        socket.current.on('CREATED', (room) => {
            console.log('CREATED')
            isInitiator = true
        })
        socket.current.on('JOIN', async (room) => {
            console.log('JOIN')
            const offer = await peerConnection.current.createOffer()
            socket.current.emit('OFFER', offer)
            setLocalAndSendMessage(offer)
        })

        socket.current.on('JOINED', async room => {
            console.log('JOINED')
            if (isInitiator) {
                const offer = await peerConnection.current.createOffer()
                socket.current.emit('OFFER', offer)
                setLocalAndSendMessage(offer)
            }
        })

        socket.current.on('OFFER_RECEIVED', async offer => {
            console.log('OFFER_RECEIVED')
            console.log(offer)
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer))
            const answer = await peerConnection.current.createAnswer()
            setLocalAndSendMessage(answer)
            socket.current.emit('ANSWER', answer)
        })

        socket.current.on('ANSWER_RECEIVED', async answer => {
            console.log('ANSWER_RECEIVED')
            console.log(answer)
            await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer))
        })

        socket.current.on('CANDIDATE_RECEIVED', async message => {
            console.log('CANDIDATE_RECEIVED')
            console.log(message)
            var candidate = new RTCIceCandidate({
                sdpMLineIndex: message.label,
                candidate: message.candidate
            });
            peerConnection.current.addIceCandidate(candidate).catch(e => console.error(e));
        })
        // socket.current.on('connect')
        function setLocalAndSendMessage(sessionDescription) {
            
            // pc.setLocalDescription(sessionDescription);
            // console.log('setLocalAndSendMessage sending message', sessionDescription);
            // sendMessage(sessionDescription);
            console.log('setLocalAndSendMessage setting local description and sending message', sessionDescription);
            peerConnection.current.setLocalDescription(sessionDescription)

        }
        // 얼굴 인식 및 좌표값 전송
        const detectFaces = async (video) => {
            await window.faceapi.nets.tinyFaceDetector.loadFromUri('/models');
            await window.faceapi.nets.faceLandmark68Net.loadFromUri('/models');
            await window.faceapi.nets.faceRecognitionNet.loadFromUri('/models');

            setInterval(async () => {
                const detections = await window.faceapi.detectAllFaces(video, new window.faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
                if (detections.length > 0) {
                    const faceData = detections.map(detection => ({
                        x: detection.detection.box.x,
                        y: detection.detection.box.y,
                        width: detection.detection.box.width,
                        height: detection.detection.box.height
                    }));
                    if (dataChannel.current && dataChannel.current.readyState === 'open') {
                        console.log('data chaneeel send')
                        dataChannel.current.send(JSON.stringify(faceData));
                    }
                }
            }, 100);
        };
        const startVideo = async () => {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            localVideoRef.current.srcObject = stream;

            stream.getTracks().forEach(track => peerConnection.current.addTrack(track, stream));

            localVideoRef.current.onloadedmetadata = () => {
                localVideoRef.current.play();
                detectFaces(localVideoRef.current);
            };
        };
        startVideo()
        return () => {
            // if (socket.current) {
            //     socket.current.disconnect();
            // }

            // if (isStarted) {
            //     stop();
            // }
        };
    }, []);

    return (
        <>
            <video ref={localVideoRef} playsInline id="left_cam" controls preload="metadata" autoPlay></video>
            <video ref={remoteVideoRef} playsInline id="right_cam" controls preload="metadata" autoPlay></video>
        </>
    );
}

export default Video;

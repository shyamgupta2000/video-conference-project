// public/js/app.js
// Main application logic

let currentRoomId = null;
let currentUserName = 'Anonymous';
let audioEnabled = true;
let videoEnabled = true;
let faceDetectionEnabled = true;

// DOM Elements
const landingScreen = document.getElementById('landing-screen');
const meetingRoom = document.getElementById('meeting-room');
const createRoomBtn = document.getElementById('createRoomBtn');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const userNameInput = document.getElementById('userName');
const roomIdInput = document.getElementById('roomIdInput');
const currentRoomIdSpan = document.getElementById('currentRoomId');
const participantCountSpan = document.getElementById('participantCount');
const leaveRoomBtn = document.getElementById('leaveRoom');
const toggleVideoBtn = document.getElementById('toggleVideo');
const toggleAudioBtn = document.getElementById('toggleAudio');
const toggleFaceDetectionBtn = document.getElementById('toggleFaceDetection');
const localVideo = document.getElementById('localVideo');
const localCanvas = document.getElementById('localCanvas');
const remoteVideosContainer = document.getElementById('remoteVideos');
const detectionStatus = document.getElementById('detectionStatus');

// Initialize on page load
window.addEventListener('load', async () => {
    console.log('[App] Initializing application...');
    
    // Check for room ID in URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('room');
    
    if (roomId) {
        roomIdInput.value = roomId;
    }
});

// Create Room
createRoomBtn.addEventListener('click', async () => {
    currentUserName = userNameInput.value.trim() || 'Anonymous';
    
    try {
        const response = await fetch('/api/room/create', { method: 'POST' });
        const data = await response.json();
        
        console.log('[App] Room created:', data.roomId);
        await joinRoom(data.roomId);
    } catch (error) {
        console.error('[App] Failed to create room:', error);
        alert('Failed to create room. Please try again.');
    }
});

// Join Room
joinRoomBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim();
    
    if (!roomId) {
        alert('Please enter a room ID');
        return;
    }
    
    currentUserName = userNameInput.value.trim() || 'Anonymous';
    joinRoom(roomId);
});

// Join Room Function
async function joinRoom(roomId) {
    try {
        currentRoomId = roomId;
        
        // Show meeting room
        landingScreen.style.display = 'none';
        meetingRoom.style.display = 'block';
        currentRoomIdSpan.textContent = roomId;
        
        // Update URL
        window.history.pushState({}, '', `/?room=${roomId}`);
        
        // Initialize face detection
        detectionStatus.textContent = 'Loading AI model...';
        const modelLoaded = await faceDetectionService.initialize();
        
        if (modelLoaded) {
            detectionStatus.textContent = 'Ready';
        } else {
            detectionStatus.textContent = 'Model load failed';
            alert('Face detection model failed to load. Continuing without face detection.');
        }
        
        // Get local stream
        const stream = await webrtcService.getLocalStream();
        localVideo.srcObject = stream;
        
        // Register local video for face detection
        faceDetectionService.registerVideo(localVideo, localCanvas);
        faceDetectionService.startDetection();
        
        // Connect socket
        socketService.connect();
        socketService.joinRoom(roomId, currentUserName);
        
        // Setup WebRTC event handlers
        setupWebRTCHandlers();
        
        // Setup socket event handlers
        setupSocketHandlers();
        
        console.log('[App] Joined room:', roomId);
        
    } catch (error) {
        console.error('[App] Failed to join room:', error);
        alert('Failed to join room. Please check your camera/microphone permissions.');
        leaveMeeting();
    }
}

// Setup WebRTC Handlers
function setupWebRTCHandlers() {
    // Handle remote stream added
    webrtcService.onRemoteStream = (socketId, stream) => {
        console.log('[App] Remote stream received from:', socketId);
        addRemoteVideo(socketId, stream);
        updateParticipantCount();
    };
    
    // Handle remote stream removed
    webrtcService.onRemoteStreamRemoved = (socketId) => {
        console.log('[App] Remote stream removed:', socketId);
        removeRemoteVideo(socketId);
        updateParticipantCount();
    };
}

// Setup Socket Handlers
function setupSocketHandlers() {
    // Existing participants
    socketService.on('existing-participants', async (participants) => {
        console.log('[App] Existing participants:', participants);
        
        for (const participant of participants) {
            const pc = webrtcService.createPeerConnection(participant.socketId);
            const offer = await webrtcService.createOffer(participant.socketId);
            socketService.sendOffer(offer, participant.socketId);
        }
    });
    
    // New user joined
    socketService.on('user-joined', async ({ socketId, userName }) => {
        console.log('[App] User joined:', userName);
        webrtcService.createPeerConnection(socketId);
    });
    
    // Receive offer
    socketService.on('offer', async ({ offer, from, userName }) => {
        console.log('[App] Received offer from:', userName);
        
        if (!webrtcService.peers.has(from)) {
            webrtcService.createPeerConnection(from);
        }
        
        await webrtcService.setRemoteDescription(from, offer);
        const answer = await webrtcService.createAnswer(from);
        socketService.sendAnswer(answer, from);
    });
    
    // Receive answer
    socketService.on('answer', async ({ answer, from }) => {
        console.log('[App] Received answer from:', from);
        await webrtcService.setRemoteDescription(from, answer);
    });
    
    // ICE candidate
    socketService.on('ice-candidate', async ({ candidate, from }) => {
        await webrtcService.addIceCandidate(from, candidate);
    });
    
    // User left
    socketService.on('user-left', ({ socketId, userName }) => {
        console.log('[App] User left:', userName);
        webrtcService.removePeer(socketId);
        removeRemoteVideo(socketId);
        updateParticipantCount();
    });
}

// Add Remote Video
function addRemoteVideo(socketId, stream) {
    // Check if already exists
    if (document.getElementById(`remote-${socketId}`)) {
        return;
    }
    
    const wrapper = document.createElement('div');
    wrapper.className = 'video-wrapper';
    wrapper.id = `remote-${socketId}`;
    
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = stream;
    
    const canvas = document.createElement('canvas');
    
    const label = document.createElement('div');
    label.className = 'video-label';
    label.textContent = 'Remote User';
    
    const faceCount = document.createElement('div');
    faceCount.className = 'face-count';
    faceCount.textContent = '0 faces detected';
    faceCount.style.display = 'none';
    
    wrapper.appendChild(video);
    wrapper.appendChild(canvas);
    wrapper.appendChild(label);
    wrapper.appendChild(faceCount);
    
    remoteVideosContainer.appendChild(wrapper);
    
    // Register for face detection
    faceDetectionService.registerVideo(video, canvas);
}

// Remove Remote Video
function removeRemoteVideo(socketId) {
    const wrapper = document.getElementById(`remote-${socketId}`);
    if (wrapper) {
        const video = wrapper.querySelector('video');
        faceDetectionService.unregisterVideo(video);
        wrapper.remove();
    }
}

// Update Participant Count
function updateParticipantCount() {
    const count = webrtcService.peers.size + 1;
    participantCountSpan.textContent = `${count} participant${count !== 1 ? 's' : ''}`;
}

// Control Buttons
toggleVideoBtn.addEventListener('click', () => {
    videoEnabled = !videoEnabled;
    webrtcService.toggleVideo(videoEnabled);
    toggleVideoBtn.textContent = videoEnabled ? '📹 Stop Video' : '📹 Start Video';
});

toggleAudioBtn.addEventListener('click', () => {
    audioEnabled = !audioEnabled;
    webrtcService.toggleAudio(audioEnabled);
    toggleAudioBtn.textContent = audioEnabled ? '🎤 Mute' : '🎤 Unmute';
});

toggleFaceDetectionBtn.addEventListener('click', () => {
    faceDetectionEnabled = faceDetectionService.toggle();
    toggleFaceDetectionBtn.textContent = faceDetectionEnabled 
        ? '🤖 Face Detection: ON' 
        : '🤖 Face Detection: OFF';
    toggleFaceDetectionBtn.classList.toggle('active', faceDetectionEnabled);
    
    detectionStatus.textContent = faceDetectionEnabled ? 'Active' : 'Paused';
});

leaveRoomBtn.addEventListener('click', () => {
    if (confirm('Are you sure you want to leave the meeting?')) {
        leaveMeeting();
    }
});

// Leave Meeting
function leaveMeeting() {
    console.log('[App] Leaving meeting...');
    
    // Cleanup
    webrtcService.cleanup();
    faceDetectionService.cleanup();
    socketService.disconnect();
    
    // Clear remote videos
    remoteVideosContainer.innerHTML = '';
    
    // Show landing screen
    meetingRoom.style.display = 'none';
    landingScreen.style.display = 'flex';
    
    // Reset URL
    window.history.pushState({}, '', '/');
    
    currentRoomId = null;
}

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (currentRoomId) {
        webrtcService.cleanup();
        faceDetectionService.cleanup();
        socketService.disconnect();
    }
});
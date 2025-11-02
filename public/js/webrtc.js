// public/js/webrtc.js
// WebRTC peer connection management

const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
];

class WebRTCService {
    constructor() {
        this.localStream = null;
        this.peers = new Map(); // socketId -> RTCPeerConnection
        this.onRemoteStream = null; // Callback for remote stream
        this.onRemoteStreamRemoved = null; // Callback for stream removal
    }

    async getLocalStream() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: true
            });
            console.log('[WebRTC] Local stream obtained');
            return this.localStream;
        } catch (error) {
            console.error('[WebRTC] Failed to get local stream:', error);
            alert('Failed to access camera/microphone. Please grant permissions.');
            throw error;
        }
    }

    createPeerConnection(socketId) {
        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        // Add local stream tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                pc.addTrack(track, this.localStream);
            });
        }

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socketService.sendIceCandidate(event.candidate, socketId);
            }
        };

        // Handle remote stream
        pc.ontrack = (event) => {
            console.log('[WebRTC] Remote track received from:', socketId);
            const [remoteStream] = event.streams;
            if (this.onRemoteStream) {
                this.onRemoteStream(socketId, remoteStream);
            }
        };

        // Handle connection state
        pc.onconnectionstatechange = () => {
            console.log('[WebRTC] Connection state:', pc.connectionState, 'for', socketId);
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                this.removePeer(socketId);
            }
        };

        this.peers.set(socketId, pc);
        return pc;
    }

    async createOffer(socketId) {
        const pc = this.peers.get(socketId);
        if (!pc) return null;

        try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            return offer;
        } catch (error) {
            console.error('[WebRTC] Create offer error:', error);
            throw error;
        }
    }

    async createAnswer(socketId) {
        const pc = this.peers.get(socketId);
        if (!pc) return null;

        try {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            return answer;
        } catch (error) {
            console.error('[WebRTC] Create answer error:', error);
            throw error;
        }
    }

    async setRemoteDescription(socketId, description) {
        const pc = this.peers.get(socketId);
        if (!pc) return;

        try {
            await pc.setRemoteDescription(new RTCSessionDescription(description));
        } catch (error) {
            console.error('[WebRTC] Set remote description error:', error);
        }
    }

    async addIceCandidate(socketId, candidate) {
        const pc = this.peers.get(socketId);
        if (!pc) return;

        try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('[WebRTC] Add ICE candidate error:', error);
        }
    }

    toggleAudio(enabled) {
        if (this.localStream) {
            this.localStream.getAudioTracks().forEach(track => {
                track.enabled = enabled;
            });
        }
    }

    toggleVideo(enabled) {
        if (this.localStream) {
            this.localStream.getVideoTracks().forEach(track => {
                track.enabled = enabled;
            });
        }
    }

    removePeer(socketId) {
        const pc = this.peers.get(socketId);
        if (pc) {
            pc.close();
            this.peers.delete(socketId);
            console.log('[WebRTC] Peer removed:', socketId);
            
            if (this.onRemoteStreamRemoved) {
                this.onRemoteStreamRemoved(socketId);
            }
        }
    }

    cleanup() {
        this.peers.forEach((pc, socketId) => {
            pc.close();
        });
        this.peers.clear();

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
    }
}

const webrtcService = new WebRTCService();
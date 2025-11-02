// public/js/socket.js
// Socket.io client wrapper

class SocketService {
    constructor() {
        this.socket = null;
    }

    connect() {
        this.socket = io({
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5
        });

        this.socket.on('connect', () => {
            console.log('[Socket] Connected:', this.socket.id);
        });

        this.socket.on('disconnect', () => {
            console.log('[Socket] Disconnected');
        });

        this.socket.on('connect_error', (error) => {
            console.error('[Socket] Connection error:', error);
        });

        return this.socket;
    }

    joinRoom(roomId, userName) {
        this.socket.emit('join-room', { roomId, userName });
    }

    sendOffer(offer, to) {
        this.socket.emit('offer', { offer, to });
    }

    sendAnswer(answer, to) {
        this.socket.emit('answer', { answer, to });
    }

    sendIceCandidate(candidate, to) {
        this.socket.emit('ice-candidate', { candidate, to });
    }

    on(event, callback) {
        this.socket.on(event, callback);
    }

    off(event, callback) {
        this.socket.off(event, callback);
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

const socketService = new SocketService();
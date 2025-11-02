// public/js/faceDetection.js
// Real-time face detection using TensorFlow.js BlazeFace

class FaceDetectionService {
    constructor() {
        this.model = null;
        this.isEnabled = true;
        this.detectionInterval = null;
        this.canvases = new Map(); // videoElement -> canvas
    }

    async initialize() {
        try {
            console.log('[FaceDetection] Loading BlazeFace model...');
            
            // Load BlazeFace model
            this.model = await blazeface.load();
            
            console.log('[FaceDetection] Model loaded successfully');
            return true;
        } catch (error) {
            console.error('[FaceDetection] Failed to load model:', error);
            return false;
        }
    }

    registerVideo(videoElement, canvasElement) {
        this.canvases.set(videoElement, canvasElement);
        console.log('[FaceDetection] Video registered for detection');
    }

    unregisterVideo(videoElement) {
        this.canvases.delete(videoElement);
    }

    async detectFaces(videoElement) {
        if (!this.model || !this.isEnabled || videoElement.paused || videoElement.ended) {
            return [];
        }

        try {
            // Run face detection
            const predictions = await this.model.estimateFaces(videoElement, false);
            return predictions;
        } catch (error) {
            // Silently handle errors (video might not be ready)
            return [];
        }
    }

    drawBoundingBoxes(canvasElement, predictions, videoElement) {
        const ctx = canvasElement.getContext('2d');
        
        // Set canvas size to match video
        canvasElement.width = videoElement.videoWidth;
        canvasElement.height = videoElement.videoHeight;

        // Clear previous drawings
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (!this.isEnabled || predictions.length === 0) {
            return;
        }

        // Draw bounding boxes
        predictions.forEach(prediction => {
            const start = prediction.topLeft;
            const end = prediction.bottomRight;
            const size = [end[0] - start[0], end[1] - start[1]];

            // Draw rectangle
            ctx.strokeStyle = '#4ECDC4';
            ctx.lineWidth = 3;
            ctx.strokeRect(start[0], start[1], size[0], size[1]);

            // Draw landmarks (eyes, nose, mouth)
            if (prediction.landmarks) {
                ctx.fillStyle = '#FF6B6B';
                prediction.landmarks.forEach(landmark => {
                    ctx.beginPath();
                    ctx.arc(landmark[0], landmark[1], 3, 0, 2 * Math.PI);
                    ctx.fill();
                });
            }

            // Draw label
            ctx.fillStyle = '#4ECDC4';
            ctx.font = '16px Arial';
            ctx.fillText('Face', start[0], start[1] > 20 ? start[1] - 5 : start[1] + 20);
        });
    }

    startDetection() {
        if (this.detectionInterval) {
            return;
        }

        console.log('[FaceDetection] Starting detection loop');

        this.detectionInterval = setInterval(async () => {
            for (const [videoElement, canvasElement] of this.canvases) {
                const predictions = await this.detectFaces(videoElement);
                this.drawBoundingBoxes(canvasElement, predictions, videoElement);

                // Update face count
                const faceCountElement = canvasElement.parentElement.querySelector('.face-count');
                if (faceCountElement) {
                    const count = predictions.length;
                    faceCountElement.textContent = `${count} face${count !== 1 ? 's' : ''} detected`;
                    faceCountElement.style.display = count > 0 ? 'block' : 'none';
                }
            }
        }, 100); // Run every 100ms (10 FPS)
    }

    stopDetection() {
        if (this.detectionInterval) {
            clearInterval(this.detectionInterval);
            this.detectionInterval = null;
            console.log('[FaceDetection] Detection loop stopped');
        }

        // Clear all canvases
        this.canvases.forEach((canvas) => {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        });
    }

    toggle() {
        this.isEnabled = !this.isEnabled;
        
        if (this.isEnabled) {
            this.startDetection();
        } else {
            // Clear canvases but keep loop running
            this.canvases.forEach((canvas) => {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            });
        }

        return this.isEnabled;
    }

    cleanup() {
        this.stopDetection();
        this.canvases.clear();
    }
}

const faceDetectionService = new FaceDetectionService();
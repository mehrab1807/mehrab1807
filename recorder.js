/**
 * recorder.js - In-browser audio voice memo and video memoir recorder for Rukn.
 * Provides camera viewfinder management, audio visualization hooks,
 * cross-browser codec negotiation, and Blob-to-File generation.
 */

(function () {
  'use strict';

  function padZero(num) {
    return String(num).padStart(2, '0');
  }

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${padZero(mins)}:${padZero(secs)}`;
  }

  function getSupportedMimeType(kind) {
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
      return '';
    }

    if (kind === 'audio') {
      const audioTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/aac',
        'audio/ogg;codecs=opus'
      ];
      for (const t of audioTypes) {
        if (MediaRecorder.isTypeSupported(t)) return t;
      }
      return '';
    }

    if (kind === 'video') {
      const videoTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4;codecs=h264,aac',
        'video/mp4'
      ];
      for (const t of videoTypes) {
        if (MediaRecorder.isTypeSupported(t)) return t;
      }
      return '';
    }

    return '';
  }

  function getExtensionForMime(mimeType, kind) {
    if (!mimeType) {
      return kind === 'video' ? 'mp4' : 'webm';
    }
    if (mimeType.includes('mp4')) return 'mp4';
    if (mimeType.includes('webm')) return 'webm';
    if (mimeType.includes('aac')) return 'm4a';
    if (mimeType.includes('ogg')) return 'ogg';
    return kind === 'video' ? 'webm' : 'webm';
  }

  class RecorderService {
    constructor() {
      this.stream = null;
      this.mediaRecorder = null;
      this.recordedChunks = [];
      this.recordedBlob = null;
      this.recordedUrl = null;
      this.mode = 'audio'; // 'audio' or 'video'
      this.facingMode = 'user'; // 'user' (selfie) or 'environment' (rear)
      this.status = 'idle'; // 'idle', 'previewing', 'recording', 'paused', 'stopped'
      this.elapsedSeconds = 0;
      this.timerInterval = null;
      this.audioContext = null;
      this.analyser = null;
      this.animFrameId = null;
      this.activeLiveVideoEl = null;
    }

    isSupported() {
      return Boolean(
        typeof navigator !== 'undefined' &&
        navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia &&
        typeof window !== 'undefined' &&
        window.MediaRecorder
      );
    }

    stopHardware() {
      if (this.stream) {
        this.stream.getTracks().forEach((track) => {
          try {
            track.stop();
          } catch (e) {
            // Ignore track closure errors
          }
        });
        this.stream = null;
      }

      if (this.activeLiveVideoEl) {
        try {
          this.activeLiveVideoEl.srcObject = null;
        } catch (e) {
          // Ignore
        }
        this.activeLiveVideoEl = null;
      }

      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }

      if (this.audioContext && this.audioContext.state !== 'closed') {
        try {
          this.audioContext.close();
        } catch (e) {
          // Ignore audio context closure errors
        }
        this.audioContext = null;
        this.analyser = null;
      }
    }

    clearTimer() {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
    }

    async startCameraPreview(videoElement) {
      this.stopHardware();
      this.mode = 'video';
      this.activeLiveVideoEl = videoElement;

      const constraints = {
        audio: true,
        video: {
          facingMode: this.facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      try {
        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (videoElement) {
          videoElement.srcObject = this.stream;
          videoElement.muted = true;
          await videoElement.play().catch(() => {});
        }
        this.status = 'previewing';
        return { success: true };
      } catch (err) {
        console.warn('Camera preview error:', err);
        return { success: false, error: err };
      }
    }

    async switchCamera(videoElement) {
      this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
      if (this.status === 'previewing') {
        return this.startCameraPreview(videoElement);
      }
      return { success: true, facingMode: this.facingMode };
    }

    async startRecording(mode, { videoElement, onTick, onAudioLevel }) {
      this.mode = mode;
      this.recordedChunks = [];
      this.recordedBlob = null;
      if (this.recordedUrl) {
        URL.revokeObjectURL(this.recordedUrl);
        this.recordedUrl = null;
      }

      // 1. Acquire media stream if not already active
      if (!this.stream || (mode === 'video' && !this.stream.getVideoTracks().length)) {
        this.stopHardware();
        const constraints = mode === 'video'
          ? {
              audio: true,
              video: {
                facingMode: this.facingMode,
                width: { ideal: 1280 },
                height: { ideal: 720 }
              }
            }
          : {
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
              },
              video: false
            };

        try {
          this.stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err) {
          console.warn('Microphone or camera permission denied:', err);
          return { success: false, error: err };
        }
      }

      // If video element supplied, mount live preview
      if (mode === 'video' && videoElement) {
        this.activeLiveVideoEl = videoElement;
        videoElement.srcObject = this.stream;
        videoElement.muted = true;
        await videoElement.play().catch(() => {});
      }

      // 2. Set up Web Audio analyser for audio levels
      if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
        try {
          const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
          this.audioContext = new AudioCtxClass();
          const source = this.audioContext.createMediaStreamSource(this.stream);
          this.analyser = this.audioContext.createAnalyser();
          this.analyser.fftSize = 64;
          source.connect(this.analyser);

          const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
          const updateLevel = () => {
            if (this.status !== 'recording' && this.status !== 'paused') return;
            this.analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const avg = sum / dataArray.length;
            const normalized = Math.min(100, Math.round((avg / 128) * 100));
            if (onAudioLevel) onAudioLevel(normalized);
            this.animFrameId = requestAnimationFrame(updateLevel);
          };
          this.animFrameId = requestAnimationFrame(updateLevel);
        } catch (audioErr) {
          console.warn('Audio visualization unavailable:', audioErr);
        }
      }

      // 3. Initialise MediaRecorder with negotiated codec
      const mimeType = getSupportedMimeType(mode);
      const options = mimeType ? { mimeType } : {};

      try {
        this.mediaRecorder = new MediaRecorder(this.stream, options);
      } catch (e) {
        // Fallback without options if browser rejects specified MIME
        this.mediaRecorder = new MediaRecorder(this.stream);
      }

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(250); // Slice chunks every 250ms for reliable streaming assembly
      this.status = 'recording';
      this.elapsedSeconds = 0;

      // 4. Start duration timer
      this.clearTimer();
      if (onTick) onTick(0, formatTime(0));
      this.timerInterval = setInterval(() => {
        if (this.status === 'recording') {
          this.elapsedSeconds += 1;
          if (onTick) onTick(this.elapsedSeconds, formatTime(this.elapsedSeconds));
        }
      }, 1000);

      return { success: true };
    }

    pauseRecording() {
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.pause();
        this.status = 'paused';
        return true;
      }
      return false;
    }

    resumeRecording() {
      if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
        this.mediaRecorder.resume();
        this.status = 'recording';
        return true;
      }
      return false;
    }

    stopRecording() {
      return new Promise((resolve, reject) => {
        if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
          resolve(null);
          return;
        }

        this.clearTimer();
        this.status = 'stopped';

        this.mediaRecorder.onstop = () => {
          const finalMime = this.mediaRecorder.mimeType || (this.mode === 'video' ? 'video/webm' : 'audio/webm');
          const blob = new Blob(this.recordedChunks, { type: finalMime });
          this.recordedBlob = blob;
          this.recordedUrl = URL.createObjectURL(blob);

          // Stop camera and mic hardware immediately
          this.stopHardware();

          // Build a File object for composer integration
          const ext = getExtensionForMime(finalMime, this.mode);
          const now = new Date();
          const dateStamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
          const prefix = this.mode === 'video' ? 'Video_Memoir' : 'Voice_Memoir';
          const filename = `${prefix}_${dateStamp}.${ext}`;

          const file = new File([blob], filename, {
            type: finalMime,
            lastModified: Date.now()
          });

          resolve({
            blob,
            file,
            url: this.recordedUrl,
            mimeType: finalMime,
            duration: this.elapsedSeconds,
            durationFormatted: formatTime(this.elapsedSeconds),
            mode: this.mode
          });
        };

        this.mediaRecorder.stop();
      });
    }

    discard() {
      this.clearTimer();
      this.stopHardware();
      if (this.recordedUrl) {
        URL.revokeObjectURL(this.recordedUrl);
        this.recordedUrl = null;
      }
      this.recordedBlob = null;
      this.recordedChunks = [];
      this.status = 'idle';
      this.elapsedSeconds = 0;
    }
  }

  // Export globally
  window.RecorderService = new RecorderService();
  window.RecorderServiceClass = RecorderService;
})();

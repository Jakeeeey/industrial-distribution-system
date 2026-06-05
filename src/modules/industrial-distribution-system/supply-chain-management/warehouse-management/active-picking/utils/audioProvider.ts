class AudioProvider {
    private playTone(frequency: number, type: OscillatorType, duration: number, volume: number = 0.1) {
        if (typeof window === "undefined") return;
        try {
            const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            if (!AudioCtxClass) return;
            const audioCtx = new AudioCtxClass();
            if (audioCtx.state === "suspended") {
                audioCtx.resume();
            }
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.type = type;
            oscillator.frequency.setValueAtTime(frequency, audioCtx.currentTime);
            
            gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + duration);
        } catch (e) {
            console.warn("Audio playback failed", e);
        }
    }

    success() {
        this.playTone(880, "sine", 0.15, 0.15);
    }

    duplicate() {
        this.playTone(440, "triangle", 0.1, 0.15);
        setTimeout(() => {
            this.playTone(440, "triangle", 0.1, 0.15);
        }, 150);
    }

    error() {
        this.playTone(180, "sawtooth", 0.35, 0.1);
    }
}

export const soundFX = new AudioProvider();

// Web Audio API Ringtone Synthesizer
// Generates a soft, pleasant, undisturbing harmonic chime with zero external audio assets

let audioCtx: AudioContext | null = null;
let ringtoneInterval: any = null;
let isRinging = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Plays a single soft 3-note harmonic chime (C5 -> E5 -> G5)
 */
function playSoftChime(ctx: AudioContext) {
  const now = ctx.currentTime;
  const notes = [
    { freq: 523.25, time: 0.00, duration: 0.4 }, // C5
    { freq: 659.25, time: 0.15, duration: 0.4 }, // E5
    { freq: 783.99, time: 0.30, duration: 0.6 }  // G5
  ];

  notes.forEach(({ freq, time, duration }) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + time);

    // Soft attack & exponential decay for pleasant acoustic tone
    gain.gain.setValueAtTime(0.0001, now + time);
    gain.gain.linearRampToValueAtTime(0.12, now + time + 0.04); // Gentle max volume
    gain.gain.exponentialRampToValueAtTime(0.0001, now + time + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + time);
    osc.stop(now + time + duration);
  });
}

/**
 * Starts looping the soft ringtone every 2.4 seconds
 */
export function startIncomingCallRingtone(): void {
  if (isRinging) return;
  isRinging = true;

  const ctx = getAudioContext();
  if (ctx) {
    playSoftChime(ctx);
    ringtoneInterval = setInterval(() => {
      if (!isRinging) {
        clearInterval(ringtoneInterval);
        return;
      }
      const activeCtx = getAudioContext();
      if (activeCtx) {
        playSoftChime(activeCtx);
      }
    }, 2400);
  }
}

/**
 * Stops the incoming call ringtone immediately
 */
export function stopIncomingCallRingtone(): void {
  isRinging = false;
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval);
    ringtoneInterval = null;
  }
}

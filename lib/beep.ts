/**
 * Rest-timer end signal. Browsers only allow audio that originates from a user
 * gesture, so `primeAudio()` is called from the ✓ tap that starts the timer —
 * that unlocks the AudioContext, and the beep at zero can then play freely.
 */

let ctx: AudioContext | null = null;

type AudioCtor = typeof AudioContext;

function getCtor(): AudioCtor | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext ??
    null
  );
}

export function primeAudio(): void {
  try {
    const Ctor = getCtor();
    if (!Ctor) return;
    ctx ??= new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    // no audio available — the timer still works silently
  }
}

/** Three short rising beeps, gym-machine style. */
export function playTimerDone(): void {
  try {
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();
    const t0 = ctx.currentTime + 0.02;
    [0, 0.22, 0.44].forEach((offset, i) => {
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = "square";
      osc.frequency.value = i === 2 ? 1175 : 880;
      gain.gain.setValueAtTime(0.0001, t0 + offset);
      gain.gain.exponentialRampToValueAtTime(0.35, t0 + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.18);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t0 + offset);
      osc.stop(t0 + offset + 0.2);
    });
  } catch {
    // ignore
  }
}

export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // ignore
  }
}

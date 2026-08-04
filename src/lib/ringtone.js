let ctx = null;
let intervalId = null;

const ring = () => {
  const now = ctx.currentTime;
  [880, 1108.73].forEach((freq) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.05);
    gain.gain.setValueAtTime(0.15, now + 0.4);
    gain.gain.linearRampToValueAtTime(0, now + 0.45);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  });
  const now2 = now + 0.6;
  [880, 1108.73].forEach((freq) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now2);
    gain.gain.linearRampToValueAtTime(0.15, now2 + 0.05);
    gain.gain.setValueAtTime(0.15, now2 + 0.4);
    gain.gain.linearRampToValueAtTime(0, now2 + 0.45);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now2);
    osc.stop(now2 + 0.5);
  });
};

export const startRingtone = () => {
  if (intervalId) return;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    ring();
    intervalId = setInterval(ring, 2000);
  } catch (e) {
    console.error("ringtone:", e);
  }
};

export const stopRingtone = () => {
  clearInterval(intervalId);
  intervalId = null;
  if (ctx) {
    ctx.close().catch(() => {});
    ctx = null;
  }
};

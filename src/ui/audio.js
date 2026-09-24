let ctx = null;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function beep(freq, dur = 0.12, type = "sine", gain = 0.04) {
  try {
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = gain;
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start();
    o.stop(c.currentTime + dur);
  } catch {
    /* audio optional */
  }
}

export const sfx = {
  click: () => beep(520, 0.06, "triangle", 0.03),
  hit: () => beep(180, 0.1, "square", 0.04),
  heal: () => beep(640, 0.14, "sine", 0.035),
  fx: (kind) => {
    if (kind === "heal" || kind === "hymn" || kind === "cleanse" || kind === "bless") sfx.heal();
    else if (kind === "poison") beep(210, 0.18, "triangle", 0.04);
    else if (kind === "guard" || kind === "ward" || kind === "taunt") beep(300, 0.16, "square", 0.03);
    else if (kind === "fire" || kind === "meteor") beep(140, 0.2, "sawtooth", 0.035);
    else if (kind === "frost") beep(720, 0.16, "sine", 0.03);
    else sfx.hit();
  },
  win: () => {
    beep(440, 0.12);
    setTimeout(() => beep(554, 0.12), 90);
    setTimeout(() => beep(659, 0.2), 180);
  },
  lose: () => beep(120, 0.4, "sawtooth", 0.03),
};

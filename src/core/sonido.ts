/** Fin del descanso: vibración y dos tonos suaves. Si el teléfono no los permite, no pasa nada. */
export function avisoDeFin() {
  try { navigator.vibrate?.([300, 150, 300]); } catch { /* sin vibración */ }
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new AC();
    for (const d of [0, 0.35]) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = 660; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(0.0001, ac.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + d + 0.3);
      o.start(ac.currentTime + d); o.stop(ac.currentTime + d + 0.32);
    }
    setTimeout(() => ac.close().catch(() => {}), 1200);
  } catch { /* sin sonido */ }
}

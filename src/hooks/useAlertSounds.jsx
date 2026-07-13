/**
 * useAlertSounds
 * Gera sons de alerta via Web Audio API (sem arquivos de áudio).
 * Cada classificação do checkpoint tem um padrão sonoro distinto.
 */
import { useRef, useCallback } from "react";

export function useAlertSounds() {
  const ctxRef = useRef(null);

  const ensure = () => {
    if (!ctxRef.current) {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctxRef.current = new AC();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  };

  const tone = (freq, start, dur, type = "sine", vol = 0.3) => {
    const ctx = ctxRef.current;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
    g.gain.setValueAtTime(vol, ctx.currentTime + start);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(ctx.currentTime + start);
    osc.stop(ctx.currentTime + start + dur);
  };

  const playDing = () => {
    ensure();
    tone(880, 0, 0.15, "sine", 0.3);
    tone(1320, 0.12, 0.25, "sine", 0.25);
  };

  const playIntruder = () => {
    ensure();
    [0, 0.2, 0.4].forEach((t) => tone(500, t, 0.15, "square", 0.25));
  };

  const playEvasion = () => {
    ensure();
    tone(600, 0, 0.18, "triangle", 0.3);
    tone(400, 0.18, 0.18, "triangle", 0.3);
    tone(600, 0.36, 0.18, "triangle", 0.3);
  };

  const playSiren = () => {
    ensure();
    const ctx = ctxRef.current;
    const dur = 2.4;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    for (let t = 0; t <= dur; t += 0.25) {
      osc.frequency.setValueAtTime(t % 0.5 < 0.25 ? 800 : 400, ctx.currentTime + t);
    }
    g.gain.setValueAtTime(0.35, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + dur);
  };

  const play = useCallback((cls) => {
    try {
      if (cls === "Wanted Suspect") playSiren();
      else if (cls === "Student Evasion Attempt") playEvasion();
      else if (cls === "Unauthorized Intruder") playIntruder();
      else if (cls === "Allowed Student") playDing();
    } catch { /* áudio bloqueado sem interação do usuário */ }
  }, []);

  return { play };
}
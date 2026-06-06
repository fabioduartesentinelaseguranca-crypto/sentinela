import { useEffect, useRef } from "react";

/**
 * Hook para alertas sonoros de ocorrências críticas/alta prioridade.
 * Toca um beep quando uma nova ocorrência prioritária é detectada.
 */
export function usePriorityAlerts({ occurrences = [], enabled = true, onNewCritical }) {
  const seenIds = useRef(new Set());
  const audioCtx = useRef(null);

  const playAlert = (type = "critical") => {
    try {
      if (!audioCtx.current) {
        audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtx.current;
      const freqs = type === "critical" ? [880, 660, 880, 440] : [660, 440];
      let time = ctx.currentTime;
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, time + i * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.001, time + i * 0.18 + 0.15);
        osc.start(time + i * 0.18);
        osc.stop(time + i * 0.18 + 0.15);
      });
    } catch (e) {
      // AudioContext pode falhar em alguns navegadores
    }
  };

  useEffect(() => {
    if (!enabled || occurrences.length === 0) return;

    occurrences.forEach((occ) => {
      if (seenIds.current.has(occ.id)) return;
      seenIds.current.add(occ.id);

      const isCritical =
        occ.type === "panic" ||
        occ.priority === "critical" ||
        (occ._urgencyScore ?? 0) >= 160;

      const isHigh =
        occ.priority === "high" ||
        (occ._urgencyScore ?? 0) >= 100;

      if (isCritical) {
        playAlert("critical");
        onNewCritical?.(occ);
      } else if (isHigh) {
        playAlert("high");
      }
    });
  }, [occurrences, enabled]);

  return { playAlert };
}
import { useEffect, useRef } from "react";
import { distanceKm } from "@/lib/geo";

const EMERGENCY_RADIUS_KM = 5;
const CRITICAL_TYPES = ["panic", "crime"];
const CRITICAL_PRIORITIES = ["critical", "high"];

/**
 * Dispara alerta sonoro específico quando nova ocorrência de emergência
 * aparece em até 5km da localização do agente.
 */
export function useEmergencyProximityAlert({ occurrences = [], agentLocation, enabled = true, onNearbyEmergency }) {
  const seenIds = useRef(new Set());
  const audioCtx = useRef(null);

  const playEmergencySound = () => {
    try {
      if (!audioCtx.current) {
        audioCtx.current = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = audioCtx.current;
      // Sirene de emergência: wail effect 3 vezes
      const patterns = [
        { freq: 440, time: 0 }, { freq: 880, time: 0.15 },
        { freq: 440, time: 0.35 }, { freq: 880, time: 0.5 },
        { freq: 440, time: 0.7 }, { freq: 1100, time: 0.85 },
        { freq: 440, time: 1.05 }, { freq: 1100, time: 1.2 },
      ];
      const base = ctx.currentTime;
      patterns.forEach(({ freq, time }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sawtooth";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.25, base + time);
        gain.gain.exponentialRampToValueAtTime(0.001, base + time + 0.12);
        osc.start(base + time);
        osc.stop(base + time + 0.12);
      });
    } catch (_) { /* ignore */ }
  };

  useEffect(() => {
    if (!enabled || !agentLocation || occurrences.length === 0) return;

    occurrences.forEach((occ) => {
      if (seenIds.current.has(occ.id)) return;
      seenIds.current.add(occ.id);

      const isEmergency =
        CRITICAL_TYPES.includes(occ.type) ||
        CRITICAL_PRIORITIES.includes(occ.priority) ||
        occ.type === "panic";

      if (!isEmergency) return;
      if (!occ.lat || !occ.lng) return;

      const dist = distanceKm(agentLocation, { lat: occ.lat, lng: occ.lng });
      if (dist <= EMERGENCY_RADIUS_KM) {
        playEmergencySound();
        onNearbyEmergency?.({ occ, dist });
      }
    });
  }, [occurrences, agentLocation, enabled]);
}
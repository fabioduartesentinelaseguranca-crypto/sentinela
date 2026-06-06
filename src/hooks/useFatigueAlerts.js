import { useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { differenceInHours, parseISO, format } from "date-fns";

const FATIGUE_THRESHOLD = 0.8; // 80% do limite
const MAX_FATIGUE = 10;
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 min

/**
 * Admin-side hook: verifica agentes com fadiga >= 80% e registra alertas para supervisores.
 */
export function useFatigueAlerts({ enabled = true, onAlert } = {}) {
  const alertedRef = useRef({}); // agentId -> lastAlertTs

  useEffect(() => {
    if (!enabled) return;

    const check = async () => {
      let agents, evals, shifts;
      try {
        [agents, evals, shifts] = await Promise.all([
          base44.entities.User.filter({ role: "agent" }),
          base44.entities.PsychEvaluation.list("-created_date", 200),
          base44.entities.Shift.filter({ status: "active" }),
        ]);
      } catch {
        return;
      }

      for (const agent of agents) {
        const activeShift = shifts.find((s) => s.agent_id === agent.id);
        if (!activeShift) continue;

        const latestEval = evals.find((e) => e.agent_id === agent.id);

        // Calcula score de fadiga composto (0-10)
        let fatigueScore = 0;

        // Tempo de turno
        const shiftStart = activeShift.start_time
          ? parseISO(`${activeShift.date || format(new Date(), "yyyy-MM-dd")}T${activeShift.start_time}`)
          : parseISO(activeShift.created_date);
        const hoursOnDuty = differenceInHours(new Date(), shiftStart);

        if (hoursOnDuty >= 14) fatigueScore += 4;
        else if (hoursOnDuty >= 10) fatigueScore += 3;
        else if (hoursOnDuty >= 8) fatigueScore += 2;
        else if (hoursOnDuty >= 6) fatigueScore += 1;

        // Avaliação psicológica
        if (latestEval) {
          fatigueScore = Math.max(fatigueScore, latestEval.fatigue_level || 0);
        }

        const fatiguePercent = fatigueScore / MAX_FATIGUE;

        if (fatiguePercent >= FATIGUE_THRESHOLD) {
          const now = Date.now();
          const lastAlert = alertedRef.current[agent.id] || 0;
          if (now - lastAlert < 30 * 60 * 1000) continue; // throttle 30 min
          alertedRef.current[agent.id] = now;

          const alertInfo = {
            agentId: agent.id,
            agentName: agent.full_name,
            fatiguePercent: Math.round(fatiguePercent * 100),
            fatigueScore,
            hoursOnDuty,
            latestEval,
          };

          onAlert?.(alertInfo);

          // Registra log de alerta de fadiga
          await base44.entities.SystemLog.create({
            event: "fatigue_alert_80",
            actor_id: agent.id,
            actor_name: agent.full_name,
            details: `ALERTA FADIGA: ${agent.full_name} atingiu ${Math.round(fatiguePercent * 100)}% do limite (${hoursOnDuty}h em turno, score=${fatigueScore}/10)`,
            severity: "warning",
          }).catch(() => {});
        }
      }
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [enabled]);
}
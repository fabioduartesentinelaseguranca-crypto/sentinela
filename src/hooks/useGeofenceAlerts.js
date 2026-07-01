import { useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { distanceKm } from "@/lib/geo";

const LIMIT_KM = 0.5;
const CHECK_INTERVAL_MS = 30_000;

/**
 * Admin-side hook: monitors ALL agents against their patrol zones.
 * Fires onAlert(info) for any breach.
 */
export function useGeofenceAlerts({ enabled = true, onAlert }) {
  const alertedRef = useRef({}); // agentId -> lastAlertTs

  useEffect(() => {
    if (!enabled) return;

    const check = async () => {
      let zones, agents;
      try {
        [zones, agents] = await Promise.all([
          base44.entities.PatrolZone.list("-created_date", 200),
          base44.entities.User.filter({ role: "agent" }),
        ]);
      } catch {
        return; // rede indisponível — tenta novamente no próximo ciclo
      }

      for (const zone of zones) {
        if (!zone.assigned_agent_id) continue;
        const agent = agents.find((a) => a.id === zone.assigned_agent_id);
        if (!agent?.last_location) continue;

        const loc = agent.last_location;
        const dist = distanceKm({ lat: loc.lat, lng: loc.lng }, { lat: zone.lat, lng: zone.lng });

        if (dist > LIMIT_KM) {
          const now = Date.now();
          const lastAlert = alertedRef.current[agent.id] || 0;
          if (now - lastAlert < 5 * 60 * 1000) continue; // throttle 5 min
          alertedRef.current[agent.id] = now;

          const info = {
            agentId: agent.id,
            agentName: agent.full_name,
            zone: zone.name,
            distanceM: Math.round(dist * 1000),
            lat: loc.lat,
            lng: loc.lng,
          };

          onAlert?.(info);

          try {
            await base44.entities.SystemLog.create({
              event: "geofence_breach",
              actor_id: agent.id,
              actor_name: agent.full_name,
              details: `Agente "${agent.full_name}" a ${info.distanceM}m da zona "${zone.name}" (limite 500m)`,
              severity: "warning",
            });
          } catch { /* log falhou — não interrompe o ciclo de monitoramento */ }
        }
      }
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [enabled]);
}
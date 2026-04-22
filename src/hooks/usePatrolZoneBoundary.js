import { useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { distanceKm } from "@/lib/geo";
import { toast } from "sonner";
import { sendBrowserNotification } from "@/lib/agentNotifications";

const LIMIT_KM = 0.5; // 500 meters
const CHECK_INTERVAL_MS = 30_000; // every 30s

/**
 * Monitors agent's location against their assigned PatrolZone.
 * Fires an alert and logs a SystemLog if they stray > 500m.
 */
export function usePatrolZoneBoundary({ userId, userName, currentLocation, onBoundaryAlert }) {
  const lastAlertRef = useRef(0);

  useEffect(() => {
    if (!userId || !currentLocation) return;

    const check = async () => {
      const zones = await base44.entities.PatrolZone.filter({ assigned_agent_id: userId }, "-created_date", 1);
      const zone = zones[0];
      if (!zone) return;

      const dist = distanceKm(
        { lat: currentLocation.lat, lng: currentLocation.lng },
        { lat: zone.lat, lng: zone.lng }
      );

      if (dist > LIMIT_KM) {
        const now = Date.now();
        // Throttle: only alert once per 5 minutes
        if (now - lastAlertRef.current < 5 * 60 * 1000) return;
        lastAlertRef.current = now;

        const msg = `⚠ Você está ${(dist * 1000).toFixed(0)}m fora da zona "${zone.name}"`;

        toast.warning(msg, { duration: 8000 });
        sendBrowserNotification("Alerta de Zona de Patrulha", msg, { tag: "zone-boundary", requireInteraction: true });

        await base44.entities.SystemLog.create({
          event: "patrol_zone_breach",
          actor_id: userId,
          actor_name: userName,
          details: `Agente a ${(dist * 1000).toFixed(0)}m da zona "${zone.name}" (limite: 500m)`,
          severity: "warning",
        });

        onBoundaryAlert?.({ zone, distanceM: dist * 1000 });
      }
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [userId, userName, currentLocation?.lat, currentLocation?.lng]);
}
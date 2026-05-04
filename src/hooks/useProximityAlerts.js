import { useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";

const EARTH_RADIUS_KM = 6371;

function distanceKm(lat1, lng1, lat2, lng2) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * useProximityAlerts
 * Subscribes to new occurrences and notifies agents within `radiusKm` (default 3km).
 * - Fires browser push notification
 * - Calls onNearbyAlert(occurrence, distanceKm, routeUrl) for in-app UI
 */
export function useProximityAlerts({
  enabled = true,
  agentLocation,
  agentId,
  radiusKm = 3,
  onNearbyAlert,
}) {
  const notifiedIds = useRef(new Set());

  const handleOccurrence = useCallback(
    (occ) => {
      if (!agentLocation?.lat || !agentLocation?.lng) return;
      if (!occ.lat || !occ.lng) return;
      if (notifiedIds.current.has(occ.id)) return;

      const dist = distanceKm(agentLocation.lat, agentLocation.lng, occ.lat, occ.lng);
      if (dist > radiusKm) return;

      const isPriority = occ.type === "panic" || occ.priority === "critical" || occ.type === "crime";
      if (!isPriority) return;

      notifiedIds.current.add(occ.id);

      // Google Maps route URL
      const routeUrl = `https://www.google.com/maps/dir/${agentLocation.lat},${agentLocation.lng}/${occ.lat},${occ.lng}`;

      // Browser notification
      if (Notification.permission === "granted") {
        const n = new Notification(`🚨 Ocorrência a ${dist.toFixed(1)}km — ${occ.type === "panic" ? "PÂNICO" : "Alta prioridade"}`, {
          body: `${occ.subtype || occ.type} · ${occ.address || ""}`,
          icon: "/favicon.ico",
          requireInteraction: true,
          tag: `proximity-${occ.id}`,
        });
        n.onclick = () => {
          window.open(routeUrl, "_blank");
          onNearbyAlert?.(occ, dist, routeUrl);
          n.close();
        };
      }

      onNearbyAlert?.(occ, dist, routeUrl);
    },
    [agentLocation, radiusKm, onNearbyAlert]
  );

  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = base44.entities.Occurrence.subscribe((event) => {
      if (event.type !== "create") return;
      const occ = event.data;
      if (!occ || occ.status !== "open") return;
      handleOccurrence(occ);
    });

    return unsubscribe;
  }, [enabled, handleOccurrence]);
}
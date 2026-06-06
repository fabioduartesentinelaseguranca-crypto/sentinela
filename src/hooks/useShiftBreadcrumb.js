import { useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { nowISO } from "@/lib/deviceTime";

const INTERVAL_MS = 30_000; // a cada 30s
const MAX_POINTS = 500;

/**
 * Tracks GPS position every INTERVAL_MS and appends to ShiftBreadcrumb.
 * Creates the breadcrumb record on first position if it doesn't exist yet.
 */
export function useShiftBreadcrumb({ shiftId, agentId, agentName, enabled = true }) {
  const recordId = useRef(null);

  useEffect(() => {
    if (!enabled || !shiftId || !agentId) return;

    const append = async (lat, lng) => {
      const point = { lat, lng, ts: nowISO() };

      if (!recordId.current) {
        // Find or create breadcrumb for this shift
        const existing = await base44.entities.ShiftBreadcrumb.filter({ shift_id: shiftId });
        if (existing.length > 0) {
          recordId.current = existing[0].id;
          const pts = [...(existing[0].points || []), point].slice(-MAX_POINTS);
          await base44.entities.ShiftBreadcrumb.update(recordId.current, { points: pts });
        } else {
          const created = await base44.entities.ShiftBreadcrumb.create({
            shift_id: shiftId,
            agent_id: agentId,
            agent_name: agentName,
            points: [point],
          });
          recordId.current = created.id;
        }
      } else {
        const existing = await base44.entities.ShiftBreadcrumb.filter({ shift_id: shiftId });
        if (existing.length > 0) {
          const pts = [...(existing[0].points || []), point].slice(-MAX_POINTS);
          await base44.entities.ShiftBreadcrumb.update(recordId.current, { points: pts });
        }
      }
    };

    const tick = () => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        (pos) => append(pos.coords.latitude, pos.coords.longitude).catch(() => {}),
        () => {}
      );
    };

    tick();
    const interval = setInterval(tick, INTERVAL_MS);
    return () => clearInterval(interval);
  }, [shiftId, agentId, agentName, enabled]);
}
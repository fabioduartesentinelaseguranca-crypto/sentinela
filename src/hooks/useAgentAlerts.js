import { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { notifyNewCriticalOccurrence, requestNotificationPermission, isNotificationGranted } from "@/lib/agentNotifications";

/**
 * Hook that subscribes to new occurrences and fires browser notifications
 * for panic or critical priority events.
 */
export function useAgentAlerts(enabled = true) {
  const [permissionGranted, setPermissionGranted] = useState(isNotificationGranted());
  const seenIds = useRef(new Set());

  const askPermission = async () => {
    const granted = await requestNotificationPermission();
    setPermissionGranted(granted);
    return granted;
  };

  useEffect(() => {
    if (!enabled) return;

    const unsub = base44.entities.Occurrence.subscribe((event) => {
      if (event.type !== "create") return;
      const occ = event.data;
      if (!occ || seenIds.current.has(occ.id)) return;
      seenIds.current.add(occ.id);

      const isCritical = occ.priority === "critical" || occ.type === "panic";
      if (!isCritical) return;

      if (isNotificationGranted()) {
        notifyNewCriticalOccurrence(occ);
      }
    });

    return () => unsub?.();
  }, [enabled]);

  return { permissionGranted, askPermission };
}
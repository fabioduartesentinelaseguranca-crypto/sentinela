import { useEffect, useRef, useCallback, useState } from "react";
import { base44 } from "@/api/base44Client";

/**
 * usePushNotifications
 * Subscribes to Occurrence real-time updates and fires browser push notifications
 * for high-priority / panic occurrences — works even when app is in background.
 * Calls onCritical(occurrence) so the UI can react.
 */
export function usePushNotifications({ enabled = true, agentId, onCritical }) {
  const notifiedIds = useRef(new Set());
  const [permissionState, setPermissionState] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );

  // Request permission on mount
  useEffect(() => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "default") {
      Notification.requestPermission().then((p) => setPermissionState(p));
    }
  }, []);

  const notify = useCallback((occ) => {
    if (notifiedIds.current.has(occ.id)) return;
    notifiedIds.current.add(occ.id);

    const isPanic = occ.type === "panic";
    const title = isPanic ? "🚨 PÂNICO ATIVO!" : "⚠️ Ocorrência de Alta Prioridade";
    const body = occ.subtype
      ? `${occ.subtype}${occ.address ? " · " + occ.address : ""}`
      : occ.address || "Nova ocorrência crítica requer atenção imediata";

    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        const n = new Notification(title, {
          body,
          icon: "/favicon.ico",
          badge: "/favicon.ico",
          tag: `occ-${occ.id}`,
          requireInteraction: true,
          silent: false,
          vibrate: isPanic ? [200, 100, 200, 100, 200] : [200, 100, 200],
        });
        n.onclick = () => {
          window.focus();
          onCritical?.(occ);
          n.close();
        };
      } catch {
        // Fallback for browsers that don't support all options
        const n = new Notification(title, { body, icon: "/favicon.ico", tag: `occ-${occ.id}` });
        n.onclick = () => { window.focus(); onCritical?.(occ); n.close(); };
      }
    }

    onCritical?.(occ);
  }, [onCritical]);

  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = base44.entities.Occurrence.subscribe((event) => {
      if (event.type !== "create" && event.type !== "update") return;
      const occ = event.data;
      if (!occ) return;
      const isCritical = occ.type === "panic" || occ.priority === "critical";
      const isOpen = occ.status === "open";
      const unassigned = !occ.assigned_agent_id;
      if (isCritical && isOpen && unassigned) notify(occ);
    });

    return unsubscribe;
  }, [enabled, notify]);

  return { permissionState };
}
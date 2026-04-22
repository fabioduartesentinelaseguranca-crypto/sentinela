import { useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";

/**
 * usePushNotifications
 * Subscribes to Occurrence real-time updates and fires browser push notifications
 * for high-priority / panic occurrences. Calls onCritical(occurrence) so the UI
 * can react (accept button, route drawing, etc.).
 */
export function usePushNotifications({ enabled = true, agentId, onCritical }) {
  const notifiedIds = useRef(new Set());

  const notify = useCallback((occ) => {
    if (notifiedIds.current.has(occ.id)) return;
    notifiedIds.current.add(occ.id);

    const title = occ.type === "panic" ? "🚨 PÂNICO ATIVO!" : "⚠️ Ocorrência Crítica";
    const body = occ.subtype
      ? `${occ.subtype}${occ.address ? " · " + occ.address : ""}`
      : occ.address || "Nova ocorrência de alta prioridade";

    if (Notification.permission === "granted") {
      const n = new Notification(title, {
        body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: occ.id,
        requireInteraction: true,
      });
      n.onclick = () => { window.focus(); onCritical?.(occ); n.close(); };
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
}
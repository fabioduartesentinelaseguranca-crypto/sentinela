/**
 * Browser Notification API wrapper for agent alerts.
 * Uses the native Web Notification API — no external service required.
 */

export async function requestNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function isNotificationGranted() {
  return "Notification" in window && Notification.permission === "granted";
}

export function sendBrowserNotification(title, body, options = {}) {
  if (!isNotificationGranted()) return;
  const n = new Notification(title, {
    body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: options.tag || "sentinela-alert",
    requireInteraction: options.requireInteraction ?? true,
    ...options,
  });
  n.onclick = () => {
    window.focus();
    n.close();
    if (options.onClick) options.onClick();
  };
  return n;
}

export function notifyNewCriticalOccurrence(occurrence) {
  const typeLabels = {
    panic: "🚨 PÂNICO",
    crime: "🔴 Crime",
    health: "🏥 Saúde",
    civil_defense: "🌊 Defesa Civil",
    traffic: "🚗 Trânsito",
  };
  const title = `${typeLabels[occurrence.type] || "⚠️ Ocorrência"} — ${occurrence.subtype || "Nova ocorrência"}`;
  const body = [
    occurrence.address ? `📍 ${occurrence.address}` : null,
    occurrence.description ? occurrence.description.slice(0, 80) : null,
    `Prioridade: ${occurrence.priority?.toUpperCase()}`,
  ].filter(Boolean).join("\n");

  sendBrowserNotification(title, body, {
    tag: `occ-${occurrence.id}`,
    requireInteraction: true,
  });
}
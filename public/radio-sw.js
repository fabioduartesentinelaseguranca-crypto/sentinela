/**
 * Sentinela Radio Service Worker
 * Recebe mensagens do app principal e exibe notificações push locais
 * quando o app está em background ou fechado.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Mensagem enviada pelo app principal via postMessage
self.addEventListener("message", (event) => {
  const { type, payload } = event.data || {};

  if (type === "RADIO_CALLING") {
    const { senderName } = payload || {};
    self.registration.showNotification("📻 Rádio Tático", {
      body: `${senderName || "Agente"} está transmitindo no canal de voz. Toque para ouvir.`,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: "radio-call",
      renotify: true,
      requireInteraction: true,
      silent: false,
      vibrate: [100, 50, 100, 50, 200],
      data: { url: "/agent" },
      actions: [
        { action: "open", title: "🔊 Abrir Rádio" },
        { action: "dismiss", title: "Ignorar" },
      ],
    });
  }
});

// Ao clicar na notificação, foca ou abre o app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const targetUrl = (event.notification.data && event.notification.data.url) || "/agent";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(targetUrl) || c.url.includes("/agent"));
      if (existing) {
        existing.focus();
        existing.postMessage({ type: "RADIO_FOCUS" });
      } else {
        self.clients.openWindow(targetUrl);
      }
    })
  );
});

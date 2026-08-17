/**
 * useOfflineOccurrences
 * Saves occurrence drafts to localStorage when offline,
 * and auto-syncs them when the connection is restored.
 */
import { useEffect, useRef, useCallback, useState } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { brasiliaNowISO } from "@/lib/deviceTime";

const STORAGE_KEY = "sentinela_offline_occurrences";

function loadPending() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function savePending(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function useOfflineOccurrences() {
  const [pendingCount, setPendingCount] = useState(() => loadPending().length);
  const [syncing, setSyncing] = useState(false);
  const syncingRef = useRef(false);

  const syncPending = useCallback(async () => {
    if (syncingRef.current) return;
    const pending = loadPending();
    if (pending.length === 0) return;

    syncingRef.current = true;
    setSyncing(true);

    const failed = [];
    for (const item of pending) {
      try {
        await base44.entities.Occurrence.create(item);
      } catch {
        failed.push(item);
      }
    }

    savePending(failed);
    setPendingCount(failed.length);
    const synced = pending.length - failed.length;
    if (synced > 0) {
      toast.success(`${synced} ocorrência(s) offline sincronizada(s) com sucesso!`);
    }
    syncingRef.current = false;
    setSyncing(false);
  }, []);

  // Queue an occurrence for later (offline)
  const queueOffline = useCallback((occData) => {
    const pending = loadPending();
    pending.push({ ...occData, _queued_at: new Date().toISOString() });
    savePending(pending);
    setPendingCount(pending.length);
    toast.warning("Sem conexão — ocorrência salva offline. Será enviada automaticamente.");
  }, []);

  // Submit: try online first, fallback to offline queue.
  // Captura o horário do dispositivo (Brasília) no momento do envio — preservado
  // mesmo quando a ocorrência fica offline e é sincronizada depois.
  const submitOccurrence = useCallback(async (occData) => {
    const data = { ...occData };
    if (!data.data_hora_dispositivo) data.data_hora_dispositivo = brasiliaNowISO();
    if (!navigator.onLine) {
      queueOffline(data);
      return { offline: true };
    }
    try {
      const result = await base44.entities.Occurrence.create(data);
      return { offline: false, result };
    } catch (err) {
      // Network error — queue offline
      queueOffline(data);
      return { offline: true };
    }
  }, [queueOffline]);

  // Listen for connection restore
  useEffect(() => {
    const handleOnline = () => {
      toast.info("Conexão restaurada — sincronizando ocorrências offline...");
      syncPending();
    };
    window.addEventListener("online", handleOnline);
    // Also try on mount in case we reconnected while app was closed
    if (navigator.onLine) syncPending();
    return () => window.removeEventListener("online", handleOnline);
  }, [syncPending]);

  return { pendingCount, syncing, submitOccurrence, syncPending };
}
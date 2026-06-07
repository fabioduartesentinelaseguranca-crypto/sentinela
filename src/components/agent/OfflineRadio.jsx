import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Radio, MapPin, AlertOctagon, Wifi, WifiOff, Send, RefreshCw, Mic, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import TacticalRadioPTT from "@/components/agent/TacticalRadioPTT";

const CHANNEL = "patrol-radio-1";

// LocalStorage key for offline queue
const LS_KEY = "sentinela_offline_queue";

function getQueue() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}
function saveQueue(q) { localStorage.setItem(LS_KEY, JSON.stringify(q)); }

export default function OfflineRadio({ agentId, agentName }) {
  const [radioTab, setRadioTab] = useState("text"); // "text" | "voice"
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [queueCount, setQueueCount] = useState(getQueue().length);
  const bottomRef = useRef(null);

  // Online/offline detection
  useEffect(() => {
    const on = () => { setIsOnline(true); syncQueue(); };
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // Load online messages
  const load = async () => {
    if (!isOnline) return;
    const data = await base44.entities.OfflineMessage.filter({ channel: CHANNEL }, "-created_date", 50);
    setMessages(data.reverse());
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  useEffect(() => { load(); }, [isOnline]);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsub = base44.entities.OfflineMessage.subscribe((event) => {
      if (event.data?.channel !== CHANNEL) return;
      if (event.type === "create") {
        setMessages((prev) => [...prev, event.data]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    });
    return unsub;
  }, []);

  const syncQueue = async () => {
    const queue = getQueue();
    if (queue.length === 0) return;
    setSyncing(true);
    for (const msg of queue) {
      await base44.entities.OfflineMessage.create({ ...msg, synced: true });
    }
    saveQueue([]);
    setQueueCount(0);
    setSyncing(false);
    toast.success(`${queue.length} mensagem(ns) offline sincronizada(s)`);
    load();
  };

  const send = async (isEmergency = false) => {
    if (!input.trim()) return;
    const msg = {
      sender_id: agentId,
      sender_name: agentName,
      channel: CHANNEL,
      content: input.trim(),
      is_emergency: isEmergency,
    };

    // Get coords if emergency
    if (isEmergency) {
      try {
        const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 }));
        msg.lat = pos.coords.latitude;
        msg.lng = pos.coords.longitude;
      } catch {}
    }

    if (isOnline) {
      await base44.entities.OfflineMessage.create({ ...msg, synced: true });
      // real-time subscription handles UI update
    } else {
      // Queue for later sync
      const queue = getQueue();
      const localMsg = { ...msg, id: `local_${Date.now()}`, created_date: new Date().toISOString(), synced: false };
      queue.push(localMsg);
      saveQueue(queue);
      setQueueCount(queue.length);
      setMessages((prev) => [...prev, localMsg]);
      toast.warning("Sem internet — mensagem salva para sincronização.");
    }

    setInput("");
  };

  const handleKeyDown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };

  return (
    <div className="rounded-2xl border border-border/60 bg-card flex flex-col h-[420px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Rádio Tático</span>
          {/* Tab switcher */}
          <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5 ml-1">
            <button
              onClick={() => setRadioTab("text")}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${radioTab === "text" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <MessageSquare className="w-3 h-3" /> Texto
            </button>
            <button
              onClick={() => setRadioTab("voice")}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${radioTab === "voice" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Mic className="w-3 h-3" /> Voz
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {queueCount > 0 && (
            <button onClick={syncQueue} disabled={!isOnline || syncing} className="flex items-center gap-1 text-[11px] text-warning">
              <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
              {queueCount} pendente{queueCount > 1 ? "s" : ""}
            </button>
          )}
          <div className={`flex items-center gap-1 text-[11px] font-medium ${isOnline ? "text-success" : "text-destructive"}`}>
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {isOnline ? "Online" : "Offline"}
          </div>
        </div>
      </div>

      {/* Voice tab */}
      {radioTab === "voice" && (
        <div className="flex-1 overflow-y-auto">
          <TacticalRadioPTT agentId={agentId} agentName={agentName} />
        </div>
      )}

      {/* Text tab — Messages */}
      {radioTab === "text" && <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 scrollbar-thin">
        {messages.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8">Nenhuma mensagem no canal. Seja o primeiro a transmitir.</div>
        )}
        {messages.map((m) => {
          const isMine = m.sender_id === agentId;
          return (
            <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm space-y-1 ${
                m.is_emergency
                  ? "bg-destructive/20 border border-destructive/40"
                  : isMine
                  ? "bg-primary/15 border border-primary/20"
                  : "bg-muted/60 border border-border/40"
              }`}>
                {!isMine && (
                  <div className="text-[10px] font-semibold text-primary">{m.sender_name}</div>
                )}
                {m.is_emergency && (
                  <div className="flex items-center gap-1 text-[10px] text-destructive font-bold uppercase">
                    <AlertOctagon className="w-3 h-3" /> EMERGÊNCIA
                  </div>
                )}
                <div className={m.is_emergency ? "text-destructive font-medium" : ""}>{m.content}</div>
                {m.lat && m.lng && (
                  <a
                    href={`https://www.google.com/maps?q=${m.lat},${m.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[10px] text-primary underline"
                  >
                    <MapPin className="w-3 h-3" /> Ver localização
                  </a>
                )}
                <div className="text-[10px] text-muted-foreground text-right">
                  {format(new Date(m.created_date), "HH:mm")}
                  {!m.synced && " · ⏳"}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>}

      {/* Input — only for text tab */}
      {radioTab === "text" && <div className="px-4 py-3 border-t border-border/60 flex gap-2">
        <Input
          placeholder="Mensagem tática..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 text-sm"
        />
        <Button
          size="icon"
          variant="destructive"
          onClick={() => send(true)}
          title="Transmitir SOS com coordenadas"
        >
          <AlertOctagon className="w-4 h-4" />
        </Button>
        <Button size="icon" onClick={() => send(false)} disabled={!input.trim()}>
          <Send className="w-4 h-4" />
        </Button>
      </div>}
    </div>
  );
}
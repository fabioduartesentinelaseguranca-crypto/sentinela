/**
 * TacticalRadioPTT — Rádio walkie-talkie com WebRTC Push-to-Talk
 * Pressione e segure o botão PTT para transmitir áudio ao vivo.
 * A transmissão é enviada para todos os agentes no mesmo canal via WebRTC.
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { useTacticalRadio } from "@/hooks/useTacticalRadio";
import { Radio, Mic, MicOff, Volume2, VolumeX, Signal, SignalZero, AlertCircle, Waves, BellOff, Bell, Headphones, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";

export default function TacticalRadioPTT({ agentId, agentName }) {
  const {
    isTransmitting,
    isReceiving,
    connectedPeers,
    listeners,
    error,
    volume,
    setVolume,
    startTransmitting,
    stopTransmitting,
  } = useTacticalRadio({ agentId, agentName });

  const listenerList = Object.entries(listeners || {});

  const [pttActive, setPttActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [notifPerm, setNotifPerm] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );
  const pttRef = useRef(null);
  const longPressTimer = useRef(null);

  const requestNotifPerm = async () => {
    if (typeof Notification === "undefined") return;
    const result = await Notification.requestPermission();
    setNotifPerm(result);
  };

  // --- PTT via mouse/touch ---
  const handlePTTStart = useCallback(async (e) => {
    e.preventDefault();
    if (pttActive) return;
    setPttActive(true);
    await startTransmitting();
  }, [pttActive, startTransmitting]);

  const handlePTTEnd = useCallback(async (e) => {
    e.preventDefault();
    if (!pttActive) return;
    setPttActive(false);
    await stopTransmitting();
  }, [pttActive, stopTransmitting]);

  // --- Spacebar PTT ---
  useEffect(() => {
    const onKeyDown = async (e) => {
      if (e.code === "Space" && !e.repeat && !pttActive) {
        // Only activate if not typing in an input
        if (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA") return;
        setPttActive(true);
        await startTransmitting();
      }
    };
    const onKeyUp = async (e) => {
      if (e.code === "Space" && pttActive) {
        setPttActive(false);
        await stopTransmitting();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [pttActive, startTransmitting, stopTransmitting]);

  // Mute: set volume to 0
  const toggleMute = () => {
    setMuted((m) => {
      setVolume(m ? 1 : 0);
      return !m;
    });
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-muted/30">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Rádio Tático — Voz</span>
          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">CH-VOZ</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Peer count */}
          <div className={cn("flex items-center gap-1 text-[11px]", connectedPeers > 0 ? "text-success" : "text-muted-foreground")}>
            {connectedPeers > 0 ? <Signal className="w-3.5 h-3.5" /> : <SignalZero className="w-3.5 h-3.5" />}
            {connectedPeers} peer{connectedPeers !== 1 ? "s" : ""}
          </div>
          {/* Mute toggle */}
          <button
            onClick={toggleMute}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title={muted ? "Ativar som" : "Silenciar recepção"}
          >
            {muted ? <VolumeX className="w-4 h-4 text-destructive" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="px-4 py-2 flex items-center gap-2 text-xs min-h-[36px]">
        {error && (
          <div className="flex items-center gap-1.5 text-destructive">
            <AlertCircle className="w-3.5 h-3.5" />
            {error}
          </div>
        )}
        {isReceiving && !isTransmitting && (
          <div className="flex items-center gap-1.5 text-success animate-pulse">
            <Waves className="w-3.5 h-3.5" />
            Recebendo transmissão...
          </div>
        )}
        {isTransmitting && (
          <div className="flex items-center gap-1.5 text-warning animate-pulse">
            <Mic className="w-3.5 h-3.5" />
            Transmitindo ao vivo...
          </div>
        )}
        {!isTransmitting && !isReceiving && !error && (
          <div className="text-muted-foreground">Canal livre · Pressione PTT para falar</div>
        )}
      </div>

      {/* PTT Button */}
      <div className="px-4 py-5 flex flex-col items-center gap-4">
        <button
          ref={pttRef}
          onMouseDown={handlePTTStart}
          onMouseUp={handlePTTEnd}
          onMouseLeave={pttActive ? handlePTTEnd : undefined}
          onTouchStart={handlePTTStart}
          onTouchEnd={handlePTTEnd}
          className={cn(
            "relative w-28 h-28 rounded-full flex flex-col items-center justify-center gap-2 select-none transition-all duration-100 font-bold text-sm shadow-lg border-4",
            pttActive
              ? "bg-warning border-warning/80 text-warning-foreground scale-95 shadow-warning/40 shadow-xl"
              : "bg-primary/10 border-primary/40 text-primary hover:bg-primary/20 hover:scale-105"
          )}
          aria-label="Push to Talk"
        >
          {/* Pulse ring when transmitting */}
          {pttActive && (
            <span className="absolute inset-0 rounded-full animate-ping bg-warning/30 pointer-events-none" />
          )}
          {pttActive ? (
            <Mic className="w-8 h-8" />
          ) : (
            <MicOff className="w-7 h-7 opacity-70" />
          )}
          <span className="text-[11px] font-mono tracking-widest uppercase">
            {pttActive ? "TX" : "PTT"}
          </span>
        </button>

        <p className="text-[11px] text-muted-foreground text-center">
          Segure o botão ou pressione <kbd className="bg-muted border border-border rounded px-1 py-0.5 font-mono text-[10px]">Espaço</kbd> para falar
        </p>
      </div>

      {/* Listeners panel — shown while transmitting or for 4s after */}
      {(isTransmitting || listenerList.length > 0) && (
        <div className="mx-4 mb-4 rounded-xl border border-border/50 bg-muted/30 overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/40 bg-muted/20">
            <Headphones className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium text-foreground">Ouvindo agora</span>
            <span className="ml-auto text-[10px] text-muted-foreground">{listenerList.length} agente{listenerList.length !== 1 ? "s" : ""}</span>
          </div>
          {listenerList.length === 0 ? (
            <div className="px-3 py-2.5 text-[11px] text-muted-foreground italic">
              Aguardando confirmação dos agentes...
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {listenerList.map(([id, info]) => (
                <div key={id} className="flex items-center gap-2 px-3 py-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-success shrink-0" />
                  <span className="text-xs text-foreground flex-1">{info.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {info.receivedAt
                      ? new Date(info.receivedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                      : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Volume slider */}
      <div className="px-4 pb-4 flex items-center gap-3">
        <Volume2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <Slider
          min={0}
          max={1}
          step={0.05}
          value={[muted ? 0 : volume]}
          onValueChange={([v]) => { setVolume(v); setMuted(v === 0); }}
          className="flex-1"
        />
        <span className="text-[11px] text-muted-foreground w-8 text-right">{Math.round((muted ? 0 : volume) * 100)}%</span>
      </div>

      {/* Notification permission banner */}
      {notifPerm !== "granted" && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
          <BellOff className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1">Ative notificações para receber chamadas com app em segundo plano.</span>
          {notifPerm !== "denied" && (
            <button
              onClick={requestNotifPerm}
              className="ml-1 underline font-medium hover:text-warning/80 transition-colors shrink-0"
            >
              Ativar
            </button>
          )}
        </div>
      )}
      {notifPerm === "granted" && (
        <div className="mx-4 mb-3 flex items-center gap-1.5 text-[10px] text-success/70">
          <Bell className="w-3 h-3" />
          Notificações ativas — você será alertado mesmo com app em segundo plano
        </div>
      )}

      {/* Info footer */}
      <div className="px-4 pb-3 text-[10px] text-muted-foreground/60 text-center">
        Áudio P2P via WebRTC · Service Worker ativo para alertas em background
      </div>
    </div>
  );
}
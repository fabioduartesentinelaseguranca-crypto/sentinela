import { useEffect, useState, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Video, VideoOff, Camera, MapPin, ChevronLeft, ChevronRight, X, Radio, Maximize2, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";

const R = 6371000;
function distanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const TYPE_LABEL = { fixed: "Fixa", dome: "Dome", ptz: "PTZ" };

export default function VirtualPatrolMode({ agentLocation, targetOccurrence, onClose }) {
  const [cameras, setCameras] = useState([]);
  const [nearby, setNearby] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [autoSwitch, setAutoSwitch] = useState(true);
  const intervalRef = useRef(null);
  const RADIUS = 400; // meters
  const AUTO_SWITCH_MS = 8000;

  useEffect(() => {
    base44.entities.Camera.list("-created_date", 500).then(setCameras);
  }, []);

  // Recompute nearby cams when agent moves
  useEffect(() => {
    if (!agentLocation?.lat || !agentLocation?.lng || cameras.length === 0) return;
    const sorted = cameras
      .filter((c) => c.active && c.lat && c.lng)
      .map((c) => ({ ...c, distAgent: Math.round(distanceMeters(agentLocation.lat, agentLocation.lng, c.lat, c.lng)) }))
      .filter((c) => {
        // Also include cams near target occurrence
        if (targetOccurrence?.lat && targetOccurrence?.lng) {
          const distTarget = distanceMeters(targetOccurrence.lat, targetOccurrence.lng, c.lat, c.lng);
          return c.distAgent <= RADIUS || distTarget <= RADIUS;
        }
        return c.distAgent <= RADIUS;
      })
      .sort((a, b) => a.distAgent - b.distAgent);
    setNearby(sorted);
    setActiveIdx(0);
    setLoadError(false);
  }, [agentLocation, cameras, targetOccurrence]);

  // Auto-switch cameras
  useEffect(() => {
    if (!autoSwitch || nearby.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setActiveIdx((i) => (i + 1) % nearby.length);
      setLoadError(false);
    }, AUTO_SWITCH_MS);
    return () => clearInterval(intervalRef.current);
  }, [autoSwitch, nearby.length]);

  const prev = () => { setActiveIdx((i) => (i - 1 + nearby.length) % nearby.length); setLoadError(false); };
  const next = () => { setActiveIdx((i) => (i + 1) % nearby.length); setLoadError(false); };

  const active = nearby[activeIdx];

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-card/90 border-b border-border/60 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm font-semibold text-success">PATRULHA VIRTUAL ATIVA</span>
          </div>
          {targetOccurrence && (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground border-l border-border/40 pl-3">
              <Navigation className="w-3.5 h-3.5 text-warning" />
              Deslocamento: {targetOccurrence.address || "Ocorrência ativa"}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{nearby.length} câmera{nearby.length !== 1 ? "s" : ""} na rota</span>
          <button
            onClick={() => setAutoSwitch((v) => !v)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-all ${autoSwitch ? "border-primary/40 bg-primary/10 text-primary" : "border-border/40 text-muted-foreground"}`}
          >
            {autoSwitch ? "Auto ON" : "Auto OFF"}
          </button>
          <Button size="icon" variant="ghost" onClick={onClose} className="h-8 w-8">
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Main stream */}
      <div className="flex-1 flex flex-col items-center justify-center relative">
        {nearby.length === 0 ? (
          <div className="text-center space-y-3">
            <Camera className="w-16 h-16 text-muted-foreground/30 mx-auto" />
            <p className="text-muted-foreground">Nenhuma câmera ativa em um raio de {RADIUS}m</p>
            <p className="text-xs text-muted-foreground/60">As câmeras aparecerão automaticamente conforme você se aproxima</p>
          </div>
        ) : (
          <>
            {/* Camera stream */}
            <div className="w-full max-w-5xl px-4">
              <div className="relative bg-black rounded-xl overflow-hidden border border-border/40" style={{ aspectRatio: "16/9" }}>
                {/* Live badge */}
                <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs text-white font-medium">AO VIVO</span>
                </div>

                {/* Distance badge */}
                {active && (
                  <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-full">
                    <MapPin className="w-3 h-3 text-primary" />
                    <span className="text-xs text-white">{active.distAgent}m</span>
                  </div>
                )}

                {/* Nav arrows */}
                {nearby.length > 1 && (
                  <>
                    <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-all">
                      <ChevronLeft className="w-5 h-5 text-white" />
                    </button>
                    <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-all">
                      <ChevronRight className="w-5 h-5 text-white" />
                    </button>
                  </>
                )}

                {/* Stream content */}
                {active?.stream_url && !loadError ? (
                  <iframe
                    key={active.id}
                    src={active.stream_url}
                    className="w-full h-full border-0"
                    allow="camera; microphone; fullscreen; autoplay"
                    title={`Stream: ${active.name}`}
                    onError={() => setLoadError(true)}
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-900">
                    <VideoOff className="w-12 h-12 text-zinc-600" />
                    <p className="text-sm text-zinc-400">{loadError ? "Falha ao carregar stream" : "Câmera sem stream configurado"}</p>
                    {active?.stream_url && loadError && (
                      <Button size="sm" variant="outline" onClick={() => setLoadError(false)}>Tentar novamente</Button>
                    )}
                  </div>
                )}
              </div>

              {/* Active camera info */}
              {active && (
                <div className="flex items-center justify-between mt-3 px-1">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm text-white">{active.name}</span>
                    <span className="text-xs text-zinc-400">· {TYPE_LABEL[active.type] || active.type}</span>
                    {active.address && <span className="text-xs text-zinc-500 hidden md:inline">· {active.address}</span>}
                  </div>
                  {active.stream_url && (
                    <a href={active.stream_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1">
                      <Maximize2 className="w-3 h-3" /> Expandir
                    </a>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {nearby.length > 1 && (
        <div className="px-4 py-3 bg-card/90 border-t border-border/60 backdrop-blur-sm">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {nearby.map((cam, i) => (
              <button
                key={cam.id}
                onClick={() => { setActiveIdx(i); setLoadError(false); }}
                className={`flex-shrink-0 flex flex-col items-center gap-1 p-2 rounded-lg border transition-all text-xs ${i === activeIdx ? "border-primary/60 bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border/60"}`}
                style={{ minWidth: 96 }}
              >
                <div className={`w-full h-10 rounded bg-zinc-800 flex items-center justify-center ${cam.stream_url ? "text-primary" : "text-zinc-600"}`}>
                  {cam.stream_url ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                </div>
                <span className="truncate w-20 text-center">{cam.name}</span>
                <span className="text-[10px] opacity-70">{cam.distAgent}m</span>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-center gap-2 mt-2">
            {nearby.map((_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === activeIdx ? "bg-primary w-4" : "bg-zinc-600"}`} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, MapPin, Share2, Smartphone, Loader2, StopCircle, Play, Clock, Navigation, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import L from "leaflet";

// Haversine in meters
function haversineM(a, b) { const R=6371000; const dLat=(b.lat-a.lat)*Math.PI/180; const dLng=(b.lng-a.lng)*Math.PI/180; const x=Math.sin(dLat/2)**2+Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.sin(dLng/2)**2; return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x)); }
function bearing(a,b){ const dLng=(b.lng-a.lng)*Math.PI/180; const y=Math.sin(dLng)*Math.cos(b.lat*Math.PI/180); const x=Math.cos(a.lat*Math.PI/180)*Math.sin(b.lat*Math.PI/180)-Math.sin(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*Math.cos(dLng); return (Math.atan2(y,x)*180/Math.PI+360)%360; }

const USER_ICON = L.divIcon({
  html: '<div class="w-8 h-8 rounded-full bg-primary border-[3px] border-white shadow-lg flex items-center justify-center"><div class="w-3 h-3 rounded-full bg-white animate-pulse"></div></div>',
  className: "", iconSize: [32, 32], iconAnchor: [16, 16],
});

function generateToken() {
  return "ccg_" + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export default function CaminheComigo() {
  const { user } = useAuth();
  const [session, setSession] = useState(null);
  const [active, setActive] = useState(false);
  const [location, setLocation] = useState(null);
  const [destino, setDestino] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);
  const watchId = useRef(null);
  const timerRef = useRef(null);
  const trailRef = useRef([]);        // last 30s of coordinates
  const anomalyLocked = useRef(false);

  // ── Anomaly detection helpers ────────────────────────
  const checkAnomaly = useCallback((loc) => {
    const trail = trailRef.current;
    trail.push({ ...loc, ts: Date.now() });
    if (trail.length > 60) trail.shift(); // keep last ~60s at 1Hz

    if (trail.length < 4 || anomalyLocked.current) return;

    const recent = trail.filter((p) => Date.now() - p.ts < 10000); // last 10s
    if (recent.length < 3) return;

    // Instant speed over last 2 samples
    const last = trail[trail.length - 1];
    const prev2 = trail[trail.length - 2];
    const d = haversineM(prev2, last);
    const dt = (last.ts - prev2.ts) / 1000;
    const speedKmh = dt > 0 ? (d / 1000) / (dt / 3600) : 0;

    // Heading change (bearing diff in degrees)
    const b1 = bearing(prev2, last);
    const b2 = bearing(trail[trail.length - 3], prev2);
    const headingDelta = Math.abs(b1 - b2) % 360;
    const sharpTurn = headingDelta > 180 ? 360 - headingDelta : headingDelta;

    // Trigger if: running + sharp turn (> 12 km/h + > 90° turn)
    // OR: running alone (> 18 km/h = sprinting)
    if ((speedKmh > 12 && sharpTurn > 90) || speedKmh > 18) {
      anomalyLocked.current = true;
      toast.error("🚨 Alerta preventivo: movimento brusco detectado!", {
        description: `Velocidade: ${speedKmh.toFixed(0)} km/h · Mudança de direção: ${sharpTurn.toFixed(0)}°`,
        duration: 10000,
      });
      const mapsLink = `https://maps.google.com/?q=${loc.lat},${loc.lng}`;
      base44.entities.Occurrence.create({
        type: "panic",
        subtype: "Desvio de Rota Suspeito",
        description: `[CAMINHE COMIGO] ${user?.full_name} apresentou movimento brusco (${speedKmh.toFixed(0)} km/h, ${sharpTurn.toFixed(0)}° de desvio). Possível fuga ou abordagem. Localização: ${mapsLink}`,
        lat: loc.lat, lng: loc.lng, reporter_id: user?.id,
        priority: "high", status: "open",
      }).catch(() => {});
      setTimeout(() => { anomalyLocked.current = false; }, 30000);
    }
  }, [user]);

  useEffect(() => { trailRef.current = []; anomalyLocked.current = false; }, [active]);

  const shareUrl = session?.share_token
    ? `${window.location.origin}/caminhe-comigo/${session.share_token}`
    : "";

  const startSession = useCallback(async () => {
    if (!navigator.geolocation) { toast.error("Geolocalização não disponível"); return; }

    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
    }).catch(() => null);

    if (!pos) { toast.error("Não foi possível obter sua localização. Verifique as permissões."); return; }

    const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    setLocation(loc);

    const token = generateToken();
    const sess = await base44.entities.Sessoes_CaminheComigo.create({
      user_id: user.id,
      user_name: user.full_name,
      share_token: token,
      origem_lat: loc.lat,
      origem_lng: loc.lng,
      destino_nome: destino || "Não informado",
      started_at: new Date().toISOString(),
      status: "active",
    });
    setSession(sess);
    setActive(true);

    // Start watching position
    const wid = navigator.geolocation.watchPosition(
      (p) => {
        const newLoc = { lat: p.coords.latitude, lng: p.coords.longitude };
        setLocation(newLoc);
        checkAnomaly(newLoc);
        base44.auth.updateMe({ last_location: { ...newLoc, updated_at: new Date().toISOString() } }).catch(() => {});
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    watchId.current = wid;

    // Start timer
    const start = Date.now();
    timerRef.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
  }, [user, destino]);

  const stopSession = async () => {
    if (watchId.current) { navigator.geolocation.clearWatch(watchId.current); watchId.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setActive(false);

    if (session?.id) {
      await base44.entities.Sessoes_CaminheComigo.update(session.id, {
        status: "ended",
        ended_at: new Date().toISOString(),
      });
    }
  };

  useEffect(() => {
    return () => {
      if (watchId.current) navigator.geolocation.clearWatch(watchId.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copiado! Compartilhe com seu contato de confiança.");
    setTimeout(() => setCopied(false), 3000);
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(`🚶 Estou a caminho e compartilhando minha localização em tempo real com você pelo Sentinela. Acompanhe aqui: ${shareUrl}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <MapPin className="w-7 h-7 text-primary" /> Caminhe Comigo
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Compartilhe sua localização em tempo real com um contato de confiança enquanto se desloca.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          {/* Status card */}
          <div className={`rounded-2xl border p-6 mb-4 ${active ? "border-success/50 bg-success/5" : "border-border/60 bg-card"}`}>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${active ? "bg-success/20" : "bg-muted"}`}>
                  {active ? (
                    <div className="w-4 h-4 rounded-full bg-success animate-pulse" />
                  ) : (
                    <Shield className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h2 className="font-semibold">{active ? "Sessão Ativa" : "Iniciar Sessão"}</h2>
                  <p className="text-xs text-muted-foreground">
                    {active ? "Sua localização está sendo compartilhada" : "Compartilhe seu trajeto em tempo real"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {active && (
                  <div className="flex items-center gap-1.5 text-sm font-mono text-success">
                    <Clock className="w-4 h-4" />
                    {formatTime(elapsed)}
                  </div>
                )}
                {!active ? (
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Para onde vai? (opcional)"
                      value={destino}
                      onChange={(e) => setDestino(e.target.value)}
                      className="h-9 text-sm w-40"
                    />
                    <Button onClick={startSession}>
                      <Play className="w-4 h-4 mr-1.5" /> Iniciar
                    </Button>
                  </div>
                ) : (
                  <Button variant="destructive" onClick={stopSession}>
                    <StopCircle className="w-4 h-4 mr-1.5" /> Encerrar
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="rounded-2xl border border-border/60 overflow-hidden" style={{ height: 400 }}>
            {location ? (
              <MapContainer center={[location.lat, location.lng]} zoom={16} className="h-full w-full" scrollWheelZoom={true}>
                <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[location.lat, location.lng]} icon={USER_ICON} />
              </MapContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MapPin className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Inicie uma sessão para ver sua localização no mapa</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Share panel */}
        <div className="space-y-4">
          {active && (
            <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4 animate-fade-in">
              <h3 className="font-semibold flex items-center gap-2">
                <Share2 className="w-4 h-4 text-primary" /> Compartilhar
              </h3>
              <p className="text-xs text-muted-foreground">
                Envie o link abaixo para um contato de confiança. Ele poderá acompanhar sua localização em tempo real.
              </p>

              <div className="flex items-center gap-2">
                <Input value={shareUrl} readOnly className="h-9 text-xs font-mono" />
                <Button size="sm" variant="outline" onClick={copyLink} className="flex-shrink-0">
                  {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
              </div>

              <Button variant="outline" className="w-full" onClick={shareWhatsApp}>
                <Smartphone className="w-4 h-4 mr-1.5" /> Compartilhar via WhatsApp
              </Button>
            </div>
          )}

          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <h3 className="font-semibold text-sm mb-3">Como funciona</h3>
            <div className="space-y-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-primary">1</span>
                </div>
                <p>Inicie a sessão informando (opcionalmente) para onde está indo.</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-primary">2</span>
                </div>
                <p>Compartilhe o link gerado com um familiar ou amigo via WhatsApp.</p>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-primary">3</span>
                </div>
                <p>Seu contato acompanha sua posição no mapa em tempo real até você chegar.</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <Button variant="ghost" size="sm" className="w-full justify-start text-sm" asChild>
              <a href={`${window.location.origin}/rotas-seguras`}>
                <Navigation className="w-4 h-4 mr-1.5" /> Calcular rota segura antes de sair →
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
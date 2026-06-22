import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet";
import { Shield, MapPin, Clock, Navigation } from "lucide-react";
import { useParams } from "react-router-dom";
import L from "leaflet";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const USER_ICON = L.divIcon({
  html: '<div class="w-8 h-8 rounded-full bg-primary border-[3px] border-white shadow-lg flex items-center justify-center"><div class="w-3 h-3 rounded-full bg-white animate-pulse"></div></div>',
  className: "", iconSize: [32, 32], iconAnchor: [16, 16],
});
const DEST_ICON = L.divIcon({
  html: '<div class="w-6 h-6 rounded-full bg-success border-2 border-white shadow-lg flex items-center justify-center text-white text-[10px]">✓</div>',
  className: "", iconSize: [24, 24], iconAnchor: [12, 12],
});

export default function CaminheComigoViewer() {
  const { token } = useParams();
  const [session, setSession] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;
    (async () => {
      const list = await base44.entities.Sessoes_CaminheComigo.filter({ share_token: token }, "-created_date", 1);
      if (list.length === 0) { setError("Sessão não encontrada ou link inválido."); return; }
      const sess = list[0];
      setSession(sess);
      if (sess.status !== "active") { setError("Essa sessão já foi encerrada."); return; }

      // Get user's last location
      try {
        const users = await base44.entities.User.filter({ id: sess.user_id });
        const u = users[0];
        if (u?.last_location) {
          setLocation(u.last_location);
          setUserInfo({ name: u.full_name, updated: u.last_location.updated_at });
        } else {
          setLocation({ lat: sess.origem_lat, lng: sess.origem_lng });
        }
      } catch { /* ignore */ }

      // Subscribe to user location updates via polling
      const interval = setInterval(async () => {
        try {
          const users = await base44.entities.User.filter({ id: sess.user_id });
          const u = users[0];
          if (u?.last_location) {
            setLocation(u.last_location);
            setUserInfo({ name: u.full_name, updated: u.last_location.updated_at });
          }
        } catch { /* ignore */ }
      }, 5000);

      return () => clearInterval(interval);
    })();
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-sm">
          <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">Sentinela</h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!session || !location) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="bg-card border-b border-border/60 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <div>
              <h1 className="text-sm font-semibold">{userInfo?.name || session.user_name}</h1>
              <p className="text-[10px] text-muted-foreground">
                {session.destino_nome ? `Indo para: ${session.destino_nome}` : "Compartilhando localização"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-success">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Ao vivo
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1">
        <MapContainer center={[location.lat, location.lng]} zoom={16} className="h-full w-full" scrollWheelZoom={true}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <Marker position={[location.lat, location.lng]} icon={USER_ICON} />
          {session.origem_lat && (
            <Marker position={[session.origem_lat, session.origem_lng]} icon={DEST_ICON} />
          )}
          {session.origem_lat && (
            <Polyline
              positions={[[session.origem_lat, session.origem_lng], [location.lat, location.lng]]}
              color="hsl(var(--primary))" weight={2} dashArray="6 3" opacity={0.5}
            />
          )}
        </MapContainer>
      </div>

      {/* Footer */}
      <div className="bg-card border-t border-border/60 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            {userInfo?.updated ? format(new Date(userInfo.updated), "HH:mm:ss", { locale: ptBR }) : "—"}
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3" />
            {location.lat?.toFixed(6)}, {location.lng?.toFixed(6)}
          </div>
          <span>Sentinela · Caminhe Comigo</span>
        </div>
      </div>
    </div>
  );
}
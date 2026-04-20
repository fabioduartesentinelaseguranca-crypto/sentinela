import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { TYPE_META } from "@/lib/occurrenceMeta";

// Fix default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const typeColors = {
  crime: "#ef4444",
  traffic: "#f59e0b",
  civil_defense: "#a855f7",
  health: "#22c55e",
  panic: "#dc2626",
};

export default function LiveMap({ occurrences = [], agents = [], heatmap = false, center }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);

  if (!ready || !center) {
    return (
      <div className="h-[500px] rounded-2xl border border-border/60 bg-card flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Carregando mapa...</div>
      </div>
    );
  }

  return (
    <div className="h-[500px] rounded-2xl border border-border/60 overflow-hidden">
      <MapContainer center={[center.lat, center.lng]} zoom={13} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; OpenStreetMap'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {occurrences.filter((o) => o.lat && o.lng).map((o) => (
          <CircleMarker
            key={o.id}
            center={[o.lat, o.lng]}
            radius={heatmap ? 18 : 10}
            pathOptions={{
              color: typeColors[o.type] || "#888",
              fillColor: typeColors[o.type] || "#888",
              fillOpacity: heatmap ? 0.3 : 0.8,
              weight: heatmap ? 0 : 2,
            }}
          >
            <Popup>
              <div className="text-xs">
                <div className="font-semibold">{TYPE_META[o.type]?.label} · {o.subtype}</div>
                {o.description && <div className="mt-1">{o.description}</div>}
                <div className="mt-1 text-gray-500">Status: {o.status}</div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
        {agents.filter((a) => a.last_location?.lat).map((a) => (
          <Marker key={a.id} position={[a.last_location.lat, a.last_location.lng]}>
            <Popup>
              <div className="text-xs">
                <div className="font-semibold">{a.full_name}</div>
                <div className="text-gray-500">{a.agent_badge || "Agente"}</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
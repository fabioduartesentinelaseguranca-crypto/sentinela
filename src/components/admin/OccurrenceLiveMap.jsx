import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { TYPE_META, STATUS_META } from "@/lib/occurrenceMeta";
import { Radio, Filter, MapPin, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

// Cores por tipo (hex) para CircleMarker
const TYPE_COLOR = {
  crime: "#ef4444",
  traffic: "#f59e0b",
  civil_defense: "#a855f7",
  health: "#22c55e",
  panic: "#dc2626",
};

// Recentraliza o mapa quando o centro muda
function Recenter({ center }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

export default function OccurrenceLiveMap() {
  const [occurrences, setOccurrences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Carga inicial
  useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.Occurrence.list("-created_date", 500);
        setOccurrences(list.filter((o) => typeof o.lat === "number" && typeof o.lng === "number"));
      } catch { /* */ }
      setLoading(false);
    })();

    // Tempo real: inscreve nos eventos da entidade
    const unsubscribe = base44.entities.Occurrence.subscribe((event) => {
      setOccurrences((prev) => {
        if (event.type === "create") {
          const o = event.data;
          if (typeof o.lat === "number" && typeof o.lng === "number") return [o, ...prev];
          return prev;
        }
        if (event.type === "update") {
          return prev.map((o) => (o.id === event.id ? { ...o, ...event.data } : o));
        }
        if (event.type === "delete") {
          return prev.filter((o) => o.id !== event.id);
        }
        return prev;
      });
    });
    return () => unsubscribe();
  }, []);

  const filtered = useMemo(() => {
    return occurrences.filter((o) => {
      if (typeFilter !== "all" && o.type !== typeFilter) return false;
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      return true;
    });
  }, [occurrences, typeFilter, statusFilter]);

  const center = useMemo(() => {
    if (!filtered.length) return [-15.78, -47.93];
    const lat = filtered.reduce((a, b) => a + b.lat, 0) / filtered.length;
    const lng = filtered.reduce((a, b) => a + b.lng, 0) / filtered.length;
    return [lat, lng];
  }, [filtered]);

  const counts = useMemo(() => {
    const byType = {};
    filtered.forEach((o) => { byType[o.type] = (byType[o.type] || 0) + 1; });
    return byType;
  }, [filtered]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-bold text-xl flex items-center gap-2">
          <Radio className="w-5 h-5 text-primary animate-pulse" /> Mapa de Ocorrências em Tempo Real
        </h2>
        <div className="flex gap-2 flex-wrap items-center">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.entries(TYPE_META).map(([k, m]) => (
                <SelectItem key={k} value={k}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {Object.entries(STATUS_META).map(([k, m]) => (
                <SelectItem key={k} value={k}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Contadores por tipo */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(TYPE_META).map(([k, m]) => (
          <div key={k} className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-1.5 text-sm">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: TYPE_COLOR[k] }} />
            <span className="text-muted-foreground">{m.label}</span>
            <span className="font-bold">{counts[k] || 0}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[480px] rounded-2xl border border-border/60 bg-card">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden border border-border/60" style={{ height: 480 }}>
          <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }} key={center.join(",")}>
            <Recenter center={center} />
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; CartoDB'
            />
            {filtered.map((o) => {
              const color = TYPE_COLOR[o.type] || "#6b7280";
              const isPanic = o.type === "panic";
              return (
                <CircleMarker
                  key={o.id}
                  center={[o.lat, o.lng]}
                  radius={isPanic ? 12 : 8}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: o.status === "resolved" ? 0.35 : 0.7,
                    weight: o.status === "open" ? 2.5 : 1.5,
                  }}
                >
                  <Popup>
                    <div className="text-xs space-y-1 min-w-[180px]">
                      <div className="font-bold flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: color }} />
                        {TYPE_META[o.type]?.label || o.type}
                      </div>
                      <div className="text-muted-foreground">Status: <strong>{STATUS_META[o.status]?.label || o.status}</strong></div>
                      {o.subtype && <div>Subtipo: {o.subtype}</div>}
                      {o.description && <div className="max-w-[200px]">{o.description}</div>}
                      <div className="text-muted-foreground">{format(new Date(o.created_date), "dd/MM/yyyy HH:mm")}</div>
                      {o.address && <div>📍 {o.address}</div>}
                      <a
                        href={`https://maps.google.com/?q=${o.lat},${o.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        <MapPin className="w-3 h-3" /> Ver no Google Maps
                      </a>
                    </div>
                  </Popup>
                  <Tooltip direction="top">
                    <div className="text-xs">
                      <strong>{TYPE_META[o.type]?.label || o.type}</strong> · {STATUS_META[o.status]?.label || o.status}
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Atualização em tempo real via WebSocket. Marcadores maiores e vermelhos = chamados de pânico.
      </p>
    </div>
  );
}
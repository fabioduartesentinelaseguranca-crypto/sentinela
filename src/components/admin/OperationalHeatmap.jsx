import { useState, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, LayerGroup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { subDays, parseISO, format } from "date-fns";
import { Flame, Filter, MapPin } from "lucide-react";
import { TYPE_META } from "@/lib/occurrenceMeta";

const SHIFT_HOURS = {
  morning: [6, 14],
  afternoon: [14, 22],
  night: [22, 6],
};

function getShift(dateStr) {
  try {
    const h = parseISO(dateStr).getHours();
    if (h >= 6 && h < 14) return "morning";
    if (h >= 14 && h < 22) return "afternoon";
    return "night";
  } catch { return "morning"; }
}

// Cluster nearby points to show density
function cluster(points, radius = 0.003) {
  const clusters = [];
  const used = new Set();
  points.forEach((p, i) => {
    if (used.has(i)) return;
    const group = [p];
    used.add(i);
    points.forEach((q, j) => {
      if (used.has(j)) return;
      const d = Math.sqrt((p.lat - q.lat) ** 2 + (p.lng - q.lng) ** 2);
      if (d < radius) { group.push(q); used.add(j); }
    });
    const lat = group.reduce((a, b) => a + b.lat, 0) / group.length;
    const lng = group.reduce((a, b) => a + b.lng, 0) / group.length;
    clusters.push({ lat, lng, count: group.length, points: group });
  });
  return clusters;
}

export default function OperationalHeatmap({ occurrences = [] }) {
  const [period, setPeriod] = useState("30");
  const [shiftFilter, setShiftFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("resolved");

  const filtered = useMemo(() => {
    const cutoff = subDays(new Date(), parseInt(period));
    return occurrences.filter((o) => {
      if (!o.lat || !o.lng) return false;
      try { if (parseISO(o.created_date) < cutoff) return false; } catch { return false; }
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (shiftFilter !== "all" && getShift(o.created_date) !== shiftFilter) return false;
      if (typeFilter !== "all" && o.type !== typeFilter) return false;
      return true;
    });
  }, [occurrences, period, shiftFilter, typeFilter, statusFilter]);

  const clusters = useMemo(() => cluster(filtered.map((o) => ({ lat: o.lat, lng: o.lng, ...o }))), [filtered]);

  const maxCount = Math.max(...clusters.map((c) => c.count), 1);

  const center = useMemo(() => {
    if (!filtered.length) return [-15.78, -47.93];
    const lat = filtered.reduce((a, b) => a + b.lat, 0) / filtered.length;
    const lng = filtered.reduce((a, b) => a + b.lng, 0) / filtered.length;
    return [lat, lng];
  }, [filtered]);

  const getColor = (count) => {
    const ratio = count / maxCount;
    if (ratio > 0.8) return "#ef4444";
    if (ratio > 0.5) return "#f97316";
    if (ratio > 0.2) return "#eab308";
    return "#22c55e";
  };

  const hotspots = [...clusters].sort((a, b) => b.count - a.count).slice(0, 5);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-bold text-xl flex items-center gap-2"><Flame className="w-5 h-5 text-destructive" /> Mapa de Calor Operacional</h2>
        <div className="flex gap-2 flex-wrap items-center">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="60">60 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Select value={shiftFilter} onValueChange={setShiftFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os turnos</SelectItem>
              <SelectItem value="morning">Manhã (6–14h)</SelectItem>
              <SelectItem value="afternoon">Tarde (14–22h)</SelectItem>
              <SelectItem value="night">Noite (22–6h)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.entries(TYPE_META).map(([k, m]) => (
                <SelectItem key={k} value={k}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="resolved">Resolvidas</SelectItem>
              <SelectItem value="open">Abertas</SelectItem>
              <SelectItem value="in_progress">Em atendimento</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex gap-3 text-sm">
        {[
          { label: "Ocorrências filtradas", val: filtered.length, color: "text-primary" },
          { label: "Zonas de calor", val: clusters.length, color: "text-warning" },
          { label: "Hotspot principal", val: hotspots[0]?.count ? `${hotspots[0].count} occ.` : "—", color: "text-destructive" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border/60 bg-card px-4 py-2">
            <span className={`font-bold ${s.color}`}>{s.val}</span>
            <span className="text-muted-foreground ml-2 text-xs">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="rounded-2xl overflow-hidden border border-border/60" style={{ height: 480 }}>
        <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }}
          key={center.join(",")}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; CartoDB'
          />
          <LayerGroup>
            {clusters.map((c, i) => {
              const radius = Math.max(8, Math.min(40, (c.count / maxCount) * 40));
              const color = getColor(c.count);
              return (
                <CircleMarker key={i} center={[c.lat, c.lng]} radius={radius}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.55, weight: 1 }}>
                  <Tooltip direction="top">
                    <div className="text-xs">
                      <strong>{c.count} ocorrência{c.count > 1 ? "s" : ""}</strong><br />
                      {c.points.slice(0, 3).map((p, j) => (
                        <div key={j}>{p.subtype || TYPE_META[p.type]?.label || p.type}</div>
                      ))}
                    </div>
                  </Tooltip>
                </CircleMarker>
              );
            })}
          </LayerGroup>
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
        <span className="font-medium text-sm">Intensidade:</span>
        {[
          { color: "#22c55e", label: "Baixa" },
          { color: "#eab308", label: "Média" },
          { color: "#f97316", label: "Alta" },
          { color: "#ef4444", label: "Crítica" },
        ].map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full inline-block" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>

      {/* Hotspots table */}
      {hotspots.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><MapPin className="w-4 h-4 text-destructive" /> Top 5 Hotspots</h3>
          <div className="space-y-2">
            {hotspots.map((h, i) => (
              <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-sm">
                <span className="text-muted-foreground">#{i + 1}</span>
                <span className="font-mono text-xs">{h.lat.toFixed(4)}, {h.lng.toFixed(4)}</span>
                <span className="font-bold text-destructive">{h.count} ocorrência{h.count > 1 ? "s" : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
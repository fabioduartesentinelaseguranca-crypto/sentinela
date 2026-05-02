import { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Brain, RefreshCw, Flame, MapPin, Route, AlertTriangle, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { TYPE_META } from "@/lib/occurrenceMeta";

const RISK_CONFIG = {
  critical: { color: "#ef4444", bg: "bg-red-500/20 border-red-500/40 text-red-400", label: "Crítico" },
  high:     { color: "#f97316", bg: "bg-orange-500/20 border-orange-500/40 text-orange-400", label: "Alto" },
  medium:   { color: "#eab308", bg: "bg-yellow-500/20 border-yellow-500/40 text-yellow-400", label: "Médio" },
  low:      { color: "#22c55e", bg: "bg-green-500/20 border-green-500/40 text-green-400", label: "Baixo" },
};

const SHIFT_LABELS = { morning: "Manhã (06-14h)", afternoon: "Tarde (14-22h)", night: "Noite (22-06h)" };

export default function HeatmapPatrolDashboard() {
  const [occurrences, setOccurrences] = useState([]);
  const [zones, setZones] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [days, setDays] = useState("30");
  const [mapCenter] = useState([-15.793, -47.882]);

  useEffect(() => {
    Promise.all([
      base44.entities.Occurrence.filter({}, "-created_date", 500),
      base44.entities.PatrolZone.list("-created_date", 100),
    ]).then(([occs, zns]) => {
      setOccurrences(occs);
      setZones(zns);
      setLoadingData(false);
    });
  }, []);

  const filteredOccs = useMemo(() => {
    const cutoff = subDays(new Date(), parseInt(days));
    return occurrences.filter((o) => o.lat && o.lng && new Date(o.created_date) >= cutoff);
  }, [occurrences, days]);

  // Build heatmap cluster points: group nearby coords
  const heatPoints = useMemo(() => {
    const clusters = {};
    filteredOccs.forEach((o) => {
      const key = `${Math.round(o.lat * 100) / 100},${Math.round(o.lng * 100) / 100}`;
      if (!clusters[key]) clusters[key] = { lat: o.lat, lng: o.lng, count: 0, types: {} };
      clusters[key].count++;
      clusters[key].types[o.type] = (clusters[key].types[o.type] || 0) + 1;
    });
    return Object.values(clusters).sort((a, b) => b.count - a.count);
  }, [filteredOccs]);

  const topType = (types) => Object.entries(types).sort((a, b) => b[1] - a[1])[0]?.[0];

  const maxCount = Math.max(...heatPoints.map((p) => p.count), 1);

  const getColor = (count) => {
    const ratio = count / maxCount;
    if (ratio > 0.7) return "#ef4444";
    if (ratio > 0.4) return "#f97316";
    if (ratio > 0.2) return "#eab308";
    return "#22c55e";
  };

  const getRadius = (count) => Math.max(8, Math.min(40, (count / maxCount) * 45));

  const getRisk = (count) => {
    const ratio = count / maxCount;
    if (ratio > 0.7) return "critical";
    if (ratio > 0.4) return "high";
    if (ratio > 0.2) return "medium";
    return "low";
  };

  const generateRecommendations = async () => {
    if (filteredOccs.length === 0) return toast.error("Nenhuma ocorrência no período selecionado.");
    setLoading(true);
    setRecommendations([]);
    try {
      const summary = heatPoints.slice(0, 15).map((p) => ({
        lat: p.lat.toFixed(4),
        lng: p.lng.toFixed(4),
        count: p.count,
        main_type: topType(p.types),
        risk: getRisk(p.count),
      }));

      const zonesSummary = zones.slice(0, 10).map((z) => ({
        name: z.name,
        lat: z.lat,
        lng: z.lng,
      }));

      const currentHour = new Date().getHours();
      const shift = currentHour >= 6 && currentHour < 14 ? "morning" : currentHour >= 14 && currentHour < 22 ? "afternoon" : "night";

      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um analista de segurança pública. Com base nos dados de ocorrências dos últimos ${days} dias, gere recomendações de rotas de patrulha otimizadas para o próximo período.

Zonas de maior incidência (coordenadas e tipos):
${JSON.stringify(summary, null, 2)}

Zonas de patrulha cadastradas:
${JSON.stringify(zonesSummary, null, 2)}

Turno atual: ${SHIFT_LABELS[shift]}
Total de ocorrências no período: ${filteredOccs.length}

Gere 4 rotas de patrulha recomendadas com base nos padrões de criminalidade. Seja específico e prático.`,
        response_json_schema: {
          type: "object",
          properties: {
            routes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  risk: { type: "string", enum: ["critical", "high", "medium", "low"] },
                  shift: { type: "string", enum: ["morning", "afternoon", "night"] },
                  crime_types: { type: "array", items: { type: "string" } },
                  rationale: { type: "string" },
                  waypoints: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: { lat: { type: "number" }, lng: { type: "number" }, note: { type: "string" } }
                    }
                  },
                  priority: { type: "number" }
                }
              }
            },
            summary: { type: "string" }
          }
        }
      });
      setRecommendations(res.routes || []);
      toast.success("Análise preditiva gerada!");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao gerar análise preditiva.");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-400" />
          <h2 className="text-lg font-semibold">Mapa de Calor Preditivo</h2>
          <span className="text-xs text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-full">{filteredOccs.length} ocorrências</span>
        </div>
        <div className="flex items-center gap-2">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="15">Últimos 15 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={generateRecommendations} disabled={loading || loadingData} size="sm">
            {loading ? <RefreshCw className="w-4 h-4 mr-1.5 animate-spin" /> : <Brain className="w-4 h-4 mr-1.5" />}
            {loading ? "Analisando..." : "Gerar Rotas IA"}
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Map */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl overflow-hidden border border-border/60" style={{ height: 460 }}>
            {loadingData ? (
              <div className="flex items-center justify-center h-full bg-card">
                <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
              </div>
            ) : (
              <MapContainer center={mapCenter} zoom={12} style={{ height: "100%", width: "100%" }}>
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; CartoDB'
                />
                {heatPoints.map((pt, i) => (
                  <CircleMarker
                    key={i}
                    center={[pt.lat, pt.lng]}
                    radius={getRadius(pt.count)}
                    fillColor={getColor(pt.count)}
                    color={getColor(pt.count)}
                    fillOpacity={0.35}
                    weight={1}
                  >
                    <Popup>
                      <div className="text-sm font-medium">{pt.count} ocorrências</div>
                      <div className="text-xs text-gray-500">
                        Principal: {TYPE_META[topType(pt.types)]?.label || topType(pt.types)}
                      </div>
                      <div className="text-xs text-gray-500">{pt.lat.toFixed(4)}, {pt.lng.toFixed(4)}</div>
                    </Popup>
                  </CircleMarker>
                ))}
                {recommendations.map((route, i) =>
                  route.waypoints && route.waypoints.length > 1 ? (
                    <Polyline
                      key={`route-${i}`}
                      positions={route.waypoints.map((w) => [w.lat, w.lng])}
                      color={RISK_CONFIG[route.risk]?.color || "#38bdf8"}
                      weight={3}
                      dashArray="8 4"
                      opacity={0.9}
                    />
                  ) : null
                )}
              </MapContainer>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 px-1 flex-wrap">
            <span className="text-xs text-muted-foreground font-medium">Intensidade:</span>
            {[
              { color: "#22c55e", label: "Baixa" },
              { color: "#eab308", label: "Média" },
              { color: "#f97316", label: "Alta" },
              { color: "#ef4444", label: "Crítica" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: l.color, opacity: 0.7 }} />
                {l.label}
              </div>
            ))}
            {recommendations.length > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className="w-6 h-0.5 bg-primary" style={{ borderTop: "2px dashed #38bdf8" }} />
                Rota sugerida
              </div>
            )}
          </div>
        </div>

        {/* Hot zones */}
        <div className="space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Zonas Críticas</h3>
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin">
            {heatPoints.slice(0, 12).map((pt, i) => {
              const risk = getRisk(pt.count);
              const cfg = RISK_CONFIG[risk];
              const mainType = topType(pt.types);
              return (
                <div key={i} className={`rounded-xl border p-3 ${cfg.bg}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-mono">{pt.lat.toFixed(4)}, {pt.lng.toFixed(4)}</div>
                        <div className="text-[10px] opacity-80 mt-0.5">
                          {TYPE_META[mainType]?.label || mainType}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold font-mono">{pt.count}</div>
                      <div className="text-[10px] opacity-70">ocorr.</div>
                    </div>
                  </div>
                </div>
              );
            })}
            {heatPoints.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-xl">
                Nenhuma ocorrência com localização no período.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Route className="w-4 h-4 text-primary" />
            <h3 className="font-semibold">Rotas de Patrulha Recomendadas pela IA</h3>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {recommendations.sort((a, b) => a.priority - b.priority).map((route, i) => {
              const cfg = RISK_CONFIG[route.risk] || RISK_CONFIG.medium;
              return (
                <div key={i} className={`rounded-2xl border p-4 ${cfg.bg} space-y-2`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm flex items-center gap-2">
                      <span>#{i + 1}</span>
                      <span>{route.name}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.bg}`}>{cfg.label}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full border border-border/40 bg-muted/30 text-muted-foreground">{SHIFT_LABELS[route.shift]}</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{route.rationale}</p>
                  {route.crime_types && route.crime_types.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {route.crime_types.map((ct) => (
                        <span key={ct} className="text-[10px] bg-muted/40 border border-border/40 px-1.5 py-0.5 rounded text-muted-foreground">
                          {TYPE_META[ct]?.label || ct}
                        </span>
                      ))}
                    </div>
                  )}
                  {route.waypoints && route.waypoints.length > 0 && (
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {route.waypoints.length} waypoints definidos
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total no período", value: filteredOccs.length, icon: AlertTriangle, color: "text-warning" },
          { label: "Zonas mapeadas", value: heatPoints.length, icon: MapPin, color: "text-primary" },
          { label: "Zona mais crítica", value: heatPoints[0]?.count || 0, icon: Flame, color: "text-emergency" },
          { label: "Tipo principal", value: TYPE_META[topType(heatPoints[0]?.types || {})]?.label || "—", icon: TrendingUp, color: "text-success" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border/60 bg-card p-3 text-center">
            <s.icon className={`w-4 h-4 ${s.color} mx-auto mb-1`} />
            <div className={`font-bold text-lg ${s.color} font-mono truncate`}>{s.value}</div>
            <div className="text-[10px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
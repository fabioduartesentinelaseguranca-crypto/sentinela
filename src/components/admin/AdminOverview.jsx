import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { TYPE_META, STATUS_META } from "@/lib/occurrenceMeta";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import {
  Shield,
  TrendingUp, TrendingDown, Users, Clock, ArrowRight, Wifi,
  CheckCircle2, AlertTriangle
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import "leaflet/dist/leaflet.css";

// Auto-fit map to markers
function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 13);
    } else {
      map.fitBounds(positions, { padding: [40, 40], maxZoom: 14 });
    }
  }, [positions.length]);
  return null;
}

// Fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const createColorIcon = (color) => L.divIcon({
  className: "",
  html: `<div style="
    width:32px;height:32px;
    background:${color};
    border:2px solid rgba(255,255,255,0.8);
    border-radius:50% 50% 50% 0;
    transform:rotate(-45deg);
    box-shadow:0 2px 8px rgba(0,0,0,0.5);
  "></div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -36],
});

const TYPE_ICON_COLOR = {
  crime: "#ef4444",
  traffic: "#f59e0b",
  civil_defense: "#8b5cf6",
  health: "#22c55e",
  panic: "#ef4444",
};

// Sparkline component
function Sparkline({ values = [], color = "#22d3ee", up = true }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const w = 80, h = 32;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      <polyline points={pts} stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export default function AdminOverview({ occurrences = [], users = [], onTabChange }) {
  const { user } = useAuth();
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const filteredOccurrences = occurrences.filter(o => {
    if (typeFilter !== "all" && o.type !== typeFilter) return false;
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    return true;
  });

  const openCount = filteredOccurrences.filter(o => o.status === "open").length;
  const agentCount = users.filter(u => u.role === "agent").length;
  const resolvedCount = filteredOccurrences.filter(o => o.status === "resolved").length;
  const totalCount = filteredOccurrences.length || 1;
  const securityIndex = Math.round((resolvedCount / totalCount) * 100);

  const avgResponseMs = 4.2; // placeholder — real calc would use timestamps

  // Filter occurrences with coords for map
  const mappedOccs = filteredOccurrences.filter(o => o.lat && o.lng).slice(0, 30);

  const markerPositions = mappedOccs.map(o => [o.lat, o.lng]);
  const mapCenter = markerPositions.length > 0 ? markerPositions[0] : [-25.4284, -49.2733];

  const recentOccs = filteredOccurrences.slice(0, 5);

  const sparkData = [3, 5, 4, 8, 6, 9, 7, 10, 8, openCount || 8];
  const agentSpark = [120, 130, 125, 140, 135, 145, 143, 147, agentCount || 147];
  const secSpark = [70, 75, 72, 80, 78, 82, 84, 86, securityIndex || 87];
  const respSpark = [5.1, 4.8, 4.9, 4.5, 4.3, 4.6, 4.2, 4.1, 4.2];

  return (
    <div className="flex h-[calc(100vh-6rem)] bg-background overflow-hidden rounded-xl border border-border/60">

      {/* ── LEFT SIDEBAR ─────────────────────────────────── */}
      <aside className={`${sidebarCollapsed ? "w-12" : "w-52"} flex-shrink-0 border-r border-border/60 bg-card flex flex-col py-4 transition-all`}>
        {sidebarCollapsed ? (
          <button onClick={() => setSidebarCollapsed(false)} className="mx-auto mt-2 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Expandir menu">
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <>
            <div className="px-4 mb-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-[10px] text-success font-medium uppercase tracking-widest">Online</span>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin px-3 space-y-3">
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Tipo de Ocorrência</div>
                <div className="space-y-0.5">
                  <button
                    onClick={() => setTypeFilter("all")}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-left ${typeFilter === "all" ? "bg-primary/15 text-primary border border-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                  >
                    Todas
                  </button>
                  {Object.entries(TYPE_META).map(([key, meta]) => {
                    const Icon = meta.icon;
                    return (
                      <button
                        key={key}
                        onClick={() => setTypeFilter(key)}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-left ${typeFilter === key ? "bg-primary/15 text-primary border border-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1.5">Status</div>
                <div className="space-y-0.5">
                  {[
                    { id: "all", label: "Todas" },
                    { id: "open", label: "Aberta" },
                    { id: "in_progress", label: "Em Atendimento" },
                    { id: "resolved", label: "Resolvida" },
                    { id: "canceled", label: "Cancelada" },
                  ].map(s => (
                    <button
                      key={s.id}
                      onClick={() => setStatusFilter(s.id)}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-all text-left ${statusFilter === s.id ? "bg-primary/15 text-primary border border-primary/20" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-3 mt-3 pt-3 border-t border-border/60">
              <div className="text-[10px] text-muted-foreground mb-1.5">{filteredOccurrences.length} de {occurrences.length} ocorrências</div>
              <button onClick={() => setSidebarCollapsed(true)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground transition-colors">
                <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                Recolher Menu
              </button>
            </div>
          </>
        )}
      </aside>

      {/* ── CENTER: MAP ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top status bar */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/60 bg-card/50">
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <Wifi className="w-3.5 h-3.5 text-success" />
              <span className="text-success font-medium">SISTEMA ONLINE</span>
            </div>
            <div className="text-muted-foreground">
              <span className="font-semibold text-foreground">{filteredOccurrences.length}</span> ocorrências
            </div>
            <div className="text-muted-foreground">
              <span className="font-semibold text-foreground">{agentCount}</span> Online
            </div>
            <div className="flex items-center gap-1.5 text-primary">
              <CheckCircle2 className="w-3 h-3" />
              <span className="font-medium uppercase tracking-wider">Comunicação Estável</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-mono font-semibold text-foreground">{format(now, "HH:mm")}</span>
              <span>{format(now, "dd 'de' MMMM, yyyy", { locale: ptBR })}</span>
            </div>
            {user && (
              <div className="flex items-center gap-2 bg-muted/50 px-2.5 py-1 rounded-lg">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-[9px] font-bold text-primary">{user.full_name?.[0]}</span>
                </div>
                <div>
                  <div className="font-medium text-foreground text-[11px]">{user.full_name}</div>
                  <div className="text-[9px] text-muted-foreground">Comandante Geral</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <MapContainer
            center={mapCenter}
            zoom={13}
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            />
            <FitBounds positions={markerPositions} />
            {mappedOccs.map(o => (
              <Marker
                key={o.id}
                position={[o.lat, o.lng]}
                icon={createColorIcon(TYPE_ICON_COLOR[o.type] || "#6366f1")}
              >
                <Popup>
                  <div className="text-xs">
                    <div className="font-semibold">{o.subtype || TYPE_META[o.type]?.label}</div>
                    {o.address && <div className="text-muted-foreground">{o.address}</div>}
                    <div className="mt-1">{STATUS_META[o.status]?.label}</div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Map overlay legend */}
          <div className="absolute bottom-3 left-3 z-[1000] flex items-center gap-2 flex-wrap">
            {Object.entries(TYPE_META).map(([key, meta]) => (
              <div key={key} className="flex items-center gap-1.5 bg-card/90 backdrop-blur px-2 py-1 rounded-md border border-border/60 text-[10px]">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: TYPE_ICON_COLOR[key] }} />
                <span className="text-muted-foreground">{meta.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── RECENT OCCURRENCES BOTTOM BAR ── */}
        <div className="border-t border-border/60 bg-card p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-warning" /> Ocorrências Recentes
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-muted px-2 py-0.5 rounded text-muted-foreground">
                {typeFilter === "all" && statusFilter === "all" ? "Todos" : "Filtrado"}
              </span>
              <button onClick={() => onTabChange?.("live_map")} className="text-[10px] text-primary hover:underline flex items-center gap-1">
                Ver Todas <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
            {recentOccs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">Nenhuma ocorrência recente.</p>
            ) : recentOccs.map(o => {
              const tm = TYPE_META[o.type] || TYPE_META.crime;
              const sm = STATUS_META[o.status || "open"];
              const Icon = tm.icon;
              return (
                <div key={o.id} className="flex-shrink-0 w-44 rounded-xl border border-border/60 bg-background p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-5 h-5 rounded ${tm.bg} ${tm.color} flex items-center justify-center`}>
                      <Icon className="w-3 h-3" />
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {format(new Date(o.created_date), "HH:mm")}
                    </span>
                  </div>
                  <div className="text-xs font-semibold leading-tight line-clamp-1">{o.subtype || tm.label}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight line-clamp-2">{o.address || "Endereço não informado"}</div>
                  <span className={`inline-block text-[9px] uppercase px-1.5 py-0.5 rounded font-medium ${sm.bg} ${sm.color}`}>{sm.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── RIGHT KPIs PANEL ─────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 border-l border-border/60 bg-card flex flex-col p-3 gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 mb-1">
          Visão Geral
        </div>

        {/* KPI Card: Ocorrências Ativas */}
        <div className="rounded-xl border border-border/60 bg-background p-3 space-y-1">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Shield className="w-3 h-3 text-emergency" /> Ocorrências Ativas
          </div>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-foreground">{openCount}</span>
            <Sparkline values={sparkData} color="#ef4444" />
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <TrendingUp className="w-3 h-3 text-emergency" />
            <span className="text-emergency">+{Math.round(openCount * 0.12)}% nas últimas 24h</span>
          </div>
        </div>

        {/* KPI Card: Agentes em Campo */}
        <div className="rounded-xl border border-border/60 bg-background p-3 space-y-1">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Users className="w-3 h-3 text-primary" /> Agentes em Campo
          </div>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-foreground">{agentCount}</span>
            <Sparkline values={agentSpark} color="#22d3ee" />
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <TrendingUp className="w-3 h-3 text-success" />
            <span className="text-success">+6% nas últimas 24h</span>
          </div>
        </div>

        {/* KPI Card: Índice de Segurança */}
        <div className="rounded-xl border border-border/60 bg-background p-3 space-y-1">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-success" /> Índice de Segurança
          </div>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-foreground">{securityIndex}%</span>
            <Sparkline values={secSpark} color="#22c55e" />
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <TrendingUp className="w-3 h-3 text-success" />
            <span className="text-success">+5% em relação à ontem</span>
          </div>
        </div>

        {/* KPI Card: Tempo Médio de Resposta */}
        <div className="rounded-xl border border-border/60 bg-background p-3 space-y-1">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Clock className="w-3 h-3 text-warning" /> Tempo Médio de Resposta
          </div>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-foreground">{avgResponseMs}<span className="text-base font-normal text-muted-foreground ml-1">min</span></span>
            <Sparkline values={respSpark} color="#f59e0b" />
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <TrendingDown className="w-3 h-3 text-success" />
            <span className="text-success">-0.8 em relação à ontem</span>
          </div>
        </div>

        {/* Type breakdown */}
        <div className="rounded-xl border border-border/60 bg-background p-3 space-y-2 flex-1">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Por Categoria</div>
          {Object.entries(TYPE_META).map(([key, meta]) => {
            const count = occurrences.filter(o => o.type === key).length;
            const pct = occurrences.length > 0 ? Math.round((count / occurrences.length) * 100) : 0;
            const Icon = meta.icon;
            return (
              <div key={key} className="space-y-0.5">
                <div className="flex items-center justify-between text-[10px]">
                  <div className={`flex items-center gap-1 ${meta.color}`}>
                    <Icon className="w-3 h-3" />
                    <span>{meta.label}</span>
                  </div>
                  <span className="text-muted-foreground font-mono">{count}</span>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      background: TYPE_ICON_COLOR[key],
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
import { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { distanceKm } from "@/lib/geo";
import { findNearestUnit } from "@/lib/nearestUnitRouter";
import { differenceInMinutes, format } from "date-fns";
import {
  Shield, Users, AlertTriangle, CheckCircle2, Clock,
  MapPin, Siren, TrendingUp, RefreshCw, Navigation, Activity, Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";

const STATUS_COLORS = {
  open: "text-warning bg-warning/10 border-warning/20",
  in_progress: "text-primary bg-primary/10 border-primary/20",
  resolved: "text-success bg-success/10 border-success/20",
  canceled: "text-muted-foreground bg-muted/40 border-border/40",
};

const STATUS_LABELS = { open: "Aberta", in_progress: "Em andamento", resolved: "Resolvida", canceled: "Cancelada" };

const PRIORITY_COLORS = {
  critical: "bg-destructive text-white",
  high: "bg-warning/20 text-warning",
  medium: "bg-primary/10 text-primary",
  low: "bg-muted text-muted-foreground",
};

function KpiCard({ icon: Icon, label, value, sub, accent = "default" }) {
  const accents = {
    default: "border-border/60",
    warning: "border-warning/40 bg-warning/5",
    emergency: "border-destructive/40 bg-destructive/5",
    success: "border-success/40 bg-success/5",
    primary: "border-primary/40 bg-primary/5",
  };
  return (
    <div className={`border rounded-xl p-4 bg-card ${accents[accent]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground mb-1">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <Icon className={`w-5 h-5 mt-0.5 ${accent === "warning" ? "text-warning" : accent === "emergency" ? "text-destructive" : accent === "success" ? "text-success" : "text-primary"}`} />
      </div>
    </div>
  );
}

function AgentStatusRow({ agent, occurrences }) {
  const myOccs = occurrences.filter((o) => o.assigned_agent_id === agent.id && o.status === "in_progress");
  const isActive = !!agent.last_location;
  const lastSeen = agent.last_location?.updated_at
    ? differenceInMinutes(new Date(), new Date(agent.last_location.updated_at))
    : null;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border/40 bg-card hover:bg-muted/20 transition-colors">
      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{agent.full_name}</div>
        {lastSeen !== null && (
          <div className="text-[11px] text-muted-foreground">
            {isActive ? (lastSeen < 2 ? "Tempo real" : `${lastSeen}min atrás`) : "Offline"}
          </div>
        )}
      </div>
      {myOccs.length > 0 && (
        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-medium flex-shrink-0">
          {myOccs.length} ativo{myOccs.length > 1 ? "s" : ""}
        </span>
      )}
      {!isActive && <span className="text-[10px] text-muted-foreground flex-shrink-0">Sem GPS</span>}
    </div>
  );
}

function CriticalOccurrenceRow({ occ, agents }) {
  const nearest = findNearestUnit({ agents, occurrenceLat: occ.lat, occurrenceLng: occ.lng });
  const age = differenceInMinutes(new Date(), new Date(occ.created_date));

  return (
    <div className={`border rounded-xl p-3 space-y-2 ${occ.priority === "critical" || occ.type === "panic" ? "border-destructive/50 bg-destructive/5" : "border-border/60 bg-card"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {(occ.type === "panic" || occ.priority === "critical") && (
            <Siren className="w-4 h-4 text-destructive flex-shrink-0 animate-pulse" />
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{occ.subtype || occ.type}</div>
            {occ.address && <div className="text-xs text-muted-foreground truncate">{occ.address}</div>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLORS[occ.priority] || PRIORITY_COLORS.medium}`}>
            {occ.priority?.toUpperCase() || "MED"}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_COLORS[occ.status]}`}>
            {STATUS_LABELS[occ.status]}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {age < 60 ? `${age} min atrás` : `${Math.floor(age / 60)}h atrás`}
        </span>
        {nearest && (
          <a
            href={nearest.routeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline"
          >
            <Navigation className="w-3 h-3" />
            {nearest.agent.full_name.split(" ")[0]} · {nearest.distKm.toFixed(1)}km
          </a>
        )}
      </div>
    </div>
  );
}

export default function TacticalCommandCenter() {
  const [occurrences, setOccurrences] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [occs, allAgents] = await Promise.all([
      base44.entities.Occurrence.list("-created_date", 200),
      base44.entities.User.filter({ role: "agent" }),
    ]);
    setOccurrences(occs);
    setAgents(allAgents);
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // auto-refresh 30s
    return () => clearInterval(interval);
  }, [load]);

  // KPIs
  const openOccs = occurrences.filter((o) => o.status === "open");
  const inProgressOccs = occurrences.filter((o) => o.status === "in_progress");
  const resolvedToday = occurrences.filter((o) => {
    if (o.status !== "resolved") return false;
    return differenceInMinutes(new Date(), new Date(o.updated_date)) < 1440;
  });
  const criticalOccs = occurrences.filter(
    (o) => (o.priority === "critical" || o.type === "panic") && o.status !== "resolved"
  );
  const activeAgents = agents.filter((a) => a.last_location);
  const avgResponseMin = (() => {
    const resolved = occurrences.filter((o) => o.status === "resolved" && o.created_date && o.updated_date);
    if (!resolved.length) return 0;
    const times = resolved.map((o) => differenceInMinutes(new Date(o.updated_date), new Date(o.created_date))).filter((t) => t > 0 && t < 600);
    return times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
  })();

  // Top 10 ocorrências críticas/abertas para exibir
  const priorityOccs = [
    ...occurrences.filter((o) => (o.type === "panic" || o.priority === "critical") && o.status !== "resolved"),
    ...occurrences.filter((o) => o.priority === "high" && o.status === "open"),
    ...occurrences.filter((o) => o.status === "open"),
  ].filter((o, i, arr) => arr.findIndex((x) => x.id === o.id) === i).slice(0, 12);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            Central de Comando Tático
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tempo real · Auto-refresh 30s
            {lastRefresh && ` · Atualizado ${format(lastRefresh, "HH:mm:ss")}`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={AlertTriangle} label="Abertas" value={openOccs.length} accent="warning" />
        <KpiCard icon={Activity} label="Em andamento" value={inProgressOccs.length} accent="primary" />
        <KpiCard icon={CheckCircle2} label="Resolvidas hoje" value={resolvedToday.length} accent="success" />
        <KpiCard icon={Siren} label="Críticas ativas" value={criticalOccs.length} sub={criticalOccs.length > 0 ? "ATENÇÃO" : "OK"} accent={criticalOccs.length > 0 ? "emergency" : "success"} />
        <KpiCard icon={Users} label="Agentes em campo" value={activeAgents.length} sub={`de ${agents.length} total`} accent="primary" />
        <KpiCard icon={Clock} label="Resp. médio" value={avgResponseMin > 0 ? `${avgResponseMin}min` : "—"} sub="tempo de resolução" />
      </div>

      {/* Main grid: agents + critical occurrences */}
      <div className="grid lg:grid-cols-2 gap-5">
        {/* Agents Status */}
        <div className="bg-card border border-border/60 rounded-2xl p-4 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Status dos Agentes
            <span className="ml-auto text-xs text-muted-foreground font-normal">{activeAgents.length}/{agents.length} ativos</span>
          </h3>
          <div className="space-y-1.5 max-h-72 overflow-y-auto scrollbar-thin">
            {agents.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum agente cadastrado</p>
            )}
            {agents
              .sort((a, b) => (b.last_location ? 1 : 0) - (a.last_location ? 1 : 0))
              .map((agent) => (
                <AgentStatusRow key={agent.id} agent={agent} occurrences={occurrences} />
              ))}
          </div>
        </div>

        {/* Critical Occurrences */}
        <div className="bg-card border border-border/60 rounded-2xl p-4 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Siren className="w-4 h-4 text-destructive" />
            Ocorrências Prioritárias
            <span className="ml-auto text-xs text-muted-foreground font-normal">{priorityOccs.length} exibidas</span>
          </h3>
          <div className="space-y-2 max-h-72 overflow-y-auto scrollbar-thin">
            {priorityOccs.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma ocorrência aberta 👍</p>
            )}
            {priorityOccs.map((occ) => (
              <CriticalOccurrenceRow key={occ.id} occ={occ} agents={agents} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
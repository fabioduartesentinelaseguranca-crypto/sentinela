import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  Play, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  Clock, Shield, Users, ShieldCheck, Filter, ChevronDown, Activity
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const PROFILE_META = {
  citizen: { label: "Cidadão", icon: Users, color: "text-primary", bg: "bg-primary/10" },
  agent: { label: "Agente", icon: ShieldCheck, color: "text-warning", bg: "bg-warning/10" },
  admin: { label: "Admin", icon: Shield, color: "text-chart-5", bg: "bg-chart-5/10" },
  system: { label: "Sistema", icon: Activity, color: "text-muted-foreground", bg: "bg-muted/40" },
};

const STATUS_META = {
  success: { label: "Sucesso", icon: CheckCircle2, color: "text-success", bg: "bg-success/10", border: "border-success/20" },
  error: { label: "Erro", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30" },
  warning: { label: "Aviso", icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10", border: "border-warning/20" },
};

function RunSummaryCard({ logs }) {
  const total = logs.length;
  const success = logs.filter((l) => l.status === "success").length;
  const errors = logs.filter((l) => l.status === "error").length;
  const critical = logs.filter((l) => l.is_critical).length;
  const avgLatency = total > 0 ? Math.round(logs.reduce((a, b) => a + (b.latency_ms || 0), 0) / total) : 0;
  const healthPct = total > 0 ? Math.round((success / total) * 100) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <div className="bg-card border border-border/60 rounded-xl p-4 text-center">
        <div className="text-2xl font-bold">{total}</div>
        <div className="text-xs text-muted-foreground mt-1">Fluxos Testados</div>
      </div>
      <div className="bg-success/10 border border-success/20 rounded-xl p-4 text-center">
        <div className="text-2xl font-bold text-success">{success}</div>
        <div className="text-xs text-muted-foreground mt-1">Sucessos</div>
      </div>
      <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-center">
        <div className="text-2xl font-bold text-destructive">{errors}</div>
        <div className="text-xs text-muted-foreground mt-1">Erros</div>
      </div>
      <div className={`border rounded-xl p-4 text-center ${critical > 0 ? "bg-destructive/20 border-destructive/40" : "bg-card border-border/60"}`}>
        <div className={`text-2xl font-bold ${critical > 0 ? "text-destructive" : "text-muted-foreground"}`}>{critical}</div>
        <div className="text-xs text-muted-foreground mt-1">Críticos</div>
      </div>
      <div className="bg-card border border-border/60 rounded-xl p-4 text-center">
        <div className={`text-2xl font-bold ${healthPct >= 90 ? "text-success" : healthPct >= 70 ? "text-warning" : "text-destructive"}`}>
          {healthPct}%
        </div>
        <div className="text-xs text-muted-foreground mt-1">Saúde · ~{avgLatency}ms</div>
      </div>
    </div>
  );
}

function LogRow({ log }) {
  const [expanded, setExpanded] = useState(false);
  const sm = STATUS_META[log.status] || STATUS_META.success;
  const pm = PROFILE_META[log.profile] || PROFILE_META.system;
  const SmIcon = sm.icon;
  const PmIcon = pm.icon;

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${log.is_critical ? "border-destructive/50 bg-destructive/5" : `${sm.border} bg-card`}`}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => log.status === "error" && setExpanded((v) => !v)}
      >
        {/* Status Icon */}
        <SmIcon className={`w-4 h-4 flex-shrink-0 ${sm.color}`} />

        {/* Profile Badge */}
        <span className={`inline-flex items-center gap-1 text-[10px] uppercase font-medium px-2 py-0.5 rounded-md ${pm.bg} ${pm.color} flex-shrink-0`}>
          <PmIcon className="w-3 h-3" />
          {pm.label}
        </span>

        {/* Flow Label */}
        <span className="text-sm flex-1 min-w-0 truncate font-medium">{log.flow_label}</span>

        {/* Critical badge */}
        {log.is_critical && (
          <span className="text-[10px] bg-destructive text-white px-2 py-0.5 rounded font-bold flex-shrink-0">CRÍTICO</span>
        )}

        {/* Latency */}
        <span className="text-xs text-muted-foreground font-mono flex-shrink-0">{log.latency_ms ?? "—"}ms</span>

        {/* Timestamp */}
        <span className="text-xs text-muted-foreground hidden md:block flex-shrink-0">
          {log.created_date ? format(new Date(log.created_date), "dd/MM HH:mm:ss") : "—"}
        </span>

        {/* Expand for errors */}
        {log.status === "error" && (
          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
        )}
      </div>

      {expanded && log.error_message && (
        <div className="border-t border-destructive/20 px-4 py-3 bg-destructive/5">
          <p className="text-xs font-semibold text-destructive mb-1">Mensagem de erro:</p>
          <p className="text-xs text-foreground font-mono bg-muted/60 rounded p-2 mb-2">{log.error_message}</p>
          {log.error_payload && (
            <>
              <p className="text-xs font-semibold text-destructive mb-1">Payload:</p>
              <pre className="text-[10px] font-mono bg-muted/60 rounded p-2 overflow-auto max-h-32 whitespace-pre-wrap">
                {(() => { try { return JSON.stringify(JSON.parse(log.error_payload), null, 2); } catch { return log.error_payload; } })()}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function SystemHealthDashboard() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastRunId, setLastRunId] = useState(null);

  // Filters
  const [filterProfile, setFilterProfile] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate, setFilterDate] = useState("");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const data = await base44.entities.SystemHealthLog.list("-created_date", 200);
    setLogs(data);
    if (data.length > 0 && !lastRunId) setLastRunId(data[0].run_id);
    setLoading(false);
  }, [lastRunId]);

  useEffect(() => { loadLogs(); }, []);

  const runCheck = async () => {
    setRunning(true);
    toast.info("Executando checklist de saúde do sistema…");
    const res = await base44.functions.invoke("runSystemHealthCheck", { trigger: "manual" });
    const data = res.data;
    toast.success(`Checklist concluído: ${data.success}/${data.total} fluxos OK`);
    if (data.critical_errors > 0) toast.error(`⚠️ ${data.critical_errors} erro(s) crítico(s) detectado(s)!`);
    setLastRunId(data.run_id);
    await loadLogs();
    setRunning(false);
  };

  // Filtros
  const filteredLogs = logs.filter((l) => {
    if (filterProfile !== "all" && l.profile !== filterProfile) return false;
    if (filterStatus !== "all" && l.status !== filterStatus) return false;
    if (filterDate && l.run_date !== filterDate) return false;
    return true;
  });

  // Logs da última execução
  const latestRunLogs = lastRunId ? logs.filter((l) => l.run_id === lastRunId) : [];

  // Unique run_ids for date filter reference
  const uniqueDates = [...new Set(logs.map((l) => l.run_date).filter(Boolean))].sort().reverse();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Checklist de Saúde do Sistema
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Testes E2E automatizados · Execução diária às 00:05
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={runCheck} disabled={running} className="bg-primary">
            <Play className={`w-3.5 h-3.5 mr-1.5 ${running ? "animate-pulse" : ""}`} />
            {running ? "Executando…" : "Rodar Checklist Agora"}
          </Button>
        </div>
      </div>

      {/* Última execução — resumo */}
      {latestRunLogs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Clock className="w-4 h-4" />
            Última Execução
            {latestRunLogs[0]?.trigger && (
              <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-medium ${latestRunLogs[0].trigger === "cron" ? "bg-primary/10 text-primary" : "bg-chart-5/10 text-chart-5"}`}>
                {latestRunLogs[0].trigger === "cron" ? "Automático (Cron)" : "Manual"}
              </span>
            )}
            {latestRunLogs[0]?.run_started_at && (
              <span className="font-normal text-muted-foreground">
                — {format(new Date(latestRunLogs[0].run_started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
          </div>
          <RunSummaryCard logs={latestRunLogs} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 border-t border-border/40 pt-4">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">Filtrar histórico:</span>

        <select
          value={filterProfile}
          onChange={(e) => setFilterProfile(e.target.value)}
          className="text-xs bg-muted/60 border border-border/60 rounded-lg px-2 py-1.5 text-foreground"
        >
          <option value="all">Todos os perfis</option>
          <option value="citizen">Cidadão</option>
          <option value="agent">Agente</option>
          <option value="admin">Admin</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-xs bg-muted/60 border border-border/60 rounded-lg px-2 py-1.5 text-foreground"
        >
          <option value="all">Todos os status</option>
          <option value="success">Sucesso</option>
          <option value="error">Erro</option>
        </select>

        <select
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="text-xs bg-muted/60 border border-border/60 rounded-lg px-2 py-1.5 text-foreground"
        >
          <option value="">Todas as datas</option>
          {uniqueDates.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {(filterProfile !== "all" || filterStatus !== "all" || filterDate) && (
          <button
            onClick={() => { setFilterProfile("all"); setFilterStatus("all"); setFilterDate(""); }}
            className="text-xs text-primary hover:underline"
          >
            Limpar filtros
          </button>
        )}

        <span className="text-xs text-muted-foreground ml-auto">{filteredLogs.length} registro(s)</span>
      </div>

      {/* Log list */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Carregando logs…</div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {logs.length === 0
              ? "Nenhuma execução registrada. Clique em \"Rodar Checklist Agora\" para iniciar."
              : "Nenhum log para os filtros selecionados."}
          </div>
        ) : (
          filteredLogs.map((log) => <LogRow key={log.id} log={log} />)
        )}
      </div>
    </div>
  );
}
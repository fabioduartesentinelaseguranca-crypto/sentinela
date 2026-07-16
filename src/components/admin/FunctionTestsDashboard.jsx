import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  Play, RefreshCw, CheckCircle2, XCircle, AlertTriangle,
  FlaskConical, ChevronDown, Cpu, Clock, Filter,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const STATUS_META = {
  success: { label: "Passou", icon: CheckCircle2, color: "text-success", bg: "bg-success/10", border: "border-success/20" },
  error: { label: "Falhou", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30" },
  warning: { label: "Pulado", icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10", border: "border-warning/20" },
};

const CATEGORY_COLOR = {
  biometria: "text-primary", despacho: "text-destructive", ocorrencias: "text-warning",
  cidadao: "text-success", defesa_civil: "text-chart-5", escolar: "text-primary",
  documentos: "text-chart-3", inteligencia: "text-chart-5", midia: "text-muted-foreground",
  visao: "text-chart-2", qa: "text-warning", infra: "text-muted-foreground",
};

function SummaryCard({ logs }) {
  const total = logs.length;
  const success = logs.filter((l) => l.status === "success").length;
  const errors = logs.filter((l) => l.status === "error").length;
  const skipped = logs.filter((l) => l.status === "warning").length;
  const critical = logs.filter((l) => l.is_critical).length;
  const avgLatency = total > 0 ? Math.round(logs.reduce((a, b) => a + (b.latency_ms || 0), 0) / total) : 0;
  const healthPct = total > 0 ? Math.round((success / total) * 100) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
      <div className="bg-card border border-border/60 rounded-xl p-4 text-center">
        <div className="text-2xl font-bold">{total}</div>
        <div className="text-xs text-muted-foreground mt-1">Funções</div>
      </div>
      <div className="bg-success/10 border border-success/20 rounded-xl p-4 text-center">
        <div className="text-2xl font-bold text-success">{success}</div>
        <div className="text-xs text-muted-foreground mt-1">Passaram</div>
      </div>
      <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-center">
        <div className="text-2xl font-bold text-destructive">{errors}</div>
        <div className="text-xs text-muted-foreground mt-1">Falharam</div>
      </div>
      <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 text-center">
        <div className="text-2xl font-bold text-warning">{skipped}</div>
        <div className="text-xs text-muted-foreground mt-1">Puladas</div>
      </div>
      <div className={`border rounded-xl p-4 text-center ${critical > 0 ? "bg-destructive/20 border-destructive/40" : "bg-card border-border/60"}`}>
        <div className={`text-2xl font-bold ${critical > 0 ? "text-destructive" : "text-muted-foreground"}`}>{critical}</div>
        <div className="text-xs text-muted-foreground mt-1">Críticos</div>
      </div>
      <div className="bg-card border border-border/60 rounded-xl p-4 text-center">
        <div className={`text-2xl font-bold ${healthPct >= 90 ? "text-success" : healthPct >= 70 ? "text-warning" : "text-destructive"}`}>{healthPct}%</div>
        <div className="text-xs text-muted-foreground mt-1">Saúde · ~{avgLatency}ms</div>
      </div>
    </div>
  );
}

function TestRow({ log }) {
  const [expanded, setExpanded] = useState(false);
  const sm = STATUS_META[log.status] || STATUS_META.success;
  const SmIcon = sm.icon;
  const category = (log.flow_key || "").replace(/^fn_/, "").split(" — ")[0];
  const catColor = CATEGORY_COLOR[(log.flow_label || "").match(/\(([^)]+)\)/)?.[1]?.replace(/.* /, "")] || "text-muted-foreground";

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${log.is_critical ? "border-destructive/50 bg-destructive/5" : `${sm.border} bg-card`}`}>
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => (log.status === "error" || log.status === "warning") && setExpanded((v) => !v)}
      >
        <SmIcon className={`w-4 h-4 flex-shrink-0 ${sm.color}`} />
        <span className="text-sm flex-1 min-w-0 truncate font-medium">{log.flow_label}</span>
        {log.is_critical && (
          <span className="text-[10px] bg-destructive text-white px-2 py-0.5 rounded font-bold flex-shrink-0">CRÍTICO</span>
        )}
        <span className="text-[10px] uppercase text-muted-foreground bg-muted/60 px-2 py-0.5 rounded flex-shrink-0 hidden sm:block">
          {category}
        </span>
        <span className="text-xs text-muted-foreground font-mono flex-shrink-0">{log.latency_ms ?? "—"}ms</span>
        <span className="text-xs text-muted-foreground hidden md:block flex-shrink-0">
          {log.created_date ? format(new Date(log.created_date), "dd/MM HH:mm:ss") : "—"}
        </span>
        {(log.status === "error" || log.status === "warning") && (
          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
        )}
      </div>

      {expanded && (log.error_message || log.error_payload) && (
        <div className={`border-t px-4 py-3 ${log.status === "warning" ? "border-warning/20 bg-warning/5" : "border-destructive/20 bg-destructive/5"}`}>
          {log.error_message && (
            <>
              <p className={`text-xs font-semibold mb-1 ${log.status === "warning" ? "text-warning" : "text-destructive"}`}>
                {log.status === "warning" ? "Motivo do skip:" : "Detalhe da falha:"}
              </p>
              <p className="text-xs text-foreground font-mono bg-muted/60 rounded p-2 mb-2">{log.error_message}</p>
            </>
          )}
          {log.error_payload && (
            <>
              <p className="text-xs font-semibold text-destructive mb-1">Payload do erro:</p>
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

export default function FunctionTestsDashboard() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastRunId, setLastRunId] = useState(null);
  const [filterStatus, setFilterStatus] = useState("all");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const all = await base44.entities.SystemHealthLog.list("-created_date", 300);
      const fnLogs = all.filter((l) => (l.flow_key || "").startsWith("fn_"));
      setLogs(fnLogs);
      if (fnLogs.length > 0 && !lastRunId) setLastRunId(fnLogs[0].run_id);
    } catch { /* */ }
    setLoading(false);
  }, [lastRunId]);

  useEffect(() => { loadLogs(); }, []);

  const runTests = async () => {
    setRunning(true);
    toast.info("Executando testes automatizados de todas as funções…");
    try {
      const res = await base44.functions.invoke("runFunctionTests", {});
      const d = res.data;
      toast.success(`Testes concluídos: ${d.success}/${d.total} passaram · ${d.errors} falhas · ${d.skipped} puladas`);
      if (d.critical_errors > 0) toast.error(`⚠️ ${d.critical_errors} falha(s) crítica(s) detectada(s)!`);
      setLastRunId(d.run_id);
      await loadLogs();
    } catch (e) {
      toast.error("Erro ao executar testes: " + (e?.message || e));
    }
    setRunning(false);
  };

  const latestRunLogs = lastRunId ? logs.filter((l) => l.run_id === lastRunId) : [];
  const filteredLogs = logs.filter((l) => filterStatus === "all" || l.status === filterStatus);
  const uniqueDates = [...new Set(logs.map((l) => l.run_date).filter(Boolean))].sort().reverse();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FlaskConical className="w-5 h-5 text-primary" />
            Testes Automatizados de Funções
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5" /> Smoke tests de todas as {logs.length > 0 ? Math.max(...Object.values(logs.reduce((a, l) => { (a[l.run_id] = a[l.run_id] || []).push(l); return a; }, {})).map((arr) => arr.length)) : 19} funções de backend
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadLogs} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={runTests} disabled={running} className="bg-primary">
            <Play className={`w-3.5 h-3.5 mr-1.5 ${running ? "animate-pulse" : ""}`} />
            {running ? "Executando…" : "Rodar Testes de Funções"}
          </Button>
        </div>
      </div>

      {latestRunLogs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <Clock className="w-4 h-4" />
            Última Execução
            {latestRunLogs[0]?.run_started_at && (
              <span className="font-normal">
                — {format(new Date(latestRunLogs[0].run_started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </span>
            )}
          </div>
          <SummaryCard logs={latestRunLogs} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 border-t border-border/40 pt-4">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">Filtrar:</span>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-xs bg-muted/60 border border-border/60 rounded-lg px-2 py-1.5 text-foreground"
        >
          <option value="all">Todos os status</option>
          <option value="success">Passou</option>
          <option value="error">Falhou</option>
          <option value="warning">Pulado</option>
        </select>
        {filterStatus !== "all" && (
          <button onClick={() => setFilterStatus("all")} className="text-xs text-primary hover:underline">Limpar</button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{filteredLogs.length} registro(s)</span>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Carregando resultados…</div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {logs.length === 0
              ? "Nenhum teste executado. Clique em \"Rodar Testes de Funções\" para iniciar."
              : "Nenhum registro para o filtro selecionado."}
          </div>
        ) : (
          filteredLogs.map((log) => <TestRow key={log.id} log={log} />)
        )}
      </div>
    </div>
  );
}
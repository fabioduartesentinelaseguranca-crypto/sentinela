import { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Flame, Activity, Bug, Clock, Play, ChevronDown, ChevronUp, ShieldCheck, AlertTriangle, XCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const ETAPA_LABELS = {
  geracao_dados: "Geração de Dados",
  criacao_agentes: "Criação de Agentes",
  criacao_ocorrencias: "Criação de Ocorrências",
  checkin_agentes: "Check-in de Agentes",
  checklist_viaturas: "Checklist de Viaturas",
  checklist_equipamentos: "Checklist Equipamentos",
  checklist_psicologico: "Checklist Psicológico",
  radio_tatico: "Rádio Tático",
  botao_panico_audio_video: "Botão de Pânico c/ Áudio/Vídeo",
  cercas_geograficas: "Cercas Geográficas",
  postes_iluminacao: "Postes de Iluminação",
  cameras: "Câmeras de Vigilância",
  perfis_medicos: "Perfis Médicos",
  denuncias_anonimas: "Denúncias Anônimas",
  triagem_ia: "Triagem IA (Claude Sonnet)",
  atribuicao_agente: "Atribuição ao Agente",
  analises_preditivas: "Análises Preditivas",
  feedback_cidadaos: "Feedback de Cidadãos",
  progressao_status: "Progressão de Status",
  finalizacao: "Finalização",
  health_check: "Health Check",
};

const STATUS_ICON = {
  success: CheckCircle2,
  error: XCircle,
  timeout: AlertTriangle,
  skipped: Clock,
};

const STATUS_COLOR = {
  success: "text-success",
  error: "text-destructive",
  timeout: "text-warning",
  skipped: "text-muted-foreground",
};

const STATUS_BG = {
  success: "bg-success/10",
  error: "bg-destructive/10",
  timeout: "bg-warning/10",
  skipped: "bg-muted/20",
};

export default function QaEstressePanel() {
  const [logs, setLogs] = useState([]);
  const [execucoes, setExecucoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [expandedBugs, setExpandedBugs] = useState({});

  const load = useCallback(async () => {
    try {
      const allLogs = await base44.entities.Logs_Auditoria_QA.list("-data_execucao", 200);
      setLogs(allLogs);

      const execMap = {};
      for (const l of allLogs) {
        if (!execMap[l.execucao_id]) execMap[l.execucao_id] = [];
        execMap[l.execucao_id].push(l);
      }
      setExecucoes(Object.entries(execMap).sort((a, b) => b[0].localeCompare(a[0])));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const disparar = async () => {
    setRunning(true);
    toast.info("🔥 Disparando simulação de estresse...");
    try {
      const res = await base44.functions.invoke("simulacaoEstresseQA", {});
      toast.success(`Simulação concluída! ${res.data?.ocorrencias || "?"} ocorrências processadas.`);
      await load();
    } catch (e) {
      toast.error("Erro na simulação: " + (e.response?.data?.error || e.message));
    } finally {
      setRunning(false);
    }
  };

  // ── Cálculos ────────────────────────────
  const ultimaExecucao = execucoes[0];
  const logsUltima = ultimaExecucao?.[1] || [];

  const totalEtapas = logsUltima.length;
  const sucessos = logsUltima.filter((l) => l.status === "success").length;
  const erros = logsUltima.filter((l) => l.status === "error" || l.status === "timeout").length;
  const saudePct = totalEtapas > 0 ? Math.round((sucessos / totalEtapas) * 100) : null;

  const bugs = logsUltima.filter((l) => l.status === "error" || l.status === "timeout");

  // ── Gargalos por etapa ──────────────────
  const etapaMap = {};
  for (const l of logsUltima) {
    if (!etapaMap[l.etapa]) etapaMap[l.etapa] = { tempos: [], erros: 0, total: 0 };
    etapaMap[l.etapa].total++;
    if (l.tempo_ms) etapaMap[l.etapa].tempos.push(l.tempo_ms);
    if (l.status === "error" || l.status === "timeout") etapaMap[l.etapa].erros++;
  }

  const gargalos = Object.entries(etapaMap).map(([etapa, d]) => ({
    etapa,
    label: ETAPA_LABELS[etapa] || etapa,
    tempoMedio: d.tempos.length > 0 ? Math.round(d.tempos.reduce((s, v) => s + v, 0) / d.tempos.length) : 0,
    erros: d.erros,
    total: d.total,
  }));

  const toggleBug = (idx) => setExpandedBugs((prev) => ({ ...prev, [idx]: !prev[idx] }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header + botão disparar ───────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Flame className="w-5 h-5 text-destructive" /> QA & Estresse
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">Auditoria de ponta a ponta do fluxo de atendimento Sentinela</p>
        </div>
        <Button
          size="lg"
          onClick={disparar}
          disabled={running}
          className="gap-2 animate-pulse hover:animate-none"
        >
          {running ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Executando...</>
          ) : (
            <><Flame className="w-4 h-4" /> Disparar Simulação de Estresse e Auditoria de Bugs Agora</>
          )}
        </Button>
      </div>

      {/* ── Barra de saúde ────────────────────────────── */}
      {saudePct !== null && (
        <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" /> Saúde do Sistema
            </h3>
            <Badge variant={saudePct >= 95 ? "default" : saudePct >= 80 ? "secondary" : "destructive"}
              className="text-sm px-3">
              {saudePct}%
            </Badge>
          </div>
          <Progress
            value={saudePct}
            className={`h-3 ${saudePct >= 95 ? "[&>div]:bg-success" : saudePct >= 80 ? "[&>div]:bg-warning" : "[&>div]:bg-destructive"}`}
          />
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-success" /> {sucessos} sucessos</span>
            {erros > 0 && <span className="flex items-center gap-1"><XCircle className="w-3.5 h-3.5 text-destructive" /> {erros} falhas</span>}
            <span className="flex items-center gap-1"><Activity className="w-3.5 h-3.5" /> {logsUltima.length} etapas</span>
          </div>
        </div>
      )}

      {/* ── Última execução: timeline ─────────────────── */}
      {ultimaExecucao && (
        <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Linha do Tempo da Última Execução
          </h3>
          <p className="text-xs text-muted-foreground font-mono">ID: {ultimaExecucao[0]}</p>

          <div className="space-y-2">
            {logsUltima.map((l, i) => {
              const Icon = STATUS_ICON[l.status] || Activity;
              return (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                  <div className={`w-8 h-8 rounded-lg ${STATUS_BG[l.status] || "bg-muted"} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <Icon className={`w-4 h-4 ${STATUS_COLOR[l.status] || "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{ETAPA_LABELS[l.etapa] || l.etapa}</span>
                      <Badge variant="outline" className="text-[10px]">{l.status}</Badge>
                      {l.tempo_ms && <span className="text-[11px] text-muted-foreground font-mono">{l.tempo_ms}ms</span>}
                    </div>
                    {l.detalhe && <p className="text-xs text-muted-foreground mt-0.5">{l.detalhe}</p>}
                    {l.error_message && (
                      <p className="text-xs text-destructive mt-1 font-mono bg-destructive/5 p-2 rounded border border-destructive/20 break-all">
                        {l.error_message}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Mapa de calor de gargalos ─────────────────── */}
      {gargalos.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
          <h3 className="font-semibold flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" /> Mapa de Calor de Gargalos
          </h3>
          <div className="space-y-3">
            {gargalos.map((g) => {
              const nivel = g.tempoMedio > 3000 ? "alto" : g.tempoMedio > 1500 ? "medio" : "baixo";
              const barra = nivel === "alto" ? "bg-destructive" : nivel === "medio" ? "bg-warning" : "bg-success";
              return (
                <div key={g.etapa} className="flex items-center gap-3">
                  <span className="w-36 text-sm truncate">{g.label}</span>
                  <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${barra} rounded-full transition-all`}
                      style={{ width: `${Math.min(100, (g.tempoMedio / 5000) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground font-mono w-14 text-right">{g.tempoMedio}ms</span>
                  <Badge variant="outline" className={`text-[10px] ${
                    nivel === "alto" ? "border-destructive/50 text-destructive" : nivel === "medio" ? "border-warning/50 text-warning" : "border-success/50 text-success"
                  }`}>
                    {nivel}
                  </Badge>
                  {g.erros > 0 && (
                    <span className="text-[10px] text-destructive font-mono">{g.erros} erro(s)</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Lista de bugs ─────────────────────────────── */}
      {bugs.length > 0 ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 space-y-4">
          <h3 className="font-semibold flex items-center gap-2 text-destructive">
            <Bug className="w-4 h-4" /> Bugs Encontrados ({bugs.length})
          </h3>
          <div className="space-y-2">
            {bugs.map((b, i) => (
              <div key={i} className="rounded-lg border border-destructive/20 bg-card p-3">
                <button
                  onClick={() => toggleBug(i)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <div className="flex items-center gap-2">
                    <Bug className="w-3.5 h-3.5 text-destructive" />
                    <span className="text-sm font-medium">{ETAPA_LABELS[b.etapa] || b.etapa}</span>
                    <Badge variant="destructive" className="text-[10px]">{b.status}</Badge>
                  </div>
                  {expandedBugs[i] ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                {expandedBugs[i] && (
                  <div className="mt-2 pl-7 space-y-1">
                    {b.error_message && (
                      <p className="text-xs text-destructive font-mono bg-destructive/5 p-2 rounded border border-destructive/20 break-all whitespace-pre-wrap">
                        {b.error_message}
                      </p>
                    )}
                    {b.error_details && (
                      <p className="text-[11px] text-muted-foreground font-mono bg-muted/50 p-2 rounded break-all whitespace-pre-wrap">
                        {b.error_details}
                      </p>
                    )}
                    {b.detalhe && <p className="text-xs text-muted-foreground">{b.detalhe}</p>}
                    <p className="text-[11px] text-muted-foreground font-mono">{b.data_execucao ? new Date(b.data_execucao).toLocaleString("pt-BR") : ""}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : ultimaExecucao && (
        <div className="rounded-2xl border border-success/30 bg-success/5 p-5 text-center">
          <CheckCircle2 className="w-8 h-8 text-success mx-auto mb-2" />
          <p className="text-sm font-medium text-success">Nenhum bug encontrado na última execução!</p>
        </div>
      )}

      {/* ── Sem execuções ─────────────────────────────── */}
      {!ultimaExecucao && (
        <div className="rounded-2xl border border-border/60 bg-card p-10 text-center space-y-3">
          <Activity className="w-12 h-12 text-muted-foreground mx-auto opacity-40" />
          <p className="text-muted-foreground">Nenhuma simulação de QA executada ainda.</p>
          <p className="text-xs text-muted-foreground">Clique no botão acima para disparar a primeira auditoria de estresse.</p>
        </div>
      )}
    </div>
  );
}
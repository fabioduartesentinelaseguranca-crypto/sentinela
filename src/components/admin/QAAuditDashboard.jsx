import { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Zap, Activity, Clock, AlertTriangle, CheckCircle2, XCircle, Timer, Bug, RefreshCw, TrendingUp } from "lucide-react";
import { toast } from "sonner";

const ETAPA_LABELS = {
  geracao_dados: "Geração de Agentes Teste",
  criacao_ocorrencias: "Criação de Ocorrências",
  triagem_ia: "Triagem IA (Superagent)",
  atribuicao_agente: "Atribuição de Agentes",
  progressao_status: "Progressão DESPACHADO→FINALIZADO",
  finalizacao: "Finalização",
  health_check: "Health Check Final",
};

export default function QAAuditDashboard() {
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [logs, setLogs] = useState([]);
  const [ultimaExecucao, setUltimaExecucao] = useState(null);
  const [healthPercent, setHealthPercent] = useState(null);
  const [gargalos, setGargalos] = useState([]);
  const [bugs, setBugs] = useState([]);
  const [resumoEtapas, setResumoEtapas] = useState([]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const todos = await base44.entities.Logs_Auditoria_QA.list("-data_execucao", 200);

      if (todos.length === 0) {
        setUltimaExecucao(null);
        setHealthPercent(null);
        setGargalos([]);
        setBugs([]);
        setResumoEtapas([]);
        setLogs([]);
        setLoading(false);
        return;
      }

      // Agrupar por execucao_id
      const porExecucao = {};
      for (const log of todos) {
        if (!porExecucao[log.execucao_id]) porExecucao[log.execucao_id] = [];
        porExecucao[log.execucao_id].push(log);
      }

      const execucoesIds = Object.keys(porExecucao).sort((a, b) => {
        const ta = porExecucao[a][0]?.data_execucao || '';
        const tb = porExecucao[b][0]?.data_execucao || '';
        return tb.localeCompare(ta);
      });

      const ultimaId = execucoesIds[0];
      const ultima = porExecucao[ultimaId] || [];
      setUltimaExecucao({ id: ultimaId, logs: ultima });

      // Calcular health
      const sucessos = ultima.filter(l => l.status === 'success').length;
      const total = ultima.length;
      const pct = total > 0 ? Math.round((sucessos / total) * 100) : 0;
      setHealthPercent(pct);

      // Gargalos: etapas mais lentas por tipo
      const porEtapa = {};
      for (const log of ultima) {
        if (!porEtapa[log.etapa]) porEtapa[log.etapa] = [];
        porEtapa[log.etapa].push(log);
      }

      const gargaloData = Object.entries(porEtapa).map(([etapa, items]) => {
        const tempos = items.filter(i => i.tempo_ms).map(i => i.tempo_ms);
        const erroCount = items.filter(i => i.status === 'error').length;
        return {
          etapa,
          label: ETAPA_LABELS[etapa] || etapa,
          tempo_medio: tempos.length > 0 ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : 0,
          tempo_max: tempos.length > 0 ? Math.max(...tempos) : 0,
          total: items.length,
          erros: erroCount,
          sucessos: items.filter(i => i.status === 'success').length,
        };
      }).sort((a, b) => b.tempo_medio - a.tempo_medio);
      setGargalos(gargaloData);

      // Bugs: todos os erros
      const bugsList = todos
        .filter(l => l.status === 'error')
        .sort((a, b) => (b.data_execucao || '').localeCompare(a.data_execucao || ''))
        .slice(0, 20);
      setBugs(bugsList);

      // Resumo etapas para a barra
      setResumoEtapas(gargaloData);
      setLogs(todos);
    } catch (e) {
      toast.error("Erro ao carregar dados de auditoria");
    }
    setLoading(false);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const dispararSimulacao = async () => {
    setSimulating(true);
    toast.info("🔥 Iniciando simulação de estresse...", { duration: 3000 });
    try {
      const res = await base44.functions.invoke('simulacaoEstresseQA', {});
      const data = res.data;
      toast.success(`Simulação concluída! Saúde: ${data.health_percent}%`, { duration: 6000 });
      await carregar();
    } catch (e) {
      toast.error(`Falha na simulação: ${e.response?.data?.error || e.message}`);
    }
    setSimulating(false);
  };

  const tempoMax = gargalos.length > 0 ? Math.max(...gargalos.map(g => g.tempo_max), 1) : 1;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── BOTÃO DE FORÇA ─────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 text-warning" /> Auditoria QA & Testes de Estresse
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Simulação E2E automatizada — triagem, despacho e progressão de ocorrências.
          </p>
        </div>
        <Button
          size="lg"
          onClick={dispararSimulacao}
          disabled={simulating}
          className="bg-emergency hover:bg-emergency/90 text-white font-bold text-base px-6 py-5 rounded-xl shadow-lg shadow-emergency/30 animate-pulse hover:animate-none transition-all"
        >
          {simulating ? (
            <><RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Executando simulação...</>
          ) : (
            <><Zap className="w-5 h-5 mr-2" /> 🔥 Disparar Simulação de Estresse e Auditoria de Bugs Agora</>
          )}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : !ultimaExecucao ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-3">
            <Bug className="w-12 h-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">Nenhuma auditoria executada ainda.</p>
            <p className="text-xs text-muted-foreground">Clique no botão acima para disparar a primeira simulação de estresse.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ── INDICADOR DE SAÚDE ────────────── */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Indicador de Saúde do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Estabilidade</span>
                    <span className={`text-2xl font-bold font-mono ${
                      healthPercent >= 95 ? 'text-success' :
                      healthPercent >= 80 ? 'text-warning' : 'text-destructive'
                    }`}>{healthPercent}%</span>
                  </div>
                  <Progress
                    value={healthPercent}
                    className={`h-3 ${
                      healthPercent >= 95 ? '[&>div]:bg-success' :
                      healthPercent >= 80 ? '[&>div]:bg-warning' : '[&>div]:bg-destructive'
                    }`}
                  />
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <div>Execução: {ultimaExecucao.id.slice(0, 12)}...</div>
                  <div>{new Date(ultimaExecucao.logs[0]?.data_execucao).toLocaleString('pt-BR')}</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                {resumoEtapas.map((e) => (
                  <div key={e.etapa} className="flex items-center gap-1.5 text-xs">
                    {e.erros > 0 ? (
                      <XCircle className="w-3.5 h-3.5 text-destructive" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                    )}
                    <span className="text-muted-foreground">{e.label}</span>
                    <Badge variant={e.erros > 0 ? "destructive" : "outline"} className="text-[10px] px-1.5 py-0">
                      {e.erros > 0 ? `${e.erros} erro(s)` : 'OK'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── MAPA DE CALOR DE GARGALOS ─────── */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Timer className="w-5 h-5 text-warning" />
                Mapa de Calor de Gargalos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {gargalos.map((g) => {
                  const pctBarra = Math.round((g.tempo_max / tempoMax) * 100);
                  const nivel = g.tempo_max > 3000 ? 'alto' : g.tempo_max > 1000 ? 'medio' : 'baixo';
                  return (
                    <div key={g.etapa} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className={`w-3.5 h-3.5 ${
                            nivel === 'alto' ? 'text-destructive' :
                            nivel === 'medio' ? 'text-warning' : 'text-success'
                          }`} />
                          <span className="font-medium">{g.label}</span>
                          {g.erros > 0 && (
                            <Badge variant="destructive" className="text-[10px] px-1 py-0">{g.erros} erro(s)</Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">
                          máx {g.tempo_max}ms · méd {g.tempo_medio}ms · {g.total} testes
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            nivel === 'alto' ? 'bg-destructive' :
                            nivel === 'medio' ? 'bg-warning' : 'bg-success'
                          }`}
                          style={{ width: `${pctBarra}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {gargalos.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado de gargalo disponível.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── LISTA DE BUGS EM POTENCIAL ────── */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Bug className="w-5 h-5 text-destructive" />
                Bugs em Potencial
                <Badge variant="destructive" className="ml-1">{bugs.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bugs.length === 0 ? (
                <div className="text-center py-6 space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-success mx-auto" />
                  <p className="text-sm text-muted-foreground">Nenhum bug detectado nas últimas execuções!</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin">
                  {bugs.map((bug, idx) => (
                    <div key={bug.id || idx} className="p-4 rounded-xl bg-destructive/5 border border-destructive/20 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-destructive truncate">
                              {ETAPA_LABELS[bug.etapa] || bug.etapa}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {bug.detalhe || bug.error_message || 'Erro não detalhado'}
                            </div>
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">
                          {new Date(bug.data_execucao).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      {bug.error_details && (
                        <details className="text-[11px]">
                          <summary className="text-muted-foreground cursor-pointer hover:text-foreground">
                            Stack trace
                          </summary>
                          <pre className="mt-1 p-2 bg-muted/50 rounded text-[10px] text-muted-foreground overflow-x-auto whitespace-pre-wrap">
                            {bug.error_details}
                          </pre>
                        </details>
                      )}
                      {bug.ocorrencia_id && (
                        <div className="text-[10px] text-muted-foreground">
                          Ocorrência: <code className="bg-muted px-1 rounded">{bug.ocorrencia_id.slice(0, 12)}...</code>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── LINHA DO TEMPO DA ÚLTIMA EXECUÇÃO ── */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Linha do Tempo — Última Execução
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative pl-6 border-l-2 border-border/60 space-y-3">
                {ultimaExecucao.logs
                  .filter(l => l.etapa !== 'health_check')
                  .map((log, idx) => (
                    <div key={idx} className="relative">
                      <div className={`absolute -left-[25px] w-3 h-3 rounded-full border-2 border-background ${
                        log.status === 'success' ? 'bg-success' : 'bg-destructive'
                      }`} />
                      <div className="text-sm">
                        <span className="font-medium">{ETAPA_LABELS[log.etapa] || log.etapa}</span>
                        <span className="text-muted-foreground ml-2">— {log.detalhe}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant={log.status === 'success' ? 'outline' : 'destructive'} className="text-[10px]">
                          {log.status === 'success' ? '✓ OK' : '✗ ERRO'}
                        </Badge>
                        {log.tempo_ms && (
                          <span className="text-[10px] text-muted-foreground font-mono">{log.tempo_ms}ms</span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
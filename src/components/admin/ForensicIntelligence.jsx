import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Brain, Loader2, MapPin, Clock, TrendingUp,
  AlertTriangle, Target, Calendar, BarChart2, RefreshCw
} from "lucide-react";
import { format, subDays, parseISO } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6"];

export default function ForensicIntelligence() {
  const [occurrences, setOccurrences] = useState([]);
  const [tips, setTips] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState("30");

  const load = async () => {
    const since = subDays(new Date(), +period);
    const [occs, anon] = await Promise.all([
      base44.entities.Occurrence.list("-created_date", 500),
      base44.entities.AnonymousTip.list("-created_date", 300),
    ]);
    setOccurrences(occs.filter((o) => { try { return parseISO(o.created_date) >= since; } catch { return true; } }));
    setTips(anon.filter((t) => { try { return parseISO(t.created_date) >= since; } catch { return true; } }));
  };

  useEffect(() => { load(); }, [period]);

  // Local stats
  const hourDist = Array.from({ length: 24 }, (_, h) => ({
    hour: `${String(h).padStart(2, "0")}h`,
    count: occurrences.filter((o) => { try { return parseISO(o.created_date).getHours() === h; } catch { return false; } }).length,
  }));

  const typeDist = Object.entries(
    occurrences.reduce((acc, o) => { acc[o.type] = (acc[o.type] || 0) + 1; return acc; }, {})
  ).map(([name, value]) => ({ name, value }));

  const hotHours = [...hourDist].sort((a, b) => b.count - a.count).slice(0, 3).map((h) => h.hour);

  const runAIAnalysis = async () => {
    if (occurrences.length === 0) return;
    setLoading(true);
    setAnalysis(null);

    const sample = occurrences.slice(0, 80).map((o) => ({
      type: o.type,
      subtype: o.subtype,
      address: o.address,
      hour: (() => { try { return parseISO(o.created_date).getHours(); } catch { return null; } })(),
      day: (() => { try { return format(parseISO(o.created_date), "EEE"); } catch { return null; } })(),
      lat: o.lat,
      lng: o.lng,
      status: o.status,
    }));

    const tipSample = tips.slice(0, 40).map((t) => ({
      category: t.category,
      address: t.address,
      description: t.description?.slice(0, 100),
    }));

    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um analista forense de segurança pública com expertise em criminologia e análise de padrões.

DADOS: Últimos ${period} dias
OCORRÊNCIAS (${sample.length} registros): ${JSON.stringify(sample)}
DENÚNCIAS ANÔNIMAS (${tipSample.length} registros): ${JSON.stringify(tipSample)}

Realize uma análise forense profunda e retorne:
1. Padrões temporais: horários e dias de maior incidência
2. Padrões geográficos: endereços/regiões com maior concentração
3. Padrões por tipo de crime: crimes mais frequentes e correlações
4. Previsão: próximos 7 dias, quais locais/horários têm maior probabilidade de incidente
5. Sugestões de operações preventivas: local, horário, tipo de ação e justificativa
6. Crimes correlacionados: padrões que sugerem mesmos autores ou grupos

Seja específico, técnico e acionável. Use os dados reais fornecidos.`,
        model: "claude_sonnet_4_6",
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            temporal_patterns: {
              type: "array",
              items: { type: "object", properties: { pattern: { type: "string" }, frequency: { type: "string" }, confidence: { type: "string" } } }
            },
            geographic_hotspots: {
              type: "array",
              items: { type: "object", properties: { location: { type: "string" }, crime_types: { type: "array", items: { type: "string" } }, risk_level: { type: "string" }, lat: { type: "number" }, lng: { type: "number" } } }
            },
            predicted_incidents: {
              type: "array",
              items: { type: "object", properties: { date: { type: "string" }, time_window: { type: "string" }, location: { type: "string" }, crime_type: { type: "string" }, probability: { type: "string" } } }
            },
            recommended_operations: {
              type: "array",
              items: { type: "object", properties: { location: { type: "string" }, schedule: { type: "string" }, type: { type: "string" }, priority: { type: "string" }, justification: { type: "string" } } }
            },
            correlated_crimes: { type: "array", items: { type: "string" } },
            risk_index: { type: "number" },
          }
        }
      });
      setAnalysis(result);
    } catch (e) {
      alert("Erro na análise. Tente novamente.");
    }
    setLoading(false);
  };

  const RISK_COLOR = (r) => r >= 8 ? "text-destructive" : r >= 5 ? "text-warning" : "text-success";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-xl">Inteligência Forense</h2>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="w-4 h-4" /></Button>
          <Button onClick={runAIAnalysis} disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analisando com IA...</> : <><Brain className="w-4 h-4 mr-2" /> Análise Forense IA</>}
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Ocorrências", value: occurrences.length, icon: AlertTriangle, color: "text-warning" },
          { label: "Denúncias anônimas", value: tips.length, icon: Target, color: "text-primary" },
          { label: "Horários críticos", value: hotHours.join(", "), icon: Clock, color: "text-destructive" },
          { label: "Tipos distintos", value: typeDist.length, icon: BarChart2, color: "text-success" },
        ].map((s, i) => (
          <div key={i} className="rounded-xl border border-border/60 bg-card p-4">
            <s.icon className={`w-4 h-4 ${s.color} mb-1`} />
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="font-bold text-sm mt-0.5">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Clock className="w-4 h-4 text-primary" /> Distribuição por Horário</h3>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={hourDist} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={3} />
              <YAxis tick={{ fontSize: 9 }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><BarChart2 className="w-4 h-4 text-primary" /> Por Tipo</h3>
          {typeDist.length === 0 ? (
            <div className="flex items-center justify-center h-[140px] text-sm text-muted-foreground">Sem dados</div>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={typeDist} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={9}>
                  {typeDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* AI Analysis results */}
      {loading && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-8 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
          <p className="text-sm font-medium">Processando análise forense com IA avançada...</p>
          <p className="text-xs text-muted-foreground">Identificando padrões, correlações e previsões. Aguarde.</p>
        </div>
      )}

      {analysis && (
        <div className="space-y-4 animate-fade-in">
          {/* Summary & Risk Index */}
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1">
                <h3 className="font-semibold mb-2 flex items-center gap-2"><Brain className="w-4 h-4 text-primary" /> Resumo Forense</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{analysis.summary}</p>
              </div>
              {analysis.risk_index !== undefined && (
                <div className="text-center p-3 rounded-xl bg-muted/30 border border-border/40 min-w-[80px]">
                  <div className={`text-3xl font-black ${RISK_COLOR(analysis.risk_index)}`}>{analysis.risk_index}</div>
                  <div className="text-[10px] text-muted-foreground">Índice de Risco</div>
                  <div className="text-[10px] text-muted-foreground">/10</div>
                </div>
              )}
            </div>
          </div>

          {/* Hotspots */}
          {analysis.geographic_hotspots?.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><MapPin className="w-4 h-4 text-destructive" /> Hotspots Geográficos</h3>
              <div className="space-y-2">
                {analysis.geographic_hotspots.map((h, i) => (
                  <div key={i} className={`p-3 rounded-xl border text-sm ${h.risk_level === "crítico" || h.risk_level === "alto" ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-medium">{h.location}</span>
                      <span className={`text-xs font-bold uppercase ${h.risk_level === "crítico" || h.risk_level === "alto" ? "text-destructive" : "text-warning"}`}>{h.risk_level}</span>
                    </div>
                    {h.crime_types?.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {h.crime_types.map((c, j) => <span key={j} className="text-[10px] bg-muted/50 px-1.5 py-0.5 rounded">{c}</span>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Temporal Patterns */}
          {analysis.temporal_patterns?.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-warning" /> Padrões Temporais</h3>
              <div className="space-y-2">
                {analysis.temporal_patterns.map((p, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border/40 text-sm">
                    <div className="flex-1">{p.pattern}</div>
                    <div className="flex gap-2 flex-shrink-0">
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">{p.frequency}</span>
                      <span className="text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded">{p.confidence}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Predicted incidents */}
          {analysis.predicted_incidents?.length > 0 && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-destructive"><TrendingUp className="w-4 h-4" /> Previsão dos Próximos 7 Dias</h3>
              <div className="space-y-2">
                {analysis.predicted_incidents.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/60 text-sm">
                    <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium">{p.location}</div>
                      <div className="text-xs text-muted-foreground">{p.date} · {p.time_window} · {p.crime_type}</div>
                    </div>
                    <span className="text-xs font-bold text-destructive">{p.probability}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommended Operations */}
          {analysis.recommended_operations?.length > 0 && (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
              <h3 className="font-semibold mb-3 flex items-center gap-2 text-primary"><Target className="w-4 h-4" /> Operações Preventivas Recomendadas</h3>
              <div className="space-y-3">
                {analysis.recommended_operations.map((op, i) => (
                  <div key={i} className="p-3 rounded-xl bg-card border border-border/60">
                    <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-sm">{op.location}</span>
                      <div className="flex gap-1">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${op.priority === "alta" || op.priority === "crítica" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"}`}>{op.priority}</span>
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{op.type}</span>
                      </div>
                    </div>
                    <div className="text-xs text-primary font-medium">{op.schedule}</div>
                    <div className="text-xs text-muted-foreground mt-1">{op.justification}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Correlated crimes */}
          {analysis.correlated_crimes?.length > 0 && (
            <div className="rounded-2xl border border-border/60 bg-card p-5">
              <h3 className="font-semibold mb-3 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-warning" /> Crimes Correlacionados (possíveis autores/grupos)</h3>
              <div className="space-y-1">
                {analysis.correlated_crimes.map((c, i) => (
                  <div key={i} className="text-sm p-2 rounded-lg bg-muted/20 border border-border/30">{c}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
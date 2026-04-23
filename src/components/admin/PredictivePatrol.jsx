import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Brain, MapPin, Clock, RefreshCw, AlertTriangle, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TYPE_META } from "@/lib/occurrenceMeta";

const RISK_COLOR = {
  high: "border-destructive/50 bg-destructive/5 text-destructive",
  medium: "border-warning/50 bg-warning/5 text-warning",
  low: "border-success/50 bg-success/5 text-success",
};

export default function PredictivePatrol({ occurrences = [] }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  const generate = async () => {
    setLoading(true);
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.toLocaleDateString("pt-BR", { weekday: "long" });

    // Summarize historical data for the LLM
    const recentOccs = occurrences.slice(0, 200);
    const summary = recentOccs.map((o) => ({
      type: o.type,
      subtype: o.subtype,
      address: o.address,
      hour: o.created_date ? new Date(o.created_date).getHours() : null,
      lat: o.lat,
      lng: o.lng,
    }));

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Você é um sistema de análise preditiva de segurança pública. Com base no histórico de ocorrências a seguir, gere recomendações de patrulhamento para os próximos turnos.

Hora atual: ${hour}h
Dia da semana: ${dayOfWeek}
Total de ocorrências no histórico: ${recentOccs.length}
Histórico resumido: ${JSON.stringify(summary.slice(0, 80))}

Analise padrões de horário, tipo de ocorrência e localização. Considere que turnos são manhã (06-14h), tarde (14-22h) e noite (22-06h).
Gere entre 3 e 5 recomendações de áreas/tipos prioritários para os próximos turnos.`,
      response_json_schema: {
        type: "object",
        properties: {
          recommendations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                area: { type: "string", description: "Nome da área ou endereço genérico" },
                shift: { type: "string", description: "Turno: manhã, tarde ou noite" },
                risk_level: { type: "string", description: "high, medium ou low" },
                primary_type: { type: "string", description: "Tipo principal de ocorrência esperada" },
                reason: { type: "string", description: "Justificativa baseada nos dados" },
                suggested_action: { type: "string", description: "Ação recomendada ao agente" },
              },
            },
          },
          summary: { type: "string", description: "Resumo geral da análise em 2 frases" },
        },
      },
    });

    setRecommendations(result.recommendations || []);
    setGenerated(true);
    setLoading(false);
  };

  const shiftIcon = (shift) => {
    if (shift?.includes("manhã")) return "🌅";
    if (shift?.includes("tarde")) return "☀️";
    return "🌙";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          <div>
            <h3 className="font-semibold text-sm">Análise Preditiva de Patrulhamento</h3>
            <p className="text-xs text-muted-foreground">IA cruza histórico + horário para sugerir áreas prioritárias</p>
          </div>
        </div>
        <Button size="sm" onClick={generate} disabled={loading}>
          {loading ? <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Brain className="w-3.5 h-3.5 mr-1.5" />}
          {generated ? "Atualizar análise" : "Gerar recomendações"}
        </Button>
      </div>

      {!generated && !loading && (
        <div className="p-8 rounded-2xl border border-dashed border-border/60 text-center text-sm text-muted-foreground">
          Clique em "Gerar recomendações" para que a IA analise o histórico de ocorrências e sugira áreas prioritárias para o próximo turno.
        </div>
      )}

      {loading && (
        <div className="p-8 rounded-2xl border border-border/60 bg-card text-center space-y-2">
          <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Analisando histórico de {occurrences.length} ocorrências...</p>
        </div>
      )}

      {generated && !loading && recommendations.length > 0 && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {recommendations.map((rec, i) => (
            <div key={i} className={`p-4 rounded-2xl border space-y-2.5 ${RISK_COLOR[rec.risk_level] || RISK_COLOR.medium}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 font-semibold text-sm">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="line-clamp-1">{rec.area}</span>
                </div>
                <span className="text-lg flex-shrink-0">{shiftIcon(rec.shift)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs opacity-80">
                <Clock className="w-3 h-3" />
                <span>{rec.shift}</span>
                {rec.primary_type && (
                  <>
                    <span>·</span>
                    <span>{TYPE_META[rec.primary_type]?.label || rec.primary_type}</span>
                  </>
                )}
              </div>
              <p className="text-xs opacity-90 leading-relaxed">{rec.reason}</p>
              {rec.suggested_action && (
                <div className="text-xs font-medium flex items-start gap-1.5 pt-1 border-t border-current/20">
                  <TrendingUp className="w-3 h-3 flex-shrink-0 mt-0.5" />
                  {rec.suggested_action}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Calendar, CheckCircle2, Plus, Users, MapPin } from "lucide-react";
import { toast } from "sonner";
import { format, addDays, parseISO, differenceInMinutes } from "date-fns";

const SHIFT_CFG = {
  morning: { label: "Manhã", time: "06:00–14:00", color: "bg-amber-500/20 text-amber-300 border-amber-500/40" },
  afternoon: { label: "Tarde", time: "14:00–22:00", color: "bg-blue-500/20 text-blue-300 border-blue-500/40" },
  night: { label: "Noite", time: "22:00–06:00", color: "bg-purple-500/20 text-purple-300 border-purple-500/40" },
};

export default function SmartShiftAllocator({ agents = [] }) {
  const [occurrences, setOccurrences] = useState([]);
  const [zones, setZones] = useState([]);
  const [existingShifts, setExistingShifts] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [daysAhead, setDaysAhead] = useState("7");

  const load = async () => {
    const [occs, zns, shifts] = await Promise.all([
      base44.entities.Occurrence.filter({ status: "resolved" }, "-created_date", 300),
      base44.entities.PatrolZone.list("created_date", 50),
      base44.entities.ScheduledShift.list("-created_date", 200),
    ]);
    setOccurrences(occs);
    setZones(zns);
    setExistingShifts(shifts);
  };

  useEffect(() => { load(); }, []);

  // Calculate per-agent productivity score
  const calcAgentScore = (agentId) => {
    const resolved = occurrences.filter((o) => o.assigned_agent_id === agentId && o.status === "resolved");
    const timed = resolved.filter((o) => o.updated_date && o.created_date);
    const avgMin = timed.length
      ? timed.reduce((a, o) => a + Math.abs(differenceInMinutes(parseISO(o.updated_date), parseISO(o.created_date))), 0) / timed.length
      : 99;
    return { resolved: resolved.length, avgMin: +avgMin.toFixed(0), score: resolved.length * 10 - Math.min(avgMin, 60) };
  };

  // Detect hotspot zones by occurrence density
  const getHotZoneShift = () => {
    const shiftCount = { morning: 0, afternoon: 0, night: 0 };
    occurrences.forEach((o) => {
      try {
        const h = parseISO(o.created_date).getHours();
        if (h >= 6 && h < 14) shiftCount.morning++;
        else if (h >= 14 && h < 22) shiftCount.afternoon++;
        else shiftCount.night++;
      } catch {}
    });
    return Object.entries(shiftCount).sort((a, b) => b[1] - a[1]).map(([k]) => k);
  };

  const generateSuggestions = async () => {
    setLoading(true);
    setSuggestions([]);

    const agentScores = agents.map((a) => ({ ...a, ...calcAgentScore(a.id) })).sort((a, b) => b.score - a.score);
    const hotShifts = getHotZoneShift();

    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um sistema inteligente de alocação de turnos policiais.

AGENTES DISPONÍVEIS (ordenados por produtividade):
${agentScores.map((a) => `- ${a.full_name}: ${a.resolved} ocorrências resolvidas, tempo médio ${a.avgMin}min, score ${a.score.toFixed(0)}`).join("\n")}

TURNOS COM MAIOR DEMANDA (histórico):
${hotShifts.map((s, i) => `${i + 1}º mais crítico: ${s}`).join(", ")}

ZONAS DE PATRULHA:
${zones.map((z) => `- ${z.name} (lat:${z.lat}, lng:${z.lng})`).join("\n") || "Nenhuma zona cadastrada"}

PERÍODO SOLICITADO: próximos ${daysAhead} dias
DATA INICIAL: ${format(new Date(), "yyyy-MM-dd")}

Gere uma escala otimizada para os próximos ${daysAhead} dias que:
1. Aloca agentes de maior produtividade nos turnos de maior demanda
2. Distribui os agentes equilibradamente (máx 1 turno/dia por agente)
3. Cobre as zonas mais críticas

Retorne APENAS um array JSON com objetos de escala:`,
        response_json_schema: {
          type: "object",
          properties: {
            shifts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  agent_id: { type: "string" },
                  agent_name: { type: "string" },
                  date: { type: "string" },
                  shift_type: { type: "string" },
                  zone_name: { type: "string" },
                  reason: { type: "string" },
                }
              }
            },
            summary: { type: "string" },
          }
        }
      });

      setSuggestions(result.shifts || []);
      toast.success(`${result.shifts?.length || 0} sugestões geradas pela IA`);
    } catch (e) {
      toast.error("Erro ao gerar sugestões");
    }
    setLoading(false);
  };

  const applyAll = async () => {
    if (!suggestions.length) return;
    setSaving(true);
    let saved = 0;
    for (const s of suggestions) {
      const agent = agents.find((a) => a.full_name === s.agent_name || a.id === s.agent_id);
      if (!agent) continue;
      const zone = zones.find((z) => z.name === s.zone_name);
      await base44.entities.ScheduledShift.create({
        agent_id: agent.id,
        agent_name: agent.full_name,
        date: s.date,
        shift_type: s.shift_type || "morning",
        zone_id: zone?.id || "",
        zone_name: s.zone_name || "",
        notes: s.reason || "Gerado automaticamente por IA",
      });
      saved++;
    }
    toast.success(`${saved} escalas salvas!`);
    setSaving(false);
    setSuggestions([]);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="font-bold text-xl">Alocação Inteligente de Turnos</h2>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={daysAhead} onValueChange={setDaysAhead}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Próximos 3 dias</SelectItem>
              <SelectItem value="7">Próximos 7 dias</SelectItem>
              <SelectItem value="14">Próximas 2 semanas</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={generateSuggestions} disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando...</> : <><Sparkles className="w-4 h-4 mr-2" /> Gerar Sugestões</>}
          </Button>
        </div>
      </div>

      {/* Agent productivity overview */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Produtividade dos Agentes</h3>
        <div className="space-y-2">
          {agents.slice(0, 6).map((a) => {
            const s = calcAgentScore(a.id);
            return (
              <div key={a.id} className="flex items-center gap-3 text-sm">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                  {a.full_name?.charAt(0)}
                </div>
                <span className="flex-1 truncate font-medium">{a.full_name}</span>
                <span className="text-xs text-muted-foreground">{s.resolved} res.</span>
                <span className="text-xs text-muted-foreground">{s.avgMin}min avg</span>
                <div className="w-16 h-1.5 bg-muted rounded-full">
                  <div className="h-1.5 bg-primary rounded-full" style={{ width: `${Math.min(100, (s.score / 200) * 100)}%` }} />
                </div>
              </div>
            );
          })}
          {agents.length === 0 && <div className="text-xs text-muted-foreground">Nenhum agente cadastrado.</div>}
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> {suggestions.length} sugestões da IA</h3>
            <Button size="sm" onClick={applyAll} disabled={saving}>
              {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Salvando...</> : <><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Aplicar Todas</>}
            </Button>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {suggestions.map((s, i) => {
              const cfg = SHIFT_CFG[s.shift_type] || SHIFT_CFG.morning;
              return (
                <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/60 text-sm">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${cfg.color}`}>{cfg.label}</span>
                  <span className="font-medium flex-1">{s.agent_name}</span>
                  <span className="text-xs text-muted-foreground font-mono">{s.date}</span>
                  {s.zone_name && (
                    <span className="text-xs text-muted-foreground flex items-center gap-0.5"><MapPin className="w-3 h-3" />{s.zone_name}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
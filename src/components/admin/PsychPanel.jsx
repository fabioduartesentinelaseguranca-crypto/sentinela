import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Brain, AlertCircle, CheckCircle2, User, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const MOOD_LABEL = { critical: "Crítico", bad: "Ruim", neutral: "Regular", good: "Bem", great: "Ótimo" };
const MOOD_COLOR = { critical: "text-destructive", bad: "text-orange-400", neutral: "text-warning", good: "text-success", great: "text-primary" };

function EvalCard({ ev, onReview }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={`rounded-xl border p-4 space-y-3 ${ev.is_critical ? "border-destructive/40 bg-destructive/5" : "border-border/60 bg-card"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {ev.is_critical
            ? <AlertCircle className="w-4 h-4 text-destructive" />
            : <User className="w-4 h-4 text-muted-foreground" />}
          <div>
            <div className="font-medium text-sm">{ev.agent_name}</div>
            <div className="text-[11px] text-muted-foreground">
              {format(new Date(ev.created_date), "dd 'de' MMMM, HH:mm", { locale: ptBR })}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {ev.is_critical && !ev.reviewed_by && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-destructive/20 text-destructive">Não revisado</span>
          )}
          {ev.reviewed_by && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-success/20 text-success flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Revisado
            </span>
          )}
          <button onClick={() => setExpanded(!expanded)} className="text-muted-foreground hover:text-foreground">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center text-xs">
        <div className="bg-muted/50 rounded-lg p-2">
          <div className="text-muted-foreground mb-0.5">Estresse</div>
          <div className={`font-bold text-base ${ev.stress_level >= 8 ? "text-destructive" : ev.stress_level >= 5 ? "text-warning" : "text-success"}`}>
            {ev.stress_level}/10
          </div>
        </div>
        <div className="bg-muted/50 rounded-lg p-2">
          <div className="text-muted-foreground mb-0.5">Cansaço</div>
          <div className={`font-bold text-base ${ev.fatigue_level >= 8 ? "text-destructive" : ev.fatigue_level >= 5 ? "text-warning" : "text-success"}`}>
            {ev.fatigue_level}/10
          </div>
        </div>
        <div className="bg-muted/50 rounded-lg p-2">
          <div className="text-muted-foreground mb-0.5">Humor</div>
          <div className={`font-bold text-sm ${MOOD_COLOR[ev.mood]}`}>{MOOD_LABEL[ev.mood]}</div>
        </div>
      </div>

      {expanded && (
        <div className="space-y-2 text-sm border-t border-border/40 pt-3">
          <div><span className="text-muted-foreground">Sono:</span> <span className="font-medium">{ev.sleep_hours}h</span></div>
          {ev.panic_triggers?.length > 0 && (
            <div>
              <span className="text-muted-foreground">Gatilhos:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {ev.panic_triggers.map((t) => (
                  <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">{t}</span>
                ))}
              </div>
            </div>
          )}
          {ev.notes && (
            <div>
              <span className="text-muted-foreground">Relato:</span>
              <p className="mt-1 text-muted-foreground italic">"{ev.notes}"</p>
            </div>
          )}
          {ev.is_critical && !ev.reviewed_by && (
            <Button size="sm" className="w-full mt-2" onClick={() => onReview(ev)}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Marcar como revisado
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function PsychPanel() {
  const [evals, setEvals] = useState([]);
  const [filter, setFilter] = useState("critical");

  const load = async () => {
    const data = await base44.entities.PsychEvaluation.list("-created_date", 200);
    setEvals(data);
  };

  useEffect(() => { load(); }, []);

  const handleReview = async (ev) => {
    await base44.entities.PsychEvaluation.update(ev.id, { reviewed_by: "psychologist" });
    load();
  };

  const filtered = filter === "critical"
    ? evals.filter((e) => e.is_critical)
    : filter === "unreviewed"
    ? evals.filter((e) => e.is_critical && !e.reviewed_by)
    : evals;

  const criticalCount = evals.filter((e) => e.is_critical && !e.reviewed_by).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" /> Painel Psicológico
          {criticalCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/20 text-destructive font-medium">
              {criticalCount} crítico{criticalCount > 1 ? "s" : ""} pendente{criticalCount > 1 ? "s" : ""}
            </span>
          )}
        </h2>
        <div className="flex gap-1 text-xs">
          {[
            { key: "critical", label: "Críticos" },
            { key: "unreviewed", label: "Não revisados" },
            { key: "all", label: "Todos" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg border font-medium transition-colors ${filter === f.key ? "bg-primary/15 text-primary border-primary/30" : "border-border/60 text-muted-foreground hover:text-foreground"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm border border-dashed rounded-2xl">
          Nenhuma avaliação encontrada.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ev) => (
            <EvalCard key={ev.id} ev={ev} onReview={handleReview} />
          ))}
        </div>
      )}
    </div>
  );
}
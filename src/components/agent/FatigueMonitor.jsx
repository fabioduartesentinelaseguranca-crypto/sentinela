import { useEffect, useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, Coffee, Clock, Brain, X, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { differenceInMinutes, differenceInHours } from "date-fns";
import { toast } from "sonner";

const BREAK_THRESHOLD_HOURS = 4;    // suggest break after 4h
const CRITICAL_HOURS = 8;           // critical after 8h no break
const FATIGUE_THRESHOLD = 7;        // psych eval fatigue >= 7
const STRESS_THRESHOLD = 7;         // psych eval stress >= 7

export default function FatigueMonitor({ agentId, agentName, activeShift, onOpenPsych }) {
  const [status, setStatus] = useState(null); // null | 'warning' | 'critical'
  const [shiftHours, setShiftHours] = useState(0);
  const [lastEval, setLastEval] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [alertSent, setAlertSent] = useState(false);
  const checkRef = useRef(null);

  const check = async () => {
    if (!agentId || !activeShift?.start_time) return;

    const hoursOn = differenceInHours(new Date(), new Date(activeShift.start_time));
    setShiftHours(hoursOn);

    // Fetch latest psych eval
    const evals = await base44.entities.PsychEvaluation.filter(
      { agent_id: agentId }, "-created_date", 1
    );
    const latest = evals[0] || null;
    setLastEval(latest);

    const highFatigue = latest && (latest.fatigue_level >= FATIGUE_THRESHOLD || latest.stress_level >= STRESS_THRESHOLD);
    const longShift = hoursOn >= CRITICAL_HOURS;
    const warnShift = hoursOn >= BREAK_THRESHOLD_HOURS;

    if (longShift || (highFatigue && hoursOn >= 2)) {
      setStatus("critical");
      if (!alertSent) {
        setAlertSent(true);
        // Notify admin
        base44.integrations.Core.SendEmail({
          to: "admin@sentinela.gov.br",
          subject: `⚠️ Monitor de Fadiga — ${agentName}`,
          body: `O agente ${agentName} está em alerta de fadiga crítica.\n\nTurno ativo há: ${hoursOn}h\nÚltima avaliação psicológica:\n- Estresse: ${latest?.stress_level ?? "—"}/10\n- Cansaço: ${latest?.fatigue_level ?? "—"}/10\n- Humor: ${latest?.mood ?? "—"}\n\nRecomendação: contato imediato e avaliação de afastamento temporário.`,
        }).catch(() => {});
        // SystemLog
        base44.entities.SystemLog.create({
          event: "fatigue_critical",
          actor_id: agentId,
          actor_name: agentName,
          details: `Turno: ${hoursOn}h | Fadiga: ${latest?.fatigue_level}/10 | Estresse: ${latest?.stress_level}/10`,
          severity: "critical",
        }).catch(() => {});
      }
    } else if (warnShift || highFatigue) {
      setStatus("warning");
    } else {
      setStatus(null);
      setDismissed(false);
    }
  };

  useEffect(() => {
    if (!agentId || !activeShift) return;
    check();
    checkRef.current = setInterval(check, 5 * 60 * 1000); // every 5 min
    return () => clearInterval(checkRef.current);
  }, [agentId, activeShift?.id]);

  if (!status || dismissed || !activeShift) return null;

  const isCritical = status === "critical";

  return (
    <div className={`rounded-2xl border p-4 ${isCritical ? "border-destructive/50 bg-destructive/8" : "border-warning/50 bg-warning/8"} animate-fade-in`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isCritical ? "bg-destructive/20" : "bg-warning/20"}`}>
            {isCritical ? <AlertTriangle className="w-5 h-5 text-destructive" /> : <Coffee className="w-5 h-5 text-warning" />}
          </div>
          <div>
            <div className={`font-semibold text-sm ${isCritical ? "text-destructive" : "text-warning"}`}>
              {isCritical ? "⚠️ Fadiga Crítica Detectada" : "Sugestão de Pausa"}
            </div>
            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                Turno ativo há <span className="font-medium">{shiftHours}h</span>
                {isCritical && " — limite crítico atingido"}
              </div>
              {lastEval && (lastEval.fatigue_level >= FATIGUE_THRESHOLD || lastEval.stress_level >= STRESS_THRESHOLD) && (
                <div className="flex items-center gap-1.5">
                  <Brain className="w-3 h-3" />
                  Última avaliação: estresse {lastEval.stress_level}/10 · fadiga {lastEval.fatigue_level}/10
                </div>
              )}
            </div>
            {isCritical && (
              <div className="text-xs text-destructive mt-1.5 font-medium">
                Administrador notificado. Pausa obrigatória recomendada.
              </div>
            )}
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex gap-2 mt-3">
        <Button
          size="sm"
          variant="outline"
          className={`text-xs ${isCritical ? "border-destructive/40 hover:bg-destructive/10" : "border-warning/40 hover:bg-warning/10"}`}
          onClick={() => { setDismissed(true); toast.info("Pausa registrada. Cuide-se!"); }}
        >
          <Coffee className="w-3.5 h-3.5 mr-1.5" /> Registrar Pausa
        </Button>
        {onOpenPsych && (
          <Button
            size="sm"
            variant="outline"
            className="text-xs border-primary/40 hover:bg-primary/10"
            onClick={onOpenPsych}
          >
            <Brain className="w-3.5 h-3.5 mr-1.5" /> Autoavaliação
          </Button>
        )}
      </div>
    </div>
  );
}
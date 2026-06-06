import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Brain, Clock, AlertTriangle, CheckCircle2, RefreshCw, Coffee, ShieldAlert, BellRing } from "lucide-react";
import { useFatigueAlerts } from "@/hooks/useFatigueAlerts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { format, differenceInHours, differenceInMinutes, parseISO } from "date-fns";

const RISK_LEVELS = {
  ok: { label: "OK", color: "text-success", bg: "bg-success/10 border-success/30", icon: CheckCircle2 },
  warning: { label: "Atenção", color: "text-warning", bg: "bg-warning/10 border-warning/30", icon: AlertTriangle },
  critical: { label: "Crítico", color: "text-destructive", bg: "bg-destructive/10 border-destructive/30", icon: ShieldAlert },
};

function calcRisk(shift, evalData) {
  if (!shift) return "ok";
  const shiftStart = shift.start_time
    ? parseISO(`${shift.date}T${shift.start_time}`)
    : parseISO(shift.created_date);
  const hoursOnDuty = differenceInHours(new Date(), shiftStart);

  let score = 0;

  // Shift duration risk
  if (hoursOnDuty >= 14) score += 3;
  else if (hoursOnDuty >= 10) score += 2;
  else if (hoursOnDuty >= 8) score += 1;

  // Psych eval risk
  if (evalData) {
    if (evalData.fatigue_level >= 8) score += 3;
    else if (evalData.fatigue_level >= 6) score += 2;
    else if (evalData.fatigue_level >= 4) score += 1;

    if (evalData.stress_level >= 8) score += 2;
    else if (evalData.stress_level >= 6) score += 1;

    if (evalData.sleep_hours <= 4) score += 2;
    else if (evalData.sleep_hours <= 6) score += 1;

    if (evalData.mood === "critical") score += 3;
    else if (evalData.mood === "bad") score += 1;
  }

  if (score >= 6) return "critical";
  if (score >= 3) return "warning";
  return "ok";
}

export default function FatigueRiskPanel() {
  const [agents, setAgents] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [evals, setEvals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [fatigueAlerts, setFatigueAlerts] = useState([]);

  useFatigueAlerts({
    enabled: true,
    onAlert: (info) => {
      setFatigueAlerts((prev) => {
        if (prev.some((a) => a.agentId === info.agentId)) return prev;
        return [info, ...prev];
      });
      toast.warning(`⚠ Fadiga: ${info.agentName} atingiu ${info.fatiguePercent}% do limite`, {
        description: `${info.hoursOnDuty}h em turno · Supervisor notificado`,
        duration: 8000,
        icon: <BellRing className="w-4 h-4" />,
      });
    },
  });

  const load = async () => {
    setLoading(true);
    const today = format(new Date(), "yyyy-MM-dd");
    const [users, todayShifts, recentEvals] = await Promise.all([
      base44.entities.User.list(),
      base44.entities.Shift.filter({ status: "active" }),
      base44.entities.PsychEvaluation.list("-created_date", 100),
    ]);
    setAgents(users.filter((u) => u.role === "agent"));
    setShifts(todayShifts);
    setEvals(recentEvals);
    setLastRefresh(new Date());
    setLoading(false);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(interval);
  }, []);

  // Build per-agent risk data
  const agentRisks = agents.map((agent) => {
    const shift = shifts.find((s) => s.agent_id === agent.id);
    const latestEval = evals.find((e) => e.agent_id === agent.id);
    const risk = calcRisk(shift, latestEval);

    const shiftDuration = shift?.start_time
      ? differenceInHours(new Date(), parseISO(`${shift.date || format(new Date(),"yyyy-MM-dd")}T${shift.start_time}`))
      : null;

    return { agent, shift, latestEval, risk, shiftDuration };
  }).filter((r) => r.shift); // only show agents on active shifts

  const critical = agentRisks.filter((r) => r.risk === "critical");
  const warning = agentRisks.filter((r) => r.risk === "warning");
  const ok = agentRisks.filter((r) => r.risk === "ok");

  return (
    <div className="space-y-4">
      {/* Fatigue alert banner */}
      {fatigueAlerts.length > 0 && (
        <div className="rounded-xl border border-warning/50 bg-warning/5 p-4">
          <h3 className="text-sm font-semibold text-warning flex items-center gap-2 mb-2">
            <BellRing className="w-4 h-4" /> Alertas automáticos de fadiga ≥80%
          </h3>
          <div className="space-y-1.5">
            {fatigueAlerts.map((a) => (
              <div key={a.agentId} className="flex items-center gap-3 text-sm bg-background rounded-lg px-3 py-2 border border-warning/20">
                <span className="font-medium">{a.agentName}</span>
                <span className="text-warning text-xs">{a.fatiguePercent}% do limite</span>
                <span className="text-muted-foreground text-xs">{a.hoursOnDuty}h em turno</span>
                <button className="ml-auto text-xs text-muted-foreground hover:text-foreground" onClick={() => setFatigueAlerts((p) => p.filter((x) => x.agentId !== a.agentId))}>✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" /> Painel de Risco de Fadiga
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cruzamento automático: tempo de turno × avaliação psicológica
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-xs text-muted-foreground">
              Atualizado às {format(lastRefresh, "HH:mm")}
            </span>
          )}
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-center">
          <div className="text-2xl font-bold text-destructive">{critical.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Críticos</div>
          <div className="text-[10px] text-destructive mt-0.5">Pausa obrigatória</div>
        </div>
        <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 text-center">
          <div className="text-2xl font-bold text-warning">{warning.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Em atenção</div>
          <div className="text-[10px] text-warning mt-0.5">Monitorar</div>
        </div>
        <div className="rounded-xl border border-success/30 bg-success/5 p-4 text-center">
          <div className="text-2xl font-bold text-success">{ok.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Normais</div>
          <div className="text-[10px] text-success mt-0.5">Operacionais</div>
        </div>
      </div>

      {/* Critical alerts */}
      {critical.length > 0 && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-destructive flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4" /> PAUSA OBRIGATÓRIA RECOMENDADA
          </h3>
          {critical.map(({ agent, shift, latestEval, shiftDuration }) => (
            <div key={agent.id} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-background border border-destructive/30">
              <div className="flex-1">
                <div className="font-medium text-sm">{agent.full_name}</div>
                <div className="flex flex-wrap gap-2 mt-1">
                  {shiftDuration !== null && (
                    <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" /> {shiftDuration}h em turno
                    </span>
                  )}
                  {latestEval && (
                    <>
                      <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">
                        Fadiga: {latestEval.fatigue_level}/10
                      </span>
                      <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">
                        Estresse: {latestEval.stress_level}/10
                      </span>
                      {latestEval.sleep_hours && (
                        <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">
                          Sono: {latestEval.sleep_hours}h
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-destructive font-medium">
                <Coffee className="w-3.5 h-3.5" /> Descanso imediato
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Warning list */}
      {warning.length > 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/5 p-4 space-y-2">
          <h3 className="text-sm font-semibold text-warning flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> Agentes em Monitoramento
          </h3>
          {warning.map(({ agent, shiftDuration, latestEval }) => (
            <div key={agent.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-background border border-warning/20">
              <div className="flex-1">
                <span className="text-sm font-medium">{agent.full_name}</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {shiftDuration !== null && (
                    <span className="text-[10px] text-warning bg-warning/10 px-1.5 py-0.5 rounded">
                      {shiftDuration}h em serviço
                    </span>
                  )}
                  {latestEval && (
                    <span className="text-[10px] text-warning bg-warning/10 px-1.5 py-0.5 rounded">
                      Fadiga: {latestEval.fatigue_level}/10
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {agentRisks.length === 0 && !loading && (
        <div className="text-center py-10 text-muted-foreground text-sm">
          Nenhum agente com turno ativo no momento.
        </div>
      )}
    </div>
  );
}
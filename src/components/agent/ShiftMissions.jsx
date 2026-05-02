import { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Target, Trophy, Clock, CheckCircle2, Star, Zap, RefreshCw, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { differenceInMinutes, addHours, format, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const MISSION_POOL = [
  { key: "resolve_3", title: "Resposta Rápida", description: "Resolva 3 ocorrências neste turno", type: "resolve", target: 3, reward_points: 80, reward_badge: "🎯", icon: Target },
  { key: "checklist_clean", title: "Viatura Impecável", description: "Complete 1 checklist sem itens críticos reprovados", type: "checklist", target: 1, reward_points: 50, reward_badge: "🚗", icon: CheckCircle2 },
  { key: "resolve_1_fast", title: "Primeiro Respondente", description: "Assuma e resolva 1 ocorrência em até 20 minutos", type: "response_time", target: 20, reward_points: 100, reward_badge: "⚡", icon: Zap },
  { key: "resolve_5", title: "Centurião do Turno", description: "Resolva 5 ocorrências em um único turno", type: "resolve", target: 5, reward_points: 150, reward_badge: "🛡️", icon: Trophy },
  { key: "patrol_full", title: "Ronda Completa", description: "Registre localização em 3 zonas de patrulha distintas", type: "patrol_zone", target: 3, reward_points: 70, reward_badge: "🗺️", icon: Target },
  { key: "feedback_4", title: "Campeão da Comunidade", description: "Receba 1 avaliação 4★ ou mais neste turno", type: "feedback", target: 1, reward_points: 60, reward_badge: "⭐", icon: Star },
];

function pickRandomMissions(n = 3) {
  const shuffled = [...MISSION_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function TimeLeft({ expiresAt }) {
  const [left, setLeft] = useState("");
  useEffect(() => {
    const update = () => {
      const min = differenceInMinutes(new Date(expiresAt), new Date());
      if (min <= 0) { setLeft("Expirada"); return; }
      const h = Math.floor(min / 60), m = min % 60;
      setLeft(h > 0 ? `${h}h ${m}min` : `${m}min`);
    };
    update();
    const id = setInterval(update, 30000);
    return () => clearInterval(id);
  }, [expiresAt]);
  const min = differenceInMinutes(new Date(expiresAt), new Date());
  return (
    <span className={`text-[11px] font-mono ${min <= 30 ? "text-warning" : "text-muted-foreground"}`}>
      <Clock className="w-3 h-3 inline mr-0.5" /> {left}
    </span>
  );
}

export default function ShiftMissions({ agentId, agentName, shiftId, occurrences = [] }) {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    if (!agentId || !shiftId) return;
    const existing = await base44.entities.ShiftMission.filter({ agent_id: agentId, shift_id: shiftId }, "-created_date", 10);
    setMissions(existing);
    setLoading(false);
  }, [agentId, shiftId]);

  useEffect(() => { load(); }, [load]);

  // Auto-update progress based on occurrences
  useEffect(() => {
    if (!missions.length || !occurrences.length) return;
    missions.forEach(async (m) => {
      if (m.completed || isPast(new Date(m.expires_at))) return;
      let newProgress = m.progress;

      if (m.type === "resolve") {
        const resolved = occurrences.filter(
          (o) => o.assigned_agent_id === agentId && o.status === "resolved" && new Date(o.updated_date) >= new Date(m.created_date)
        ).length;
        newProgress = resolved;
      } else if (m.type === "checklist") {
        const cls = await base44.entities.VehicleChecklist.filter({ agent_id: agentId, status: "approved" }, "-created_date", 20);
        const sinceStart = cls.filter((c) => new Date(c.created_date) >= new Date(m.created_date)).length;
        newProgress = sinceStart;
      } else if (m.type === "response_time") {
        const fast = occurrences.filter((o) => {
          if (o.assigned_agent_id !== agentId || o.status !== "resolved") return false;
          const min = differenceInMinutes(new Date(o.updated_date), new Date(o.created_date));
          return min > 0 && min <= m.target && new Date(o.updated_date) >= new Date(m.created_date);
        }).length;
        newProgress = fast;
        if (fast >= 1) { newProgress = 1; }
      }

      if (newProgress !== m.progress) {
        const completed = newProgress >= m.target;
        await base44.entities.ShiftMission.update(m.id, {
          progress: newProgress,
          completed,
          completed_at: completed ? new Date().toISOString() : undefined,
        });
        if (completed && !m.completed) {
          // Award points
          const users = await base44.entities.User.filter({ id: agentId });
          if (users[0]) {
            await base44.entities.User.update(users[0].id, { points: (users[0].points || 0) + m.reward_points });
            await base44.entities.PointsLog.create({
              user_id: agentId, user_name: agentName,
              points: m.reward_points, reason: `Missão concluída: ${m.title}`,
            }).catch(() => {});
          }
          toast.success(`🎉 Missão concluída: "${m.title}" +${m.reward_points} pts`);
        }
        load();
      }
    });
  }, [occurrences, missions, agentId]);

  const generateMissions = async () => {
    if (!agentId || !shiftId) return;
    setGenerating(true);
    const pool = pickRandomMissions(3);
    const expiresAt = addHours(new Date(), 8).toISOString();
    for (const m of pool) {
      await base44.entities.ShiftMission.create({
        agent_id: agentId, agent_name: agentName, shift_id: shiftId,
        mission_key: m.key, title: m.title, description: m.description,
        type: m.type, target: m.target, reward_points: m.reward_points,
        reward_badge: m.reward_badge, expires_at: expiresAt, progress: 0, completed: false,
      });
    }
    toast.success("3 novas missões geradas para este turno!");
    setGenerating(false);
    load();
  };

  const active = missions.filter((m) => !m.completed && !isPast(new Date(m.expires_at)));
  const done = missions.filter((m) => m.completed);
  const expired = missions.filter((m) => !m.completed && isPast(new Date(m.expires_at)));
  const hasAny = missions.length > 0;

  if (loading) return null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Missões do Turno</h3>
          {done.length > 0 && (
            <span className="text-xs bg-success/15 text-success px-2 py-0.5 rounded-full border border-success/30">
              {done.length} concluída{done.length > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {!hasAny && (
          <Button size="sm" variant="outline" onClick={generateMissions} disabled={generating} className="text-xs h-7">
            {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Gift className="w-3.5 h-3.5 mr-1" />}
            {generating ? "" : "Gerar Missões"}
          </Button>
        )}
      </div>

      {!hasAny ? (
        <div className="text-center py-6 border border-dashed border-border/40 rounded-xl">
          <Target className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Nenhuma missão ativa.</p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">Inicie o turno e gere missões para ganhar pontos extras!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...active, ...done, ...expired].map((m) => {
            const poolDef = MISSION_POOL.find((p) => p.key === m.mission_key);
            const Icon = poolDef?.icon || Target;
            const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
            const isExpired = !m.completed && isPast(new Date(m.expires_at));
            return (
              <div
                key={m.id}
                className={`rounded-xl border p-3 transition-all ${m.completed ? "border-success/40 bg-success/5" : isExpired ? "border-border/30 opacity-50" : "border-border/60 bg-muted/20"}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{m.reward_badge}</span>
                    <div>
                      <div className={`text-sm font-medium ${m.completed ? "text-success" : ""}`}>
                        {m.title}
                        {m.completed && " ✓"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{m.description}</div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className={`text-xs font-bold font-mono ${m.completed ? "text-success" : "text-primary"}`}>
                      +{m.reward_points} pts
                    </div>
                    {!m.completed && !isExpired && <TimeLeft expiresAt={m.expires_at} />}
                    {isExpired && <span className="text-[11px] text-muted-foreground">Expirada</span>}
                  </div>
                </div>

                {/* Progress bar */}
                {!m.completed && (
                  <div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>{m.progress}/{m.target}</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isExpired ? "bg-muted" : "bg-primary"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
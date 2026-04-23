import { useMemo } from "react";
import { Trophy, Star, Clock, CheckCircle2 } from "lucide-react";
import { differenceInMinutes } from "date-fns";

const MEDALS = [
  { id: "speed_demon", label: "Velocista", icon: "⚡", desc: "T. médio < 10 min" },
  { id: "centurion", label: "Centurião", icon: "🛡️", desc: "100+ resolvidas" },
  { id: "top_rated", label: "Mais Bem Avaliado", icon: "⭐", desc: "Média ≥ 4.5 ★" },
  { id: "faithful", label: "Dedicado", icon: "🎖️", desc: "50+ resolvidas" },
  { id: "first_responder", label: "Primeiro a Responder", icon: "🚀", desc: "10+ assumidas" },
];

export default function AgentMedalCard({ agentId, occurrences = [], feedbacks = [] }) {
  const stats = useMemo(() => {
    const resolved = occurrences.filter((o) => o.assigned_agent_id === agentId && o.status === "resolved");
    const assigned = occurrences.filter((o) => o.assigned_agent_id === agentId);
    const times = resolved
      .filter((o) => o.updated_date && o.created_date)
      .map((o) => differenceInMinutes(new Date(o.updated_date), new Date(o.created_date)))
      .filter((t) => t > 0 && t < 600);
    const avgTime = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
    const agentFeedbacks = feedbacks.filter((f) => f.agent_id === agentId);
    const avgRating = agentFeedbacks.length
      ? agentFeedbacks.reduce((a, b) => a + (b.rating || 0), 0) / agentFeedbacks.length
      : 0;

    const medals = [];
    if (avgTime > 0 && avgTime < 10) medals.push("speed_demon");
    if (resolved.length >= 100) medals.push("centurion");
    if (resolved.length >= 50) medals.push("faithful");
    if (avgRating >= 4.5) medals.push("top_rated");
    if (assigned.length >= 10) medals.push("first_responder");

    const score = (resolved.length * 10) + Math.max(0, 60 - avgTime) * 2 + (avgRating * 10);

    return { resolved: resolved.length, assigned: assigned.length, avgTime, avgRating, medals, score };
  }, [agentId, occurrences, feedbacks]);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4 text-yellow-400" />
        <h3 className="font-semibold text-sm">Meu Desempenho</h3>
        <span className="ml-auto font-bold text-yellow-400 font-mono text-lg">{Math.round(stats.score)} pts</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-muted/40 p-3">
          <CheckCircle2 className="w-4 h-4 text-success mx-auto mb-1" />
          <div className="text-xl font-bold text-success">{stats.resolved}</div>
          <div className="text-[10px] text-muted-foreground">Resolvidas</div>
        </div>
        <div className="rounded-xl bg-muted/40 p-3">
          <Clock className="w-4 h-4 text-primary mx-auto mb-1" />
          <div className="text-xl font-bold text-primary">{stats.avgTime || "—"}</div>
          <div className="text-[10px] text-muted-foreground">Min. médio</div>
        </div>
        <div className="rounded-xl bg-muted/40 p-3">
          <Star className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
          <div className="text-xl font-bold text-yellow-400">{stats.avgRating ? stats.avgRating.toFixed(1) : "—"}</div>
          <div className="text-[10px] text-muted-foreground">Avaliação</div>
        </div>
      </div>

      <div>
        <div className="text-xs font-medium text-muted-foreground mb-2">Medalhas conquistadas</div>
        <div className="flex flex-wrap gap-2">
          {MEDALS.map((m) => {
            const earned = stats.medals.includes(m.id);
            return (
              <div
                key={m.id}
                title={m.desc}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all ${earned ? "border-yellow-400/40 bg-yellow-400/10 text-foreground" : "border-border/40 bg-muted/30 text-muted-foreground opacity-40 grayscale"}`}
              >
                <span className="text-base">{m.icon}</span>
                <span className="font-medium">{m.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
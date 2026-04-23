import { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Trophy, Medal, Star, Zap, Clock, ThumbsUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { differenceInMinutes } from "date-fns";
import { toast } from "sonner";

const MEDALS = [
  { id: "speed_demon", label: "Velocista", icon: "⚡", desc: "Tempo médio < 10 min", color: "text-yellow-400" },
  { id: "centurion", label: "Centurião", icon: "🛡️", desc: "100+ ocorrências resolvidas", color: "text-blue-400" },
  { id: "top_rated", label: "Mais Bem Avaliado", icon: "⭐", desc: "Média ≥ 4.5 estrelas", color: "text-amber-400" },
  { id: "faithful", label: "Dedicado", icon: "🎖️", desc: "50+ ocorrências resolvidas", color: "text-green-400" },
  { id: "first_responder", label: "Primeiro a Responder", icon: "🚀", desc: "10+ ocorrências assumidas", color: "text-purple-400" },
];

function calcMedals(stats) {
  const earned = [];
  if (stats.avg_response_min > 0 && stats.avg_response_min < 10) earned.push("speed_demon");
  if (stats.resolved_count >= 100) earned.push("centurion");
  if (stats.resolved_count >= 50) earned.push("faithful");
  if (stats.avg_rating >= 4.5) earned.push("top_rated");
  if (stats.assigned_count >= 10) earned.push("first_responder");
  return earned;
}

function calcScore(stats) {
  const responseBonus = stats.avg_response_min > 0 ? Math.max(0, 60 - stats.avg_response_min) * 2 : 0;
  return (stats.resolved_count * 10) + responseBonus + (stats.positive_feedbacks * 5) + (stats.avg_rating * 10);
}

const RANK_COLORS = ["text-yellow-400", "text-slate-300", "text-amber-600"];
const RANK_ICONS = ["🥇", "🥈", "🥉"];

export default function AgentLeaderboard({ agents = [], occurrences = [] }) {
  const [feedbacks, setFeedbacks] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    base44.entities.CitizenFeedback.list("-created_date", 500).then(setFeedbacks);
  }, []);

  const leaderboard = useMemo(() => {
    return agents.map((agent) => {
      const resolved = occurrences.filter(
        (o) => o.assigned_agent_id === agent.id && o.status === "resolved"
      );
      const assigned = occurrences.filter((o) => o.assigned_agent_id === agent.id);
      const times = resolved
        .filter((o) => o.updated_date && o.created_date)
        .map((o) => differenceInMinutes(new Date(o.updated_date), new Date(o.created_date)))
        .filter((t) => t > 0 && t < 600);
      const avgTime = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;

      const agentFeedbacks = feedbacks.filter((f) => f.agent_id === agent.id);
      const avgRating = agentFeedbacks.length
        ? agentFeedbacks.reduce((a, b) => a + (b.rating || 0), 0) / agentFeedbacks.length
        : 0;
      const positiveFeedbacks = agentFeedbacks.filter((f) => f.rating >= 4).length;

      const stats = {
        resolved_count: resolved.length,
        assigned_count: assigned.length,
        avg_response_min: avgTime,
        avg_rating: avgRating,
        positive_feedbacks: positiveFeedbacks,
      };
      const medals = calcMedals(stats);
      const score = calcScore(stats);

      return { agent, ...stats, medals, score };
    })
      .sort((a, b) => b.score - a.score);
  }, [agents, occurrences, feedbacks]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-yellow-400" />
        <h3 className="font-semibold">Ranking de Agentes</h3>
        <span className="text-xs text-muted-foreground ml-1">Score = ocorrências × 10 + bônus velocidade + feedbacks</span>
      </div>

      <div className="rounded-2xl border border-border/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground w-10">#</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Agente</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground hidden md:table-cell">Resolvidas</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground hidden md:table-cell">T. Médio</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground hidden lg:table-cell">Avaliação</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden lg:table-cell">Medalhas</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Score</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((row, idx) => (
              <tr key={row.agent.id} className={`border-b border-border/40 transition-colors hover:bg-muted/20 ${idx === 0 ? "bg-yellow-500/5" : ""}`}>
                <td className="px-4 py-3">
                  <span className={`text-lg ${RANK_COLORS[idx] || "text-muted-foreground"}`}>
                    {RANK_ICONS[idx] || `${idx + 1}`}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{row.agent.full_name}</div>
                  <div className="text-[10px] text-muted-foreground">{row.agent.email}</div>
                </td>
                <td className="px-4 py-3 text-center hidden md:table-cell">
                  <span className="font-mono font-medium text-success">{row.resolved_count}</span>
                </td>
                <td className="px-4 py-3 text-center hidden md:table-cell">
                  <span className={`font-mono text-xs ${row.avg_response_min < 10 ? "text-success" : row.avg_response_min < 30 ? "text-warning" : "text-muted-foreground"}`}>
                    {row.avg_response_min ? `${row.avg_response_min} min` : "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-center hidden lg:table-cell">
                  {row.avg_rating > 0 ? (
                    <span className="flex items-center justify-center gap-1 text-xs">
                      <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                      {row.avg_rating.toFixed(1)}
                    </span>
                  ) : <span className="text-muted-foreground text-xs">—</span>}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <div className="flex gap-1 flex-wrap">
                    {row.medals.map((mid) => {
                      const m = MEDALS.find((x) => x.id === mid);
                      return m ? (
                        <span key={mid} title={`${m.label}: ${m.desc}`} className="text-base cursor-help">{m.icon}</span>
                      ) : null;
                    })}
                    {row.medals.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className={`font-bold font-mono ${idx === 0 ? "text-yellow-400" : idx === 1 ? "text-slate-300" : idx === 2 ? "text-amber-600" : "text-foreground"}`}>
                    {Math.round(row.score)}
                  </span>
                </td>
              </tr>
            ))}
            {leaderboard.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhum agente cadastrado ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Medal legend */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {MEDALS.map((m) => (
          <div key={m.id} className="p-3 rounded-xl border border-border/50 bg-card text-center space-y-1">
            <div className="text-2xl">{m.icon}</div>
            <div className="text-xs font-medium">{m.label}</div>
            <div className="text-[10px] text-muted-foreground leading-tight">{m.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
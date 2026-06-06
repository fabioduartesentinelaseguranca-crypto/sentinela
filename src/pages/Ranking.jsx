import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Trophy, Award, Medal, Star, Users, ShieldCheck, RefreshCw } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { differenceInMinutes } from "date-fns";

const MEDAL_ICON = ["🥇", "🥈", "🥉"];
const RANK_COLORS = ["text-yellow-400", "text-slate-300", "text-amber-600"];

function calcAgentScore(resolved, avgResponseMin, positiveFeedbacks, avgRating) {
  const responseBonus = avgResponseMin > 0 ? Math.max(0, 60 - avgResponseMin) * 2 : 0;
  return (resolved * 10) + responseBonus + (positiveFeedbacks * 5) + (avgRating * 10);
}

export default function Ranking() {
  const { user } = useAuth();
  const [tab, setTab] = useState("citizen");
  const [citizens, setCitizens] = useState([]);
  const [agentRows, setAgentRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    if (tab === "citizen") {
      // Aggregate points from PointsLog for accuracy
      const [allUsers, logs] = await Promise.all([
        base44.entities.User.list("-created_date", 200),
        base44.entities.PointsLog.list("-created_date", 1000),
      ]);
      const pointsMap = {};
      logs.forEach((l) => {
        if (!l.user_id) return;
        pointsMap[l.user_id] = (pointsMap[l.user_id] || 0) + (l.points || 0);
      });
      // Also include points stored directly on user (fallback)
      allUsers.forEach((u) => {
        if (!pointsMap[u.id] && (u.points || 0) > 0) pointsMap[u.id] = u.points;
      });
      const ranked = allUsers
        .filter((u) => (u.role === "citizen" || !u.role) && (pointsMap[u.id] || 0) > 0)
        .map((u) => ({ ...u, computedPoints: pointsMap[u.id] || 0 }))
        .sort((a, b) => b.computedPoints - a.computedPoints);
      setCitizens(ranked);
    } else {
      const [agents, occs, feedbacks] = await Promise.all([
        base44.entities.User.filter({ role: "agent" }),
        base44.entities.Occurrence.filter({}, "-created_date", 500),
        base44.entities.CitizenFeedback.list("-created_date", 500),
      ]);
      const rows = agents.map((agent) => {
        const resolved = occs.filter((o) => o.assigned_agent_id === agent.id && o.status === "resolved");
        const times = resolved
          .filter((o) => o.updated_date && o.created_date)
          .map((o) => differenceInMinutes(new Date(o.updated_date), new Date(o.created_date)))
          .filter((t) => t > 0 && t < 600);
        const avgTime = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const agentFbs = feedbacks.filter((f) => f.agent_id === agent.id);
        const avgRating = agentFbs.length ? agentFbs.reduce((a, b) => a + (b.rating || 0), 0) / agentFbs.length : 0;
        const positiveFbs = agentFbs.filter((f) => f.rating >= 4).length;
        const score = calcAgentScore(resolved.length, avgTime, positiveFbs, avgRating);
        return { agent, resolvedCount: resolved.length, avgTime, avgRating, positiveFbs, score };
      }).sort((a, b) => b.score - a.score);
      setAgentRows(rows);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [tab]);

  const isAdmin = user?.role === "admin";

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="w-6 h-6 text-warning" />
            Ranking Sentinela
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {tab === "citizen" ? "Pontos acumulados por colaborações reportadas e confirmadas." : "Score dos agentes com base em desempenho e avaliações."}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar
        </Button>
      </div>

      {/* Tab toggle — agentes só visível para admin */}
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1 w-fit">
        <button
          onClick={() => setTab("citizen")}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "citizen" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Users className="w-3.5 h-3.5" /> Cidadãos
        </button>
        {(isAdmin || user?.role === "agent") && (
          <button
            onClick={() => setTab("agent")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "agent" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Agentes
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin" />
          Carregando ranking...
        </div>
      ) : tab === "citizen" ? (
        citizens.length === 0 ? (
          <EmptyState icon={Trophy} title="Ninguém pontuou ainda" description="Seja o primeiro a reportar um problema confirmado." />
        ) : (
          <div className="space-y-2">
            {citizens.map((u, i) => {
              const maxPts = citizens[0]?.computedPoints || 1;
              const pct = Math.round((u.computedPoints / maxPts) * 100);
              return (
                <div key={u.id} className={`flex items-center gap-4 p-4 rounded-xl border bg-card transition-all ${u.id === user?.id ? "border-primary/50 ring-1 ring-primary/20" : "border-border/60"}`}>
                  <div className={`w-8 text-center font-bold text-lg ${RANK_COLORS[i] || "text-muted-foreground"}`}>
                    {i < 3 ? MEDAL_ICON[i] : `#${i + 1}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{u.full_name} {u.id === user?.id && <span className="text-xs text-primary">(você)</span>}</div>
                    <div className="text-xs text-muted-foreground">{u.computedPoints} pts</div>
                  </div>
                  <div className="h-2 w-28 rounded-full bg-muted overflow-hidden hidden sm:block">
                    <div className="h-full bg-gradient-to-r from-primary to-success transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        agentRows.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Nenhum agente cadastrado" description="Os agentes aparecerão aqui conforme resolverem ocorrências." />
        ) : (
          <div className="space-y-2">
            {agentRows.map((row, i) => (
              <div key={row.agent.id} className={`flex items-center gap-4 p-4 rounded-xl border bg-card ${row.agent.id === user?.id ? "border-primary/50 ring-1 ring-primary/20" : "border-border/60"}`}>
                <div className={`w-8 text-center font-bold text-lg ${RANK_COLORS[i] || "text-muted-foreground"}`}>
                  {i < 3 ? MEDAL_ICON[i] : `#${i + 1}`}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{row.agent.full_name} {row.agent.id === user?.id && <span className="text-xs text-primary">(você)</span>}</div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>{row.resolvedCount} resolvidas</span>
                    {row.avgTime > 0 && <span>·  {row.avgTime} min méd.</span>}
                    {row.avgRating > 0 && <span className="flex items-center gap-0.5"><Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />{row.avgRating.toFixed(1)}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold font-mono text-lg ${RANK_COLORS[i] || "text-foreground"}`}>{Math.round(row.score)}</div>
                  <div className="text-[10px] text-muted-foreground">pts</div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
import { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useAppRole } from "@/lib/useCurrentUser";
import { Trophy, Star, Clock, CheckCircle2, Shield, Medal, TrendingUp, History } from "lucide-react";
import { differenceInMinutes } from "date-fns";
import AgentLeaderboard from "@/components/admin/AgentLeaderboard";
import PatrolHistoryViewer from "@/components/agent/PatrolHistoryViewer";
import { AccessDenied } from "@/components/shared/RoleGuard";

const MEDALS = [
  { id: "speed_demon", label: "Velocista", icon: "⚡", desc: "Tempo médio < 10 min", color: "from-yellow-500/20 to-yellow-600/10 border-yellow-500/40" },
  { id: "centurion", label: "Centurião", icon: "🛡️", desc: "100+ ocorrências resolvidas", color: "from-blue-500/20 to-blue-600/10 border-blue-500/40" },
  { id: "top_rated", label: "Mais Bem Avaliado", icon: "⭐", desc: "Média ≥ 4.5 estrelas", color: "from-amber-500/20 to-amber-600/10 border-amber-500/40" },
  { id: "faithful", label: "Dedicado", icon: "🎖️", desc: "50+ ocorrências resolvidas", color: "from-green-500/20 to-green-600/10 border-green-500/40" },
  { id: "first_responder", label: "Primeiro a Responder", icon: "🚀", desc: "10+ ocorrências assumidas", color: "from-purple-500/20 to-purple-600/10 border-purple-500/40" },
  { id: "checklist_hero", label: "Viatura Impecável", icon: "🚗", desc: "10+ checklists aprovados", color: "from-teal-500/20 to-teal-600/10 border-teal-500/40" },
];

export default function AgentProfile() {
  const { user } = useAuth();
  const role = useAppRole();

  const [occurrences, setOccurrences] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [agents, setAgents] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [tab, setTab] = useState("medals");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    Promise.all([
      base44.entities.Occurrence.filter({}, "-created_date", 500),
      base44.entities.CitizenFeedback.list("-created_date", 500),
      base44.entities.User.filter({ role: "agent" }),
      base44.entities.VehicleChecklist.filter({ agent_id: user.id }, "-created_date", 100),
      base44.entities.Shift.filter({ agent_id: user.id }, "-created_date", 50),
    ]).then(([occs, fbs, ags, cl, sh]) => {
      setOccurrences(occs);
      setFeedbacks(fbs);
      setAgents(ags);
      setChecklists(cl);
      setShifts(sh);
      setLoading(false);
    });
  }, [user?.id]);

  const stats = useMemo(() => {
    if (!user?.id) return {};
    const resolved = occurrences.filter((o) => o.assigned_agent_id === user.id && o.status === "resolved");
    const assigned = occurrences.filter((o) => o.assigned_agent_id === user.id);
    const times = resolved
      .filter((o) => o.updated_date && o.created_date)
      .map((o) => differenceInMinutes(new Date(o.updated_date), new Date(o.created_date)))
      .filter((t) => t > 0 && t < 600);
    const avgTime = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
    const myFeedbacks = feedbacks.filter((f) => f.agent_id === user.id);
    const avgRating = myFeedbacks.length ? myFeedbacks.reduce((a, b) => a + (b.rating || 0), 0) / myFeedbacks.length : 0;
    const approvedChecklists = checklists.filter((c) => c.status === "approved").length;
    const medals = [];
    if (avgTime > 0 && avgTime < 10) medals.push("speed_demon");
    if (resolved.length >= 100) medals.push("centurion");
    if (resolved.length >= 50) medals.push("faithful");
    if (avgRating >= 4.5) medals.push("top_rated");
    if (assigned.length >= 10) medals.push("first_responder");
    if (approvedChecklists >= 10) medals.push("checklist_hero");
    const score = (resolved.length * 10) + (avgTime > 0 ? Math.max(0, 60 - avgTime) * 2 : 0) + (myFeedbacks.filter(f => f.rating >= 4).length * 5) + (avgRating * 10);
    return { resolved: resolved.length, assigned: assigned.length, avgTime, avgRating, medals, score, approvedChecklists, totalFeedbacks: myFeedbacks.length };
  }, [user?.id, occurrences, feedbacks, checklists]);

  const myRank = useMemo(() => {
    if (!user?.id || agents.length === 0) return null;
    const ranked = agents.map((agent) => {
      const resolved = occurrences.filter((o) => o.assigned_agent_id === agent.id && o.status === "resolved").length;
      const times = occurrences
        .filter((o) => o.assigned_agent_id === agent.id && o.status === "resolved" && o.updated_date && o.created_date)
        .map((o) => differenceInMinutes(new Date(o.updated_date), new Date(o.created_date)))
        .filter((t) => t > 0 && t < 600);
      const avgTime = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
      const fb = feedbacks.filter((f) => f.agent_id === agent.id);
      const avgRating = fb.length ? fb.reduce((a, b) => a + (b.rating || 0), 0) / fb.length : 0;
      const score = (resolved * 10) + (avgTime > 0 ? Math.max(0, 60 - avgTime) * 2 : 0) + (fb.filter(f => f.rating >= 4).length * 5) + (avgRating * 10);
      return { id: agent.id, score };
    }).sort((a, b) => b.score - a.score);
    return ranked.findIndex((r) => r.id === user.id) + 1;
  }, [agents, occurrences, feedbacks, user?.id]);

  const TABS = [
    { id: "medals", label: "Medalhas & Stats", icon: Medal },
    { id: "ranking", label: "Leaderboard", icon: Trophy },
    { id: "history", label: "Histórico de Patrulhas", icon: History },
  ];

  // RBAC: only agents can access this page
  if (role && role !== "agent") return <AccessDenied role={role} />;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
      <div className="rounded-2xl border border-border/60 bg-card p-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center text-2xl font-bold text-primary">
          {user?.full_name?.[0]?.toUpperCase() || "A"}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{user?.full_name}</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">
              <Shield className="w-3 h-3" /> Agente de Campo
            </span>
            {myRank && myRank <= 3 && <span className="text-lg">{["🥇","🥈","🥉"][myRank-1]}</span>}
            {myRank && <span className="text-xs text-muted-foreground">#{myRank} no ranking</span>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-yellow-400 font-mono">{Math.round(stats.score || 0)}</div>
          <div className="text-xs text-muted-foreground">pontos totais</div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: CheckCircle2, label: "Resolvidas", value: stats.resolved || 0, color: "text-success" },
          { icon: Clock, label: "Tempo médio", value: stats.avgTime ? `${stats.avgTime}min` : "—", color: "text-primary" },
          { icon: Star, label: "Avaliação", value: stats.avgRating ? stats.avgRating.toFixed(1) + "★" : "—", color: "text-yellow-400" },
          { icon: TrendingUp, label: "Checklists OK", value: stats.approvedChecklists || 0, color: "text-teal-400" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-border/60 bg-card p-4 text-center">
            <kpi.icon className={`w-5 h-5 ${kpi.color} mx-auto mb-2`} />
            <div className={`text-2xl font-bold font-mono ${kpi.color}`}>{kpi.value}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-1 bg-muted/40 rounded-xl p-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${tab === t.id ? "bg-card shadow border border-border/60 text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <t.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === "medals" && (
        <div className="space-y-4">
          <h2 className="font-semibold text-lg">Medalhas conquistadas</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {MEDALS.map((m) => {
              const earned = stats.medals?.includes(m.id);
              return (
                <div key={m.id} className={`rounded-2xl border bg-gradient-to-br p-5 transition-all ${earned ? m.color : "border-border/30 bg-muted/20 opacity-40 grayscale"}`}>
                  <div className="text-4xl mb-3">{m.icon}</div>
                  <div className="font-semibold text-sm">{m.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{m.desc}</div>
                  {earned && <div className="text-[10px] text-success mt-2 font-medium">✓ Conquistada</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "ranking" && (
        <AgentLeaderboard agents={agents} occurrences={occurrences} highlightId={user?.id} />
      )}

      {tab === "history" && (
        <PatrolHistoryViewer agentId={user?.id} agentName={user?.full_name} shifts={shifts} />
      )}
    </div>
  );
}
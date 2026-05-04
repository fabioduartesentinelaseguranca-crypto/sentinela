import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Trophy, Medal, Star, TrendingUp, Crown } from "lucide-react";

const TIER_LABEL = (pts) =>
  pts >= 500 ? { label: "Lenda", color: "text-yellow-400" }
  : pts >= 200 ? { label: "Ouro", color: "text-amber-400" }
  : pts >= 100 ? { label: "Prata", color: "text-slate-300" }
  : pts >= 30  ? { label: "Bronze", color: "text-orange-400" }
  : { label: "Iniciante", color: "text-muted-foreground" };

export default function CitizenRankingPanel({ currentUserId }) {
  const [ranking, setRanking] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const users = await base44.entities.User.list("-points", 20);
      setRanking(users.filter((u) => (u.role === "citizen" || !u.role) && (u.points || 0) > 0));
      setLoading(false);
    };
    load();
  }, []);

  const RANK_ICON = { 0: Crown, 1: Medal, 2: Star };

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4 text-primary" />
        <h3 className="font-semibold">Ranking Cidadão Sentinela</h3>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map((i) => <div key={i} className="h-10 rounded-lg bg-muted/30 animate-pulse" />)}
        </div>
      ) : ranking.length === 0 ? (
        <div className="text-center py-4 text-sm text-muted-foreground">
          <TrendingUp className="w-6 h-6 mx-auto mb-1 opacity-40" />
          Nenhum cidadão com pontos ainda.
        </div>
      ) : (
        <div className="space-y-1.5">
          {ranking.slice(0, 8).map((u, i) => {
            const tier = TIER_LABEL(u.points || 0);
            const RankIcon = RANK_ICON[i];
            const isMe = u.id === currentUserId;
            return (
              <div key={u.id} className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors ${isMe ? "bg-primary/10 border border-primary/30" : "bg-muted/20 border border-transparent"}`}>
                <div className="w-6 text-center flex-shrink-0">
                  {RankIcon ? <RankIcon className={`w-4 h-4 mx-auto ${i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-300" : "text-amber-500"}`} />
                    : <span className="text-xs text-muted-foreground font-mono">{i + 1}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate flex items-center gap-1">
                    {u.full_name} {isMe && <span className="text-[10px] bg-primary/20 text-primary px-1 rounded">você</span>}
                  </div>
                  <div className={`text-[10px] ${tier.color}`}>{tier.label}</div>
                </div>
                <div className="text-sm font-bold text-primary">{u.points || 0} pts</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
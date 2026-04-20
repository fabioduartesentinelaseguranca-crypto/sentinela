import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Trophy, Award, Medal } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";

export default function Ranking() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const list = await base44.entities.User.list("-points", 50);
        setUsers(list.filter((u) => (u.points || 0) > 0));
      } catch {}
      setLoading(false);
    })();
  }, []);

  const medal = (i) => {
    if (i === 0) return { icon: Trophy, color: "text-yellow-400" };
    if (i === 1) return { icon: Medal, color: "text-slate-300" };
    if (i === 2) return { icon: Medal, color: "text-amber-600" };
    return { icon: Award, color: "text-muted-foreground" };
  };

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Trophy className="w-6 h-6 text-warning" />
          Ranking Cidadão Sentinela
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ganhe pontos ao reportar problemas de Defesa Civil que forem confirmados e resolvidos.
        </p>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : users.length === 0 ? (
        <EmptyState icon={Trophy} title="Ninguém pontuou ainda" description="Seja o primeiro a reportar um problema de Defesa Civil." />
      ) : (
        <div className="space-y-2">
          {users.map((u, i) => {
            const m = medal(i);
            const Icon = m.icon;
            return (
              <div key={u.id} className="flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card">
                <div className={`w-8 text-center font-bold ${m.color}`}>
                  {i < 3 ? <Icon className="w-5 h-5 mx-auto" /> : `#${i + 1}`}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{u.full_name}</div>
                  <div className="text-xs text-muted-foreground">{u.points || 0} pontos</div>
                </div>
                <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-success" style={{ width: `${Math.min(100, (u.points || 0))}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
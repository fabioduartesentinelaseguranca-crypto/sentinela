import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Trophy, ShieldCheck, Star, Users, RefreshCw, AlertCircle, UserCheck } from "lucide-react";
import EmptyState from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

const MEDAL_ICON = ["🥇", "🥈", "🥉"];
const RANK_COLORS = ["text-yellow-400", "text-slate-300", "text-amber-600"];

export default function Ranking() {
  const { user } = useAuth();
  const [tab, setTab] = useState("citizen");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("obterRanking");
      setData(res);
    } catch (e) {
      setError(e?.message || "Erro ao carregar ranking");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const role = user?.role || "citizen";
  const isCitizen = role === "citizen";
  const isAgentOrAdmin = role === "agent" || role === "admin";

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Trophy className="w-6 h-6 text-warning" />
            Ranking Sentinela
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isCitizen
              ? "Sua pontuação e posição no ranking de cidadãos."
              : tab === "citizen"
              ? "Pontos acumulados por colaborações reportadas e confirmadas."
              : "Score dos agentes com base em desempenho e avaliações."}
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5 mr-1" /> Atualizar
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin" />
          Carregando ranking...
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <AlertCircle className="w-8 h-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button size="sm" variant="outline" onClick={load}>Tentar novamente</Button>
        </div>
      ) : isCitizen ? (
        <CitizenSelfCard myEntry={data?.myEntry} />
      ) : (
        <>
          <div className="flex gap-1 bg-muted/50 rounded-lg p-1 w-fit">
            <button
              onClick={() => setTab("citizen")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "citizen" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Users className="w-3.5 h-3.5" /> Cidadãos
            </button>
            <button
              onClick={() => setTab("agent")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "agent" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Agentes
            </button>
          </div>

          {tab === "citizen" ? (
            (data?.citizens?.length ?? 0) === 0 ? (
              <EmptyState icon={Trophy} title="Ninguém pontuou ainda" description="Os cidadãos aparecerão aqui conforme reportarem ocorrências confirmadas." />
            ) : (
              <div className="space-y-2">
                {data.citizens.map((u, i) => {
                  const maxPts = data.citizens[0]?.computedPoints || 1;
                  const pct = Math.round((u.computedPoints / maxPts) * 100);
                  return (
                    <div key={u.id} className={`flex items-center gap-4 p-4 rounded-xl border bg-card transition-all ${u.id === user?.id ? "border-primary/50 ring-1 ring-primary/20" : "border-border/60"}`}>
                      <div className={`w-8 text-center font-bold text-lg ${RANK_COLORS[i] || "text-muted-foreground"}`}>
                        {i < 3 ? MEDAL_ICON[i] : `#${i + 1}`}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{u.full_name} {u.id === user?.id && <span className="text-xs text-primary">(você)</span>}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{u.computedPoints} pts</span>
                          {u.occTotal > 0 && <span>· {u.occTotal} ocorrências</span>}
                          {u.occResolved > 0 && <span className="text-success">· {u.occResolved} resolvidas</span>}
                          {u.bonusPts > 0 && <span className="text-warning">· +{u.bonusPts} bônus</span>}
                        </div>
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
            (data?.agents?.length ?? 0) === 0 ? (
              <EmptyState icon={ShieldCheck} title="Nenhum agente cadastrado" description="Os agentes aparecerão aqui conforme resolverem ocorrências." />
            ) : (
              <div className="space-y-2">
                {data.agents.map((row, i) => (
                  <div key={row.id} className={`flex items-center gap-4 p-4 rounded-xl border bg-card ${row.id === user?.id ? "border-primary/50 ring-1 ring-primary/20" : "border-border/60"}`}>
                    <div className={`w-8 text-center font-bold text-lg ${RANK_COLORS[i] || "text-muted-foreground"}`}>
                      {i < 3 ? MEDAL_ICON[i] : `#${i + 1}`}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{row.full_name} {row.id === user?.id && <span className="text-xs text-primary">(você)</span>}</div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        <span>{row.assignedCount} atribuídas</span>
                        <span className="text-success">{row.resolvedCount} resolvidas</span>
                        {row.inProgressCount > 0 && <span className="text-primary">{row.inProgressCount} em andamento</span>}
                        {row.avgTime > 0 && <span>· {row.avgTime}min méd.</span>}
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
        </>
      )}
    </div>
  );
}

function CitizenSelfCard({ myEntry }) {
  if (!myEntry) {
    return (
      <EmptyState
        icon={Trophy}
        title="Você ainda não pontuou"
        description="Reporte ocorrências confirmadas para entrar no ranking de cidadãos."
      />
    );
  }
  const ranked = myEntry.position != null;
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 to-card p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
              <UserCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Sua posição</div>
              <div className="text-2xl font-bold">
                {ranked ? `#${myEntry.position}` : "—"}
                <span className="text-sm font-normal text-muted-foreground ml-2">de {myEntry.total} cidadãos</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-primary font-mono">{myEntry.computedPoints}</div>
            <div className="text-xs text-muted-foreground">pontos</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
          <div className="text-2xl font-bold">{myEntry.occTotal}</div>
          <div className="text-[11px] text-muted-foreground">Ocorrências</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
          <div className="text-2xl font-bold text-success">{myEntry.occResolved}</div>
          <div className="text-[11px] text-muted-foreground">Resolvidas</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
          <div className="text-2xl font-bold text-warning">+{myEntry.bonusPts}</div>
          <div className="text-[11px] text-muted-foreground">Bônus</div>
        </div>
      </div>

      {!ranked && (
        <p className="text-xs text-muted-foreground text-center">
          Você ainda não consta no ranking. Reporte ocorrências para começar a pontuar.
        </p>
      )}
    </div>
  );
}
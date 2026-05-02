import { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Trophy, Star, Users, Shield, BookOpen, CheckCircle2, RefreshCw, Siren, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { differenceInMinutes } from "date-fns";

const DIFFICULTY_CONFIG = {
  bronze:   { label: "Bronze",   color: "from-amber-700/20 to-amber-800/10 border-amber-700/40 text-amber-600" },
  silver:   { label: "Prata",    color: "from-slate-400/20 to-slate-500/10 border-slate-400/40 text-slate-300" },
  gold:     { label: "Ouro",     color: "from-yellow-500/20 to-yellow-600/10 border-yellow-500/40 text-yellow-400" },
  platinum: { label: "Platina",  color: "from-cyan-400/20 to-cyan-500/10 border-cyan-400/40 text-cyan-300" },
};

const CATEGORY_ICON = {
  resolutions: Shield,
  response_time: Siren,
  checklists: CheckCircle2,
  training: BookOpen,
  community: Star,
};

const DEFAULT_ACHIEVEMENTS = [
  { title: "Século de Resoluções", description: "A equipe resolve 100 ocorrências no total", icon: "🛡️", category: "resolutions", target: 100, difficulty: "bronze", reward_description: "+500 pts distribuídos entre todos os agentes" },
  { title: "Força-Tarefa", description: "A equipe resolve 500 ocorrências", icon: "💪", category: "resolutions", target: 500, difficulty: "silver", reward_description: "Medalha de equipe + bônus mensal" },
  { title: "Elite de Campo", description: "A equipe resolve 1.000 ocorrências", icon: "🏆", category: "resolutions", target: 1000, difficulty: "gold", reward_description: "Distinção oficial da corporação" },
  { title: "Resposta Relâmpago", description: "Tempo médio da equipe abaixo de 15 min em 50 ocorrências", icon: "⚡", category: "response_time", target: 50, difficulty: "silver", reward_description: "Banner de destaque no painel" },
  { title: "Frotas Seguras", description: "100 checklists de viatura aprovados pela equipe", icon: "🚗", category: "checklists", target: 100, difficulty: "bronze", reward_description: "Certificado de segurança operacional" },
  { title: "Equipe Capacitada", description: "Total de 50 módulos de treinamento concluídos", icon: "📚", category: "training", target: 50, difficulty: "silver", reward_description: "+200 pts para cada agente que concluiu um módulo" },
  { title: "Voz da Comunidade", description: "Receber 100 avaliações 4★ ou mais dos cidadãos", icon: "⭐", category: "community", target: 100, difficulty: "gold", reward_description: "Destaque na página pública da corporação" },
  { title: "Platina Total", description: "A equipe resolve 5.000 ocorrências históricas", icon: "💎", category: "resolutions", target: 5000, difficulty: "platinum", reward_description: "Reconhecimento máximo — Platina Sentinela" },
];

export default function TeamAchievements() {
  const [achievements, setAchievements] = useState([]);
  const [occurrences, setOccurrences] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const load = async () => {
    const [achs, occs, cls, fbs, trs] = await Promise.all([
      base44.entities.TeamAchievement.list("-created_date", 50),
      base44.entities.Occurrence.filter({}, "-created_date", 2000),
      base44.entities.VehicleChecklist.filter({ status: "approved" }, "-created_date", 500),
      base44.entities.CitizenFeedback.list("-created_date", 500),
      base44.entities.TrainingProgress.filter({ status: "passed" }, "-created_date", 500),
    ]);
    setAchievements(achs);
    setOccurrences(occs);
    setChecklists(cls);
    setFeedbacks(fbs);
    setTrainings(trs);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const seedAchievements = async () => {
    setSeeding(true);
    for (const a of DEFAULT_ACHIEVEMENTS) {
      await base44.entities.TeamAchievement.create({ ...a, current: 0, completed: false });
    }
    toast.success("Conquistas inicializadas!");
    setSeeding(false);
    load();
  };

  // Compute live progress for each achievement
  const withProgress = useMemo(() => {
    const resolved = occurrences.filter((o) => o.status === "resolved").length;
    const fastResolutions = occurrences.filter((o) => {
      if (o.status !== "resolved") return false;
      const min = differenceInMinutes(new Date(o.updated_date), new Date(o.created_date));
      return min > 0 && min <= 15;
    }).length;
    const positiveFeedbacks = feedbacks.filter((f) => f.rating >= 4).length;

    return achievements.map((a) => {
      let current = a.current || 0;
      switch (a.category) {
        case "resolutions": current = resolved; break;
        case "response_time": current = fastResolutions; break;
        case "checklists": current = checklists.length; break;
        case "training": current = trainings.length; break;
        case "community": current = positiveFeedbacks; break;
      }
      const pct = Math.min(100, Math.round((current / a.target) * 100));
      const newlyCompleted = !a.completed && current >= a.target;
      // Auto-mark completed
      if (newlyCompleted) {
        base44.entities.TeamAchievement.update(a.id, { current, completed: true, completed_at: new Date().toISOString() }).then(load);
      } else if (current !== a.current) {
        base44.entities.TeamAchievement.update(a.id, { current }).catch(() => {});
      }
      return { ...a, current, pct };
    });
  }, [achievements, occurrences, checklists, feedbacks, trainings]);

  const completed = withProgress.filter((a) => a.completed);
  const inProgress = withProgress.filter((a) => !a.completed);

  const grouped = Object.entries(DIFFICULTY_CONFIG).map(([diff, cfg]) => ({
    diff, cfg,
    items: inProgress.filter((a) => a.difficulty === diff),
  })).filter((g) => g.items.length > 0);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-400" /> Conquistas da Equipe
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Metas coletivas — cada agente contribui para o sucesso do grupo.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-2xl font-bold text-yellow-400 font-mono">{completed.length}<span className="text-muted-foreground text-base font-normal">/{withProgress.length}</span></div>
            <div className="text-xs text-muted-foreground">Conquistas</div>
          </div>
          {achievements.length === 0 && (
            <Button size="sm" onClick={seedAchievements} disabled={seeding}>
              {seeding ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Inicializar Conquistas"}
            </Button>
          )}
        </div>
      </div>

      {/* Completed */}
      {completed.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-success" /> Conquistadas ({completed.length})
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {completed.map((a) => {
              const cfg = DIFFICULTY_CONFIG[a.difficulty];
              const CategoryIcon = CATEGORY_ICON[a.category] || Trophy;
              return (
                <div key={a.id} className={`rounded-2xl border bg-gradient-to-br p-4 ${cfg.color} space-y-2`}>
                  <div className="flex items-start justify-between">
                    <span className="text-3xl">{a.icon}</span>
                    <div className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</div>
                  </div>
                  <div className="font-semibold text-sm">{a.title}</div>
                  <div className="text-xs text-muted-foreground">{a.description}</div>
                  {a.completed_at && (
                    <div className="text-[10px] text-success font-medium">
                      ✓ Concluída em {format(new Date(a.completed_at), "dd/MM/yyyy", { locale: ptBR })}
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground border-t border-border/30 pt-2 mt-1">
                    🎁 {a.reward_description}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* In Progress — grouped by difficulty */}
      {grouped.map(({ diff, cfg, items }) => (
        <div key={diff} className="space-y-3">
          <h2 className={`font-semibold text-sm uppercase tracking-wider flex items-center gap-2 ${cfg.color.split(" ").find(c => c.startsWith("text-")) || "text-muted-foreground"}`}>
            <Target className="w-4 h-4" /> {cfg.label} ({items.length})
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {items.map((a) => {
              const CategoryIcon = CATEGORY_ICON[a.category] || Trophy;
              return (
                <div key={a.id} className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{a.icon}</span>
                      <div>
                        <div className="font-semibold text-sm">{a.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{a.description}</div>
                      </div>
                    </div>
                    <div className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${cfg.color}`}>{cfg.label}</div>
                  </div>

                  {/* Progress */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Users className="w-3 h-3" /> Progresso da equipe
                      </span>
                      <span className="font-mono font-medium">{a.current.toLocaleString()} / {a.target.toLocaleString()}</span>
                    </div>
                    <div className="h-2.5 bg-muted/50 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all bg-gradient-to-r ${
                          diff === "bronze" ? "from-amber-700 to-amber-500" :
                          diff === "silver" ? "from-slate-400 to-slate-300" :
                          diff === "gold" ? "from-yellow-600 to-yellow-400" :
                          "from-cyan-500 to-cyan-300"
                        }`}
                        style={{ width: `${a.pct}%` }}
                      />
                    </div>
                    <div className="text-right text-[10px] text-muted-foreground mt-0.5">{a.pct}%</div>
                  </div>

                  <div className="text-[10px] text-muted-foreground border-t border-border/30 pt-2">
                    🎁 {a.reward_description}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {withProgress.length === 0 && (
        <div className="text-center py-16 border border-dashed rounded-2xl">
          <Trophy className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">Nenhuma conquista configurada ainda.</p>
          <Button className="mt-4" onClick={seedAchievements} disabled={seeding}>
            Inicializar conquistas padrão
          </Button>
        </div>
      )}
    </div>
  );
}
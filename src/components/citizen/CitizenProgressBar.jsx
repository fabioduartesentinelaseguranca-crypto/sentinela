import { useMemo } from "react";
import { Star, Shield, Flame, Award, Zap, Heart } from "lucide-react";

const LEVELS = [
  { level: 1, label: "Sentinela Novato", min: 0, color: "from-muted to-muted/50" },
  { level: 2, label: "Observador Ativo", min: 50, color: "from-chart-4/60 to-chart-4/20" },
  { level: 3, label: "Guardião da Cidade", min: 150, color: "from-primary/60 to-primary/20" },
  { level: 4, label: "Sentinela Veterano", min: 350, color: "from-warning/60 to-warning/20" },
  { level: 5, label: "Herói Comunitário", min: 700, color: "from-emergency/60 to-emergency/20" },
];

const BADGES = [
  { id: "first_report", icon: Star, label: "Primeiro Registro", desc: "Registrou a primeira ocorrência", condition: (occs) => occs.length >= 1, color: "text-warning" },
  { id: "five_reports", icon: Flame, label: "Alerta Constante", desc: "5 ocorrências registradas", condition: (occs) => occs.length >= 5, color: "text-emergency" },
  { id: "ten_reports", icon: Shield, label: "Cidadão Vigilante", desc: "10 ocorrências registradas", condition: (occs) => occs.length >= 10, color: "text-primary" },
  { id: "resolved", icon: Award, label: "Resolutivo", desc: "Ocorrência resolvida", condition: (occs) => occs.some(o => o.status === "resolved"), color: "text-chart-4" },
  { id: "points_100", icon: Zap, label: "Engajado", desc: "100 pontos acumulados", condition: (_, pts) => pts >= 100, color: "text-chart-5" },
  { id: "points_500", icon: Heart, label: "Defensor da Cidade", desc: "500 pontos acumulados", condition: (_, pts) => pts >= 500, color: "text-destructive" },
];

export default function CitizenProgressBar({ occurrences = [], points = 0 }) {
  const currentLevel = useMemo(() => {
    return [...LEVELS].reverse().find(l => points >= l.min) || LEVELS[0];
  }, [points]);

  const nextLevel = LEVELS.find(l => l.min > points);
  const progressPct = nextLevel
    ? Math.min(100, ((points - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100)
    : 100;

  const unlockedBadges = BADGES.filter(b => b.condition(occurrences, points));
  const lockedBadges = BADGES.filter(b => !b.condition(occurrences, points));

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Star className="w-4 h-4 text-warning" /> Progresso Cidadão
        </h3>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full bg-gradient-to-r ${currentLevel.color}`}>
          Nível {currentLevel.level} · {currentLevel.label}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{points} pts</span>
          <span>{nextLevel ? `${nextLevel.min} pts para Nível ${nextLevel.level}` : "Nível máximo!"}</span>
        </div>
        <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
          <div
            className="h-3 rounded-full bg-gradient-to-r from-primary to-primary/60 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex justify-between">
          {LEVELS.map((l, i) => (
            <div key={l.level} className="flex flex-col items-center gap-0.5">
              <div className={`w-2.5 h-2.5 rounded-full border-2 transition-colors ${
                points >= l.min ? "bg-primary border-primary" : "bg-muted border-border"
              }`} />
              <span className="text-[9px] text-muted-foreground hidden md:block">N{l.level}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Unlocked badges */}
      {unlockedBadges.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">Emblemas desbloqueados</div>
          <div className="flex flex-wrap gap-2">
            {unlockedBadges.map(b => {
              const Icon = b.icon;
              return (
                <div key={b.id} title={b.desc} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-primary/10 border border-primary/20">
                  <Icon className={`w-3.5 h-3.5 ${b.color}`} />
                  <span className="text-xs font-medium">{b.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Locked badges hint */}
      {lockedBadges.length > 0 && (
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">Próximos emblemas</div>
          <div className="flex flex-wrap gap-2">
            {lockedBadges.slice(0, 3).map(b => {
              const Icon = b.icon;
              return (
                <div key={b.id} title={b.desc} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-muted/50 border border-border/40 opacity-50">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs">{b.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
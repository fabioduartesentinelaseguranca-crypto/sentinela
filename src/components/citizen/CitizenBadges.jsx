import { useMemo } from "react";
import { Shield, Star, Users, Heart, Flame, Eye, Award, Zap } from "lucide-react";

export const BADGE_CATALOG = [
  { id: "first_report",   icon: Eye,    label: "Primeira Denúncia",   desc: "Registrou sua primeira ocorrência",          points: 0,  condition: (s) => s.totalReports >= 1 },
  { id: "reporter_5",     icon: FileText2, label: "Repórter Ativo",   desc: "5 ocorrências registradas",                  points: 0,  condition: (s) => s.totalReports >= 5 },
  { id: "reporter_20",    icon: Star,   label: "Sentinela de Prata",   desc: "20 ocorrências registradas",                 points: 0,  condition: (s) => s.totalReports >= 20 },
  { id: "reporter_50",    icon: Flame,  label: "Sentinela de Ouro",    desc: "50 ocorrências registradas",                 points: 0,  condition: (s) => s.totalReports >= 50 },
  { id: "verified_3",     icon: Shield, label: "Cidadão Verificado",   desc: "3 denúncias verificadas por agentes",        points: 0,  condition: (s) => s.verifiedReports >= 3 },
  { id: "verified_10",    icon: Award,  label: "Guardião da Verdade",  desc: "10 denúncias verificadas",                   points: 0,  condition: (s) => s.verifiedReports >= 10 },
  { id: "first_aid",      icon: Heart,  label: "Socorrista",           desc: "Enviou denúncia de saúde / SAMU",            points: 0,  condition: (s) => s.healthReports >= 1 },
  { id: "neighborhood",   icon: Users,  label: "Vizinhança Solidária", desc: "Participou de programa comunitário",         points: 0,  condition: (s) => s.communityPoints >= 50 },
  { id: "points_100",     icon: Zap,    label: "100 Pontos",           desc: "Acumulou 100 pontos de reputação",           points: 0,  condition: (s) => s.totalPoints >= 100 },
];

// Placeholder icon since lucide doesn't have FileText2
function FileText2(props) { return <Eye {...props} />; }

export function calcCitizenStats(occurrences = [], userPoints = 0, communityPoints = 0) {
  return {
    totalReports: occurrences.length,
    verifiedReports: occurrences.filter((o) => o.status === "resolved").length,
    healthReports: occurrences.filter((o) => o.type === "health").length,
    communityPoints,
    totalPoints: userPoints,
  };
}

export default function CitizenBadges({ occurrences = [], userPoints = 0 }) {
  const stats = useMemo(() => calcCitizenStats(occurrences, userPoints), [occurrences, userPoints]);

  const earned = BADGE_CATALOG.filter((b) => b.condition(stats));
  const locked = BADGE_CATALOG.filter((b) => !b.condition(stats));

  const TIER = userPoints >= 500 ? { label: "Lenda", color: "text-yellow-400", bg: "bg-yellow-500/10" }
    : userPoints >= 200 ? { label: "Ouro", color: "text-amber-400", bg: "bg-amber-500/10" }
    : userPoints >= 100 ? { label: "Prata", color: "text-slate-300", bg: "bg-slate-400/10" }
    : userPoints >= 30  ? { label: "Bronze", color: "text-orange-400", bg: "bg-orange-500/10" }
    : { label: "Iniciante", color: "text-muted-foreground", bg: "bg-muted/20" };

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Award className="w-4 h-4 text-primary" /> Conquistas
        </h3>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${TIER.bg} ${TIER.color}`}>
          {TIER.label} · {userPoints} pts
        </span>
      </div>

      {earned.length > 0 && (
        <div>
          <p className="text-[11px] text-muted-foreground mb-2">Conquistadas ({earned.length})</p>
          <div className="grid grid-cols-3 gap-2">
            {earned.map((b) => {
              const Icon = b.icon;
              return (
                <div key={b.id} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-primary/10 border border-primary/20 text-center">
                  <Icon className="w-5 h-5 text-primary" />
                  <span className="text-[10px] font-semibold text-primary leading-tight">{b.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {locked.length > 0 && (
        <div>
          <p className="text-[11px] text-muted-foreground mb-2">Bloqueadas ({locked.length})</p>
          <div className="grid grid-cols-3 gap-2">
            {locked.slice(0, 6).map((b) => {
              const Icon = b.icon;
              return (
                <div key={b.id} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-muted/20 border border-border/30 text-center opacity-40">
                  <Icon className="w-5 h-5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground leading-tight">{b.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="pt-1">
        <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
          <span>Progresso de reputação</span>
          <span>{userPoints} / {userPoints >= 500 ? "MAX" : userPoints >= 200 ? 500 : userPoints >= 100 ? 200 : userPoints >= 30 ? 100 : 30}</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-2 bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-700"
            style={{ width: `${Math.min(100, (userPoints / (userPoints >= 200 ? 500 : userPoints >= 100 ? 200 : userPoints >= 30 ? 100 : 30)) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
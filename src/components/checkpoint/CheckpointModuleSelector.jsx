import { GraduationCap, ShieldAlert, ArrowRight } from "lucide-react";

const MODULES = [
  {
    id: "escolar",
    title: "Módulo Escolar",
    desc: "Biometria de alunos (com óculos duplo), responsáveis e blacklist escolar. Monitoramento contra Alunos_Biometria + Blacklist_Biometrica.",
    icon: GraduationCap,
    accent: "from-blue-500/20 to-blue-600/5 border-blue-500/40",
    iconColor: "text-blue-400",
  },
  {
    id: "procurados",
    title: "Módulo Procurados",
    desc: "Cadastro de criminosos procurados com recompensa, nível de perigo e mandado. Monitoramento contra WantedCriminal.",
    icon: ShieldAlert,
    accent: "from-red-500/20 to-red-600/5 border-red-500/40",
    iconColor: "text-red-400",
  },
];

export default function CheckpointModuleSelector({ onPick }) {
  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">Checkpoint de Segurança</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
          Selecione o módulo de atuação. Cada módulo possui sua própria base biométrica e regras de
          classificação — o pipeline de reconhecimento facial local (MediaPipe + face-api) é compartilhado.
        </p>
      </div>
      <div className="grid md:grid-cols-2 gap-5">
        {MODULES.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.id}
              onClick={() => onPick(m.id)}
              className={`group text-left rounded-2xl border bg-gradient-to-br ${m.accent} p-6 hover:scale-[1.02] transition-transform`}
            >
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-card/60 flex items-center justify-center flex-shrink-0">
                  <Icon className={`w-8 h-8 ${m.iconColor}`} />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold">{m.title}</h2>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{m.desc}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:translate-x-1 transition-transform flex-shrink-0 mt-1" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
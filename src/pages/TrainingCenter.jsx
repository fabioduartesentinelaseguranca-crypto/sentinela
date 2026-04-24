import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { BookOpen, CheckCircle2, Play, RotateCcw, Trophy, Award } from "lucide-react";
import { toast } from "sonner";
import { addMonths } from "date-fns";
import TrainingQuiz from "@/components/training/TrainingQuiz";
import CertificatePanel from "@/components/training/CertificatePanel";

const CATEGORY_LABELS = {
  protocols: "Protocolos",
  legislation: "Legislação",
  first_aid: "Primeiros Socorros",
  communication: "Comunicação",
  tactical: "Tático",
};

export default function TrainingCenter() {
  const { user } = useAuth();
  const [modules, setModules] = useState([]);
  const [progress, setProgress] = useState([]);
  const [selected, setSelected] = useState(null);
  const [quizOpen, setQuizOpen] = useState(false);

  const load = async () => {
    const [mods, progs] = await Promise.all([
      base44.entities.TrainingModule.filter({ active: true }, "created_date", 50),
      user?.id ? base44.entities.TrainingProgress.filter({ agent_id: user.id }) : Promise.resolve([]),
    ]);
    setModules(mods);
    setProgress(progs);
  };

  useEffect(() => { load(); }, [user?.id]);

  const getProgress = (moduleId) => progress.find((p) => p.module_id === moduleId);

  const startModule = async (mod) => {
    setSelected(mod);
    const prog = getProgress(mod.id);
    if (!prog) {
      await base44.entities.TrainingProgress.create({
        agent_id: user.id,
        agent_name: user.full_name,
        module_id: mod.id,
        module_title: mod.title,
        status: "watching",
        attempts: 0,
      });
      load();
    }
  };

  const openQuiz = (mod) => {
    setSelected(mod);
    setQuizOpen(true);
  };

  const handleQuizComplete = async (score) => {
    const prog = getProgress(selected.id);
    const passing = selected.passing_score ?? 70;
    const passed = score >= passing;
    const now = new Date();
    const updates = {
      score,
      status: passed ? "passed" : "failed",
      attempts: (prog?.attempts || 0) + 1,
      completed_at: now.toISOString(),
    };
    if (prog) {
      await base44.entities.TrainingProgress.update(prog.id, updates);
    } else {
      await base44.entities.TrainingProgress.create({
        agent_id: user.id,
        agent_name: user.full_name,
        module_id: selected.id,
        module_title: selected.title,
        ...updates,
      });
    }

    // Emit certificate if passed
    if (passed) {
      const expiresAt = addMonths(now, 12); // 1 year validity
      const existing = await base44.entities.CertificateRecord.filter({ agent_id: user.id, module_id: selected.id });
      if (existing.length > 0) {
        await base44.entities.CertificateRecord.update(existing[0].id, {
          issued_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          score,
          valid: true,
        });
      } else {
        await base44.entities.CertificateRecord.create({
          agent_id: user.id,
          agent_name: user.full_name,
          module_id: selected.id,
          module_title: selected.title,
          issued_at: now.toISOString(),
          expires_at: expiresAt.toISOString(),
          score,
          valid: true,
        });
      }
    }

    toast[passed ? "success" : "error"](
      passed ? `Aprovado! Nota: ${score}% — Certificado emitido por 1 ano` : `Reprovado. Nota: ${score}%. Tente novamente.`
    );
    setQuizOpen(false);
    load();
  };

  const statusBadge = (prog) => {
    if (!prog) return <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Não iniciado</span>;
    if (prog.status === "passed") return <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/20 text-success font-medium flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Aprovado {prog.score}%</span>;
    if (prog.status === "failed") return <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/20 text-destructive font-medium">Reprovado {prog.score}%</span>;
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">Em andamento</span>;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-primary" /> Central de Capacitação
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Videoaulas e quizzes de protocolos operacionais.</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Trophy className="w-4 h-4 text-warning" />
          <span className="font-medium">{progress.filter((p) => p.status === "passed").length} / {modules.length} módulos concluídos</span>
        </div>
      </div>

      {modules.length === 0 && (
        <div className="text-sm text-muted-foreground p-10 text-center border border-dashed rounded-2xl">
          Nenhum módulo disponível no momento.
        </div>
      )}

      <CertificatePanel agentId={user?.id} />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((mod) => {
          const prog = getProgress(mod.id);
          const isPassed = prog?.status === "passed";
          return (
            <div
              key={mod.id}
              className={`rounded-2xl border border-border/60 bg-card p-5 space-y-3 flex flex-col transition-shadow hover:shadow-lg ${isPassed ? "border-success/30 bg-success/5" : ""}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] uppercase text-muted-foreground font-medium mb-1">
                    {CATEGORY_LABELS[mod.category] || mod.category}
                  </div>
                  <div className="font-semibold text-sm leading-snug">{mod.title}</div>
                </div>
                {statusBadge(prog)}
              </div>

              {mod.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">{mod.description}</p>
              )}

              {/* Video embed */}
              {mod.video_url && selected?.id === mod.id && (
                <div className="rounded-xl overflow-hidden aspect-video bg-black">
                  <iframe
                    src={mod.video_url}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
                    allowFullScreen
                  />
                </div>
              )}

              <div className="flex gap-2 mt-auto pt-1">
                {mod.video_url && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => selected?.id === mod.id ? setSelected(null) : startModule(mod)}
                  >
                    <Play className="w-3.5 h-3.5 mr-1" />
                    {selected?.id === mod.id ? "Fechar" : "Assistir"}
                  </Button>
                )}
                {mod.quiz?.length > 0 && (
                  <Button
                    size="sm"
                    className="flex-1"
                    variant={isPassed ? "outline" : "default"}
                    onClick={() => openQuiz(mod)}
                  >
                    {isPassed ? <RotateCcw className="w-3.5 h-3.5 mr-1" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                    {isPassed ? "Refazer" : "Quiz"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {quizOpen && selected && (
        <TrainingQuiz
          module={selected}
          onComplete={handleQuizComplete}
          onClose={() => setQuizOpen(false)}
        />
      )}
    </div>
  );
}
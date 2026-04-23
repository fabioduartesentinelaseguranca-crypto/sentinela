import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";

export default function TrainingQuiz({ module, onComplete, onClose }) {
  const questions = module.quiz || [];
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const q = questions[current];

  const select = (idx) => {
    if (submitted) return;
    setAnswers((prev) => ({ ...prev, [current]: idx }));
  };

  const next = () => {
    if (current < questions.length - 1) setCurrent((c) => c + 1);
    else setSubmitted(true);
  };

  const score = submitted
    ? Math.round(
        (questions.filter((q, i) => answers[i] === q.correct).length / questions.length) * 100
      )
    : 0;

  if (questions.length === 0) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Quiz — {module.title}</DialogTitle>
        </DialogHeader>

        {!submitted ? (
          <div className="space-y-4">
            <div className="text-xs text-muted-foreground">Pergunta {current + 1} de {questions.length}</div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className="bg-primary h-1.5 rounded-full transition-all"
                style={{ width: `${((current + 1) / questions.length) * 100}%` }}
              />
            </div>
            <p className="font-medium text-sm">{q.question}</p>
            <div className="space-y-2">
              {q.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => select(i)}
                  className={`w-full text-left text-sm px-4 py-3 rounded-xl border transition-colors ${
                    answers[current] === i
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/60 hover:bg-muted/50"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <Button
              className="w-full"
              disabled={answers[current] === undefined}
              onClick={next}
            >
              {current < questions.length - 1 ? "Próxima" : "Finalizar"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 text-center py-4">
            {score >= (module.passing_score ?? 70) ? (
              <CheckCircle2 className="w-14 h-14 text-success mx-auto" />
            ) : (
              <XCircle className="w-14 h-14 text-destructive mx-auto" />
            )}
            <div className="text-4xl font-bold">{score}%</div>
            <div className="text-sm text-muted-foreground">
              {score >= (module.passing_score ?? 70)
                ? "Parabéns! Você foi aprovado."
                : `Nota mínima: ${module.passing_score ?? 70}%. Tente novamente.`}
            </div>
            <div className="space-y-2 text-left text-sm">
              {questions.map((q, i) => {
                const correct = answers[i] === q.correct;
                return (
                  <div key={i} className={`flex items-start gap-2 p-2 rounded-lg ${correct ? "bg-success/10" : "bg-destructive/10"}`}>
                    {correct
                      ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                      : <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />}
                    <div>
                      <div className="font-medium text-xs">{q.question}</div>
                      {!correct && <div className="text-xs text-muted-foreground">Correta: {q.options[q.correct]}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
            <Button className="w-full" onClick={() => onComplete(score)}>
              Concluir
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
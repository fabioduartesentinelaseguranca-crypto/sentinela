import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, RotateCcw, ClipboardList, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_META = {
  pending: { label: "Aguardando", cls: "bg-warning/15 text-warning" },
  approved: { label: "Aprovado", cls: "bg-success/15 text-success" },
  revision: { label: "Revisão solicitada", cls: "bg-destructive/15 text-destructive" },
};

export default function AgentTaskReview() {
  const [submissions, setSubmissions] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [feedback, setFeedback] = useState({});

  const load = async () => {
    const list = await base44.entities.TrainingProgress.filter({}, "-updated_date", 100);
    // only submissions with submitted_task
    setSubmissions(list.filter(p => p.submitted_task));
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (prog, status) => {
    const fb = feedback[prog.id] || "";
    await base44.entities.TrainingProgress.update(prog.id, {
      review_status: status,
      review_feedback: fb,
      reviewed_at: new Date().toISOString(),
    });
    toast.success(status === "approved" ? "Tarefa aprovada!" : "Revisão solicitada.");
    setFeedback(f => ({ ...f, [prog.id]: "" }));
    setExpanded(null);
    load();
  };

  if (submissions.length === 0) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-6 text-center">
        <ClipboardList className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Nenhuma tarefa submetida para revisão.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold flex items-center gap-2 text-sm">
        <ClipboardList className="w-4 h-4 text-primary" /> Tarefas Submetidas pelos Agentes
      </h3>
      {submissions.map(prog => {
        const meta = STATUS_META[prog.review_status || "pending"];
        const isOpen = expanded === prog.id;
        return (
          <div key={prog.id} className="rounded-xl border border-border/60 bg-card overflow-hidden">
            <button
              className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
              onClick={() => setExpanded(isOpen ? null : prog.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{prog.module_title || "Módulo"}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {prog.agent_name || prog.created_by} · {prog.updated_date ? format(new Date(prog.updated_date), "dd/MM/yyyy HH:mm") : "—"}
                </div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${meta.cls}`}>{meta.label}</span>
              {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
            </button>

            {isOpen && (
              <div className="px-4 pb-4 space-y-3 border-t border-border/40 pt-3">
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Resposta do agente:</div>
                  <div className="p-3 rounded-lg bg-muted/50 text-sm whitespace-pre-wrap">{prog.submitted_task}</div>
                </div>

                {prog.review_feedback && (
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Feedback anterior:</div>
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">{prog.review_feedback}</div>
                  </div>
                )}

                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Feedback (opcional):</div>
                  <Textarea
                    rows={3}
                    placeholder="Deixe um comentário para o agente..."
                    value={feedback[prog.id] || ""}
                    onChange={e => setFeedback(f => ({ ...f, [prog.id]: e.target.value }))}
                    className="text-sm"
                  />
                </div>

                <div className="flex gap-2">
                  <Button size="sm" className="bg-success hover:bg-success/80 text-white flex-1" onClick={() => updateStatus(prog, "approved")}>
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Aprovar
                  </Button>
                  <Button size="sm" variant="destructive" className="flex-1" onClick={() => updateStatus(prog, "revision")}>
                    <RotateCcw className="w-3.5 h-3.5 mr-1" /> Solicitar Revisão
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
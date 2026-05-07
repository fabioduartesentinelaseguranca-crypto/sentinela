import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Plus, CheckCircle2, XCircle, Users, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import AgentTaskReview from "./AgentTaskReview";

const CATEGORIES = {
  protocols: "Protocolos",
  legislation: "Legislação",
  first_aid: "Primeiros Socorros",
  communication: "Comunicação",
  tactical: "Tático",
};

const EMPTY_MODULE = { title: "", description: "", video_url: "", category: "protocols", passing_score: 70, quiz: [], active: true };

export default function TrainingManager() {
  const [modules, setModules] = useState([]);
  const [allProgress, setAllProgress] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_MODULE);
  const [quizInput, setQuizInput] = useState("");

  const load = async () => {
    const [mods, progs] = await Promise.all([
      base44.entities.TrainingModule.list("created_date", 100),
      base44.entities.TrainingProgress.list("-updated_date", 500),
    ]);
    setModules(mods);
    setAllProgress(progs);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(EMPTY_MODULE); setQuizInput(""); setDialogOpen(true); };
  const openEdit = (m) => { setEditing(m); setForm({ ...m }); setQuizInput(""); setDialogOpen(true); };

  const save = async () => {
    if (!form.title) { toast.error("Título obrigatório"); return; }
    if (editing) {
      await base44.entities.TrainingModule.update(editing.id, form);
    } else {
      await base44.entities.TrainingModule.create(form);
    }
    toast.success("Módulo salvo");
    setDialogOpen(false);
    load();
  };

  const deleteModule = async (id) => {
    await base44.entities.TrainingModule.delete(id);
    toast.info("Módulo removido");
    load();
  };

  const addQuestion = () => {
    if (!quizInput.trim()) return;
    const parts = quizInput.split("|").map((s) => s.trim());
    if (parts.length < 3) { toast.error("Formato: Pergunta | OpA | OpB | OpC | índice_correto"); return; }
    const correctIdx = parseInt(parts[parts.length - 1]);
    const options = parts.slice(1, parts.length - 1);
    setForm((f) => ({
      ...f,
      quiz: [...(f.quiz || []), { question: parts[0], options, correct: correctIdx }],
    }));
    setQuizInput("");
  };

  const getModuleStats = (moduleId) => {
    const progs = allProgress.filter((p) => p.module_id === moduleId);
    const passed = progs.filter((p) => p.status === "passed").length;
    return { total: progs.length, passed };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /> Módulos de Capacitação</h2>
        <Button size="sm" onClick={openNew}><Plus className="w-3.5 h-3.5 mr-1" /> Novo Módulo</Button>
      </div>

      {/* Progress summary */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <h3 className="text-sm font-medium mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-primary" /> Progresso da Equipe</h3>
        <div className="space-y-2">
          {modules.map((mod) => {
            const stats = getModuleStats(mod.id);
            return (
              <div key={mod.id} className="flex items-center gap-3 text-sm">
                <span className="flex-1 truncate text-xs">{mod.title}</span>
                <span className="text-xs text-muted-foreground">{stats.passed}/{stats.total} aprovados</span>
                <div className="w-24 bg-muted rounded-full h-1.5">
                  <div
                    className="bg-success h-1.5 rounded-full"
                    style={{ width: stats.total ? `${(stats.passed / stats.total) * 100}%` : "0%" }}
                  />
                </div>
              </div>
            );
          })}
          {modules.length === 0 && <div className="text-xs text-muted-foreground">Nenhum módulo cadastrado.</div>}
        </div>
      </div>

      {/* Module list */}
      <div className="space-y-2">
        {modules.map((mod) => {
          const stats = getModuleStats(mod.id);
          return (
            <div key={mod.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{mod.title}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {CATEGORIES[mod.category]} · {mod.quiz?.length || 0} perguntas · nota mín. {mod.passing_score}%
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3 h-3 text-success" />{stats.passed}
                <XCircle className="w-3 h-3 text-destructive" />{stats.total - stats.passed}
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${mod.active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                {mod.active ? "Ativo" : "Inativo"}
              </span>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(mod)}><Pencil className="w-3 h-3" /></Button>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteModule(mod.id)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Review */}
      <AgentTaskReview />

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Módulo" : "Novo Módulo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Título *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <Input placeholder="Descrição" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Input placeholder="URL do vídeo (YouTube embed)" value={form.video_url || ""} onChange={(e) => setForm({ ...form, video_url: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium">Categoria</label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">Nota mínima (%)</label>
                <Input type="number" value={form.passing_score || 70} onChange={(e) => setForm({ ...form, passing_score: +e.target.value })} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium">Perguntas do Quiz</label>
              <div className="text-[10px] text-muted-foreground">Formato: Pergunta | Opção A | Opção B | Opção C | índice_correto (0-based)</div>
              <div className="flex gap-2">
                <Input
                  placeholder="Ex: Qual o protocolo? | A | B | C | 1"
                  value={quizInput}
                  onChange={(e) => setQuizInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addQuestion()}
                />
                <Button size="sm" onClick={addQuestion}><Plus className="w-3.5 h-3.5" /></Button>
              </div>
              {(form.quiz || []).map((q, i) => (
                <div key={i} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-muted/50">
                  <span className="flex-1 truncate">{i + 1}. {q.question}</span>
                  <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setForm((f) => ({ ...f, quiz: f.quiz.filter((_, j) => j !== i) }))}>
                    <XCircle className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>

            <Button className="w-full" onClick={save}>Salvar Módulo</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
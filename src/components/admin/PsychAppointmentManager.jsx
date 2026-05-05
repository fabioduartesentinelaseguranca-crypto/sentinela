import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Brain, Calendar, AlertTriangle, Plus, CheckCircle2, Clock, User } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_LABELS = {
  scheduled: { label: "Agendado", color: "text-primary border-primary/30 bg-primary/10" },
  confirmed: { label: "Confirmado", color: "text-success border-success/30 bg-success/10" },
  completed: { label: "Concluído", color: "text-muted-foreground border-border bg-muted/20" },
  cancelled: { label: "Cancelado", color: "text-destructive border-destructive/30 bg-destructive/10" },
  no_show: { label: "Ausente", color: "text-warning border-warning/30 bg-warning/10" },
};

export default function PsychAppointmentManager() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [evals, setEvals] = useState([]);
  const [agents, setAgents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ agent_id: "", agent_name: "", scheduled_at: "", duration_min: 50, modality: "in_person", reason: "", is_urgent: false });

  const load = async () => {
    setLoading(true);
    const [apps, ev, ags] = await Promise.all([
      base44.entities.PsychAppointment.list("-created_date", 100),
      base44.entities.PsychEvaluation.filter({ is_critical: true }, "-created_date", 50),
      base44.entities.User.filter({ role: "agent" }),
    ]);
    setAppointments(apps);
    setEvals(ev);
    setAgents(ags);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    const agentObj = agents.find(a => a.id === form.agent_id);
    await base44.entities.PsychAppointment.create({
      ...form,
      agent_name: agentObj?.full_name || form.agent_id,
      psychologist_id: user?.id,
      psychologist_name: user?.full_name,
    });
    // Send alert email if urgent
    if (form.is_urgent) {
      await base44.integrations.Core.SendEmail({
        to: user?.email,
        subject: "⚠ Consulta Urgente Agendada",
        body: `Consulta urgente agendada para o agente ${agentObj?.full_name} em ${form.scheduled_at}. Verifique o painel psicológico.`,
      });
    }
    toast.success("Consulta agendada!");
    setShowForm(false);
    setForm({ agent_id: "", agent_name: "", scheduled_at: "", duration_min: 50, modality: "in_person", reason: "", is_urgent: false });
    load();
  };

  const updateStatus = async (id, status) => {
    await base44.entities.PsychAppointment.update(id, { status });
    toast.success("Status atualizado!");
    load();
  };

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-border border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      {/* Critical Evals Alert */}
      {evals.length > 0 && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-destructive text-sm">
            <AlertTriangle className="w-4 h-4" /> {evals.length} agente(s) em estado crítico de bem-estar
          </div>
          {evals.slice(0, 5).map(ev => (
            <div key={ev.id} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
                <span>{ev.agent_name || ev.agent_id}</span>
                <span className="text-muted-foreground">· Estresse: {ev.stress_level}/10 · Fadiga: {ev.fatigue_level}/10</span>
              </div>
              <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2" onClick={() => { setForm(p => ({ ...p, agent_id: ev.agent_id, is_urgent: true })); setShowForm(true); }}>
                Agendar urgente
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <h3 className="font-semibold flex items-center gap-2"><Brain className="w-4 h-4 text-primary" /> Consultas Agendadas</h3>
        <Button size="sm" onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-1" /> Agendar Consulta</Button>
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {appointments.length === 0 && <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-xl">Nenhuma consulta agendada.</div>}
        {appointments.map(ap => {
          const sc = STATUS_LABELS[ap.status] || STATUS_LABELS.scheduled;
          return (
            <div key={ap.id} className="rounded-xl border border-border/60 bg-card p-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{ap.agent_name || ap.agent_id}</span>
                  {ap.is_urgent && <span className="text-[10px] bg-destructive/10 text-destructive border border-destructive/30 px-1.5 py-0.5 rounded-full font-medium">URGENTE</span>}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${sc.color}`}>{sc.label}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{ap.scheduled_at ? format(parseISO(ap.scheduled_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "—"}</span>
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{ap.duration_min} min</span>
                  <span>{ap.modality === "online" ? "🌐 Online" : "🏢 Presencial"}</span>
                  <span className="text-muted-foreground/60">Psicólogo: {ap.psychologist_name || "—"}</span>
                </div>
                {ap.reason && <p className="text-xs text-muted-foreground italic">"{ap.reason}"</p>}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {ap.status === "scheduled" && (
                  <>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(ap.id, "confirmed")}><CheckCircle2 className="w-3 h-3 mr-1" /> Confirmar</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => updateStatus(ap.id, "cancelled")}>Cancelar</Button>
                  </>
                )}
                {ap.status === "confirmed" && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(ap.id, "completed")}>Marcar Concluído</Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Schedule Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Brain className="w-5 h-5 text-primary" /> Agendar Consulta Psicológica</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Agente</Label>
              <Select value={form.agent_id} onValueChange={v => setForm(p => ({ ...p, agent_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione o agente" /></SelectTrigger>
                <SelectContent>{agents.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Data e Hora</Label><Input type="datetime-local" className="mt-1" value={form.scheduled_at} onChange={e => setForm(p => ({ ...p, scheduled_at: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Duração (min)</Label>
                <Input type="number" className="mt-1" value={form.duration_min} onChange={e => setForm(p => ({ ...p, duration_min: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Modalidade</Label>
                <Select value={form.modality} onValueChange={v => setForm(p => ({ ...p, modality: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="in_person">Presencial</SelectItem><SelectItem value="online">Online</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Motivo / Observação</Label><Input className="mt-1" placeholder="Opcional — visível apenas ao psicólogo" value={form.reason} onChange={e => setForm(p => ({ ...p, reason: e.target.value }))} /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="urgent" checked={form.is_urgent} onChange={e => setForm(p => ({ ...p, is_urgent: e.target.checked }))} className="w-4 h-4" />
              <Label htmlFor="urgent" className="cursor-pointer">Consulta urgente (envia alerta ao gestor)</Label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!form.agent_id || !form.scheduled_at}>Agendar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
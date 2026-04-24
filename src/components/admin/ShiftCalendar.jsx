import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Plus, Trash2, Bell, Calendar } from "lucide-react";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const SHIFT_CFG = {
  morning: { label: "Manhã", color: "bg-amber-500/20 text-amber-300 border-amber-500/40", time: "06:00–14:00" },
  afternoon: { label: "Tarde", color: "bg-blue-500/20 text-blue-300 border-blue-500/40", time: "14:00–22:00" },
  night: { label: "Noite", color: "bg-purple-500/20 text-purple-300 border-purple-500/40", time: "22:00–06:00" },
};

const EMPTY = { agent_id: "", agent_name: "", vehicle_id: "", vehicle_name: "", zone_id: "", zone_name: "", date: "", shift_type: "morning", notes: "" };

export default function ShiftCalendar({ agents = [] }) {
  const [weekStart, setWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [shifts, setShifts] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [zones, setZones] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [sendingAlert, setSendingAlert] = useState(false);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const load = async () => {
    const startStr = format(weekStart, "yyyy-MM-dd");
    const endStr = format(addDays(weekStart, 6), "yyyy-MM-dd");
    const [s, v, z] = await Promise.all([
      base44.entities.ScheduledShift.list("-created_date", 500),
      base44.entities.Vehicle.filter({ status: "available" }),
      base44.entities.PatrolZone.list("created_date", 100),
    ]);
    setShifts(s.filter((sh) => sh.date >= startStr && sh.date <= endStr));
    setVehicles(v);
    setZones(z);
  };

  useEffect(() => { load(); }, [weekStart]);

  const openNew = (date) => {
    setForm({ ...EMPTY, date: format(date, "yyyy-MM-dd") });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.agent_id || !form.date) { toast.error("Agente e data são obrigatórios"); return; }
    const agent = agents.find((a) => a.id === form.agent_id);
    const vehicle = vehicles.find((v) => v.id === form.vehicle_id);
    const zone = zones.find((z) => z.id === form.zone_id);
    await base44.entities.ScheduledShift.create({
      ...form,
      agent_name: agent?.full_name || "",
      vehicle_name: vehicle ? `${vehicle.prefix} – ${vehicle.plate}` : "",
      zone_name: zone?.name || "",
    });
    toast.success("Escala salva");
    setDialogOpen(false);
    load();
  };

  const remove = async (id) => {
    await base44.entities.ScheduledShift.delete(id);
    load();
  };

  const sendAlerts = async () => {
    setSendingAlert(true);
    const today = format(new Date(), "yyyy-MM-dd");
    const todayShifts = shifts.filter((s) => s.date === today && !s.alert_sent);
    if (todayShifts.length === 0) { toast.info("Nenhuma escala de hoje sem alerta enviado."); setSendingAlert(false); return; }

    for (const sh of todayShifts) {
      const agent = agents.find((a) => a.id === sh.agent_id);
      if (agent?.email) {
        await base44.integrations.Core.SendEmail({
          to: agent.email,
          subject: `🚨 Sentinela – Início de turno hoje`,
          body: `Olá ${sh.agent_name},\n\nVocê está escalado para o turno de ${SHIFT_CFG[sh.shift_type]?.label} (${SHIFT_CFG[sh.shift_type]?.time}) hoje (${format(parseISO(sh.date), "dd/MM/yyyy")}).\n${sh.zone_name ? `Zona: ${sh.zone_name}` : ""}\n${sh.vehicle_name ? `Viatura: ${sh.vehicle_name}` : ""}\n\nBom turno!\nEquipe Sentinela`,
        }).catch(() => {});
      }
      await base44.entities.ScheduledShift.update(sh.id, { alert_sent: true });
    }
    toast.success(`${todayShifts.length} alerta(s) enviado(s)`);
    setSendingAlert(false);
    load();
  };

  const getShiftsForDay = (date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return shifts.filter((s) => s.date === dateStr);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Escalas Semanais</h3>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => subWeeks(w, 1))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium min-w-[180px] text-center">
            {format(weekStart, "dd/MM", { locale: ptBR })} – {format(addDays(weekStart, 6), "dd/MM/yyyy", { locale: ptBR })}
          </span>
          <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => addWeeks(w, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={sendAlerts} disabled={sendingAlert}>
            <Bell className="w-3.5 h-3.5 mr-1" /> {sendingAlert ? "Enviando..." : "Alertar hoje"}
          </Button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => {
          const dayShifts = getShiftsForDay(day);
          const isToday = isSameDay(day, new Date());
          return (
            <div key={day.toISOString()} className={`rounded-xl border min-h-[120px] p-2 space-y-1 ${isToday ? "border-primary/60 bg-primary/5" : "border-border/50 bg-card"}`}>
              <div className={`text-center text-xs font-medium mb-1.5 ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                <div>{format(day, "EEE", { locale: ptBR })}</div>
                <div className={`text-base font-bold ${isToday ? "text-primary" : "text-foreground"}`}>{format(day, "dd")}</div>
              </div>
              {dayShifts.map((sh) => {
                const cfg = SHIFT_CFG[sh.shift_type] || SHIFT_CFG.morning;
                return (
                  <div key={sh.id} className={`rounded-lg border px-1.5 py-1 text-[10px] leading-tight ${cfg.color} relative group`}>
                    <div className="font-medium truncate">{sh.agent_name}</div>
                    <div className="opacity-70 truncate">{cfg.label}</div>
                    {sh.zone_name && <div className="opacity-60 truncate">{sh.zone_name}</div>}
                    <button
                      onClick={() => remove(sh.id)}
                      className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 text-destructive transition-opacity"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  </div>
                );
              })}
              <button
                onClick={() => openNew(day)}
                className="w-full flex items-center justify-center rounded-lg border border-dashed border-border/50 py-0.5 text-[10px] text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <Plus className="w-2.5 h-2.5 mr-0.5" /> Escalar
              </button>
            </div>
          );
        })}
      </div>

      {/* Add shift dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Escala — {form.date && format(parseISO(form.date), "dd/MM/yyyy")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Agente *</label>
              <Select value={form.agent_id} onValueChange={(v) => setForm((f) => ({ ...f, agent_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecionar agente..." /></SelectTrigger>
                <SelectContent>
                  {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Turno *</label>
              <Select value={form.shift_type} onValueChange={(v) => setForm((f) => ({ ...f, shift_type: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SHIFT_CFG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label} ({v.time})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Viatura</label>
              <Select value={form.vehicle_id} onValueChange={(v) => setForm((f) => ({ ...f, vehicle_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Opcional..." /></SelectTrigger>
                <SelectContent>
                  {vehicles.map((v) => <SelectItem key={v.id} value={v.id}>{v.prefix} – {v.plate}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Zona de patrulha</label>
              <Select value={form.zone_id} onValueChange={(v) => setForm((f) => ({ ...f, zone_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Opcional..." /></SelectTrigger>
                <SelectContent>
                  {zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Observações</label>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Instruções especiais..." className="mt-1" />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save}><Plus className="w-4 h-4 mr-1" /> Salvar Escala</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
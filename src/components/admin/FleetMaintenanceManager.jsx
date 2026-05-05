import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Wrench, Plus, AlertTriangle, CheckCircle2, Calendar, Gauge } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, differenceInDays, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";

const TYPE_LABELS = {
  preventive: "Preventiva", corrective: "Corretiva",
  inspection: "Inspeção", tire: "Pneus", oil_change: "Troca de Óleo"
};

const STATUS_COLORS = {
  scheduled: "text-primary border-primary/30 bg-primary/10",
  in_progress: "text-warning border-warning/30 bg-warning/10",
  completed: "text-success border-success/30 bg-success/10",
  overdue: "text-destructive border-destructive/30 bg-destructive/10",
};

function getDerivedStatus(m) {
  if (m.status === "completed") return "completed";
  if (m.status === "in_progress") return "in_progress";
  if (m.scheduled_date && isPast(parseISO(m.scheduled_date)) && m.status !== "completed") return "overdue";
  return m.status || "scheduled";
}

export default function FleetMaintenanceManager() {
  const [vehicles, setVehicles] = useState([]);
  const [maintenances, setMaintenances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ vehicle_id: "", type: "preventive", scheduled_date: "", odometer_at_service: "", next_service_km: "", next_service_date: "", workshop: "", cost: 0, notes: "" });

  const load = async () => {
    setLoading(true);
    const [veh, maint] = await Promise.all([
      base44.entities.Vehicle.list("-created_date", 100),
      base44.entities.VehicleMaintenance.list("-created_date", 200),
    ]);
    setVehicles(veh);
    setMaintenances(maint);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const overdue = maintenances.filter(m => getDerivedStatus(m) === "overdue");
  const upcomingNext7 = maintenances.filter(m => {
    if (m.status === "completed" || !m.scheduled_date) return false;
    const days = differenceInDays(parseISO(m.scheduled_date), new Date());
    return days >= 0 && days <= 7;
  });

  // Also check vehicles where odometer is past next_service_km
  const kmAlerts = vehicles.filter(v => v.next_maintenance_km && v.odometer_km >= v.next_maintenance_km);

  const handleSave = async () => {
    const vehicle = vehicles.find(v => v.id === form.vehicle_id);
    await base44.entities.VehicleMaintenance.create({
      ...form,
      vehicle_prefix: vehicle?.prefix || "",
      vehicle_plate: vehicle?.plate || "",
      status: "scheduled",
      odometer_at_service: Number(form.odometer_at_service) || 0,
      next_service_km: Number(form.next_service_km) || 0,
      cost: Number(form.cost) || 0,
    });
    // Update vehicle next maintenance km if set
    if (form.next_service_km && vehicle) {
      await base44.entities.Vehicle.update(vehicle.id, { next_maintenance_km: Number(form.next_service_km) });
    }
    toast.success("Manutenção agendada!");
    setShowForm(false);
    setForm({ vehicle_id: "", type: "preventive", scheduled_date: "", odometer_at_service: "", next_service_km: "", next_service_date: "", workshop: "", cost: 0, notes: "" });
    load();
  };

  const updateStatus = async (id, status) => {
    await base44.entities.VehicleMaintenance.update(id, { status, ...(status === "completed" ? { completed_date: new Date().toISOString().split("T")[0] } : {}) });
    toast.success("Status atualizado!");
    load();
  };

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-border border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      {/* Alerts */}
      {(overdue.length > 0 || upcomingNext7.length > 0 || kmAlerts.length > 0) && (
        <div className="rounded-xl border border-warning/40 bg-warning/5 p-4 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-warning text-sm mb-1">
            <AlertTriangle className="w-4 h-4" /> Alertas de frota
          </div>
          {overdue.map(m => (
            <div key={m.id} className="text-xs text-destructive flex items-center gap-2">
              🔴 <span className="font-medium">{m.vehicle_prefix}</span> — {TYPE_LABELS[m.type]} <span className="text-muted-foreground">atrasada desde {m.scheduled_date ? format(parseISO(m.scheduled_date), "dd/MM/yyyy") : "—"}</span>
            </div>
          ))}
          {upcomingNext7.map(m => (
            <div key={m.id} className="text-xs text-warning flex items-center gap-2">
              🟡 <span className="font-medium">{m.vehicle_prefix}</span> — {TYPE_LABELS[m.type]} <span className="text-muted-foreground">em {m.scheduled_date ? format(parseISO(m.scheduled_date), "dd/MM/yyyy") : "—"}</span>
            </div>
          ))}
          {kmAlerts.map(v => (
            <div key={v.id} className="text-xs text-orange-400 flex items-center gap-2">
              🟠 <span className="font-medium">{v.prefix}</span> <span className="text-muted-foreground">— KM atual {v.odometer_km} atingiu limite de {v.next_maintenance_km} km</span>
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex justify-between items-center">
        <h3 className="font-semibold flex items-center gap-2"><Wrench className="w-4 h-4 text-primary" /> Manutenções da Frota</h3>
        <Button size="sm" onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-1" /> Agendar Manutenção</Button>
      </div>

      {/* List */}
      <div className="space-y-2">
        {maintenances.length === 0 && <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-xl">Nenhuma manutenção cadastrada.</div>}
        {maintenances.map(m => {
          const ds = getDerivedStatus(m);
          const sc = STATUS_COLORS[ds] || STATUS_COLORS.scheduled;
          return (
            <div key={m.id} className="rounded-xl border border-border/60 bg-card p-4 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{m.vehicle_prefix || m.vehicle_id}</span>
                  <span className="text-xs text-muted-foreground">{m.vehicle_plate}</span>
                  <span className="text-xs bg-muted/40 border border-border/60 px-2 py-0.5 rounded-full">{TYPE_LABELS[m.type] || m.type}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${sc}`}>{ds === "scheduled" ? "Agendado" : ds === "in_progress" ? "Em execução" : ds === "completed" ? "Concluído" : "Atrasado"}</span>
                </div>
                <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                  {m.scheduled_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{format(parseISO(m.scheduled_date), "dd/MM/yyyy")}</span>}
                  {m.odometer_at_service > 0 && <span className="flex items-center gap-1"><Gauge className="w-3 h-3" />{m.odometer_at_service.toLocaleString()} km</span>}
                  {m.workshop && <span>🏭 {m.workshop}</span>}
                  {m.cost > 0 && <span>💰 R$ {m.cost.toFixed(2)}</span>}
                </div>
                {m.notes && <p className="text-xs text-muted-foreground italic">{m.notes}</p>}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {ds === "scheduled" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(m.id, "in_progress")}>Iniciar</Button>}
                {ds === "in_progress" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => updateStatus(m.id, "completed")}><CheckCircle2 className="w-3 h-3 mr-1" /> Concluir</Button>}
                {ds === "overdue" && <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => updateStatus(m.id, "in_progress")}>Iniciar agora</Button>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Schedule Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Wrench className="w-5 h-5 text-primary" /> Agendar Manutenção</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Viatura</Label>
              <Select value={form.vehicle_id} onValueChange={v => setForm(p => ({ ...p, vehicle_id: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a viatura" /></SelectTrigger>
                <SelectContent>{vehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.prefix} — {v.plate}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Data agendada</Label><Input type="date" className="mt-1" value={form.scheduled_date} onChange={e => setForm(p => ({ ...p, scheduled_date: e.target.value }))} /></div>
              <div><Label>KM atual</Label><Input type="number" className="mt-1" placeholder="0" value={form.odometer_at_service} onChange={e => setForm(p => ({ ...p, odometer_at_service: e.target.value }))} /></div>
              <div><Label>Próx. revisão (KM)</Label><Input type="number" className="mt-1" placeholder="ex: 10000" value={form.next_service_km} onChange={e => setForm(p => ({ ...p, next_service_km: e.target.value }))} /></div>
              <div><Label>Próx. revisão (data)</Label><Input type="date" className="mt-1" value={form.next_service_date} onChange={e => setForm(p => ({ ...p, next_service_date: e.target.value }))} /></div>
              <div><Label>Oficina</Label><Input className="mt-1" value={form.workshop} onChange={e => setForm(p => ({ ...p, workshop: e.target.value }))} /></div>
              <div><Label>Custo estimado (R$)</Label><Input type="number" className="mt-1" value={form.cost} onChange={e => setForm(p => ({ ...p, cost: e.target.value }))} /></div>
            </div>
            <div><Label>Observações</Label><Input className="mt-1" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!form.vehicle_id || !form.type}>Agendar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
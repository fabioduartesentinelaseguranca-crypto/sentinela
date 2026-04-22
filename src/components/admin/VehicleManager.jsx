import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Car, Wrench, AlertTriangle, CheckCircle2, UserCheck, Pencil } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_CFG = {
  available:   { label: "Disponível",  color: "text-success",     bg: "bg-success/10",     icon: CheckCircle2 },
  on_patrol:   { label: "Em patrulha", color: "text-primary",     bg: "bg-primary/10",     icon: Car },
  maintenance: { label: "Manutenção",  color: "text-warning",     bg: "bg-warning/10",     icon: Wrench },
  inactive:    { label: "Inativa",     color: "text-muted-foreground", bg: "bg-muted/40",  icon: AlertTriangle },
};

const EMPTY = { prefix: "", plate: "", model: "", status: "available", odometer_km: 0, daily_km: 0, next_maintenance_km: 0, notes: "" };

export default function VehicleManager({ agents = [] }) {
  const [vehicles, setVehicles] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const load = async () => {
    const v = await base44.entities.Vehicle.list("-created_date", 100);
    setVehicles(v);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (v) => { setEditing(v); setForm({ ...v }); setDialogOpen(true); };

  const save = async () => {
    if (!form.prefix || !form.plate) { toast.error("Prefixo e placa obrigatórios"); return; }
    if (editing) {
      await base44.entities.Vehicle.update(editing.id, form);
    } else {
      await base44.entities.Vehicle.create(form);
    }
    toast.success(editing ? "Viatura atualizada" : "Viatura cadastrada");
    setDialogOpen(false);
    load();
  };

  const autoAssign = async () => {
    const available = vehicles.filter((v) => v.status === "available");
    const unassigned = agents.filter((a) => !vehicles.some((v) => v.assigned_agent_id === a.id));
    const pairs = Math.min(available.length, unassigned.length);
    for (let i = 0; i < pairs; i++) {
      await base44.entities.Vehicle.update(available[i].id, {
        assigned_agent_id: unassigned[i].id,
        assigned_agent_name: unassigned[i].full_name,
        status: "on_patrol",
      });
    }
    toast.success(`${pairs} viatura(s) atribuída(s) automaticamente`);
    load();
  };

  const needsMaintenance = (v) => v.next_maintenance_km && v.odometer_km >= v.next_maintenance_km;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold flex items-center gap-2"><Car className="w-4 h-4 text-primary" /> Controle de Viaturas</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={autoAssign}>
            <UserCheck className="w-3.5 h-3.5 mr-1" /> Atribuição Automática
          </Button>
          <Button size="sm" onClick={openNew}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Nova Viatura
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Object.entries(STATUS_CFG).map(([key, cfg]) => {
          const Icon = cfg.icon;
          const count = vehicles.filter((v) => v.status === key).length;
          return (
            <div key={key} className={`p-3 rounded-xl border border-border/40 ${cfg.bg} flex items-center gap-3`}>
              <Icon className={`w-5 h-5 ${cfg.color}`} />
              <div>
                <div className="text-lg font-bold">{count}</div>
                <div className={`text-xs ${cfg.color}`}>{cfg.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Vehicle table */}
      <div className="rounded-2xl border border-border/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Viatura</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Status</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">KM</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Agente</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Manutenção</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {vehicles.map((v) => {
              const cfg = STATUS_CFG[v.status] || STATUS_CFG.inactive;
              const Icon = cfg.icon;
              const maint = needsMaintenance(v);
              return (
                <tr key={v.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium font-mono">{v.prefix}</div>
                    <div className="text-xs text-muted-foreground">{v.plate} {v.model && `· ${v.model}`}</div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
                      <Icon className="w-3 h-3" /> {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="font-mono text-xs">{(v.odometer_km || 0).toLocaleString()} km</div>
                    <div className="text-[10px] text-muted-foreground">hoje: {v.daily_km || 0} km</div>
                    {maint && <div className="text-[10px] text-warning font-medium mt-0.5">⚠ Revisão devida</div>}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                    {v.assigned_agent_name || "—"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                    {v.last_maintenance_date
                      ? format(new Date(v.last_maintenance_date), "dd/MM/yyyy", { locale: ptBR })
                      : "—"}
                    {v.next_maintenance_km && (
                      <div className="text-[10px]">próx. {v.next_maintenance_km.toLocaleString()} km</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(v)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                  </td>
                </tr>
              );
            })}
            {vehicles.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Nenhuma viatura cadastrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Form Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Viatura" : "Nova Viatura"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Prefixo *</label>
                <Input placeholder="RP-01" value={form.prefix} onChange={(e) => setForm({ ...form, prefix: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Placa *</label>
                <Input placeholder="ABC-1234" value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Modelo</label>
              <Input placeholder="VW Amarok 2023" value={form.model || ""} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Status</label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CFG).map(([k, c]) => (
                    <SelectItem key={k} value={k}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Odômetro (km)</label>
                <Input type="number" value={form.odometer_km || 0} onChange={(e) => setForm({ ...form, odometer_km: +e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">KM hoje</label>
                <Input type="number" value={form.daily_km || 0} onChange={(e) => setForm({ ...form, daily_km: +e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Última manutenção</label>
                <Input type="date" value={form.last_maintenance_date || ""} onChange={(e) => setForm({ ...form, last_maintenance_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Próx. revisão (km)</label>
                <Input type="number" value={form.next_maintenance_km || ""} onChange={(e) => setForm({ ...form, next_maintenance_km: +e.target.value })} />
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium">Observações</label>
              <Input value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <Button className="w-full" onClick={save}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
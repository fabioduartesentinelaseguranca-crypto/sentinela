import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Car, LogIn, LogOut, Clock, ClipboardList, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { nowISO } from "@/lib/deviceTime";
import { toast } from "sonner";
import VehicleChecklistDialog from "@/components/agent/VehicleChecklistDialog";

export default function ShiftManager({ userId }) {
  const [active, setActive] = useState(null);
  const [plate, setPlate] = useState("");
  const [prefix, setPrefix] = useState("");
  const [checklistDone, setChecklistDone] = useState(false);
  const [checklistOpen, setChecklistOpen] = useState(false);

  const load = async () => {
    if (!userId) return;
    const list = await base44.entities.Shift.filter({ agent_id: userId, status: "active" }, "-created_date", 1);
    setActive(list[0] || null);
  };

  useEffect(() => { load(); }, [userId]);

  const checkIn = async () => {
    if (!prefix) return toast.error("Informe o prefixo");
    if (!checklistDone) return toast.error("Realize o checklist da viatura antes de iniciar o turno.");
    await base44.entities.Shift.create({
      agent_id: userId,
      vehicle_plate: plate,
      vehicle_prefix: prefix,
      start_time: nowISO(),
      status: "active",
    });
    setPlate(""); setPrefix("");
    load();
    toast.success("Check-in realizado");
  };

  const checkOut = async () => {
    if (!active) return;
    await base44.entities.Shift.update(active.id, {
      end_time: nowISO(),
      status: "ended",
    });
    load();
    toast.success("Check-out realizado");
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Car className="w-4 h-4 text-primary" />
        <h3 className="font-semibold">Escala de Serviço</h3>
      </div>

      {active ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider">Em serviço</div>
              <div className="text-2xl font-bold font-mono mt-1">{active.vehicle_prefix}</div>
              {active.vehicle_plate && <div className="text-xs text-muted-foreground font-mono mt-0.5">{active.vehicle_plate}</div>}
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end"><Clock className="w-3 h-3" /> Início</div>
              <div className="text-sm font-mono">{format(new Date(active.start_time), "dd/MM HH:mm")}</div>
            </div>
          </div>
          <Button variant="destructive" onClick={checkOut} className="w-full">
            <LogOut className="w-4 h-4 mr-2" /> Check-out
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Prefixo</Label>
            <Input value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} placeholder="VTR-0042" className="font-mono mt-1" />
          </div>
          <div>
            <Label className="text-xs">Placa (opcional)</Label>
            <Input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="ABC1D23" className="font-mono mt-1" />
          </div>
          {!checklistDone ? (
            <Button variant="outline" onClick={() => { if (!prefix) { toast.error("Informe o prefixo primeiro"); return; } setChecklistOpen(true); }} className="w-full border-warning/40 text-warning hover:bg-warning/10">
              <ClipboardList className="w-4 h-4 mr-2" /> Fazer Checklist da Viatura
            </Button>
          ) : (
            <div className="flex items-center gap-2 text-success text-xs mb-1">
              <CheckCircle2 className="w-4 h-4" /> Checklist aprovado
            </div>
          )}
          <Button onClick={checkIn} className="w-full" disabled={!checklistDone}>
            <LogIn className="w-4 h-4 mr-2" /> Check-in
          </Button>
        </div>
      )}
      <VehicleChecklistDialog
        open={checklistOpen}
        onOpenChange={setChecklistOpen}
        agentId={userId}
        agentName=""
        vehicleId={prefix}
        vehiclePrefix={prefix}
        onChecklistApproved={() => { setChecklistDone(true); setChecklistOpen(false); }}
      />
    </div>
  );
}
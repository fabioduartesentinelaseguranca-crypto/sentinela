import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CheckSquare, XSquare, AlertTriangle, CheckCircle2, ClipboardList } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import { todayDate, nowISO } from "@/lib/deviceTime";

const CHECKLIST_ITEMS = [
  { key: "fuel_ok", label: "Combustível", critical: true, description: "Nível acima de 1/4" },
  { key: "tires_ok", label: "Pneus", critical: true, description: "Sem furos ou desgaste excessivo" },
  { key: "signals_ok", label: "Sinalização", critical: true, description: "Giroflex, sirene e pisca funcionando" },
  { key: "lights_ok", label: "Faróis e Lanternas", critical: true, description: "Todos funcionando" },
  { key: "fire_extinguisher_ok", label: "Extintor", critical: false, description: "Presente e dentro da validade" },
  { key: "first_aid_ok", label: "Kit Primeiros Socorros", critical: false, description: "Completo e acessível" },
  { key: "radio_ok", label: "Rádio / Comunicação", critical: false, description: "Rádio ligado e com sinal" },
];

function CheckItem({ item, value, onChange }) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${value === true ? "border-success/40 bg-success/5" : value === false ? "border-destructive/40 bg-destructive/5" : "border-border/60 bg-card"}`}>
      <div className="flex items-start gap-3 flex-1">
        {item.critical && (
          <span className="text-[10px] font-medium text-destructive bg-destructive/10 px-1.5 py-0.5 rounded mt-0.5">CRÍTICO</span>
        )}
        <div>
          <div className="text-sm font-medium">{item.label}</div>
          <div className="text-xs text-muted-foreground">{item.description}</div>
        </div>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={() => onChange(true)}
          className={`p-1.5 rounded-lg transition-colors ${value === true ? "text-success bg-success/20" : "text-muted-foreground hover:text-success"}`}
        >
          <CheckSquare className="w-5 h-5" />
        </button>
        <button
          onClick={() => onChange(false)}
          className={`p-1.5 rounded-lg transition-colors ${value === false ? "text-destructive bg-destructive/20" : "text-muted-foreground hover:text-destructive"}`}
        >
          <XSquare className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

export default function VehicleChecklistDialog({ open, onOpenChange, agentId, agentName, vehicleId, vehiclePrefix, onChecklistApproved }) {
  const [checks, setChecks] = useState({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // "approved" | "blocked"

  const setCheck = (key, val) => setChecks((prev) => ({ ...prev, [key]: val }));

  const unanswered = CHECKLIST_ITEMS.filter((i) => checks[i.key] === undefined).length;
  const criticalFails = CHECKLIST_ITEMS.filter((i) => i.critical && checks[i.key] === false);
  const isBlocked = criticalFails.length > 0;

  const submit = async () => {
    if (unanswered > 0) { toast.error(`Responda todos os itens (${unanswered} pendente${unanswered > 1 ? "s" : ""})`); return; }
    setLoading(true);
    const status = isBlocked ? "blocked" : "approved";
    await base44.entities.VehicleChecklist.create({
      agent_id: agentId,
      agent_name: agentName,
      vehicle_id: vehicleId,
      vehicle_prefix: vehiclePrefix,
      shift_date: todayDate(),
      ...CHECKLIST_ITEMS.reduce((acc, i) => ({ ...acc, [i.key]: checks[i.key] }), {}),
      critical_issues: criticalFails.map((i) => i.label),
      notes,
      status,
    });
    setResult(status);
    setLoading(false);
    if (status === "approved") {
      toast.success("Checklist aprovado — Boa patrulha!");
      onChecklistApproved?.();
    } else {
      toast.error("Checklist bloqueado — Viatura com pendências críticas.");
    }
  };

  const handleClose = () => {
    setChecks({});
    setNotes("");
    setResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Checklist da Viatura — {vehiclePrefix || ""}
          </DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="py-8 text-center space-y-3">
            {result === "approved" ? (
              <>
                <CheckCircle2 className="w-16 h-16 text-success mx-auto" />
                <h3 className="text-lg font-bold text-success">Viatura Aprovada</h3>
                <p className="text-sm text-muted-foreground">Todos os itens críticos foram verificados. Boa patrulha!</p>
              </>
            ) : (
              <>
                <AlertTriangle className="w-16 h-16 text-destructive mx-auto" />
                <h3 className="text-lg font-bold text-destructive">Turno Bloqueado</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  A viatura possui pendências críticas. Notifique a manutenção antes de iniciar o turno.
                </p>
                <div className="space-y-1">
                  {criticalFails.map((i) => (
                    <div key={i.key} className="text-xs text-destructive flex items-center gap-1.5 justify-center">
                      <XSquare className="w-3.5 h-3.5" /> {i.label}
                    </div>
                  ))}
                </div>
              </>
            )}
            <Button variant="outline" onClick={handleClose} className="mt-4">Fechar</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              {CHECKLIST_ITEMS.map((item) => (
                <CheckItem key={item.key} item={item} value={checks[item.key]} onChange={(v) => setCheck(item.key, v)} />
              ))}
            </div>

            <Textarea
              placeholder="Observações adicionais (opcional)"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            {isBlocked && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Itens críticos com problema: <strong>{criticalFails.map((i) => i.label).join(", ")}</strong>. O turno será bloqueado.</span>
              </div>
            )}

            <Button
              className="w-full"
              onClick={submit}
              disabled={loading}
              variant={isBlocked ? "destructive" : "default"}
            >
              {loading ? "Salvando..." : isBlocked ? "Registrar e Bloquear Turno" : "Confirmar Checklist"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
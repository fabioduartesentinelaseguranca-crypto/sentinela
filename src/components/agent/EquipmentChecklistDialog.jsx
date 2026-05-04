import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import { CheckCircle2, AlertTriangle, Package, Wrench } from "lucide-react";

const ITEMS = [
  { key: "radio_status", label: "Rádio / Comunicação", icon: "📻", critical: true },
  { key: "weapon_status", label: "Armamento", icon: "🔫", critical: true },
  { key: "vest_status", label: "Colete Balístico", icon: "🛡️", critical: true },
  { key: "medical_kit_status", label: "Kit Médico / Primeiros Socorros", icon: "🩺", critical: false },
  { key: "handcuff_status", label: "Algemas", icon: "⛓️", critical: false },
  { key: "flashlight_status", label: "Lanterna", icon: "🔦", critical: false },
  { key: "baton_status", label: "Bastão / Tonfa", icon: "🥢", critical: false },
];

const STATUS_OPTS = [
  { value: "ok", label: "OK", color: "text-success bg-success/10 border-success/30" },
  { value: "inoperante", label: "Inoperante", color: "text-destructive bg-destructive/10 border-destructive/30" },
  { value: "ausente", label: "Ausente", color: "text-warning bg-warning/10 border-warning/30" },
];

function ItemRow({ item, value, onChange }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-card">
      <div className="flex items-center gap-3">
        <span className="text-xl">{item.icon}</span>
        <div>
          <div className="text-sm font-medium">{item.label}</div>
          {item.critical && <span className="text-[10px] text-destructive font-semibold">CRÍTICO</span>}
        </div>
      </div>
      <div className="flex gap-1">
        {STATUS_OPTS.map((opt) => (
          <button key={opt.value} onClick={() => onChange(opt.value)}
            className={`text-[10px] font-semibold px-2 py-1 rounded-lg border transition-colors ${value === opt.value ? opt.color : "text-muted-foreground border-border/40 hover:border-border"}`}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function EquipmentChecklistDialog({ open, onOpenChange, agentId, agentName, shiftId }) {
  const [checks, setChecks] = useState({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const setCheck = (key, val) => setChecks((p) => ({ ...p, [key]: val }));

  const inoperante = ITEMS.filter((i) => checks[i.key] === "inoperante" || checks[i.key] === "ausente");
  const unanswered = ITEMS.filter((i) => !checks[i.key]).length;

  const submit = async () => {
    if (unanswered > 0) { toast.error(`${unanswered} item(s) não respondido(s)`); return; }
    setLoading(true);
    const record = {
      agent_id: agentId,
      agent_name: agentName,
      shift_id: shiftId,
      shift_date: format(new Date(), "yyyy-MM-dd"),
      inoperante_items: inoperante.map((i) => i.label),
      notes,
      maintenance_alert_sent: false,
      ...ITEMS.reduce((acc, i) => ({ ...acc, [i.key]: checks[i.key] || "ok" }), {}),
    };
    await base44.entities.EquipmentChecklist.create(record);

    // Send maintenance alert if inoperantes exist
    if (inoperante.length > 0) {
      await base44.entities.SystemLog.create({
        event: "equipment_inoperante",
        actor_id: agentId,
        actor_name: agentName,
        details: `Equipamentos inoperantes: ${inoperante.map((i) => i.label).join(", ")}`,
        severity: inoperante.some((i) => ITEMS.find((it) => it.key === i.key)?.critical) ? "critical" : "warning",
      });
      // Notify via email (best effort)
      try {
        await base44.integrations.Core.SendEmail({
          to: "admin@sentinela.gov",
          subject: `⚠ Alerta de Manutenção — Agente ${agentName}`,
          body: `O agente ${agentName} registrou os seguintes equipamentos inoperantes/ausentes em ${format(new Date(), "dd/MM/yyyy HH:mm")}:\n\n${inoperante.map((i) => `• ${i.label}`).join("\n")}\n\nVerifique e providencie manutenção.`,
        });
      } catch (_) {}
      toast.error(`Alerta enviado para manutenção: ${inoperante.map((i) => i.label).join(", ")}`);
    } else {
      toast.success("Checklist de equipamentos concluído — Tudo OK!");
    }

    setDone(true);
    setLoading(false);
  };

  const handleClose = () => {
    setChecks({});
    setNotes("");
    setDone(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" /> Checklist de Equipamentos
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="py-8 text-center space-y-3">
            {inoperante.length > 0 ? (
              <>
                <AlertTriangle className="w-14 h-14 text-destructive mx-auto" />
                <h3 className="text-lg font-bold text-destructive">Alerta de Manutenção Enviado</h3>
                <p className="text-sm text-muted-foreground">Os seguintes itens requerem atenção:</p>
                {inoperante.map((i) => (
                  <div key={i.key} className="text-sm text-destructive">{i.icon} {i.label}</div>
                ))}
              </>
            ) : (
              <>
                <CheckCircle2 className="w-14 h-14 text-success mx-auto" />
                <h3 className="text-lg font-bold text-success">Todos os Equipamentos OK</h3>
                <p className="text-sm text-muted-foreground">Checklist registrado com sucesso.</p>
              </>
            )}
            <Button variant="outline" onClick={handleClose}>Fechar</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Registre o status de cada equipamento antes de iniciar o turno.</p>
            <div className="space-y-2">
              {ITEMS.map((item) => (
                <ItemRow key={item.key} item={item} value={checks[item.key]} onChange={(v) => setCheck(item.key, v)} />
              ))}
            </div>
            {inoperante.length > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                <Wrench className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Itens problemáticos: <strong>{inoperante.map((i) => i.label).join(", ")}</strong>. Um alerta será enviado para manutenção.</span>
              </div>
            )}
            <Textarea rows={2} placeholder="Observações adicionais..." value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Button className="w-full" onClick={submit} disabled={loading}>
              {loading ? "Registrando..." : "Confirmar Checklist"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
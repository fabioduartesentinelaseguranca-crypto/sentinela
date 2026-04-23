import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Wrench, CheckCircle2, XCircle, Clock, Car, Package, AlertTriangle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_CFG = {
  open: { label: "Aberto", cls: "bg-warning/20 text-warning" },
  approved: { label: "Aprovado", cls: "bg-primary/20 text-primary" },
  in_repair: { label: "Em Reparo", cls: "bg-blue-500/20 text-blue-400" },
  resolved: { label: "Resolvido", cls: "bg-success/20 text-success" },
  rejected: { label: "Rejeitado", cls: "bg-destructive/20 text-destructive" },
};

const PRIORITY_CFG = {
  low: { label: "Baixa", cls: "text-muted-foreground" },
  medium: { label: "Média", cls: "text-warning" },
  high: { label: "Alta", cls: "text-destructive" },
  critical: { label: "Crítico", cls: "text-emergency font-bold" },
};

export default function MaintenanceManager() {
  const [tickets, setTickets] = useState([]);
  const [selected, setSelected] = useState(null);
  const [managerNotes, setManagerNotes] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);

  const load = () => base44.entities.MaintenanceTicket.list("-created_date", 200).then(setTickets);

  useEffect(() => { load(); }, []);

  const openDetail = (ticket) => {
    setSelected(ticket);
    setManagerNotes(ticket.manager_notes || "");
    setDetailOpen(true);
  };

  const updateStatus = async (newStatus) => {
    await base44.entities.MaintenanceTicket.update(selected.id, { status: newStatus, manager_notes: managerNotes });

    // Update vehicle/item status if approved or rejected
    if (selected.item_type === "vehicle") {
      if (newStatus === "approved" || newStatus === "in_repair") {
        await base44.entities.Vehicle.update(selected.item_id, { status: "maintenance" }).catch(() => {});
      } else if (newStatus === "resolved") {
        await base44.entities.Vehicle.update(selected.item_id, { status: "available" }).catch(() => {});
      }
    } else if (selected.item_type === "tactical_item") {
      if (newStatus === "approved" || newStatus === "in_repair") {
        await base44.entities.TacticalItem.update(selected.item_id, { status: "maintenance_due" }).catch(() => {});
      } else if (newStatus === "resolved") {
        await base44.entities.TacticalItem.update(selected.item_id, { status: "ok" }).catch(() => {});
      }
    }

    toast.success(`Chamado atualizado para "${STATUS_CFG[newStatus]?.label}"`);
    setDetailOpen(false);
    load();
  };

  const openCount = tickets.filter((t) => t.status === "open").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Wrench className="w-5 h-5 text-warning" />
        <h3 className="font-semibold">Chamados de Manutenção</h3>
        {openCount > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-warning/20 text-warning font-medium flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> {openCount} aberto{openCount > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="rounded-2xl border border-border/60 overflow-hidden">
        {tickets.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum chamado registrado.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60 bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Item</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground hidden md:table-cell">Agente</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Prioridade</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground hidden md:table-cell">Data</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">Ação</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => {
                const sc = STATUS_CFG[t.status] || STATUS_CFG.open;
                const pc = PRIORITY_CFG[t.priority] || PRIORITY_CFG.medium;
                return (
                  <tr key={t.id} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {t.item_type === "vehicle" ? <Car className="w-3.5 h-3.5 text-primary flex-shrink-0" /> : <Package className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                        <span className="font-medium truncate max-w-[140px]">{t.item_name}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground ml-5 line-clamp-1 mt-0.5">{t.description}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">{t.reported_by_name}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium ${pc.cls}`}>{pc.label}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${sc.cls}`}>{sc.label}</span>
                    </td>
                    <td className="px-4 py-3 text-center text-[10px] text-muted-foreground font-mono hidden md:table-cell">
                      {format(new Date(t.created_date), "dd/MM HH:mm")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button size="sm" variant="ghost" onClick={() => openDetail(t)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-warning" /> Chamado — {selected?.item_name}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground text-xs">Tipo</span><div className="font-medium capitalize">{selected.item_type === "vehicle" ? "Viatura" : "Equipamento"}</div></div>
                <div><span className="text-muted-foreground text-xs">Prioridade</span><div className={`font-medium ${PRIORITY_CFG[selected.priority]?.cls}`}>{PRIORITY_CFG[selected.priority]?.label}</div></div>
                <div><span className="text-muted-foreground text-xs">Reportado por</span><div className="font-medium">{selected.reported_by_name}</div></div>
                <div><span className="text-muted-foreground text-xs">Status atual</span><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_CFG[selected.status]?.cls}`}>{STATUS_CFG[selected.status]?.label}</span></div>
              </div>

              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">Descrição da falha</div>
                <p className="text-sm p-3 rounded-lg bg-muted/40 border border-border/60">{selected.description}</p>
              </div>

              {selected.photo_urls?.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-2">Fotos anexadas ({selected.photo_urls.length})</div>
                  <div className="flex gap-2 flex-wrap">
                    {selected.photo_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        <img src={url} alt={`foto-${i}`} className="w-20 h-20 object-cover rounded-lg border border-border/60 hover:opacity-80 transition-opacity" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-medium">Notas do gestor</label>
                <Textarea
                  value={managerNotes}
                  onChange={(e) => setManagerNotes(e.target.value)}
                  placeholder="Observações, número da OS, prazo estimado..."
                  className="mt-1 resize-none min-h-[80px]"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {selected.status === "open" && (
                  <>
                    <Button size="sm" onClick={() => updateStatus("approved")} className="flex-1">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Aprovar envio
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => updateStatus("rejected")} className="flex-1">
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Rejeitar
                    </Button>
                  </>
                )}
                {selected.status === "approved" && (
                  <Button size="sm" onClick={() => updateStatus("in_repair")} className="flex-1">
                    <Wrench className="w-3.5 h-3.5 mr-1" /> Marcar em reparo
                  </Button>
                )}
                {(selected.status === "in_repair" || selected.status === "approved") && (
                  <Button size="sm" variant="outline" onClick={() => updateStatus("resolved")} className="flex-1">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-success" /> Marcar resolvido
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
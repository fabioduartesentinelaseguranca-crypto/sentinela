import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, Radio, Flashlight, AlertTriangle, Plus, Pencil, ArrowDownLeft, ArrowUpRight, Package } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";

const CATEGORY_CFG = {
  vest: { label: "Colete", icon: Shield },
  radio: { label: "Rádio", icon: Radio },
  flashlight: { label: "Lanterna", icon: Flashlight },
  handcuff: { label: "Algemas", icon: Package },
  first_aid: { label: "Kit Primeiros Socorros", icon: Plus },
  other: { label: "Outros", icon: Package },
};

const EMPTY_ITEM = { name: "", category: "other", serial_number: "", total_quantity: 1, available_quantity: 1, min_quantity: 1, maintenance_interval_days: 365, last_maintenance_date: "", notes: "" };

function itemAlerts(item) {
  const alerts = [];
  if (item.available_quantity <= item.min_quantity) alerts.push("estoque_baixo");
  if (item.last_maintenance_date && item.maintenance_interval_days) {
    const days = differenceInDays(new Date(), new Date(item.last_maintenance_date));
    if (days >= item.maintenance_interval_days) alerts.push("manutencao_devida");
  }
  return alerts;
}

export default function InventoryManager({ agents = [] }) {
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [moveDialog, setMoveDialog] = useState(null); // item being moved
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_ITEM);
  const [moveForm, setMoveForm] = useState({ type: "checkout", quantity: 1, agent_id: "", notes: "" });

  const load = async () => {
    const [its, movs] = await Promise.all([
      base44.entities.TacticalItem.list("created_date", 200),
      base44.entities.StockMovement.list("-created_date", 100),
    ]);
    setItems(its);
    setMovements(movs);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(EMPTY_ITEM); setDialogOpen(true); };
  const openEdit = (item) => { setEditing(item); setForm({ ...item }); setDialogOpen(true); };
  const openMove = (item) => { setMoveDialog(item); setMoveForm({ type: "checkout", quantity: 1, agent_id: "", notes: "" }); };

  const save = async () => {
    if (!form.name) { toast.error("Nome obrigatório"); return; }
    if (editing) {
      await base44.entities.TacticalItem.update(editing.id, form);
    } else {
      await base44.entities.TacticalItem.create(form);
    }
    toast.success("Item salvo");
    setDialogOpen(false);
    load();
  };

  const saveMovement = async () => {
    if (!moveForm.agent_id) { toast.error("Selecione o agente"); return; }
    const agent = agents.find((a) => a.id === moveForm.agent_id);
    const qty = Number(moveForm.quantity);
    const item = moveDialog;

    if (moveForm.type === "checkout" && qty > item.available_quantity) {
      toast.error("Quantidade indisponível em estoque");
      return;
    }

    const newAvail = moveForm.type === "checkout"
      ? item.available_quantity - qty
      : Math.min(item.total_quantity, item.available_quantity + qty);

    await Promise.all([
      base44.entities.StockMovement.create({
        item_id: item.id,
        item_name: item.name,
        agent_id: moveForm.agent_id,
        agent_name: agent?.full_name || "",
        type: moveForm.type,
        quantity: qty,
        notes: moveForm.notes,
      }),
      base44.entities.TacticalItem.update(item.id, { available_quantity: newAvail }),
    ]);

    toast.success(moveForm.type === "checkout" ? "Retirada registrada" : "Devolução registrada");
    setMoveDialog(null);
    load();
  };

  const totalAlerts = items.filter((i) => itemAlerts(i).length > 0).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="font-semibold flex items-center gap-2">
          <Package className="w-4 h-4 text-primary" /> Estoque Tático
          {totalAlerts > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/20 text-destructive font-medium flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {totalAlerts} alerta{totalAlerts > 1 ? "s" : ""}
            </span>
          )}
        </h2>
        <Button size="sm" onClick={openNew}><Plus className="w-3.5 h-3.5 mr-1" /> Novo Item</Button>
      </div>

      {/* Items grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((item) => {
          const cfg = CATEGORY_CFG[item.category] || CATEGORY_CFG.other;
          const Icon = cfg.icon;
          const alerts = itemAlerts(item);
          const pct = item.total_quantity > 0 ? (item.available_quantity / item.total_quantity) * 100 : 0;
          return (
            <div
              key={item.id}
              className={`p-4 rounded-2xl border bg-card space-y-3 ${alerts.length ? "border-destructive/40" : "border-border/60"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{item.name}</div>
                    <div className="text-[10px] text-muted-foreground">{cfg.label}{item.serial_number && ` · ${item.serial_number}`}</div>
                  </div>
                </div>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(item)}>
                  <Pencil className="w-3 h-3" />
                </Button>
              </div>

              {/* Stock bar */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Disponível</span>
                  <span className={`font-medium ${item.available_quantity <= item.min_quantity ? "text-destructive" : "text-success"}`}>
                    {item.available_quantity}/{item.total_quantity}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted">
                  <div
                    className={`h-1.5 rounded-full transition-all ${pct <= 30 ? "bg-destructive" : pct <= 60 ? "bg-warning" : "bg-success"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Alerts */}
              {alerts.includes("estoque_baixo") && (
                <div className="text-[10px] text-destructive flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Estoque abaixo do mínimo ({item.min_quantity})</div>
              )}
              {alerts.includes("manutencao_devida") && (
                <div className="text-[10px] text-warning flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Manutenção preventiva devida</div>
              )}

              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => openMove(item)}>
                  <ArrowDownLeft className="w-3 h-3 mr-1" /> Movimentar
                </Button>
              </div>
            </div>
          );
        })}
        {items.length === 0 && (
          <div className="col-span-3 text-sm text-muted-foreground p-8 text-center border border-dashed rounded-2xl">
            Nenhum item cadastrado.
          </div>
        )}
      </div>

      {/* Recent movements */}
      {movements.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border/60 text-sm font-medium">Últimas Movimentações</div>
          <div className="divide-y divide-border/40">
            {movements.slice(0, 10).map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                {m.type === "checkout"
                  ? <ArrowDownLeft className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                  : <ArrowUpRight className="w-3.5 h-3.5 text-success flex-shrink-0" />}
                <span className="flex-1 truncate">{m.item_name}</span>
                <span className="text-xs text-muted-foreground truncate">{m.agent_name}</span>
                <span className={`text-xs font-mono font-medium ${m.type === "checkout" ? "text-destructive" : "text-success"}`}>
                  {m.type === "checkout" ? "-" : "+"}{m.quantity}
                </span>
                <span className="text-[10px] text-muted-foreground font-mono hidden md:block">
                  {format(new Date(m.created_date), "dd/MM HH:mm")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Item form dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar Item" : "Novo Item"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Nome do equipamento *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(CATEGORY_CFG).map(([k, c]) => <SelectItem key={k} value={k}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Nº de série" value={form.serial_number || ""} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} />
            <div className="grid grid-cols-3 gap-2">
              <div><label className="text-xs font-medium">Qtd Total</label><Input type="number" value={form.total_quantity} onChange={(e) => setForm({ ...form, total_quantity: +e.target.value })} /></div>
              <div><label className="text-xs font-medium">Disponível</label><Input type="number" value={form.available_quantity} onChange={(e) => setForm({ ...form, available_quantity: +e.target.value })} /></div>
              <div><label className="text-xs font-medium">Mínimo</label><Input type="number" value={form.min_quantity} onChange={(e) => setForm({ ...form, min_quantity: +e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="text-xs font-medium">Última manutenção</label><Input type="date" value={form.last_maintenance_date || ""} onChange={(e) => setForm({ ...form, last_maintenance_date: e.target.value })} /></div>
              <div><label className="text-xs font-medium">Intervalo (dias)</label><Input type="number" value={form.maintenance_interval_days || ""} onChange={(e) => setForm({ ...form, maintenance_interval_days: +e.target.value })} /></div>
            </div>
            <Input placeholder="Observações" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <Button className="w-full" onClick={save}>Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Movement dialog */}
      <Dialog open={!!moveDialog} onOpenChange={() => setMoveDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Movimentar — {moveDialog?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              {["checkout", "return"].map((t) => (
                <button
                  key={t}
                  onClick={() => setMoveForm((f) => ({ ...f, type: t }))}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${moveForm.type === t ? "bg-primary text-primary-foreground border-primary" : "border-border/60 text-muted-foreground"}`}
                >
                  {t === "checkout" ? "Retirada" : "Devolução"}
                </button>
              ))}
            </div>
            <Select value={moveForm.agent_id} onValueChange={(v) => setMoveForm((f) => ({ ...f, agent_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecionar agente..." /></SelectTrigger>
              <SelectContent>
                {agents.map((a) => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div><label className="text-xs font-medium">Quantidade</label>
              <Input type="number" min={1} value={moveForm.quantity} onChange={(e) => setMoveForm((f) => ({ ...f, quantity: +e.target.value }))} />
            </div>
            <Input placeholder="Observação (opcional)" value={moveForm.notes} onChange={(e) => setMoveForm((f) => ({ ...f, notes: e.target.value }))} />
            <Button className="w-full" onClick={saveMovement}>Confirmar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
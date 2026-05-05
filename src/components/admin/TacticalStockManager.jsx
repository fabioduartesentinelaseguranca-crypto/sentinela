import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Package, Plus, QrCode, RotateCcw, LogOut, Clock } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const CATEGORY_LABELS = {
  weapon: "🔫 Arma", vest: "🦺 Colete", ammo: "🔶 Munição",
  radio: "📻 Rádio", flashlight: "🔦 Lanterna", handcuff: "⛓ Algemas",
  medical: "🏥 Kit Médico", other: "📦 Outro"
};

const STATUS_COLORS = {
  ok: "text-success border-success/30 bg-success/10",
  low_stock: "text-warning border-warning/30 bg-warning/10",
  expiring_soon: "text-orange-400 border-orange-400/30 bg-orange-400/10",
  expired: "text-destructive border-destructive/30 bg-destructive/10",
  inactive: "text-muted-foreground border-border bg-muted/20",
};

function computeStatus(item) {
  if (item.status === "inactive") return "inactive";
  if (item.expiry_date) {
    const days = differenceInDays(parseISO(item.expiry_date), new Date());
    if (days < 0) return "expired";
    if (days < 30) return "expiring_soon";
  }
  if (item.available_qty <= item.min_qty) return "low_stock";
  return "ok";
}

export default function TacticalStockManager() {
  const [items, setItems] = useState([]);
  const [checkouts, setCheckouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [checkoutDialog, setCheckoutDialog] = useState(null); // item to checkout/return
  const [checkoutType, setCheckoutType] = useState("checkout");
  const [agentName, setAgentName] = useState("");
  const [qty, setQty] = useState(1);
  const [form, setForm] = useState({ name: "", category: "other", serial_number: "", total_qty: 1, min_qty: 2, expiry_date: "", notes: "" });
  const [filterCat, setFilterCat] = useState("all");

  const load = async () => {
    setLoading(true);
    const [its, cos] = await Promise.all([
      base44.entities.TacticalStock.list("-created_date", 200),
      base44.entities.TacticalCheckout.list("-created_date", 300),
    ]);
    setItems(its);
    setCheckouts(cos);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const alerts = items.filter(i => {
    const s = computeStatus(i);
    return s === "expired" || s === "expiring_soon" || s === "low_stock";
  });

  const handleSave = async () => {
    const qr = `SENT-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    await base44.entities.TacticalStock.create({ ...form, available_qty: Number(form.total_qty), total_qty: Number(form.total_qty), min_qty: Number(form.min_qty), qr_code: qr });
    toast.success("Item cadastrado com sucesso!");
    setShowForm(false);
    setForm({ name: "", category: "other", serial_number: "", total_qty: 1, min_qty: 2, expiry_date: "", notes: "" });
    load();
  };

  const handleCheckout = async () => {
    const item = checkoutDialog;
    const isReturn = checkoutType === "return";
    const newQty = isReturn ? item.available_qty + qty : item.available_qty - qty;
    if (!isReturn && qty > item.available_qty) { toast.error("Quantidade insuficiente em estoque!"); return; }
    await base44.entities.TacticalCheckout.create({ item_id: item.id, item_name: item.name, item_category: item.category, agent_name: agentName, agent_id: agentName, type: checkoutType, quantity: qty });
    await base44.entities.TacticalStock.update(item.id, { available_qty: Math.max(0, newQty) });
    toast.success(isReturn ? "Devolução registrada!" : "Retirada registrada!");
    setCheckoutDialog(null); setAgentName(""); setQty(1);
    load();
  };

  const filtered = items.filter(i => filterCat === "all" || i.category === filterCat);

  if (loading) return <div className="flex items-center justify-center h-40"><div className="w-7 h-7 border-4 border-border border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/5 p-4 space-y-1.5">
          <div className="flex items-center gap-2 font-semibold text-warning text-sm mb-2">
            <AlertTriangle className="w-4 h-4" /> {alerts.length} alerta(s) de estoque
          </div>
          {alerts.map(a => (
            <div key={a.id} className="text-xs text-muted-foreground flex gap-2 items-center">
              <span className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${STATUS_COLORS[computeStatus(a)]}`}>{computeStatus(a) === "expired" ? "VENCIDO" : computeStatus(a) === "expiring_soon" ? "VENCE EM BREVE" : "BAIXO ESTOQUE"}</span>
              <span>{a.name}</span>
              {a.expiry_date && <span className="text-muted-foreground">· Vence: {format(parseISO(a.expiry_date), "dd/MM/yyyy")}</span>}
              {computeStatus(a) === "low_stock" && <span className="text-muted-foreground">· {a.available_qty}/{a.min_qty} mín</span>}
            </div>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-1" /> Novo Item</Button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              {["Item", "Categoria", "QR Code", "Disponível", "Mín.", "Vencimento", "Status", "Ações"].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-muted-foreground">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-muted-foreground text-sm">Nenhum item cadastrado.</td></tr>
            )}
            {filtered.map(item => {
              const s = computeStatus(item);
              return (
                <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-3 py-2.5 font-medium">{item.name}{item.serial_number && <span className="text-[10px] text-muted-foreground ml-1">#{item.serial_number}</span>}</td>
                  <td className="px-3 py-2.5 text-xs">{CATEGORY_LABELS[item.category] || item.category}</td>
                  <td className="px-3 py-2.5"><span className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground"><QrCode className="w-3 h-3" />{item.qr_code?.slice(0, 12)}...</span></td>
                  <td className="px-3 py-2.5 font-mono font-bold">{item.available_qty}<span className="text-muted-foreground font-normal text-xs">/{item.total_qty}</span></td>
                  <td className="px-3 py-2.5 text-xs text-muted-foreground">{item.min_qty}</td>
                  <td className="px-3 py-2.5 text-xs">
                    {item.expiry_date ? (
                      <span className={differenceInDays(parseISO(item.expiry_date), new Date()) < 30 ? "text-warning font-medium" : "text-muted-foreground"}>
                        {format(parseISO(item.expiry_date), "dd/MM/yyyy")}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${STATUS_COLORS[s]}`}>
                      {s === "ok" ? "OK" : s === "low_stock" ? "Baixo" : s === "expiring_soon" ? "Vence Breve" : s === "expired" ? "Vencido" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setCheckoutDialog(item); setCheckoutType("checkout"); }}>
                        <LogOut className="w-3 h-3 mr-1" /> Retirada
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setCheckoutDialog(item); setCheckoutType("return"); }}>
                        <RotateCcw className="w-3 h-3 mr-1" /> Dev.
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* New Item Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Package className="w-5 h-5 text-primary" /> Cadastrar Item Tático</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Nome do item</Label><Input className="mt-1" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="ex: Colete Balístico Nível III" /></div>
              <div>
                <Label>Categoria</Label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Nº de Série</Label><Input className="mt-1" value={form.serial_number} onChange={e => setForm(p => ({ ...p, serial_number: e.target.value }))} /></div>
              <div><Label>Quantidade total</Label><Input type="number" className="mt-1" value={form.total_qty} onChange={e => setForm(p => ({ ...p, total_qty: e.target.value }))} /></div>
              <div><Label>Qtd. mínima (alerta)</Label><Input type="number" className="mt-1" value={form.min_qty} onChange={e => setForm(p => ({ ...p, min_qty: e.target.value }))} /></div>
              <div className="col-span-2"><Label>Data de vencimento (opcional)</Label><Input type="date" className="mt-1" value={form.expiry_date} onChange={e => setForm(p => ({ ...p, expiry_date: e.target.value }))} /></div>
              <div className="col-span-2"><Label>Observações</Label><Input className="mt-1" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} /></div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={!form.name}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={!!checkoutDialog} onOpenChange={() => setCheckoutDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{checkoutType === "checkout" ? "📤 Retirada de Item" : "📥 Devolução de Item"}</DialogTitle></DialogHeader>
          {checkoutDialog && (
            <div className="space-y-4 pt-2">
              <div className="rounded-lg bg-muted/30 border border-border/50 p-3">
                <div className="font-semibold">{checkoutDialog.name}</div>
                <div className="text-xs text-muted-foreground">{CATEGORY_LABELS[checkoutDialog.category]} · Disponível: {checkoutDialog.available_qty}</div>
              </div>
              <div><Label>Agente (nome)</Label><Input className="mt-1" placeholder="Nome do agente" value={agentName} onChange={e => setAgentName(e.target.value)} /></div>
              <div><Label>Quantidade</Label><Input type="number" className="mt-1" min={1} value={qty} onChange={e => setQty(Number(e.target.value))} /></div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setCheckoutDialog(null)}>Cancelar</Button>
                <Button onClick={handleCheckout} disabled={!agentName || qty < 1}>{checkoutType === "checkout" ? "Registrar Retirada" : "Registrar Devolução"}</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
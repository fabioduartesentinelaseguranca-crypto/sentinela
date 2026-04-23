import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Wrench, Paperclip, X, Loader2, Image, Car, Package } from "lucide-react";
import { toast } from "sonner";

export default function MaintenanceTicketDialog({ open, onOpenChange, agentId, agentName }) {
  const [vehicles, setVehicles] = useState([]);
  const [tacticalItems, setTacticalItems] = useState([]);
  const [form, setForm] = useState({ item_type: "vehicle", item_id: "", priority: "medium", description: "" });
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    if (!open) return;
    Promise.all([
      base44.entities.Vehicle.list("-created_date", 100),
      base44.entities.TacticalItem.list("created_date", 100),
    ]).then(([vehs, items]) => { setVehicles(vehs); setTacticalItems(items); });
  }, [open]);

  const itemOptions = form.item_type === "vehicle" ? vehicles : tacticalItems;
  const selectedItem = itemOptions.find((i) => i.id === form.item_id);
  const itemName = form.item_type === "vehicle"
    ? (selectedItem ? `${selectedItem.prefix} – ${selectedItem.plate}` : "")
    : (selectedItem?.name || "");

  const handleFiles = async (e) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    setUploading(true);
    const uploaded = [];
    for (const file of selected) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      uploaded.push({ name: file.name, url: file_url });
    }
    setFiles((prev) => [...prev, ...uploaded]);
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!form.item_id) { toast.error("Selecione o item"); return; }
    if (!form.description.trim()) { toast.error("Descreva a falha"); return; }
    setSaving(true);

    await base44.entities.MaintenanceTicket.create({
      item_type: form.item_type,
      item_id: form.item_id,
      item_name: itemName,
      reported_by_id: agentId,
      reported_by_name: agentName,
      description: form.description,
      photo_urls: files.map((f) => f.url),
      status: "open",
      priority: form.priority,
    });

    toast.success("Chamado de manutenção aberto com sucesso");
    setSaving(false);
    onOpenChange(false);
    setForm({ item_type: "vehicle", item_id: "", priority: "medium", description: "" });
    setFiles([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-warning" />
            Abrir Chamado de Manutenção
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Item type */}
          <div className="flex gap-2">
            {[
              { value: "vehicle", label: "Viatura", icon: Car },
              { value: "tactical_item", label: "Equipamento", icon: Package },
            ].map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  onClick={() => setForm((f) => ({ ...f, item_type: t.value, item_id: "" }))}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg border text-sm font-medium transition-colors ${form.item_type === t.value ? "bg-primary text-primary-foreground border-primary" : "border-border/60 text-muted-foreground hover:border-primary/50"}`}
                >
                  <Icon className="w-4 h-4" /> {t.label}
                </button>
              );
            })}
          </div>

          {/* Item selector */}
          <Select value={form.item_id} onValueChange={(v) => setForm((f) => ({ ...f, item_id: v }))}>
            <SelectTrigger><SelectValue placeholder={`Selecionar ${form.item_type === "vehicle" ? "viatura" : "equipamento"}...`} /></SelectTrigger>
            <SelectContent>
              {itemOptions.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {form.item_type === "vehicle" ? `${item.prefix} – ${item.plate}` : item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Priority */}
          <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="low">🟢 Baixa prioridade</SelectItem>
              <SelectItem value="medium">🟡 Média prioridade</SelectItem>
              <SelectItem value="high">🔴 Alta prioridade</SelectItem>
              <SelectItem value="critical">🚨 Crítico – fora de operação</SelectItem>
            </SelectContent>
          </Select>

          {/* Description */}
          <Textarea
            placeholder="Descreva a falha ou problema observado..."
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className="min-h-[100px] resize-none"
          />

          {/* Photos */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Fotos da falha</label>
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted border border-border/60 text-xs max-w-[160px]">
                  <Image className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span className="truncate">{f.name}</span>
                  <button onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-border/60 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                {uploading ? "Enviando..." : "Anexar foto"}
              </button>
            </div>
            <input ref={fileRef} type="file" multiple accept="image/*" className="hidden" onChange={handleFiles} />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={saving || uploading} onClick={handleSubmit}>
            {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Wrench className="w-4 h-4 mr-1.5" />}
            Abrir Chamado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Camera, Plus, Pencil, Trash2, Video, VideoOff } from "lucide-react";

const EMPTY = { name: "", type: "fixed", lat: "", lng: "", address: "", stream_url: "", active: true, notes: "" };

export default function CameraManager() {
  const [cameras, setCameras] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    const list = await base44.entities.Camera.list("-created_date", 200);
    setCameras(list);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(EMPTY); setEditing(null); setOpen(true); };
  const openEdit = (c) => { setForm({ ...c }); setEditing(c.id); setOpen(true); };

  const save = async () => {
    const data = {
      ...form,
      lat: parseFloat(form.lat),
      lng: parseFloat(form.lng),
    };
    if (!data.name || isNaN(data.lat) || isNaN(data.lng)) {
      toast.error("Nome, latitude e longitude são obrigatórios.");
      return;
    }
    if (editing) {
      await base44.entities.Camera.update(editing, data);
      toast.success("Câmera atualizada");
    } else {
      await base44.entities.Camera.create(data);
      toast.success("Câmera cadastrada");
    }
    setOpen(false);
    load();
  };

  const remove = async (id) => {
    await base44.entities.Camera.delete(id);
    toast.info("Câmera removida");
    load();
  };

  const TYPE_LABEL = { fixed: "Fixa", dome: "Dome", ptz: "PTZ" };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold flex items-center gap-2">
          <Camera className="w-4 h-4 text-primary" /> Câmeras ({cameras.length})
        </h2>
        <Button size="sm" onClick={openNew}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Nova Câmera
        </Button>
      </div>

      <div className="rounded-2xl border border-border/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Nome</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Tipo</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden lg:table-cell">Endereço</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Stream</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {cameras.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-xs">
                  Nenhuma câmera cadastrada.
                </td>
              </tr>
            )}
            {cameras.map((c) => (
              <tr key={c.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${c.active ? "bg-success" : "bg-muted-foreground"}`} />
                    {c.name}
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">{c.lat?.toFixed(5)}, {c.lng?.toFixed(5)}</div>
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{TYPE_LABEL[c.type] || c.type}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground hidden lg:table-cell max-w-[200px] truncate">{c.address || "—"}</td>
                <td className="px-4 py-3">
                  {c.stream_url ? (
                    <a href={c.stream_url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline">
                      <Video className="w-3 h-3" /> Ver stream
                    </a>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <VideoOff className="w-3 h-3" /> Não configurado
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(c)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(c.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Câmera" : "Nova Câmera"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input placeholder="Nome / identificador *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixa</SelectItem>
                <SelectItem value="dome">Dome</SelectItem>
                <SelectItem value="ptz">PTZ</SelectItem>
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Latitude *" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
              <Input placeholder="Longitude *" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} />
            </div>
            <Input placeholder="Endereço" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <Input
              placeholder="URL do stream (HLS/WebRTC) — configurar com a prefeitura"
              value={form.stream_url}
              onChange={(e) => setForm({ ...form, stream_url: e.target.value })}
            />
            <Input placeholder="Observações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div className="flex items-center gap-2">
              <input type="checkbox" id="cam-active" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              <label htmlFor="cam-active" className="text-sm">Câmera ativa</label>
            </div>
            <Button className="w-full" onClick={save}>{editing ? "Salvar alterações" : "Cadastrar câmera"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
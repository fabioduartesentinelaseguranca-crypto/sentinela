import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, Paperclip, X, Loader2, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const CATEGORIES = {
  drug_traffic: "Tráfico de Drogas",
  suspicious_activity: "Atividade Suspeita",
  vandalism: "Vandalismo",
  abandoned_vehicle: "Veículo Abandonado",
  risk_area: "Área de Risco",
  other: "Outro",
};

export default function AnonymousTipForm() {
  const [form, setForm] = useState({ description: "", address: "", category: "other", lat: "", lng: "" });
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);
  const fileRef = useRef();

  const handleFiles = async (e) => {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    setUploading(true);
    const uploaded = [];
    for (const file of selected) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      uploaded.push({ name: file.name, url: file_url });
    }
    setFiles((p) => [...p, ...uploaded]);
    setUploading(false);
  };

  const getLocation = () => {
    navigator.geolocation?.getCurrentPosition((pos) => {
      setForm((f) => ({ ...f, lat: pos.coords.latitude.toString(), lng: pos.coords.longitude.toString() }));
      toast.success("Localização capturada");
    }, () => toast.error("Não foi possível obter localização"));
  };

  const submit = async () => {
    if (!form.description.trim()) { toast.error("Descreva a denúncia"); return; }
    setSaving(true);
    await base44.entities.AnonymousTip.create({
      description: form.description,
      address: form.address,
      category: form.category,
      lat: form.lat ? parseFloat(form.lat) : undefined,
      lng: form.lng ? parseFloat(form.lng) : undefined,
      media_urls: files.map((f) => f.url),
      status: "pending",
    });
    setSent(true);
    setSaving(false);
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
        <CheckCircle2 className="w-12 h-12 text-success" />
        <h3 className="text-lg font-semibold">Denúncia enviada com sucesso</h3>
        <p className="text-sm text-muted-foreground max-w-sm">Sua denúncia anônima foi registrada e será analisada pela central de operações.</p>
        <Button variant="outline" onClick={() => { setSent(false); setForm({ description: "", address: "", category: "other", lat: "", lng: "" }); setFiles([]); }}>
          Nova denúncia
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center gap-2">
        <ShieldAlert className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Denúncia Anônima</h3>
        <span className="text-xs text-muted-foreground">Sua identidade não será revelada</span>
      </div>

      <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
        </SelectContent>
      </Select>

      <Textarea
        placeholder="Descreva o que você observou, quando e como aconteceu..."
        value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        className="min-h-[100px] resize-none"
      />

      <Input
        placeholder="Endereço ou referência (opcional)"
        value={form.address}
        onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
      />

      <div className="flex gap-2">
        <Button variant="outline" size="sm" type="button" onClick={getLocation}>📍 Usar minha localização</Button>
        {form.lat && <span className="text-xs text-success self-center">✓ Localização capturada</span>}
      </div>

      <div className="flex flex-wrap gap-2">
        {files.map((f, i) => (
          <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted border text-xs max-w-[160px]">
            <span className="truncate">{f.name}</span>
            <button onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-destructive">
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
          {uploading ? "Enviando..." : "Anexar mídia"}
        </button>
        <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden" onChange={handleFiles} />
      </div>

      <Button className="w-full" disabled={saving || uploading} onClick={submit}>
        {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
        Enviar denúncia anonimamente
      </Button>
    </div>
  );
}
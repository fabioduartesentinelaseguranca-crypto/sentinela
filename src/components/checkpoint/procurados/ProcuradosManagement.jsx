import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ShieldAlert, Trash2, Plus } from "lucide-react";
import CheckpointFaceCapture from "@/components/checkpoint/CheckpointFaceCapture";
import { bloquearSeConflito } from "@/lib/biometria";

const DANGER = [
  { v: "low", l: "Baixo", c: "text-yellow-500" },
  { v: "medium", l: "Médio", c: "text-orange-500" },
  { v: "high", l: "Alto", c: "text-red-500" },
  { v: "extreme", l: "Extremo", c: "text-red-600" },
];

export default function ProcuradosManagement({ onSaved }) {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({
    name: "", alias: "", danger_level: "high", status: "wanted",
    reward: 0, last_seen_location: "", last_seen_date: "", description: "",
    warrant_number: "", age_approx: "", crimes: "",
  });
  const [bio, setBio] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => { setList(await base44.entities.WantedCriminal.list("-created_date", 100)); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name) return toast.error("Nome é obrigatório");
    if (!bio?.embedding?.length) return toast.error("Biometria facial é obrigatória");
    setLoading(true);
    try {
      if (await bloquearSeConflito(bio.embedding, ["alunos", "blacklist", "procurados"])) { setLoading(false); return; }
      await base44.entities.WantedCriminal.create({
        name: form.name, alias: form.alias, danger_level: form.danger_level, status: form.status,
        reward: Number(form.reward) || 0, last_seen_location: form.last_seen_location,
        last_seen_date: form.last_seen_date || undefined, description: form.description,
        warrant_number: form.warrant_number, age_approx: form.age_approx ? Number(form.age_approx) : undefined,
        crimes: form.crimes ? form.crimes.split(",").map((s) => s.trim()).filter(Boolean) : [],
        photo_url: bio.file_url, face_embedding: bio.embedding,
      });
      toast.success("Procurado cadastrado");
      setForm({ name: "", alias: "", danger_level: "high", status: "wanted", reward: 0, last_seen_location: "", last_seen_date: "", description: "", warrant_number: "", age_approx: "", crimes: "" });
      setBio(null);
      load(); onSaved?.();
    } catch (err) { toast.error("Erro: " + err.message); }
    setLoading(false);
  };

  const remove = async (id) => { await base44.entities.WantedCriminal.delete(id); load(); onSaved?.(); toast.info("Registro removido"); };

  const dangerCfg = (v) => DANGER.find((d) => d.v === v) || DANGER[2];

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-3">
        <Input placeholder="Nome completo *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input placeholder="Alcunha / apelido" value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <Select value={form.danger_level} onValueChange={(v) => setForm({ ...form, danger_level: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DANGER.map((d) => <SelectItem key={d.v} value={d.v}>{d.l}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="wanted">Procurado</SelectItem>
              <SelectItem value="captured">Capturado</SelectItem>
              <SelectItem value="inactive">Inativo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-xs text-muted-foreground">Recompensa (R$)</label><Input type="number" value={form.reward} onChange={(e) => setForm({ ...form, reward: e.target.value })} /></div>
          <div><label className="text-xs text-muted-foreground">Idade aprox.</label><Input type="number" value={form.age_approx} onChange={(e) => setForm({ ...form, age_approx: e.target.value })} /></div>
        </div>
        <Input placeholder="Nº do mandado" value={form.warrant_number} onChange={(e) => setForm({ ...form, warrant_number: e.target.value })} />
        <Input placeholder="Última localização vista" value={form.last_seen_location} onChange={(e) => setForm({ ...form, last_seen_location: e.target.value })} />
        <div><label className="text-xs text-muted-foreground">Data avistado</label><Input type="date" value={form.last_seen_date} onChange={(e) => setForm({ ...form, last_seen_date: e.target.value })} /></div>
        <Input placeholder="Crimes (separados por vírgula)" value={form.crimes} onChange={(e) => setForm({ ...form, crimes: e.target.value })} />
        <Textarea placeholder="Descrição / características físicas" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <CheckpointFaceCapture onCapture={setBio} />
        <Button className="w-full bg-destructive hover:bg-destructive/90" onClick={save} disabled={loading}><Plus className="w-4 h-4 mr-2" />{loading ? "Salvando..." : "Cadastrar Procurado"}</Button>
      </div>
      <div className="space-y-2 max-h-[640px] overflow-y-auto scrollbar-thin">
        {list.map((w) => {
          const d = dangerCfg(w.danger_level);
          return (
            <div key={w.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-border/60 bg-card">
              {w.photo_url ? <img src={w.photo_url} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <ShieldAlert className="w-8 h-8 text-destructive" />}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{w.name}{w.alias ? ` (${w.alias})` : ""}</div>
                <div className={`text-[10px] font-bold ${d.c}`}>{d.l}{w.status !== "wanted" ? ` · ${w.status}` : ""}{w.reward ? ` · R$ ${w.reward}` : ""}</div>
                {w.crimes?.length > 0 && <div className="text-xs text-muted-foreground truncate">{w.crimes.join(", ")}</div>}
              </div>
              <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(w.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          );
        })}
        {list.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum procurado cadastrado.</p>}
      </div>
    </div>
  );
}
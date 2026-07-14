import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Radio, Plus, MapPin } from "lucide-react";

const TIPOS = [
  { v: "policial", l: "Policial" },
  { v: "socorrista", l: "Socorrista" },
  { v: "bombeiro", l: "Bombeiro" },
];
const STATUS = [
  { v: "disponivel", l: "Disponível" },
  { v: "em_atendimento", l: "Em atendimento" },
  { v: "fora_servico", l: "Fora de serviço" },
];
const statusColor = { disponivel: "text-success", em_atendimento: "text-warning", fora_servico: "text-muted-foreground" };

export default function AgentesSegurancaManager() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({
    nome: "", tipo: "policial", lat: "", lng: "", status: "disponivel",
    veiculo: "", push_token: "", telefone: "",
  });
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try { setList(await base44.entities.Agentes_Seguranca.list("-created_date", 100)); }
    catch { /* */ }
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.nome) return toast.error("Nome do agente é obrigatório");
    if (form.lat === "" || form.lng === "") return toast.error("Latitude e longitude são obrigatórias (posição atual do agente)");
    setLoading(true);
    try {
      await base44.entities.Agentes_Seguranca.create({
        nome: form.nome, tipo: form.tipo, status: form.status,
        lat: Number(form.lat), lng: Number(form.lng),
        veiculo: form.veiculo || undefined,
        push_token: form.push_token || undefined,
        telefone: form.telefone || undefined,
      });
      toast.success("Agente de segurança cadastrado");
      setForm({ nome: "", tipo: "policial", lat: "", lng: "", status: "disponivel", veiculo: "", push_token: "", telefone: "" });
      load();
    } catch (e) { toast.error("Erro: " + e.message); }
    setLoading(false);
  };

  const remove = async (id) => { await base44.entities.Agentes_Seguranca.delete(id); load(); toast.info("Agente removido"); };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-3">
        <Input placeholder="Nome do agente *" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TIPOS.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-xs text-muted-foreground">Latitude atual *</label><Input type="number" step="any" placeholder="-23.55" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} /></div>
          <div><label className="text-xs text-muted-foreground">Longitude atual *</label><Input type="number" step="any" placeholder="-46.63" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} /></div>
        </div>
        <Input placeholder="Viatura / unidade (ex: PM-4521)" value={form.veiculo} onChange={(e) => setForm({ ...form, veiculo: e.target.value })} />
        <Input placeholder="Telefone de contato" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
        <Input placeholder="Push token (FCM/APNs)" value={form.push_token} onChange={(e) => setForm({ ...form, push_token: e.target.value })} />
        <Button className="w-full" onClick={save} disabled={loading}><Plus className="w-4 h-4 mr-2" />{loading ? "Salvando..." : "Cadastrar Agente"}</Button>
      </div>
      <div className="space-y-2 max-h-[520px] overflow-y-auto scrollbar-thin">
        {list.map((a) => (
          <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-border/60 bg-card">
            <Radio className={`w-4 h-4 ${statusColor[a.status] || "text-muted-foreground"}`} />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{a.nome}</div>
              <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                <MapPin className="w-3 h-3" />{a.lat ?? "—"}, {a.lng ?? "—"}
                {a.veiculo ? ` · ${a.veiculo}` : ""}
              </div>
              <div className={`text-[10px] font-bold ${statusColor[a.status] || ""}`}>{STATUS.find((s) => s.v === a.status)?.l || a.status}</div>
            </div>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(a.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum agente cadastrado. Cadastre agentes com localização para ativar o despacho tático.</p>}
      </div>
    </div>
  );
}
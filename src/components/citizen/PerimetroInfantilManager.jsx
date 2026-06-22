import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { MapPin, Baby, Plus, Trash2, Loader2, School, TreePine, ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";

const DIAS = [
  { v: 1, l: "Seg" }, { v: 2, l: "Ter" }, { v: 3, l: "Qua" },
  { v: 4, l: "Qui" }, { v: 5, l: "Sex" }, { v: 6, l: "Sáb" }, { v: 0, l: "Dom" },
];

const TIPO_ICONES = {
  escola: School,
  creche: Baby,
  parque: TreePine,
  rota_escolar: ArrowRightLeft,
  casa_parente: MapPin,
  outro: MapPin,
};

export default function PerimetroInfantilManager() {
  const { user } = useAuth();
  const [perimetros, setPerimetros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nome_crianca: "",
    nome_local: "",
    tipo: "escola",
    lat: "",
    lng: "",
    raio_metros: 300,
    horario_inicio: "07:00",
    horario_fim: "17:00",
    dias_semana: [1, 2, 3, 4, 5],
    ativo: true,
  });

  const load = async () => {
    const list = await base44.entities.Perimetros_Seguranca_Infantil.filter({ user_id: user?.id }, "-data_criacao", 50);
    setPerimetros(list);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user?.id]);

  const toggleDia = (d) => {
    setForm((f) => ({
      ...f,
      dias_semana: f.dias_semana.includes(d) ? f.dias_semana.filter((x) => x !== d) : [...f.dias_semana, d],
    }));
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setForm((f) => ({ ...f, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) })),
        () => toast.error("Não foi possível obter localização")
      );
    }
  };

  const save = async () => {
    if (!form.nome_crianca || !form.nome_local || !form.lat || !form.lng) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      await base44.entities.Perimetros_Seguranca_Infantil.create({
        user_id: user.id,
        user_name: user.full_name,
        nome_crianca: form.nome_crianca,
        nome_local: form.nome_local,
        tipo: form.tipo,
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        raio_metros: form.raio_metros,
        horario_inicio: form.horario_inicio,
        horario_fim: form.horario_fim,
        dias_semana: form.dias_semana,
        ativo: form.ativo,
        data_criacao: new Date().toISOString(),
      });
      toast.success("Perímetro de segurança criado!");
      setShowForm(false);
      setForm({ nome_crianca: "", nome_local: "", tipo: "escola", lat: "", lng: "", raio_metros: 300, horario_inicio: "07:00", horario_fim: "17:00", dias_semana: [1, 2, 3, 4, 5], ativo: true });
      load();
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    }
    setSaving(false);
  };

  const toggleAtivo = async (p) => {
    await base44.entities.Perimetros_Seguranca_Infantil.update(p.id, { ativo: !p.ativo });
    load();
  };

  const remove = async (p) => {
    await base44.entities.Perimetros_Seguranca_Infantil.delete(p.id);
    toast.info("Perímetro removido.");
    load();
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-4 text-center">
        <Loader2 className="w-4 h-4 animate-spin mx-auto text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Baby className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Perímetros de Segurança Infantil</h3>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm(!showForm)}>
          <Plus className="w-3 h-3 mr-1" /> Novo
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Cadastre cercas virtuais ao redor de escolas, creches e rotas seguras. Se a criança sair do perímetro nos horários definidos, você receberá um alerta imediato.
      </p>

      {showForm && (
        <div className="rounded-xl border border-border/60 bg-background p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-medium">Nome da Criança *</label>
              <Input placeholder="Ex: Maria" value={form.nome_crianca} onChange={(e) => setForm({ ...form, nome_crianca: e.target.value })} className="h-8 text-sm mt-0.5" />
            </div>
            <div>
              <label className="text-[10px] font-medium">Nome do Local *</label>
              <Input placeholder="Ex: Escola Municipal" value={form.nome_local} onChange={(e) => setForm({ ...form, nome_local: e.target.value })} className="h-8 text-sm mt-0.5" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-medium">Tipo</label>
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
              <SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="escola">Escola</SelectItem>
                <SelectItem value="creche">Creche</SelectItem>
                <SelectItem value="parque">Parque</SelectItem>
                <SelectItem value="rota_escolar">Rota Escolar</SelectItem>
                <SelectItem value="casa_parente">Casa de Parente</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-medium">Latitude *</label>
              <Input placeholder="-23.5505" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} className="h-8 text-sm font-mono mt-0.5" />
            </div>
            <div>
              <label className="text-[10px] font-medium">Longitude *</label>
              <Input placeholder="-46.6333" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} className="h-8 text-sm font-mono mt-0.5" />
            </div>
            <div className="flex items-end">
              <Button variant="outline" size="sm" onClick={getCurrentLocation} className="h-8 text-[10px] w-full">
                <MapPin className="w-3 h-3 mr-1" /> Usar GPS
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-medium">Raio (metros)</label>
              <Input type="number" value={form.raio_metros} onChange={(e) => setForm({ ...form, raio_metros: parseInt(e.target.value) || 300 })} className="h-8 text-sm mt-0.5" />
            </div>
            <div className="grid grid-cols-2 gap-1">
              <div>
                <label className="text-[10px] font-medium">Início</label>
                <Input type="time" value={form.horario_inicio} onChange={(e) => setForm({ ...form, horario_inicio: e.target.value })} className="h-8 text-sm mt-0.5" />
              </div>
              <div>
                <label className="text-[10px] font-medium">Fim</label>
                <Input type="time" value={form.horario_fim} onChange={(e) => setForm({ ...form, horario_fim: e.target.value })} className="h-8 text-sm mt-0.5" />
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-medium">Dias da Semana</label>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {DIAS.map((d) => (
                <button key={d.v} onClick={() => toggleDia(d.v)}
                  className={`text-[10px] px-2 py-1 rounded font-medium transition-colors ${
                    form.dias_semana.includes(d.v) ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}>
                  {d.l}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={save} disabled={saving} size="sm" className="w-full">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
            Criar Perímetro
          </Button>
        </div>
      )}

      {perimetros.length === 0 ? (
        <div className="text-center py-6">
          <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
          <p className="text-xs text-muted-foreground">Nenhum perímetro de segurança cadastrado.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {perimetros.map((p) => {
            const Icon = TIPO_ICONES[p.tipo] || MapPin;
            return (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-xl border border-border/60 bg-background/50">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium truncate">{p.nome_crianca} · {p.nome_local}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {p.raio_metros}m · {p.horario_inicio}–{p.horario_fim}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <Switch checked={p.ativo} onCheckedChange={() => toggleAtivo(p)} className="scale-75" />
                  <button onClick={() => remove(p)} className="p-1 hover:bg-destructive/10 rounded">
                    <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Search, Plus, Shield, AlertTriangle, CheckCircle2, DollarSign, X, Camera, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";

const DANGER_COLOR = {
  low: "border-success/40 bg-success/5 text-success",
  medium: "border-warning/40 bg-warning/5 text-warning",
  high: "border-destructive/40 bg-destructive/5 text-destructive",
  extreme: "border-destructive bg-destructive/10 text-destructive",
};

const DANGER_LABEL = { low: "Baixo", medium: "Médio", high: "Alto", extreme: "EXTREMO" };

const DEFAULT = {
  name: "", alias: "", description: "", crimes: [],
  reward: 0, danger_level: "medium", status: "wanted",
  last_seen_location: "", age_approx: "", notes: "", warrant_number: "", photo_url: ""
};

export default function WantedBoard() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [criminals, setCriminals] = useState([]);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("wanted");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(DEFAULT);
  const [crimesInput, setCrimesInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  const load = async () => {
    const data = await base44.entities.WantedCriminal.list("-created_date", 200);
    setCriminals(data);
  };

  useEffect(() => { load(); }, []);

  const filtered = criminals.filter((c) => {
    const matchSearch = !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.alias?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || c.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const openCreate = () => { setEditing(null); setForm(DEFAULT); setCrimesInput(""); setShowForm(true); };
  const openEdit = (c) => {
    setEditing(c);
    setForm({ ...c });
    setCrimesInput((c.crimes || []).join(", "));
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name) { toast.error("Nome é obrigatório"); return; }
    setLoading(true);
    const data = { ...form, crimes: crimesInput.split(",").map((s) => s.trim()).filter(Boolean), reward: Number(form.reward) || 0, age_approx: Number(form.age_approx) || undefined };
    if (editing) {
      await base44.entities.WantedCriminal.update(editing.id, data);
      toast.success("Registro atualizado");
    } else {
      await base44.entities.WantedCriminal.create(data);
      toast.success("Procurado cadastrado");
    }
    setLoading(false);
    setShowForm(false);
    load();
  };

  const remove = async (id) => {
    await base44.entities.WantedCriminal.delete(id);
    toast.info("Registro removido");
    load();
  };

  const markCaptured = async (c) => {
    await base44.entities.WantedCriminal.update(c.id, { status: "captured" });
    toast.success(`${c.name} marcado como capturado`);
    load();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="w-7 h-7 text-destructive" /> Mural de Procurados
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Criminosos procurados com recompensa e retrato falado.</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="bg-destructive hover:bg-destructive/90">
            <Plus className="w-4 h-4 mr-2" /> Cadastrar Procurado
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por nome ou apelido..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="wanted">Procurados</SelectItem>
            <SelectItem value="captured">Capturados</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 text-sm">
        {[
          { label: "Procurados ativos", val: criminals.filter(c => c.status === "wanted").length, color: "text-destructive" },
          { label: "Capturados", val: criminals.filter(c => c.status === "captured").length, color: "text-success" },
          { label: "Com recompensa", val: criminals.filter(c => (c.reward || 0) > 0).length, color: "text-warning" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border/60 bg-card px-4 py-2">
            <span className={`font-bold text-lg ${s.color}`}>{s.val}</span>
            <span className="text-muted-foreground ml-2">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Grid */}
      {filtered.length === 0 && (
        <div className="text-center py-16 text-muted-foreground border border-dashed rounded-2xl">
          Nenhum registro encontrado.
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map((c) => (
          <div key={c.id} className={`rounded-2xl border-2 bg-card overflow-hidden flex flex-col ${DANGER_COLOR[c.danger_level]} hover:scale-[1.01] transition-transform`}>
            {/* Photo */}
            <div className="relative bg-muted/30 h-52 flex items-center justify-center cursor-pointer" onClick={() => setSelected(c)}>
              {c.photo_url ? (
                <img src={c.photo_url} alt={c.name} className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <Camera className="w-10 h-10 opacity-40" />
                  <span className="text-xs">Sem foto</span>
                </div>
              )}
              {c.status === "captured" && (
                <div className="absolute inset-0 bg-success/20 flex items-center justify-center">
                  <span className="rotate-[-15deg] border-4 border-success text-success font-black text-2xl px-4 py-1 rounded">CAPTURADO</span>
                </div>
              )}
              <div className={`absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full border ${DANGER_COLOR[c.danger_level]}`}>
                {DANGER_LABEL[c.danger_level]}
              </div>
            </div>

            {/* Info */}
            <div className="p-4 flex-1 space-y-2">
              <div>
                <div className="font-bold text-sm truncate">{c.name}</div>
                {c.alias && <div className="text-xs text-muted-foreground italic">"{c.alias}"</div>}
              </div>

              {c.reward > 0 && (
                <div className="flex items-center gap-1.5 text-warning text-sm font-semibold">
                  <DollarSign className="w-4 h-4" />
                  Recompensa: R$ {c.reward.toLocaleString("pt-BR")}
                </div>
              )}

              {c.crimes?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {c.crimes.slice(0, 3).map((cr) => (
                    <span key={cr} className="text-[9px] bg-destructive/10 text-destructive border border-destructive/20 px-1.5 py-0.5 rounded">{cr}</span>
                  ))}
                  {c.crimes.length > 3 && <span className="text-[9px] text-muted-foreground">+{c.crimes.length - 3}</span>}
                </div>
              )}

              {c.last_seen_location && (
                <div className="text-xs text-muted-foreground truncate">📍 {c.last_seen_location}</div>
              )}
            </div>

            {/* Actions */}
            {isAdmin && (
              <div className="border-t border-border/40 p-2 flex gap-1">
                {c.status === "wanted" && (
                  <Button size="sm" variant="outline" className="flex-1 text-success border-success/30 hover:bg-success/10" onClick={() => markCaptured(c)}>
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Capturado
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Edit2 className="w-3.5 h-3.5" /></Button>
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => remove(c.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && setSelected(null)}>
          <div className="bg-card border border-border/60 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            {selected.photo_url ? (
              <img src={selected.photo_url} alt={selected.name} className="w-full h-64 object-cover" />
            ) : (
              <div className="w-full h-40 bg-muted/30 flex items-center justify-center text-muted-foreground">
                <Camera className="w-12 h-12 opacity-30" />
              </div>
            )}
            <div className="p-6 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold">{selected.name}</h2>
                  {selected.alias && <p className="text-sm text-muted-foreground italic">"{selected.alias}"</p>}
                </div>
                <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
              </div>
              {selected.description && <p className="text-sm text-muted-foreground">{selected.description}</p>}
              <div className="grid grid-cols-2 gap-3 text-sm">
                {selected.age_approx && <div><span className="text-muted-foreground">Idade aprox.:</span> {selected.age_approx} anos</div>}
                {selected.warrant_number && <div><span className="text-muted-foreground">Mandado:</span> {selected.warrant_number}</div>}
                {selected.last_seen_location && <div className="col-span-2"><span className="text-muted-foreground">Último avistamento:</span> {selected.last_seen_location}</div>}
              </div>
              {selected.reward > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-warning/10 border border-warning/30">
                  <DollarSign className="w-5 h-5 text-warning" />
                  <span className="font-bold text-warning text-lg">Recompensa: R$ {selected.reward.toLocaleString("pt-BR")}</span>
                </div>
              )}
              {selected.crimes?.length > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Crimes:</div>
                  <div className="flex flex-wrap gap-1">
                    {selected.crimes.map((cr) => (
                      <span key={cr} className="text-xs bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 rounded">{cr}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div className="bg-card border border-border/60 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">{editing ? "Editar Procurado" : "Cadastrar Procurado"}</h3>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Nome *</label>
                  <Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Nome completo" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Apelido</label>
                  <Input value={form.alias} onChange={(e) => setForm(p => ({ ...p, alias: e.target.value }))} placeholder="Alcunha" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Nível de perigo</label>
                  <Select value={form.danger_level} onValueChange={(v) => setForm(p => ({ ...p, danger_level: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Baixo</SelectItem>
                      <SelectItem value="medium">Médio</SelectItem>
                      <SelectItem value="high">Alto</SelectItem>
                      <SelectItem value="extreme">Extremo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Recompensa (R$)</label>
                  <Input type="number" value={form.reward} onChange={(e) => setForm(p => ({ ...p, reward: e.target.value }))} placeholder="0" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Crimes (separados por vírgula)</label>
                <Input value={crimesInput} onChange={(e) => setCrimesInput(e.target.value)} placeholder="Roubo, Tráfico, Homicídio..." />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">URL da foto / retrato falado</label>
                <Input value={form.photo_url} onChange={(e) => setForm(p => ({ ...p, photo_url: e.target.value }))} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Idade aprox.</label>
                  <Input type="number" value={form.age_approx} onChange={(e) => setForm(p => ({ ...p, age_approx: e.target.value }))} placeholder="ex: 32" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Nº do Mandado</label>
                  <Input value={form.warrant_number} onChange={(e) => setForm(p => ({ ...p, warrant_number: e.target.value }))} placeholder="ex: 0001234-56" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Último avistamento</label>
                <Input value={form.last_seen_location} onChange={(e) => setForm(p => ({ ...p, last_seen_location: e.target.value }))} placeholder="Bairro, cidade..." />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Descrição / Características</label>
                <Textarea rows={3} value={form.description} onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Características físicas, marcas, tatuagens..." />
              </div>
            </div>
            <Button className="w-full" onClick={save} disabled={loading}>
              {loading ? "Salvando..." : editing ? "Salvar Alterações" : "Cadastrar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
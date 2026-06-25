import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldAlert, Plus, Trash2, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import BiometriaCapturaFace from "./BiometriaCapturaFace";

const NIVEL_STYLE = {
  vermelho: "bg-red-500/15 text-red-400 border-red-500/30",
  laranja: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  amarelo: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
};

export default function BlacklistManager() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [biometria, setBiometria] = useState(null);
  const [form, setForm] = useState({
    nome_suspeito: "",
    descricao_risco: "",
    nivel_alerta: "vermelho",
  });

  const load = async () => {
    const data = await base44.entities.Blacklist_Biometrica.list("-created_date", 100);
    setList(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.descricao_risco) { toast.error("Informe a descrição do risco."); return; }
    setSaving(true);
    await base44.entities.Blacklist_Biometrica.create({
      ...form,
      foto_url: biometria?.fotoUrl || null,
      face_embedding: biometria?.embedding || [],
      ativo: true,
      criado_por_id: user?.id,
      criado_por_nome: user?.full_name,
    });
    toast.success("Registro adicionado à Blacklist Biométrica.");
    setShowForm(false);
    setBiometria(null);
    setForm({ nome_suspeito: "", descricao_risco: "", nivel_alerta: "vermelho" });
    load();
    setSaving(false);
  };

  const remove = async (id) => {
    await base44.entities.Blacklist_Biometrica.delete(id);
    toast.info("Registro removido da blacklist.");
    load();
  };

  const toggleAtivo = async (item) => {
    await base44.entities.Blacklist_Biometrica.update(item.id, { ativo: !item.ativo });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-red-400" /> Blacklist Biométrica
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Rostos nesta lista disparam Alerta Vermelho imediato ao serem detectados nas câmeras.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(v => !v)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar
        </Button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3 animate-fade-in">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nome (se conhecido)</label>
              <Input value={form.nome_suspeito} onChange={e => setForm(f => ({ ...f, nome_suspeito: e.target.value }))} placeholder="Desconhecido" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nível de Alerta</label>
              <select
                value={form.nivel_alerta}
                onChange={e => setForm(f => ({ ...f, nivel_alerta: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="vermelho">🔴 Vermelho — Máxima prioridade</option>
                <option value="laranja">🟠 Laranja — Alta prioridade</option>
                <option value="amarelo">🟡 Amarelo — Atenção</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Descrição do Risco *</label>
              <Input
                value={form.descricao_risco}
                onChange={e => setForm(f => ({ ...f, descricao_risco: e.target.value }))}
                placeholder="Ex: Indivíduo com medida protetiva — não pode acessar a escola"
              />
            </div>
          </div>

          <BiometriaCapturaFace
            onCapture={setBiometria}
            onClear={() => setBiometria(null)}
          />

          {!biometria && (
            <p className="text-[10px] text-warning flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Sem biometria, o alerta só poderá ser gerado por análise manual (sem match automático).
            </p>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={save} disabled={saving} className="bg-red-600 hover:bg-red-700">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <ShieldAlert className="w-3.5 h-3.5 mr-1" />}
              Adicionar à Blacklist
            </Button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
      ) : list.length === 0 ? (
        <div className="py-8 text-center border border-dashed border-border rounded-xl text-muted-foreground text-sm">
          Nenhum registro na blacklist.
        </div>
      ) : (
        <div className="space-y-2">
          {list.map(item => (
            <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border ${NIVEL_STYLE[item.nivel_alerta]} ${!item.ativo ? "opacity-50" : ""}`}>
              {item.foto_url
                ? <img src={item.foto_url} alt="" className="w-10 h-12 object-cover rounded-lg flex-shrink-0" />
                : <div className="w-10 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0"><ShieldAlert className="w-4 h-4 text-muted-foreground" /></div>
              }
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{item.nome_suspeito || "Desconhecido"}</div>
                <div className="text-xs text-muted-foreground truncate">{item.descricao_risco}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase border ${NIVEL_STYLE[item.nivel_alerta]}`}>
                    {item.nivel_alerta}
                  </span>
                  {item.face_embedding?.length > 0 && (
                    <span className="text-[10px] text-success flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Biometria cadastrada
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => toggleAtivo(item)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-medium border transition-colors ${item.ativo ? "border-success/40 text-success bg-success/10" : "border-border text-muted-foreground"}`}
                >
                  {item.ativo ? "Ativo" : "Inativo"}
                </button>
                <button onClick={() => remove(item.id)} className="p-1.5 hover:bg-destructive/10 rounded-lg">
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
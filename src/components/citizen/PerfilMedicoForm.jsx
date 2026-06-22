import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Heart, Save, X, Plus } from "lucide-react";
import { toast } from "sonner";

export default function PerfilMedicoForm({ onSaved }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    tipo_sanguineo: "nao_informado",
    alergias: [],
    restricoes_medicamentos: [],
    condicoes_preexistentes: [],
    medicamentos_uso_continuo: [],
    contato_emergencia_nome: "",
    contato_emergencia_telefone: "",
    contato_emergencia_parentesco: "",
    contato_emergencia_alternativo: "",
    plano_saude: "",
    numero_plano: "",
    observacoes: "",
  });

  const [newItem, setNewItem] = useState({ alergias: "", restricoes_medicamentos: "", condicoes_preexistentes: "", medicamentos_uso_continuo: "" });

  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const list = await base44.entities.Perfis_Medicos_Usuarios.filter({ user_id: user.id }, "-created_date", 1);
      if (list.length > 0) {
        setProfile(list[0]);
        setForm({
          tipo_sanguineo: list[0].tipo_sanguineo || "nao_informado",
          alergias: list[0].alergias || [],
          restricoes_medicamentos: list[0].restricoes_medicamentos || [],
          condicoes_preexistentes: list[0].condicoes_preexistentes || [],
          medicamentos_uso_continuo: list[0].medicamentos_uso_continuo || [],
          contato_emergencia_nome: list[0].contato_emergencia_nome || "",
          contato_emergencia_telefone: list[0].contato_emergencia_telefone || "",
          contato_emergencia_parentesco: list[0].contato_emergencia_parentesco || "",
          contato_emergencia_alternativo: list[0].contato_emergencia_alternativo || "",
          plano_saude: list[0].plano_saude || "",
          numero_plano: list[0].numero_plano || "",
          observacoes: list[0].observacoes || "",
        });
      }
      setLoading(false);
    })();
  }, [user?.id]);

  const addItem = (field) => {
    const val = newItem[field].trim();
    if (!val) return;
    setForm((f) => ({ ...f, [field]: [...f[field], val] }));
    setNewItem((n) => ({ ...n, [field]: "" }));
  };

  const removeItem = (field, idx) => {
    setForm((f) => ({ ...f, [field]: f[field].filter((_, i) => i !== idx) }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const data = { ...form, user_id: user.id, user_name: user.full_name, ultima_atualizacao: new Date().toISOString() };
      if (profile) {
        await base44.entities.Perfis_Medicos_Usuarios.update(profile.id, data);
      } else {
        await base44.entities.Perfis_Medicos_Usuarios.create(data);
      }
      toast.success("Perfil médico salvo com sucesso!");
      onSaved?.();
    } catch (e) {
      toast.error("Erro ao salvar perfil médico");
    }
    setSaving(false);
  };

  const arrayFields = [
    { key: "alergias", label: "Alergias", placeholder: "Ex: Penicilina, Amendoim" },
    { key: "restricoes_medicamentos", label: "Restrições de Medicamentos", placeholder: "Ex: AAS, Ibuprofeno" },
    { key: "condicoes_preexistentes", label: "Condições Preexistentes", placeholder: "Ex: Diabetes tipo 2, Hipertensão" },
    { key: "medicamentos_uso_continuo", label: "Medicamentos de Uso Contínuo", placeholder: "Ex: Losartana 50mg" },
  ];

  if (loading) return <div className="p-4 text-center text-sm text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold flex items-center gap-2"><Heart className="w-4 h-4 text-emergency" /> Perfil de Saúde de Emergência</h3>
      <p className="text-xs text-muted-foreground">Essas informações serão enviadas automaticamente ao SAMU/Bombeiros em caso de emergência.</p>

      <div>
        <Label className="text-xs">Tipo Sanguíneo</Label>
        <Select value={form.tipo_sanguineo} onValueChange={(v) => setForm((f) => ({ ...f, tipo_sanguineo: v }))}>
          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["nao_informado", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {arrayFields.map(({ key, label, placeholder }) => (
        <div key={key}>
          <Label className="text-xs">{label}</Label>
          <div className="flex gap-2 mt-1">
            <Input
              placeholder={placeholder}
              value={newItem[key]}
              onChange={(e) => setNewItem((n) => ({ ...n, [key]: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem(key))}
              className="h-8 text-xs"
            />
            <Button type="button" size="sm" variant="outline" onClick={() => addItem(key)} className="h-8 px-2">
              <Plus className="w-3 h-3" />
            </Button>
          </div>
          {form[key].length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {form[key].map((item, i) => (
                <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-xs">
                  {item}
                  <button onClick={() => removeItem(key, i)}><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}
        </div>
      ))}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Contato de Emergência (Nome)</Label>
          <Input className="h-8 mt-1 text-xs" value={form.contato_emergencia_nome}
            onChange={(e) => setForm((f) => ({ ...f, contato_emergencia_nome: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs">Telefone</Label>
          <Input className="h-8 mt-1 text-xs" value={form.contato_emergencia_telefone}
            onChange={(e) => setForm((f) => ({ ...f, contato_emergencia_telefone: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs">Parentesco</Label>
          <Input className="h-8 mt-1 text-xs" value={form.contato_emergencia_parentesco}
            onChange={(e) => setForm((f) => ({ ...f, contato_emergencia_parentesco: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs">Contato Alternativo</Label>
          <Input className="h-8 mt-1 text-xs" value={form.contato_emergencia_alternativo}
            onChange={(e) => setForm((f) => ({ ...f, contato_emergencia_alternativo: e.target.value }))} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Plano de Saúde</Label>
          <Input className="h-8 mt-1 text-xs" value={form.plano_saude}
            onChange={(e) => setForm((f) => ({ ...f, plano_saude: e.target.value }))} />
        </div>
        <div>
          <Label className="text-xs">Nº do Plano</Label>
          <Input className="h-8 mt-1 text-xs" value={form.numero_plano}
            onChange={(e) => setForm((f) => ({ ...f, numero_plano: e.target.value }))} />
        </div>
      </div>

      <div>
        <Label className="text-xs">Observações adicionais</Label>
        <Textarea className="mt-1 text-xs" rows={2} value={form.observacoes}
          onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} />
      </div>

      <Button onClick={save} disabled={saving} size="sm" className="w-full">
        <Save className="w-3.5 h-3.5 mr-1.5" /> {saving ? "Salvando..." : "Salvar Perfil Médico"}
      </Button>
    </div>
  );
}
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ClipboardList, Plus, QrCode, CheckCircle2, XCircle, Loader2,
  Clock, User, ShieldCheck, AlertTriangle, Copy
} from "lucide-react";
import { toast } from "sonner";
import BiometriaCapturaFace from "./BiometriaCapturaFace";

const STATUS_STYLE = {
  pendente: "text-warning bg-warning/10",
  ativo: "text-success bg-success/10",
  utilizado: "text-muted-foreground bg-muted",
  expirado: "text-destructive bg-destructive/10",
  cancelado: "text-destructive/70 bg-destructive/5",
};

function generateToken() {
  return Math.random().toString(36).substring(2, 10).toUpperCase() +
    "-" + Math.random().toString(36).substring(2, 6).toUpperCase();
}

export default function OrdemServicoVisitante({ escolas = [] }) {
  const { user } = useAuth();
  const [ordens, setOrdens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [biometria, setBiometria] = useState(null);
  const [form, setForm] = useState({
    nome_visitante: "",
    tipo_visitante: "visitante_comum",
    documento_identidade: "",
    motivo_visita: "",
    id_escola_cerca: "",
    data_visita: new Date().toISOString().split("T")[0],
    horario_inicio: "08:00",
    horario_fim: "17:00",
  });

  const load = async () => {
    const data = await base44.entities.Ordens_Servico_Visitantes.list("-created_date", 100);
    setOrdens(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Auto-expirar ordens vencidas
  useEffect(() => {
    const hoje = new Date().toISOString().split("T")[0];
    ordens.forEach(async o => {
      if (o.status === "ativo" && o.data_visita < hoje) {
        await base44.entities.Ordens_Servico_Visitantes.update(o.id, { status: "expirado" });
      }
    });
  }, [ordens]);

  const save = async () => {
    if (!form.nome_visitante || !form.id_escola_cerca) {
      toast.error("Nome do visitante e escola são obrigatórios.");
      return;
    }
    setSaving(true);
    const escola = escolas.find(e => e.id === form.id_escola_cerca);
    const token = generateToken();
    await base44.entities.Ordens_Servico_Visitantes.create({
      ...form,
      nome_escola: escola?.nome_escola || "",
      foto_url: biometria?.fotoUrl || null,
      face_embedding: biometria?.embedding || [],
      qr_token: token,
      status: "ativo",
      criado_por_id: user?.id,
      criado_por_nome: user?.full_name,
    });
    toast.success(`Ordem criada! Token: ${token}`);
    setShowForm(false);
    setBiometria(null);
    setForm({ nome_visitante: "", tipo_visitante: "visitante_comum", documento_identidade: "", motivo_visita: "", id_escola_cerca: "", data_visita: new Date().toISOString().split("T")[0], horario_inicio: "08:00", horario_fim: "17:00" });
    load();
    setSaving(false);
  };

  const cancelar = async (id) => {
    await base44.entities.Ordens_Servico_Visitantes.update(id, { status: "cancelado" });
    load();
  };

  const copyToken = (token) => {
    navigator.clipboard.writeText(token);
    toast.success("Token copiado!");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" /> Ordens de Serviço / Visitantes (2FA)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Visitantes precisam de face cadastrada + Token QR ativo para liberar acesso.
          </p>
        </div>
        <Button size="sm" onClick={() => setShowForm(v => !v)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Nova Ordem
        </Button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-3 animate-fade-in">
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nome do Visitante *</label>
              <Input value={form.nome_visitante} onChange={e => setForm(f => ({ ...f, nome_visitante: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
              <select value={form.tipo_visitante} onChange={e => setForm(f => ({ ...f, tipo_visitante: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                <option value="visitante_comum">Visitante</option>
                <option value="fornecedor">Fornecedor</option>
                <option value="tecnico">Técnico</option>
                <option value="prestador_servico">Prestador de Serviço</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Documento</label>
              <Input value={form.documento_identidade} onChange={e => setForm(f => ({ ...f, documento_identidade: e.target.value }))} placeholder="RG / CPF" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Escola *</label>
              <select value={form.id_escola_cerca} onChange={e => setForm(f => ({ ...f, id_escola_cerca: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                <option value="">Selecione...</option>
                {escolas.map(e => <option key={e.id} value={e.id}>{e.nome_escola}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Motivo da Visita</label>
              <Input value={form.motivo_visita} onChange={e => setForm(f => ({ ...f, motivo_visita: e.target.value }))} placeholder="Ex: Manutenção do ar-condicionado" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data da Visita</label>
              <Input type="date" value={form.data_visita} onChange={e => setForm(f => ({ ...f, data_visita: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Entrada</label>
                <Input type="time" value={form.horario_inicio} onChange={e => setForm(f => ({ ...f, horario_inicio: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Saída</label>
                <Input type="time" value={form.horario_fim} onChange={e => setForm(f => ({ ...f, horario_fim: e.target.value }))} />
              </div>
            </div>
          </div>

          <div className="border-t border-border/60 pt-3">
            <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              Biometria Facial (2º Fator — obrigatório para liberar acesso)
            </p>
            <BiometriaCapturaFace onCapture={setBiometria} onClear={() => setBiometria(null)} />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <QrCode className="w-3.5 h-3.5 mr-1" />}
              Gerar Token de Acesso
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
      ) : ordens.length === 0 ? (
        <div className="py-8 text-center border border-dashed border-border rounded-xl text-muted-foreground text-sm">
          Nenhuma ordem de serviço cadastrada.
        </div>
      ) : (
        <div className="space-y-2">
          {ordens.map(o => (
            <div key={o.id} className={`flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card ${o.status === "cancelado" || o.status === "expirado" ? "opacity-60" : ""}`}>
              {o.foto_url
                ? <img src={o.foto_url} alt="" className="w-10 h-12 object-cover rounded-lg flex-shrink-0" />
                : <div className="w-10 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0"><User className="w-4 h-4 text-muted-foreground" /></div>
              }
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{o.nome_visitante}</div>
                <div className="text-xs text-muted-foreground">{o.tipo_visitante?.replace(/_/g, " ")} · {o.nome_escola}</div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${STATUS_STYLE[o.status]}`}>
                    {o.status}
                  </span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {o.data_visita} · {o.horario_inicio}–{o.horario_fim}
                  </span>
                  {o.face_embedding?.length > 0 && (
                    <span className="text-[10px] text-success flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> 2FA biométrico
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-1.5 bg-muted rounded-lg px-2 py-1">
                  <QrCode className="w-3 h-3 text-primary" />
                  <span className="text-xs font-mono font-bold tracking-wider">{o.qr_token}</span>
                  <button onClick={() => copyToken(o.qr_token)}>
                    <Copy className="w-3 h-3 text-muted-foreground hover:text-primary" />
                  </button>
                </div>
                {o.status === "ativo" && (
                  <button onClick={() => cancelar(o.id)} className="text-[10px] text-destructive hover:underline flex items-center gap-1">
                    <XCircle className="w-3 h-3" /> Cancelar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
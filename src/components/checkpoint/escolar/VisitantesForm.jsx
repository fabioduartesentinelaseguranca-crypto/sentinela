import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Wrench, Trash2, CalendarClock, QrCode } from "lucide-react";
import CheckpointFaceCapture from "@/components/checkpoint/CheckpointFaceCapture";

const TIPOS = [
  { v: "fornecedor", l: "Fornecedor" }, { v: "tecnico", l: "Técnico" },
  { v: "prestador_servico", l: "Prestador de Serviço" }, { v: "visitante_comum", l: "Visitante Comum" },
];

const STATUS_LABEL = {
  pendente: { t: "Pendente", c: "text-yellow-500" },
  ativo: { t: "Ativo", c: "text-green-500" },
  utilizado: { t: "Utilizado", c: "text-blue-500" },
  expirado: { t: "Expirado", c: "text-muted-foreground" },
  cancelado: { t: "Cancelado", c: "text-red-500" },
};

function genToken() {
  return Array.from({ length: 12 }, () => Math.random().toString(36).slice(2, 8)).slice(0, 1)[0] +
    Date.now().toString(36).toUpperCase();
}

export default function VisitantesForm({ onSaved }) {
  const [list, setList] = useState([]);
  const [escolas, setEscolas] = useState([]);
  const [form, setForm] = useState({
    nome_visitante: "", tipo_visitante: "visitante_comum", id_escola_cerca: "",
    documento_identidade: "", motivo_visita: "", data_visita: "",
    horario_inicio: "08:00", horario_fim: "18:00",
  });
  const [bio, setBio] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [v, e] = await Promise.all([
      base44.entities.Ordens_Servico_Visitantes.list("-created_date", 100),
      base44.entities.Cercas_Virtuais_Escolares.list(),
    ]);
    setList(v); setEscolas(e);
  };
  useEffect(() => { load(); }, []);

  const escola = escolas.find((e) => e.id === form.id_escola_cerca);

  const save = async () => {
    if (!form.nome_visitante) return toast.error("Nome do visitante é obrigatório");
    if (!form.id_escola_cerca) return toast.error("Selecione a escola");
    if (!form.data_visita) return toast.error("Data da visita é obrigatória");
    if (!bio?.embedding?.length) return toast.error("Biometria facial é obrigatória");
    setLoading(true);
    try {
      const created = await base44.entities.Ordens_Servico_Visitantes.create({
        id_escola_cerca: form.id_escola_cerca,
        nome_escola: escola?.nome_escola || "",
        nome_visitante: form.nome_visitante,
        tipo_visitante: form.tipo_visitante,
        foto_url: bio.file_url,
        face_embedding: bio.embedding,
        documento_identidade: form.documento_identidade,
        motivo_visita: form.motivo_visita,
        qr_token: genToken(),
        data_visita: form.data_visita,
        horario_inicio: form.horario_inicio,
        horario_fim: form.horario_fim,
        status: "pendente",
      });
      toast.success("Ordem de serviço/visita criada");
      setForm({ nome_visitante: "", tipo_visitante: "visitante_comum", id_escola_cerca: "", documento_identidade: "", motivo_visita: "", data_visita: "", horario_inicio: "08:00", horario_fim: "18:00" });
      setBio(null);
      load(); onSaved?.();
    } catch (err) { toast.error("Erro: " + err.message); }
    setLoading(false);
  };

  const remove = async (id) => { await base44.entities.Ordens_Servico_Visitantes.delete(id); load(); onSaved?.(); toast.info("Ordem removida"); };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-3">
        <Input placeholder="Nome do visitante/prestador *" value={form.nome_visitante} onChange={(e) => setForm({ ...form, nome_visitante: e.target.value })} />
        <Select value={form.tipo_visitante} onValueChange={(v) => setForm({ ...form, tipo_visitante: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{TIPOS.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={form.id_escola_cerca} onValueChange={(v) => setForm({ ...form, id_escola_cerca: v })}>
          <SelectTrigger><SelectValue placeholder="Escola *" /></SelectTrigger>
          <SelectContent>{escolas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome_escola}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="Documento de identidade (RG/CNPJ)" value={form.documento_identidade} onChange={(e) => setForm({ ...form, documento_identidade: e.target.value })} />
        <Textarea placeholder="Motivo da visita / serviço a ser realizado" rows={2} value={form.motivo_visita} onChange={(e) => setForm({ ...form, motivo_visita: e.target.value })} />
        <Input type="date" value={form.data_visita} onChange={(e) => setForm({ ...form, data_visita: e.target.value })} />
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-xs text-muted-foreground">Início</label><Input type="time" value={form.horario_inicio} onChange={(e) => setForm({ ...form, horario_inicio: e.target.value })} /></div>
          <div><label className="text-xs text-muted-foreground">Fim</label><Input type="time" value={form.horario_fim} onChange={(e) => setForm({ ...form, horario_fim: e.target.value })} /></div>
        </div>
        <div className="text-xs text-muted-foreground">Token 2FA gerado automaticamente após o cadastro.</div>
        <CheckpointFaceCapture onCapture={setBio} />
        <Button className="w-full" onClick={save} disabled={loading}>{loading ? "Salvando..." : "Emitir Ordem de Acesso"}</Button>
      </div>
      <div className="space-y-2 max-h-[560px] overflow-y-auto scrollbar-thin">
        {list.map((v) => (
          <div key={v.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-border/60 bg-card">
            {v.foto_url ? <img src={v.foto_url} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <Wrench className="w-8 h-8 text-muted-foreground" />}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{v.nome_visitante}</div>
              <div className="text-xs text-muted-foreground truncate">{TIPOS.find((t) => t.v === v.tipo_visitante)?.l || v.tipo_visitante} · {v.nome_escola || "—"}</div>
              <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                <CalendarClock className="w-3 h-3" />{v.data_visita} {v.horario_inicio}-{v.horario_fim}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-[10px] font-bold ${STATUS_LABEL[v.status]?.c || "text-muted-foreground"}`}>{STATUS_LABEL[v.status]?.t || v.status}</span>
                {v.qr_token && <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-0.5"><QrCode className="w-3 h-3" />{v.qr_token.slice(0, 10)}…</span>}
              </div>
            </div>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(v.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhuma ordem de visita emitida.</p>}
      </div>
    </div>
  );
}
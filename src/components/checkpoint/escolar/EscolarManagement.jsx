import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { GraduationCap, Ban, Trash2, Glasses, Users, Wrench } from "lucide-react";
import CheckpointFaceCapture from "@/components/checkpoint/CheckpointFaceCapture";
import { bloquearSeConflito } from "@/lib/biometria";
import ResponsaveisForm from "@/components/checkpoint/escolar/ResponsaveisForm";
import VisitantesForm from "@/components/checkpoint/escolar/VisitantesForm";

const TURNOS = [
  { v: "manha", l: "Manhã" }, { v: "tarde", l: "Tarde" },
  { v: "noite", l: "Noite" }, { v: "integral", l: "Integral" },
];

function AlunosForm({ onSaved }) {
  const [alunos, setAlunos] = useState([]);
  const [escolas, setEscolas] = useState([]);
  const [form, setForm] = useState({
    nome: "", matricula: "", id_escola_cerca: "", turno: "manha",
    horario_entrada: "07:00", horario_saida: "12:00", tolerancia_minutos: 15, usa_oculos: false,
  });
  const [bio, setBio] = useState(null);
  const [bioOculos, setBioOculos] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [a, e] = await Promise.all([
      base44.entities.Alunos_Biometria.list("-created_date", 100),
      base44.entities.Cercas_Virtuais_Escolares.list(),
    ]);
    setAlunos(a); setEscolas(e);
  };
  useEffect(() => { load(); }, []);

  const escola = escolas.find((e) => e.id === form.id_escola_cerca);

  const save = async () => {
    if (!form.nome) return toast.error("Nome é obrigatório");
    if (!form.matricula) return toast.error("Matrícula é obrigatória");
    if (!form.id_escola_cerca) return toast.error("Selecione a escola");
    if (!bio?.embedding?.length) return toast.error("Biometria facial é obrigatória");
    if (form.usa_oculos && !bioOculos?.embedding?.length) return toast.error("Biometria com óculos é obrigatória (cadastro duplo)");
    setLoading(true);
    try {
      const embeddings = [bio.embedding, ...(form.usa_oculos && bioOculos?.embedding ? [bioOculos.embedding] : [])];
      for (const emb of embeddings) {
        if (await bloquearSeConflito(emb, ["alunos", "blacklist", "procurados"])) { setLoading(false); return; }
      }
      await base44.entities.Alunos_Biometria.create({
        nome: form.nome, matricula: form.matricula,
        id_escola_cerca: form.id_escola_cerca, nome_escola: escola?.nome_escola || "",
        turno: form.turno, horario_entrada: form.horario_entrada, horario_saida: form.horario_saida,
        tolerancia_minutos: Number(form.tolerancia_minutos) || 0,
        usa_oculos: form.usa_oculos,
        foto_url: bio.file_url, face_embedding: bio.embedding,
        foto_url_oculos: form.usa_oculos ? bioOculos?.file_url : undefined,
        face_embedding_oculos: form.usa_oculos ? bioOculos?.embedding : undefined,
        ativo: true,
      });
      toast.success("Aluno cadastrado com biometria");
      setForm({ nome: "", matricula: "", id_escola_cerca: "", turno: "manha", horario_entrada: "07:00", horario_saida: "12:00", tolerancia_minutos: 15, usa_oculos: false });
      setBio(null); setBioOculos(null);
      load(); onSaved?.();
    } catch (err) { toast.error("Erro: " + err.message); }
    setLoading(false);
  };

  const remove = async (id) => { await base44.entities.Alunos_Biometria.delete(id); load(); onSaved?.(); toast.info("Aluno removido"); };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-3">
        <Input placeholder="Nome do aluno *" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        <Input placeholder="Matrícula *" value={form.matricula} onChange={(e) => setForm({ ...form, matricula: e.target.value })} />
        <Select value={form.id_escola_cerca} onValueChange={(v) => setForm({ ...form, id_escola_cerca: v })}>
          <SelectTrigger><SelectValue placeholder="Escola *" /></SelectTrigger>
          <SelectContent>{escolas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome_escola}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={form.turno} onValueChange={(v) => setForm({ ...form, turno: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{TURNOS.map((t) => <SelectItem key={t.v} value={t.v}>{t.l}</SelectItem>)}</SelectContent>
        </Select>
        <div className="grid grid-cols-3 gap-2">
          <div><label className="text-xs text-muted-foreground">Entrada</label><Input type="time" value={form.horario_entrada} onChange={(e) => setForm({ ...form, horario_entrada: e.target.value })} /></div>
          <div><label className="text-xs text-muted-foreground">Saída</label><Input type="time" value={form.horario_saida} onChange={(e) => setForm({ ...form, horario_saida: e.target.value })} /></div>
          <div><label className="text-xs text-muted-foreground">Tol. (min)</label><Input type="number" value={form.tolerancia_minutos} onChange={(e) => setForm({ ...form, tolerancia_minutos: e.target.value })} /></div>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={form.usa_oculos} onChange={(e) => setForm({ ...form, usa_oculos: e.target.checked })} className="accent-primary w-4 h-4" />
          <Glasses className="w-4 h-4 text-muted-foreground" /> Usa óculos de grau (cadastro duplo)
        </label>
        <div className="text-xs text-muted-foreground font-medium">Biometria principal{form.usa_oculos ? " (sem óculos)" : ""}:</div>
        <CheckpointFaceCapture onCapture={setBio} />
        {form.usa_oculos && (
          <>
            <div className="text-xs text-muted-foreground font-medium mt-2">Biometria com óculos:</div>
            <CheckpointFaceCapture onCapture={setBioOculos} />
          </>
        )}
        <Button className="w-full" onClick={save} disabled={loading}>{loading ? "Salvando..." : "Cadastrar Aluno"}</Button>
      </div>
      <div className="space-y-2 max-h-[520px] overflow-y-auto scrollbar-thin">
        {alunos.map((a) => (
          <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-border/60 bg-card">
            {a.foto_url ? <img src={a.foto_url} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <GraduationCap className="w-8 h-8 text-muted-foreground" />}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{a.nome}</div>
              <div className="text-xs text-muted-foreground truncate">{a.matricula} · {a.nome_escola || "—"} · {a.horario_entrada}-{a.horario_saida}{a.usa_oculos ? " · óculos" : ""}</div>
            </div>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(a.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        ))}
        {alunos.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum aluno cadastrado.</p>}
      </div>
    </div>
  );
}

function BlacklistForm({ onSaved }) {
  const [list, setList] = useState([]);
  const [form, setForm] = useState({ nome_suspeito: "", descricao_risco: "", nivel_alerta: "vermelho" });
  const [bio, setBio] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => { setList(await base44.entities.Blacklist_Biometrica.list("-created_date", 100)); };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.descricao_risco) return toast.error("Descrição do risco é obrigatória");
    if (!bio?.embedding?.length) return toast.error("Biometria facial é obrigatória");
    setLoading(true);
    try {
      if (await bloquearSeConflito(bio.embedding, ["alunos", "blacklist", "procurados"])) { setLoading(false); return; }
      await base44.entities.Blacklist_Biometrica.create({
        nome_suspeito: form.nome_suspeito, descricao_risco: form.descricao_risco,
        nivel_alerta: form.nivel_alerta, foto_url: bio.file_url, face_embedding: bio.embedding, ativo: true,
      });
      toast.success("Registro de blacklist criado");
      setForm({ nome_suspeito: "", descricao_risco: "", nivel_alerta: "vermelho" }); setBio(null);
      load(); onSaved?.();
    } catch (err) { toast.error("Erro: " + err.message); }
    setLoading(false);
  };

  const remove = async (id) => { await base44.entities.Blacklist_Biometrica.delete(id); load(); onSaved?.(); toast.info("Removido da blacklist"); };

  const nivelLabel = { vermelho: "Vermelho", laranja: "Laranja", amarelo: "Amarelo" };
  const nivelColor = { vermelho: "text-red-500", laranja: "text-orange-500", amarelo: "text-yellow-500" };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-3">
        <Input placeholder="Nome do suspeito (se conhecido)" value={form.nome_suspeito} onChange={(e) => setForm({ ...form, nome_suspeito: e.target.value })} />
        <Textarea placeholder="Descrição do risco / motivo da restrição *" rows={3} value={form.descricao_risco} onChange={(e) => setForm({ ...form, descricao_risco: e.target.value })} />
        <Select value={form.nivel_alerta} onValueChange={(v) => setForm({ ...form, nivel_alerta: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="vermelho">Vermelho (crítico)</SelectItem>
            <SelectItem value="laranja">Laranja (alto)</SelectItem>
            <SelectItem value="amarelo">Amarelo (moderado)</SelectItem>
          </SelectContent>
        </Select>
        <CheckpointFaceCapture onCapture={setBio} />
        <Button className="w-full bg-destructive hover:bg-destructive/90" onClick={save} disabled={loading}>{loading ? "Salvando..." : "Adicionar à Blacklist"}</Button>
      </div>
      <div className="space-y-2 max-h-[520px] overflow-y-auto scrollbar-thin">
        {list.map((b) => (
          <div key={b.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-border/60 bg-card">
            {b.foto_url ? <img src={b.foto_url} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <Ban className="w-8 h-8 text-destructive" />}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{b.nome_suspeito || "Suspeito não identificado"}</div>
              <div className="text-xs text-muted-foreground truncate">{b.descricao_risco}</div>
              <div className={`text-[10px] font-bold ${nivelColor[b.nivel_alerta]}`}>{nivelLabel[b.nivel_alerta]}</div>
            </div>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(b.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum registro na blacklist.</p>}
      </div>
    </div>
  );
}

export default function EscolarManagement({ onSaved }) {
  return (
    <Tabs defaultValue="alunos">
      <TabsList className="mb-4 flex flex-wrap">
        <TabsTrigger value="alunos"><GraduationCap className="w-4 h-4 mr-1.5" /> Alunos</TabsTrigger>
        <TabsTrigger value="responsaveis"><Users className="w-4 h-4 mr-1.5" /> Responsáveis</TabsTrigger>
        <TabsTrigger value="visitantes"><Wrench className="w-4 h-4 mr-1.5" /> Visitantes/OS</TabsTrigger>
        <TabsTrigger value="blacklist"><Ban className="w-4 h-4 mr-1.5" /> Blacklist</TabsTrigger>
      </TabsList>
      <TabsContent value="alunos"><AlunosForm onSaved={onSaved} /></TabsContent>
      <TabsContent value="responsaveis"><ResponsaveisForm onSaved={onSaved} /></TabsContent>
      <TabsContent value="visitantes"><VisitantesForm onSaved={onSaved} /></TabsContent>
      <TabsContent value="blacklist"><BlacklistForm onSaved={onSaved} /></TabsContent>
    </Tabs>
  );
}
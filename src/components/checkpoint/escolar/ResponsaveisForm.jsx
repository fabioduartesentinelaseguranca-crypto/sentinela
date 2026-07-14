import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Users, Trash2, Phone, UserCog } from "lucide-react";
import CheckpointFaceCapture from "@/components/checkpoint/CheckpointFaceCapture";

const PARENTESCOS = [
  { v: "pai", l: "Pai" }, { v: "mae", l: "Mãe" }, { v: "avo", l: "Avô" },
  { v: "avoa", l: "Avó" }, { v: "tio", l: "Tio" }, { v: "tia", l: "Tia" },
  { v: "responsavel_legal", l: "Responsável Legal" }, { v: "outro", l: "Outro" },
];

export default function ResponsaveisForm({ onSaved }) {
  const [list, setList] = useState([]);
  const [escolas, setEscolas] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [alunosEscola, setAlunosEscola] = useState([]);
  const [form, setForm] = useState({
    nome_responsavel: "", parentesco: "responsavel_legal", telefone: "", id_escola_cerca: "",
  });
  const [vinculados, setVinculados] = useState([]);
  const [bio, setBio] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [r, e, a] = await Promise.all([
      base44.entities.Biometria_Responsaveis.list("-created_date", 100),
      base44.entities.Cercas_Virtuais_Escolares.list(),
      base44.entities.Alunos_Biometria.list("-created_date", 200),
    ]);
    setList(r); setEscolas(e); setAlunos(a);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    setAlunosEscola(alunos.filter((a) => a.id_escola_cerca === form.id_escola_cerca && a.ativo));
    setVinculados([]);
  }, [form.id_escola_cerca, alunos]);

  const escola = escolas.find((e) => e.id === form.id_escola_cerca);

  const toggleAluno = (a) => {
    setVinculados((v) => v.includes(a.id) ? v.filter((x) => x !== a.id) : [...v, a.id]);
  };

  const save = async () => {
    if (!form.nome_responsavel) return toast.error("Nome do responsável é obrigatório");
    if (!form.id_escola_cerca) return toast.error("Selecione a escola");
    if (!bio?.embedding?.length) return toast.error("Biometria facial é obrigatória");
    setLoading(true);
    try {
      const linked = alunos.filter((a) => vinculados.includes(a.id));
      await base44.entities.Biometria_Responsaveis.create({
        nome_responsavel: form.nome_responsavel,
        parentesco: form.parentesco,
        telefone: form.telefone,
        id_escola_cerca: form.id_escola_cerca,
        nome_escola: escola?.nome_escola || "",
        matriculas_vinculadas: linked.map((a) => a.matricula).filter(Boolean),
        alunos_ids: linked.map((a) => a.id),
        alunos_nomes: linked.map((a) => a.nome),
        foto_url: bio.file_url,
        face_embedding: bio.embedding,
        ativo: true,
      });
      // Link-back: adiciona o nome do responsável em cada aluno vinculado
      for (const a of linked) {
        const nomes = Array.isArray(a.responsaveis_nomes) ? [...a.responsaveis_nomes] : [];
        if (!nomes.includes(form.nome_responsavel)) nomes.push(form.nome_responsavel);
        await base44.entities.Alunos_Biometria.update(a.id, { responsaveis_nomes: nomes });
      }
      toast.success("Responsável cadastrado com biometria");
      setForm({ nome_responsavel: "", parentesco: "responsavel_legal", telefone: "", id_escola_cerca: "" });
      setBio(null); setVinculados([]);
      load(); onSaved?.();
    } catch (err) { toast.error("Erro: " + err.message); }
    setLoading(false);
  };

  const remove = async (id) => { await base44.entities.Biometria_Responsaveis.delete(id); load(); onSaved?.(); toast.info("Responsável removido"); };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-3">
        <Input placeholder="Nome do responsável *" value={form.nome_responsavel} onChange={(e) => setForm({ ...form, nome_responsavel: e.target.value })} />
        <Select value={form.parentesco} onValueChange={(v) => setForm({ ...form, parentesco: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{PARENTESCOS.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="Telefone (com DDD)" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
        <Select value={form.id_escola_cerca} onValueChange={(v) => setForm({ ...form, id_escola_cerca: v })}>
          <SelectTrigger><SelectValue placeholder="Escola *" /></SelectTrigger>
          <SelectContent>{escolas.map((e) => <SelectItem key={e.id} value={e.id}>{e.nome_escola}</SelectItem>)}</SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground font-medium pt-1">Alunos vinculados (pode retirar):</div>
        <div className="max-h-40 overflow-y-auto scrollbar-thin rounded-xl border border-border/60 p-2 space-y-1">
          {form.id_escola_cerca ? (
            alunosEscola.length === 0 ? <p className="text-xs text-muted-foreground p-2">Nenhum aluno nesta escola.</p>
              : alunosEscola.map((a) => (
                <label key={a.id} className="flex items-center gap-2 text-sm p-1.5 rounded-lg hover:bg-accent/40 cursor-pointer">
                  <input type="checkbox" checked={vinculados.includes(a.id)} onChange={() => toggleAluno(a)} className="accent-primary w-4 h-4" />
                  <span className="truncate">{a.nome} <span className="text-muted-foreground">· {a.matricula}</span></span>
                </label>
              ))
          ) : <p className="text-xs text-muted-foreground p-2">Selecione a escola para listar os alunos.</p>}
        </div>
        <CheckpointFaceCapture onCapture={setBio} />
        <Button className="w-full" onClick={save} disabled={loading}>{loading ? "Salvando..." : "Cadastrar Responsável"}</Button>
      </div>
      <div className="space-y-2 max-h-[560px] overflow-y-auto scrollbar-thin">
        {list.map((r) => (
          <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-border/60 bg-card">
            {r.foto_url ? <img src={r.foto_url} alt="" className="w-10 h-10 rounded-lg object-cover" /> : <Users className="w-8 h-8 text-muted-foreground" />}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">{r.nome_responsavel}</div>
              <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5 flex-wrap">
                <span className="capitalize">{r.parentesco?.replace("_", " ")}</span>
                {r.telefone && <><Phone className="w-3 h-3" />{r.telefone}</>}
                <UserCog className="w-3 h-3" /> {r.alunos_nomes?.length || 0} aluno(s)
              </div>
              <div className="text-[10px] text-muted-foreground truncate">{r.nome_escola || "—"}</div>
            </div>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Nenhum responsável cadastrado.</p>}
      </div>
    </div>
  );
}
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  UserCheck, Plus, X, Loader2, Search, ShieldCheck, AlertTriangle,
  Trash2, Edit2, ChevronDown, ChevronUp, Phone, Users, Link2,
  RefreshCw, CheckCircle2, Clock
} from "lucide-react";
import { toast } from "sonner";
import BiometriaCapturaFace from "./BiometriaCapturaFace";

const PARENTESCO_LABELS = {
  pai: "Pai", mae: "Mãe", avo: "Avô", avoa: "Avó",
  tio: "Tio", tia: "Tia", responsavel_legal: "Responsável Legal", outro: "Outro"
};

const EMPTY_FORM = {
  nome_responsavel: "", parentesco: "responsavel_legal", telefone: "",
  id_escola_cerca: "", matriculas_vinculadas: [""],
};

export default function BiometriaResponsaveis({ escolas = [], alunos = [] }) {
  const { user } = useAuth();
  const [responsaveis, setResponsaveis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [biometria, setBiometria] = useState(null);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [busca, setBusca] = useState("");
  const [filtroEscola, setFiltroEscola] = useState("__todas__");
  const [checklist, setChecklist] = useState({});

  const load = async () => {
    setLoading(true);
    try {
      const data = await base44.entities.Biometria_Responsaveis.list("-created_date", 200);
      setResponsaveis(data);
    } catch (e) {
      toast.error("Erro ao carregar responsáveis.");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setMatricula = (i, val) => {
    const arr = [...(form.matriculas_vinculadas || [""])];
    arr[i] = val;
    setForm(f => ({ ...f, matriculas_vinculadas: arr }));
  };

  const addMatricula = () => setForm(f => ({
    ...f, matriculas_vinculadas: [...(f.matriculas_vinculadas || [""]), ""]
  }));

  const removeMatricula = (i) => setForm(f => ({
    ...f, matriculas_vinculadas: f.matriculas_vinculadas.filter((_, idx) => idx !== i)
  }));

  const escolaSelecionada = escolas.find(e => e.id === form.id_escola_cerca);

  const runChecklist = async (responsavelId, matriculas, escolaId, embeddingResponsavel) => {
    setChecklist(prev => ({ ...prev, [responsavelId]: { loading: true, itens: [] } }));
    const itens = [];
    for (const mat of (matriculas || []).filter(Boolean)) {
      try {
        const encontrados = await base44.entities.Alunos_Biometria.filter({ matricula: mat, id_escola_cerca: escolaId });
        if (!encontrados || encontrados.length === 0) {
          itens.push({ matricula: mat, status: "nao_encontrado" });
        } else {
          const aluno = encontrados[0];
          const temBiometria = (aluno.face_embedding?.length || 0) > 0;
          let consistencia = "ok";
          if (temBiometria && embeddingResponsavel?.length > 0) {
            const ea = aluno.face_embedding;
            const er = embeddingResponsavel;
            const dot = ea.reduce((s, v, i) => s + v * (er[i] || 0), 0);
            const normA = Math.sqrt(ea.reduce((s, v) => s + v * v, 0));
            const normR = Math.sqrt(er.reduce((s, v) => s + v * v, 0));
            const sim = normA && normR ? dot / (normA * normR) : 0;
            consistencia = sim > 0.75 ? "suspeito" : "ok";
          }
          itens.push({ matricula: mat, status: "encontrado", nome: aluno.nome, temBiometria, consistencia });
        }
      } catch {
        itens.push({ matricula: mat, status: "nao_encontrado" });
      }
    }
    setChecklist(prev => ({ ...prev, [responsavelId]: { loading: false, itens } }));
  };

  const save = async () => {
    if (!form.nome_responsavel.trim()) {
      toast.error("Preencha o nome do responsável.");
      return;
    }
    if (!form.id_escola_cerca) {
      toast.error("Selecione a escola.");
      return;
    }
    setSaving(true);

    const matriculasValidas = (form.matriculas_vinculadas || []).filter(Boolean);
    const alunosMatch = alunos.filter(a =>
      a.id_escola_cerca === form.id_escola_cerca && matriculasValidas.includes(a.matricula)
    );

    // Capturar refs antes de qualquer reset
    const escolaId = form.id_escola_cerca;
    const embeddingCapturado = biometria?.embedding || [];
    const nomeResponsavel = form.nome_responsavel;

    const data = {
      nome_responsavel: nomeResponsavel,
      parentesco: form.parentesco,
      telefone: form.telefone,
      id_escola_cerca: escolaId,
      nome_escola: escolaSelecionada?.nome_escola || "",
      matriculas_vinculadas: matriculasValidas,
      alunos_ids: alunosMatch.map(a => a.id),
      alunos_nomes: alunosMatch.map(a => a.nome),
      cadastrado_por_id: user?.id,
      cadastrado_por_nome: user?.full_name,
      ativo: true,
      ...(biometria ? {
        foto_url: biometria.fotoUrl,
        face_embedding: biometria.embedding,
        score_qualidade: biometria.qualidade,
      } : {}),
    };

    try {
      let savedId = editingId;
      if (editingId) {
        await base44.entities.Biometria_Responsaveis.update(editingId, data);
        toast.success("Responsável atualizado!");
      } else {
        const created = await base44.entities.Biometria_Responsaveis.create(data);
        savedId = created.id;
        toast.success("Responsável cadastrado com sucesso!");
        base44.functions.invoke('notificarNovoResponsavel', { responsavelId: created.id }).catch(() => {});
      }

      // Atualizar alunos vinculados
      if (savedId && alunosMatch.length > 0) {
        await Promise.allSettled(alunosMatch.map(a =>
          base44.entities.Alunos_Biometria.update(a.id, {
            responsaveis_ids: [...new Set([...(a.responsaveis_ids || []), savedId])],
            responsaveis_nomes: [...new Set([...(a.responsaveis_nomes || []), nomeResponsavel])],
          })
        ));
      }

      // Reset form
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      setBiometria(null);

      await load();

      if (savedId && matriculasValidas.length > 0) {
        runChecklist(savedId, matriculasValidas, escolaId, embeddingCapturado);
      }
    } catch (err) {
      toast.error("Erro ao salvar: " + (err?.message || "Tente novamente."));
    }

    setSaving(false);
  };

  const startEdit = (r) => {
    setForm({
      nome_responsavel: r.nome_responsavel || "",
      parentesco: r.parentesco || "responsavel_legal",
      telefone: r.telefone || "",
      id_escola_cerca: r.id_escola_cerca || "",
      matriculas_vinculadas: r.matriculas_vinculadas?.length ? r.matriculas_vinculadas : [""],
    });
    setEditingId(r.id);
    setBiometria(r.foto_url ? { fotoUrl: r.foto_url, embedding: r.face_embedding || [], qualidade: r.score_qualidade } : null);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (r) => {
    if (!confirm(`Remover ${r.nome_responsavel}?`)) return;
    await base44.entities.Biometria_Responsaveis.delete(r.id);
    toast.info("Responsável removido.");
    load();
  };

  const lista = responsaveis.filter(r => {
    const matchBusca = !busca || r.nome_responsavel?.toLowerCase().includes(busca.toLowerCase());
    const matchEscola = filtroEscola === "__todas__" || r.id_escola_cerca === filtroEscola;
    return matchBusca && matchEscola;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Barra de ações */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar responsável..."
              className="pl-8 h-9"
            />
          </div>
          <Select value={filtroEscola} onValueChange={setFiltroEscola}>
            <SelectTrigger className="w-48 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__todas__">Todas as escolas</SelectItem>
              {escolas.map(e => <SelectItem key={e.id} value={e.id}>{e.nome_escola}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setForm(EMPTY_FORM);
            setEditingId(null);
            setBiometria(null);
            setShowForm(true);
          }}
        >
          <Plus className="w-4 h-4 mr-1.5" /> Cadastrar Responsável
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
          <div className="text-xl font-bold">{responsaveis.length}</div>
          <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
            <Users className="w-3 h-3" /> Responsáveis
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
          <div className="text-xl font-bold text-success">
            {responsaveis.filter(r => r.foto_url || r.face_embedding?.length > 0).length}
          </div>
          <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
            <UserCheck className="w-3 h-3" /> Com Biometria
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
          <div className="text-xl font-bold text-primary">
            {responsaveis.reduce((acc, r) => acc + (r.alunos_ids?.length || 0), 0)}
          </div>
          <div className="text-xs text-muted-foreground flex items-center justify-center gap-1 mt-0.5">
            <Link2 className="w-3 h-3" /> Vínculos ativos
          </div>
        </div>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="rounded-2xl border border-primary/30 bg-card p-5 space-y-5 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-primary" />
              {editingId ? "Editar Responsável" : "Novo Responsável com Biometria"}
            </h3>
            <button type="button" onClick={() => setShowForm(false)}>
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Captura biométrica */}
          <BiometriaCapturaFace
            onCapture={setBiometria}
            onClear={() => setBiometria(null)}
            label="Foto Biométrica do Responsável"
            initialValue={biometria}
          />

          {/* Dados pessoais */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Dados do Responsável</div>
            <div className="grid md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="text-xs text-muted-foreground mb-1 block">Nome Completo *</label>
                <Input
                  value={form.nome_responsavel}
                  onChange={e => setForm(f => ({ ...f, nome_responsavel: e.target.value }))}
                  placeholder="Nome completo"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Parentesco</label>
                <Select value={form.parentesco} onValueChange={v => setForm(f => ({ ...f, parentesco: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PARENTESCO_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Telefone</label>
                <Input
                  value={form.telefone}
                  onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
          </div>

          {/* Escola */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Escola *</div>
            {escolas.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-warning bg-warning/10 border border-warning/30 px-3 py-2 rounded-lg">
                <AlertTriangle className="w-4 h-4" /> Nenhuma escola ativa. Cadastre primeiro em "Cercas Virtuais Escolares".
              </div>
            ) : (
              <Select value={form.id_escola_cerca} onValueChange={v => setForm(f => ({ ...f, id_escola_cerca: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione a escola..." /></SelectTrigger>
                <SelectContent>
                  {escolas.map(e => <SelectItem key={e.id} value={e.id}>{e.nome_escola}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Matrículas — sempre visível */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Matrículas dos Alunos Vinculados
            </div>
            <div className="space-y-2">
              {(form.matriculas_vinculadas || [""]).map((mat, i) => {
                const alunoEncontrado = form.id_escola_cerca
                  ? alunos.find(a => a.id_escola_cerca === form.id_escola_cerca && a.matricula === mat)
                  : null;
                return (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1">
                      <Input
                        value={mat}
                        onChange={e => setMatricula(i, e.target.value)}
                        placeholder="Nº de matrícula do aluno"
                      />
                      {mat && alunoEncontrado && (
                        <div className="text-[10px] mt-0.5 flex items-center gap-1 text-success">
                          <UserCheck className="w-3 h-3" /> {alunoEncontrado.nome}
                        </div>
                      )}
                      {mat && !alunoEncontrado && (
                        <div className="text-[10px] mt-0.5 flex items-center gap-1 text-muted-foreground">
                          <Clock className="w-3 h-3" /> Verificado ao salvar
                        </div>
                      )}
                    </div>
                    {i > 0 && (
                      <button
                        type="button"
                        onClick={() => removeMatricula(i)}
                        className="p-2 hover:bg-destructive/10 rounded-lg flex-shrink-0 mt-0.5"
                      >
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={addMatricula}
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Adicionar outra matrícula
              </button>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button type="button" variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving
                ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                : <UserCheck className="w-4 h-4 mr-1.5" />
              }
              {editingId ? "Salvar Alterações" : "Cadastrar Responsável"}
            </Button>
          </div>
        </div>
      )}

      {/* Lista */}
      {lista.length === 0 && !showForm ? (
        <div className="py-16 text-center border border-dashed border-border rounded-2xl text-muted-foreground">
          <UserCheck className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum responsável cadastrado. Clique em "Cadastrar Responsável".</p>
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map(r => {
            const isExpanded = expandedId === r.id;
            const temBio = !!r.foto_url || (r.face_embedding?.length || 0) > 0;
            return (
              <div key={r.id} className="rounded-2xl border border-border/60 bg-card overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  {r.foto_url ? (
                    <img src={r.foto_url} alt={r.nome_responsavel} className="w-10 h-12 object-cover rounded-lg border border-border flex-shrink-0" />
                  ) : (
                    <div className="w-10 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 text-lg font-bold text-muted-foreground">
                      {r.nome_responsavel?.[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{r.nome_responsavel}</div>
                    <div className="text-xs text-muted-foreground">
                      {PARENTESCO_LABELS[r.parentesco] || r.parentesco}
                      {r.telefone && <> · <Phone className="inline w-3 h-3" /> {r.telefone}</>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{r.nome_escola || "—"}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary flex items-center gap-1">
                      <Link2 className="w-3 h-3" /> {r.alunos_ids?.length || 0} aluno(s)
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${temBio ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                      {temBio ? "✓ Biometria" : "Sem bio"}
                    </span>
                    <button type="button" onClick={() => startEdit(r)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                      <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                    <button type="button" onClick={() => remove(r)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
                      <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                    <button type="button" onClick={() => setExpandedId(isExpanded ? null : r.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border/60 p-4 space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1.5">
                          <ShieldCheck className="w-3 h-3" /> Checklist de Consistência
                        </div>
                        <button
                          type="button"
                          onClick={() => runChecklist(r.id, r.matriculas_vinculadas || [], r.id_escola_cerca, r.face_embedding)}
                          className="text-[10px] text-primary hover:underline flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" /> Verificar agora
                        </button>
                      </div>
                      {!checklist[r.id] && (
                        <div className="text-xs text-muted-foreground italic flex items-center gap-1.5">
                          <Clock className="w-3 h-3" /> Clique em "Verificar agora" para checar as matrículas.
                        </div>
                      )}
                      {checklist[r.id]?.loading && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="w-3 h-3 animate-spin" /> Consultando...
                        </div>
                      )}
                      {checklist[r.id] && !checklist[r.id].loading && (
                        <div className="space-y-1.5">
                          {checklist[r.id].itens.map((item, idx) => (
                            <div key={idx} className={`rounded-lg px-3 py-2 text-xs ${
                              item.status === "nao_encontrado" ? "bg-warning/10 border border-warning/30"
                              : item.consistencia === "suspeito" ? "bg-destructive/10 border border-destructive/30"
                              : "bg-success/10 border border-success/30"
                            }`}>
                              <div className="flex items-center gap-2 font-medium">
                                {item.status === "nao_encontrado"
                                  ? <><AlertTriangle className="w-3.5 h-3.5 text-warning" /> Mat. <span className="font-mono">{item.matricula}</span> — não encontrada</>
                                  : item.consistencia === "suspeito"
                                  ? <><AlertTriangle className="w-3.5 h-3.5 text-destructive" /> Mat. <span className="font-mono">{item.matricula}</span> — suspeito</>
                                  : <><CheckCircle2 className="w-3.5 h-3.5 text-success" /> Mat. <span className="font-mono">{item.matricula}</span> — {item.nome}</>
                                }
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Matrículas informadas</div>
                      <div className="flex flex-wrap gap-1.5">
                        {(r.matriculas_vinculadas || []).filter(Boolean).map((m, i) => (
                          <span key={i} className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded">{m}</span>
                        ))}
                      </div>
                    </div>

                    {temBio && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Embedding Biométrico</div>
                        <div className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-2 py-1 rounded truncate">
                          [{r.face_embedding.slice(0, 8).map(v => v.toFixed(3)).join(", ")} ... ({r.face_embedding.length} dims)]
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertTriangle, CheckCircle2, Loader2, Search, RefreshCw,
  UserCheck, Link2, Link2Off, Edit2, ShieldAlert, Filter
} from "lucide-react";
import { toast } from "sonner";

export default function ChecklistBiometria() {
  const [responsaveis, setResponsaveis] = useState([]);
  const [alunos, setAlunos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("pendentes"); // pendentes | todos
  const [validando, setValidando] = useState({}); // { respId: true }
  const [corrigindo, setCorrigindo] = useState(null); // id do responsável em correção
  const [correcaoInput, setCorrecaoInput] = useState("");

  const load = async () => {
    setLoading(true);
    const [r, a] = await Promise.all([
      base44.entities.Biometria_Responsaveis.list("-created_date", 500),
      base44.entities.Alunos_Biometria.list("-created_date", 500),
    ]);
    setResponsaveis(r);
    setAlunos(a);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Cada responsável: para cada matrícula vinculada, verifica se existe aluno na mesma escola
  const enriquecido = responsaveis.map(resp => {
    const matriculas = (resp.matriculas_vinculadas || []).filter(Boolean);
    const vinculos = matriculas.map(mat => {
      const aluno = alunos.find(a => a.matricula === mat && a.id_escola_cerca === resp.id_escola_cerca);
      return { matricula: mat, aluno: aluno || null, confirmado: !!aluno };
    });
    const temBio = (resp.face_embedding?.length || 0) > 0;
    const pendente = vinculos.some(v => !v.confirmado) || !temBio;
    return { ...resp, vinculos, temBio, pendente };
  });

  const lista = enriquecido
    .filter(r => {
      if (filtro === "pendentes") return r.pendente;
      return true;
    })
    .filter(r => !busca || r.nome_responsavel?.toLowerCase().includes(busca.toLowerCase()));

  const validarVinculo = async (resp, vinculo) => {
    if (!vinculo.aluno) return;
    const key = `${resp.id}-${vinculo.matricula}`;
    setValidando(v => ({ ...v, [key]: true }));
    try {
      // Atualizar aluno: adicionar ID do responsável
      const alunoAtual = vinculo.aluno;
      const respIds = [...new Set([...(alunoAtual.responsaveis_ids || []), resp.id])];
      const respNomes = [...new Set([...(alunoAtual.responsaveis_nomes || []), resp.nome_responsavel])];
      await base44.entities.Alunos_Biometria.update(alunoAtual.id, {
        responsaveis_ids: respIds,
        responsaveis_nomes: respNomes,
      });
      // Atualizar responsável: adicionar ID do aluno
      const alunosIds = [...new Set([...(resp.alunos_ids || []), alunoAtual.id])];
      const alunosNomes = [...new Set([...(resp.alunos_nomes || []), alunoAtual.nome])];
      await base44.entities.Biometria_Responsaveis.update(resp.id, {
        alunos_ids: alunosIds,
        alunos_nomes: alunosNomes,
      });
      toast.success(`Vínculo de ${resp.nome_responsavel} → ${alunoAtual.nome} confirmado!`);
      await load();
    } catch {
      toast.error("Erro ao validar vínculo.");
    }
    setValidando(v => ({ ...v, [key]: false }));
  };

  const corrigirMatricula = async (resp) => {
    if (!correcaoInput.trim()) return;
    const novaLista = (resp.matriculas_vinculadas || []).map(m =>
      m === corrigindo ? correcaoInput.trim() : m
    );
    try {
      await base44.entities.Biometria_Responsaveis.update(resp.id, {
        matriculas_vinculadas: novaLista,
      });
      toast.success("Matrícula corrigida!");
      setCorrigindo(null);
      setCorrecaoInput("");
      await load();
    } catch {
      toast.error("Erro ao corrigir matrícula.");
    }
  };

  const totalPendentes = enriquecido.filter(r => r.pendente).length;
  const totalOk = enriquecido.filter(r => !r.pendente).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-warning" /> Checklist de Vínculos Biométricos
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Responsáveis cadastrados cuja matrícula não foi confirmada ou sem biometria.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-warning/40 bg-warning/5 p-3 text-center">
          <div className="text-xl font-bold text-warning">{totalPendentes}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Pendentes</div>
        </div>
        <div className="rounded-xl border border-success/40 bg-success/5 p-3 text-center">
          <div className="text-xl font-bold text-success">{totalOk}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Validados</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
          <div className="text-xl font-bold">{enriquecido.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Total</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar responsável..." className="pl-8 h-9" />
        </div>
        <div className="flex gap-1">
          {[
            { id: "pendentes", label: "Pendentes" },
            { id: "todos", label: "Todos" },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                filtro === f.id
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Filter className="inline w-3 h-3 mr-1" />{f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : lista.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-border rounded-2xl text-muted-foreground">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-30 text-success" />
          <p className="text-sm">{filtro === "pendentes" ? "Nenhum vínculo pendente! Tudo validado." : "Nenhum responsável encontrado."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map(resp => (
            <div key={resp.id} className="rounded-2xl border border-border/60 bg-card overflow-hidden">
              {/* Cabeçalho do responsável */}
              <div className="flex items-center gap-3 p-4 border-b border-border/40">
                {resp.foto_url ? (
                  <img src={resp.foto_url} alt={resp.nome_responsavel} className="w-10 h-12 object-cover rounded-lg border border-border flex-shrink-0" />
                ) : (
                  <div className="w-10 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 font-bold text-muted-foreground">
                    {resp.nome_responsavel?.[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm">{resp.nome_responsavel}</div>
                  <div className="text-xs text-muted-foreground">{resp.nome_escola || "—"}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${resp.temBio ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                    {resp.temBio ? "✓ Biometria" : "⚠ Sem bio"}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${resp.pendente ? "bg-warning/15 text-warning" : "bg-success/15 text-success"}`}>
                    {resp.pendente ? "Pendente" : "Validado"}
                  </span>
                </div>
              </div>

              {/* Lista de vínculos */}
              <div className="p-4 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Matrículas vinculadas
                </div>
                {resp.vinculos.length === 0 && (
                  <div className="text-xs text-muted-foreground italic">Nenhuma matrícula informada.</div>
                )}
                {resp.vinculos.map((vinculo, idx) => {
                  const key = `${resp.id}-${vinculo.matricula}`;
                  const isCorrigindo = corrigindo === key;
                  return (
                    <div key={idx} className={`rounded-xl border p-3 text-xs ${
                      vinculo.confirmado
                        ? "border-success/40 bg-success/5"
                        : "border-warning/40 bg-warning/5"
                    }`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {vinculo.confirmado
                            ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                            : <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                          }
                          <div>
                            <div className="font-mono font-medium">{vinculo.matricula}</div>
                            {vinculo.aluno ? (
                              <div className="text-muted-foreground flex items-center gap-1 mt-0.5">
                                <UserCheck className="w-3 h-3 text-success" />
                                {vinculo.aluno.nome} · {vinculo.aluno.nome_escola}
                              </div>
                            ) : (
                              <div className="text-warning flex items-center gap-1 mt-0.5">
                                <Link2Off className="w-3 h-3" /> Aluno não encontrado nesta escola
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          {vinculo.aluno && !vinculo.confirmado && (
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-success hover:bg-success/90"
                              disabled={validando[key]}
                              onClick={() => validarVinculo(resp, vinculo)}
                            >
                              {validando[key] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3 mr-1" />}
                              Confirmar vínculo
                            </Button>
                          )}
                          {!vinculo.aluno && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => { setCorrigindo(isCorrigindo ? null : key); setCorrecaoInput(vinculo.matricula); }}
                            >
                              <Edit2 className="w-3 h-3 mr-1" /> Corrigir
                            </Button>
                          )}
                        </div>
                      </div>
                      {isCorrigindo && (
                        <div className="mt-2 flex gap-2">
                          <Input
                            value={correcaoInput}
                            onChange={e => setCorrecaoInput(e.target.value)}
                            placeholder="Nova matrícula correta..."
                            className="h-7 text-xs flex-1"
                          />
                          <Button size="sm" className="h-7 text-xs" onClick={() => corrigirMatricula(resp)}>
                            Salvar
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCorrigindo(null)}>
                            Cancelar
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
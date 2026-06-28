import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  School, Plus, Users, UserCheck, LogIn, LogOut, Fingerprint,
  Trash2, Edit2, ChevronDown, ChevronUp, X, Loader2, AlertTriangle,
  Shield, Clock, BookOpen, ShieldAlert, ClipboardList, Radio, ScanFace, Glasses
} from "lucide-react";
import { toast } from "sonner";
import BiometriaCapturaFace from "@/components/escola/BiometriaCapturaFace";
import RegistroAcessoManual from "@/components/escola/RegistroAcessoManual";
import BlacklistManager from "@/components/escola/BlacklistManager";
import OrdemServicoVisitante from "@/components/escola/OrdemServicoVisitante";
import AlertasIntrusaoPanel from "@/components/escola/AlertasIntrusaoPanel";
import MotorSegurancaEscolar from "@/components/escola/MotorSegurancaEscolar";

const TURNO_LABELS = { manha: "Manhã", tarde: "Tarde", noite: "Noite", integral: "Integral" };

const EMPTY_FORM = {
  nome: "", data_nascimento: "", matricula: "", turno: "manha",
  horario_entrada: "07:00", horario_saida: "12:00", tolerancia_minutos: 15,
  id_escola_cerca: "", responsaveis_nomes: [""],
};

export default function CadastroBiometricoEscolar() {
  const { user } = useAuth();
  const [alunos, setAlunos] = useState([]);
  const [escolas, setEscolas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [biometria, setBiometria] = useState(null);       // { fotoUrl, embedding } — sem óculos (ou única)
  const [biometriaOculos, setBiometriaOculos] = useState(null); // { fotoUrl, embedding } — com óculos
  const [usaOculos, setUsaOculos] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [activeTab, setActiveTab] = useState("alunos");
  const [escolaAcesso, setEscolaAcesso] = useState(null);
  const [blacklist, setBlacklist] = useState([]);
  const [ordensAtivas, setOrdensAtivas] = useState([]);

  const load = async () => {
    const [a, e, bl, os] = await Promise.all([
      base44.entities.Alunos_Biometria.list("-created_date", 100),
      base44.entities.Cercas_Virtuais_Escolares.filter({ ativo: true }, "-created_date", 50),
      base44.entities.Blacklist_Biometrica.filter({ ativo: true }, "-created_date", 100),
      base44.entities.Ordens_Servico_Visitantes.filter({ status: "ativo" }, "-created_date", 50),
    ]);
    setAlunos(a);
    setEscolas(e);
    setBlacklist(bl);
    setOrdensAtivas(os);
    if (e.length > 0 && !escolaAcesso) setEscolaAcesso(e[0]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const setResponsavel = (i, val) => {
    const arr = [...(form.responsaveis_nomes || [""])];
    arr[i] = val;
    setForm(f => ({ ...f, responsaveis_nomes: arr }));
  };

  const addResponsavel = () => setForm(f => ({ ...f, responsaveis_nomes: [...(f.responsaveis_nomes || [""]), ""] }));
  const removeResponsavel = (i) => setForm(f => ({ ...f, responsaveis_nomes: f.responsaveis_nomes.filter((_, idx) => idx !== i) }));

  const escolaSelecionada = escolas.find(e => e.id === form.id_escola_cerca);

  const save = async () => {
    if (!form.nome || !form.matricula || !form.id_escola_cerca) {
      toast.error("Preencha nome, matrícula e escola.");
      return;
    }
    if (!editingId && !biometria) {
      toast.error("Capture a foto biométrica do aluno.");
      return;
    }
    if (!editingId && usaOculos && !biometriaOculos) {
      toast.error("Capture também a foto do aluno COM óculos.");
      return;
    }
    setSaving(true);
    const data = {
      nome: form.nome,
      data_nascimento: form.data_nascimento,
      matricula: form.matricula,
      turno: form.turno,
      horario_entrada: form.horario_entrada,
      horario_saida: form.horario_saida,
      tolerancia_minutos: Number(form.tolerancia_minutos) || 15,
      id_escola_cerca: form.id_escola_cerca,
      nome_escola: escolaSelecionada?.nome_escola || "",
      responsaveis_nomes: (form.responsaveis_nomes || []).filter(Boolean),
      cadastrado_por_id: user?.id,
      cadastrado_por_nome: user?.full_name,
      ativo: true,
      ...(biometria ? { foto_url: biometria.fotoUrl, face_embedding: biometria.embedding } : {}),
      // Cadastro duplo: embedding com óculos (segundo vetor)
      ...(biometriaOculos ? {
        foto_url_oculos: biometriaOculos.fotoUrl,
        face_embedding_oculos: biometriaOculos.embedding,
      } : {}),
      usa_oculos: usaOculos,
    };
    try {
      if (editingId) {
        await base44.entities.Alunos_Biometria.update(editingId, data);
        toast.success("Aluno atualizado!");
      } else {
        await base44.entities.Alunos_Biometria.create(data);
        toast.success("Aluno cadastrado com biometria!");
      }
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      setBiometria(null);
      setBiometriaOculos(null);
      setUsaOculos(false);
      await load();
    } catch {
      toast.error("Erro ao salvar. Tente novamente.");
    }
    setSaving(false);
  };

  const startEdit = (a) => {
    setForm({ ...EMPTY_FORM, ...a, responsaveis_nomes: a.responsaveis_nomes?.length ? a.responsaveis_nomes : [""] });
    setEditingId(a.id);
    setBiometria(a.foto_url ? { fotoUrl: a.foto_url, embedding: a.face_embedding || [] } : null);
    setBiometriaOculos(a.foto_url_oculos ? { fotoUrl: a.foto_url_oculos, embedding: a.face_embedding_oculos || [] } : null);
    setUsaOculos(!!a.usa_oculos);
    setShowForm(true);
    setActiveTab("alunos");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (a) => {
    if (!confirm(`Remover ${a.nome}? Esta ação não pode ser desfeita.`)) return;
    await base44.entities.Alunos_Biometria.delete(a.id);
    toast.info("Aluno removido.");
    load();
  };

  const stats = {
    total: alunos.length,
    comBiometria: alunos.filter(a => a.face_embedding?.length > 0).length,
    escolas: new Set(alunos.map(a => a.id_escola_cerca)).size,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Fingerprint className="w-6 h-6 text-primary" /> Cadastro Biométrico Escolar
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cadastro facial de alunos vinculado às cercas virtuais escolares. Alertas automáticos aos responsáveis.
          </p>
        </div>
        {activeTab === "alunos" && (
          <Button onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setBiometria(null); setShowForm(true); }}>
            <Plus className="w-4 h-4 mr-1.5" /> Cadastrar Aluno
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1"><Users className="w-3 h-3" /> Alunos Cadastrados</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
          <div className="text-2xl font-bold text-success">{stats.comBiometria}</div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1"><UserCheck className="w-3 h-3" /> Com Biometria</div>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-4 text-center">
          <div className="text-2xl font-bold text-primary">{escolas.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1"><School className="w-3 h-3" /> Escolas Ativas</div>
        </div>
      </div>

      {/* Aviso de arquitetura */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-muted-foreground space-y-1">
        <div className="font-semibold text-foreground flex items-center gap-1.5 mb-1"><Shield className="w-3.5 h-3.5 text-primary" /> Infraestrutura de Reconhecimento Facial</div>
        <p>• <strong>Câmeras IP:</strong> 1080p/30fps, WDR ativo, suporte RTSP/ONVIF nos portões escolares.</p>
        <p>• <strong>Edge Computing:</strong> NVIDIA Jetson Nano/Orin ou PC com GPU RTX para inferência local (&lt;200ms de latência).</p>
        <p>• <strong>Stack de IA:</strong> FaceNet/InsightFace + Distância Euclidiana com threshold de confiança ≥95%.</p>
        <p>• <strong>Offline-first:</strong> Fila local SQLite sincroniza automaticamente quando a internet é restaurada.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/60 flex-wrap">
        {[
          { id: "alunos", label: "Alunos", icon: BookOpen },
          { id: "acesso", label: "Registro de Acesso", icon: LogIn },
          { id: "motor", label: "Motor de Segurança", icon: ScanFace },
          { id: "alertas", label: "Alertas de Intrusão", icon: Radio },
          { id: "blacklist", label: "Blacklist", icon: ShieldAlert },
          { id: "visitantes", label: "Visitantes / OS", icon: ClipboardList },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB: ALUNOS ── */}
      {activeTab === "alunos" && (
        <div className="space-y-4">
          {/* Formulário */}
          {showForm && (
            <div className="rounded-2xl border border-primary/30 bg-card p-5 space-y-5 animate-fade-in">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-primary" />
                  {editingId ? "Editar Aluno" : "Novo Cadastro Biométrico"}
                </h3>
                <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>

              {/* Seletor de óculos de grau */}
              <div className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-muted/20">
                <Glasses className="w-5 h-5 text-primary flex-shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-medium">O aluno usa óculos de grau?</div>
                  <div className="text-xs text-muted-foreground">Se sim, serão capturados dois vetores biométricos para garantir reconhecimento com e sem óculos.</div>
                </div>
                <button
                  type="button"
                  onClick={() => { setUsaOculos(v => !v); setBiometriaOculos(null); }}
                  className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${usaOculos ? "bg-primary" : "bg-muted"}`}
                >
                  <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${usaOculos ? "translate-x-7" : "translate-x-1"}`} />
                </button>
              </div>

              {/* Biometria facial */}
              {usaOculos ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground flex items-start gap-2">
                    <Glasses className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                    <span>Cadastro duplo ativo: capture uma foto <strong>sem óculos</strong> e outra <strong>com óculos</strong>. Ambos os vetores serão vinculados à mesma matrícula.</span>
                  </div>
                  <BiometriaCapturaFace
                    onCapture={setBiometria}
                    onClear={() => setBiometria(null)}
                    alunoId={editingId || null}
                    label="Foto 1 — Sem Óculos *"
                    captureLabel="Sem Óculos"
                  />
                  <BiometriaCapturaFace
                    onCapture={setBiometriaOculos}
                    onClear={() => setBiometriaOculos(null)}
                    alunoId={null}
                    label="Foto 2 — Com Óculos *"
                    captureLabel="Com Óculos"
                  />
                </div>
              ) : (
                <BiometriaCapturaFace
                  onCapture={setBiometria}
                  onClear={() => setBiometria(null)}
                  alunoId={editingId || null}
                  label="Foto Biométrica *"
                />
              )}

              {editingId && !biometria && (
                <p className="text-xs text-muted-foreground">Deixe em branco para manter a foto biométrica atual.</p>
              )}

              {/* Dados do aluno */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Dados do Aluno</div>
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <label className="text-xs text-muted-foreground mb-1 block">Nome Completo *</label>
                    <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Nome completo do aluno" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Data de Nascimento</label>
                    <Input type="date" value={form.data_nascimento} onChange={e => setForm(f => ({ ...f, data_nascimento: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Matrícula *</label>
                    <Input value={form.matricula} onChange={e => setForm(f => ({ ...f, matricula: e.target.value }))} placeholder="Nº de matrícula" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Turno</label>
                    <Select value={form.turno} onValueChange={v => setForm(f => ({ ...f, turno: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(TURNO_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Tolerância (min.)</label>
                    <Input type="number" min={5} max={60} value={form.tolerancia_minutos} onChange={e => setForm(f => ({ ...f, tolerancia_minutos: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Horário de Entrada</label>
                    <Input type="time" value={form.horario_entrada} onChange={e => setForm(f => ({ ...f, horario_entrada: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Horário de Saída</label>
                    <Input type="time" value={form.horario_saida} onChange={e => setForm(f => ({ ...f, horario_saida: e.target.value }))} />
                  </div>
                </div>
              </div>

              {/* Escola */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Escola / Cerca Virtual</div>
                {escolas.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-warning bg-warning/10 border border-warning/30 px-3 py-2 rounded-lg">
                    <AlertTriangle className="w-4 h-4" />
                    Nenhuma cerca virtual ativa cadastrada. Acesse "Cercas Virtuais Escolares" para criar.
                  </div>
                ) : (
                  <Select value={form.id_escola_cerca} onValueChange={v => setForm(f => ({ ...f, id_escola_cerca: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione a escola..." /></SelectTrigger>
                    <SelectContent>
                      {escolas.map(e => <SelectItem key={e.id} value={e.id}>{e.nome_escola}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
                {escolaSelecionada && (
                  <div className="mt-2 text-xs text-muted-foreground flex items-center gap-1.5">
                    <Shield className="w-3 h-3 text-primary" />
                    Cerca ativa: {escolaSelecionada.nome_escola} · {escolaSelecionada.horario_inicio}–{escolaSelecionada.horario_fim}
                  </div>
                )}
              </div>

              {/* Responsáveis */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Responsáveis (para alertas)</div>
                <div className="space-y-2">
                  {(form.responsaveis_nomes || [""]).map((nome, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={nome}
                        onChange={e => setResponsavel(i, e.target.value)}
                        placeholder={`Responsável ${i + 1} (nome completo)`}
                      />
                      {i > 0 && (
                        <button onClick={() => removeResponsavel(i)} className="p-2 hover:bg-destructive/10 rounded-lg">
                          <X className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button onClick={addResponsavel} className="text-xs text-primary hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Adicionar responsável
                  </button>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Fingerprint className="w-4 h-4 mr-1.5" />}
                  {editingId ? "Salvar Alterações" : "Cadastrar com Biometria"}
                </Button>
              </div>
            </div>
          )}

          {/* Lista de alunos */}
          {alunos.length === 0 && !showForm ? (
            <div className="py-16 text-center border border-dashed border-border rounded-2xl text-muted-foreground">
              <Fingerprint className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum aluno cadastrado. Clique em "Cadastrar Aluno".</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alunos.map(a => {
                const isExpanded = expandedId === a.id;
                const temBio = a.face_embedding?.length > 0;
                return (
                  <div key={a.id} className="rounded-2xl border border-border/60 bg-card overflow-hidden">
                    <div className="flex items-center gap-3 p-4">
                      {a.foto_url ? (
                        <img src={a.foto_url} alt={a.nome} className="w-10 h-12 object-cover rounded-lg border border-border flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 text-lg font-bold text-muted-foreground">
                          {a.nome?.[0]}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm">{a.nome}</div>
                        <div className="text-xs text-muted-foreground">
                          Mat: {a.matricula} · {TURNO_LABELS[a.turno]} · {a.horario_entrada}–{a.horario_saida}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{a.nome_escola || "Escola não vinculada"}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${temBio ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                          {temBio ? "✓ Biometria" : "Sem bio"}
                        </span>
                        <button onClick={() => startEdit(a)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                          <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => remove(a)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                        </button>
                        <button onClick={() => setExpandedId(isExpanded ? null : a.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="border-t border-border/60 p-4 grid md:grid-cols-3 gap-3 text-sm">
                        <div>
                          <div className="text-xs text-muted-foreground">Data de Nascimento</div>
                          <div>{a.data_nascimento || "—"}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Tolerância</div>
                          <div className="flex items-center gap-1"><Clock className="w-3 h-3" /> ±{a.tolerancia_minutos || 15} min</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">Responsáveis</div>
                          <div className="space-y-0.5">
                            {(a.responsaveis_nomes || []).filter(Boolean).map((n, i) => (
                              <div key={i} className="text-xs bg-muted/50 px-2 py-0.5 rounded">{n}</div>
                            ))}
                            {!a.responsaveis_nomes?.filter(Boolean).length && <span className="text-muted-foreground text-xs">Nenhum responsável</span>}
                          </div>
                        </div>
                        {temBio && (
                          <div className="md:col-span-3">
                            <div className="text-xs text-muted-foreground mb-1">Embedding Facial</div>
                            <div className="text-[10px] font-mono text-muted-foreground bg-muted/40 px-2 py-1 rounded truncate">
                              [{a.face_embedding.slice(0, 8).map(v => v.toFixed(3)).join(", ")} ... ({a.face_embedding.length} dimensões)]
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
      )}

      {/* ── TAB: MOTOR DE SEGURANÇA ── */}
      {activeTab === "motor" && (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Escola monitorada</label>
            <select
              value={escolaAcesso?.id || ""}
              onChange={e => setEscolaAcesso(escolas.find(x => x.id === e.target.value))}
              className="flex h-9 w-64 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            >
              {escolas.map(e => <option key={e.id} value={e.id}>{e.nome_escola}</option>)}
            </select>
          </div>
          <MotorSegurancaEscolar
            escola={escolaAcesso}
            alunosMatriculados={alunos.filter(a => a.id_escola_cerca === escolaAcesso?.id)}
            blacklist={blacklist}
            ordensAtivas={ordensAtivas}
          />
        </div>
      )}

      {/* ── TAB: ALERTAS ── */}
      {activeTab === "alertas" && <AlertasIntrusaoPanel />}

      {/* ── TAB: BLACKLIST ── */}
      {activeTab === "blacklist" && <BlacklistManager />}

      {/* ── TAB: VISITANTES ── */}
      {activeTab === "visitantes" && <OrdemServicoVisitante escolas={escolas} />}

      {/* ── TAB: ACESSO ── */}
      {activeTab === "acesso" && (
        <div className="space-y-4">
          {escolas.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-border rounded-2xl text-muted-foreground">
              <School className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhuma cerca/escola ativa. Cadastre primeiro em "Cercas Virtuais Escolares".</p>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Escola / Portão</label>
                <Select
                  value={escolaAcesso?.id || ""}
                  onValueChange={v => setEscolaAcesso(escolas.find(e => e.id === v))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione a escola..." /></SelectTrigger>
                  <SelectContent>
                    {escolas.map(e => <SelectItem key={e.id} value={e.id}>{e.nome_escola}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {escolaAcesso && (
                <div className="rounded-2xl border border-border/60 bg-card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <School className="w-4 h-4 text-primary" />
                    <span className="font-semibold">{escolaAcesso.nome_escola}</span>
                    <span className="text-xs text-muted-foreground">· {escolaAcesso.horario_inicio}–{escolaAcesso.horario_fim}</span>
                  </div>
                  <RegistroAcessoManual escolaId={escolaAcesso.id} escolaNome={escolaAcesso.nome_escola} />
                </div>
              )}
            </>
          )}

          {/* Legenda de alertas */}
          <div className="rounded-xl border border-border/60 bg-card p-4 text-xs space-y-2">
            <div className="font-semibold mb-2 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-warning" /> Regras de Alerta Automático</div>
            <div className="flex items-start gap-2"><LogOut className="w-3.5 h-3.5 text-warning mt-0.5 flex-shrink-0" /><span><strong>Saída antecipada:</strong> Saída registrada antes do horário previsto menos a tolerância → alerta imediato aos responsáveis.</span></div>
            <div className="flex items-start gap-2"><LogOut className="w-3.5 h-3.5 text-destructive mt-0.5 flex-shrink-0" /><span><strong>Atraso crítico:</strong> Saída registrada após o horário previsto mais a tolerância → alerta aos responsáveis.</span></div>
            <div className="flex items-start gap-2"><LogIn className="w-3.5 h-3.5 text-warning mt-0.5 flex-shrink-0" /><span><strong>Entrada atrasada:</strong> Entrada além da tolerância configurada → notificação de ausência/atraso.</span></div>
            <div className="flex items-start gap-2"><Clock className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" /><span><strong>Offline-first:</strong> Registros salvos localmente e sincronizados automaticamente quando a conexão for restaurada.</span></div>
          </div>
        </div>
      )}
    </div>
  );
}
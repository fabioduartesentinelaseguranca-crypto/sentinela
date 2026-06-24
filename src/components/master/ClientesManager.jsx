import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Building2, Plus, Edit2, CheckCircle2, Package, Users, ChevronDown, ChevronUp, X, Lock, RefreshCw, AlertTriangle } from "lucide-react";
import { format, addMonths, isBefore, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_META = {
  ativo: { label: "Ativo", color: "bg-success/15 text-success" },
  suspenso: { label: "Suspenso", color: "bg-warning/15 text-warning" },
  trial: { label: "Trial", color: "bg-primary/15 text-primary" },
  cancelado: { label: "Cancelado", color: "bg-destructive/15 text-destructive" },
};

const PLANO_COLOR = {
  basico: "text-muted-foreground",
  essencial: "text-primary",
  avancado: "text-warning",
  premium: "text-chart-5",
};

const EMPTY_FORM = {
  nome_municipio: "", estado: "", populacao: "", nome_responsavel: "",
  email_responsavel: "", telefone: "", cnpj: "", plano: "basico",
  status: "trial", modulos_ativos: [], limite_usuarios_cidadaos: 1000,
  limite_usuarios_agentes: 10, valor_mensal: "", observacoes: "",
  data_inicio_contrato: new Date().toISOString().slice(0, 10),
  data_renovacao: addMonths(new Date(), 1).toISOString().slice(0, 10),
};

function podeAlterarModulos(cliente) {
  // Pode alterar módulos apenas se: novo cliente (sem data_renovacao) OU
  // data_renovacao foi atingida (renovação atual)
  if (!cliente?.data_renovacao) return true;
  const renovacao = parseISO(cliente.data_renovacao);
  return !isBefore(new Date(), renovacao);
}

export default function ClientesManager() {
  const [clientes, setClientes] = useState([]);
  const [modulos, setModulos] = useState([]);
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [expandedId, setExpandedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modulosBloqueados, setModulosBloqueados] = useState(false);

  const load = async () => {
    const [c, m, p] = await Promise.all([
      base44.entities.ClienteMunicipal.list("-created_date"),
      base44.entities.ModuloSentinela.list(),
      base44.entities.PlanoAssinatura.list(),
    ]);
    setClientes(c);
    setModulos(m);
    setPlanos(p);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const applyPlano = (planoId) => {
    const plano = planos.find(p => p.plano_id === planoId);
    if (plano) {
      setForm(f => ({
        ...f,
        plano: planoId,
        modulos_ativos: plano.modulos_incluidos || [],
        limite_usuarios_cidadaos: plano.limite_cidadaos || 1000,
        limite_usuarios_agentes: plano.limite_agentes || 10,
        valor_mensal: plano.preco_base || "",
      }));
    } else {
      setForm(f => ({ ...f, plano: planoId }));
    }
  };

  const toggleModulo = (modulo_id) => {
    if (modulosBloqueados) return;
    setForm(f => ({
      ...f,
      modulos_ativos: f.modulos_ativos.includes(modulo_id)
        ? f.modulos_ativos.filter(m => m !== modulo_id)
        : [...f.modulos_ativos, modulo_id],
    }));
  };

  const save = async () => {
    setSaving(true);
    const data = {
      ...form,
      populacao: Number(form.populacao),
      valor_mensal: Number(form.valor_mensal),
    };

    if (editingId) {
      // Se está renovando (módulos desbloqueados), avança a data_renovacao em +1 mês
      if (!modulosBloqueados) {
        data.data_renovacao = addMonths(new Date(), 1).toISOString().slice(0, 10);
      }
      await base44.entities.ClienteMunicipal.update(editingId, data);
    } else {
      data.data_inicio_contrato = new Date().toISOString().slice(0, 10);
      data.data_renovacao = addMonths(new Date(), 1).toISOString().slice(0, 10);
      await base44.entities.ClienteMunicipal.create(data);
    }
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModulosBloqueados(false);
    await load();
    setSaving(false);
  };

  const startEdit = (c) => {
    setForm({ ...EMPTY_FORM, ...c });
    setEditingId(c.id);
    setModulosBloqueados(!podeAlterarModulos(c));
    setShowForm(true);
  };

  const changeStatus = async (c, status) => {
    await base44.entities.ClienteMunicipal.update(c.id, { status });
    load();
  };

  if (loading) return <div className="py-20 text-center text-muted-foreground">Carregando clientes...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Clientes Municipais</h2>
          <p className="text-sm text-muted-foreground">{clientes.length} municípios cadastrados</p>
        </div>
        <Button onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setModulosBloqueados(false); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1.5" /> Novo Cliente
        </Button>
      </div>

      {/* FORM */}
      {showForm && (
        <div className="rounded-2xl border border-primary/30 bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{editingId ? "Editar Cliente" : "Novo Cliente Municipal"}</h3>
            <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Município *</label>
              <Input value={form.nome_municipio} onChange={e => setForm(f => ({ ...f, nome_municipio: e.target.value }))} placeholder="Ex: São Paulo" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Estado *</label>
              <Input value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} placeholder="Ex: SP" maxLength={2} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">População *</label>
              <Input type="number" value={form.populacao} onChange={e => setForm(f => ({ ...f, populacao: e.target.value }))} placeholder="Ex: 50000" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Responsável</label>
              <Input value={form.nome_responsavel} onChange={e => setForm(f => ({ ...f, nome_responsavel: e.target.value }))} placeholder="Nome do responsável" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">E-mail</label>
              <Input value={form.email_responsavel} onChange={e => setForm(f => ({ ...f, email_responsavel: e.target.value }))} placeholder="email@prefeitura.gov.br" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Telefone</label>
              <Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(11) 99999-9999" />
            </div>
          </div>

          <div className="grid md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Plano *</label>
              <select
                value={form.plano}
                onChange={e => applyPlano(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="basico">Básico</option>
                <option value="essencial">Essencial</option>
                <option value="avancado">Avançado</option>
                <option value="premium">Premium</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                <option value="trial">Trial</option>
                <option value="ativo">Ativo</option>
                <option value="suspenso">Suspenso</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Valor Mensal (R$)</label>
              <Input type="number" value={form.valor_mensal} onChange={e => setForm(f => ({ ...f, valor_mensal: e.target.value }))} placeholder="0" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Próxima Renovação</label>
              <Input
                type="date"
                value={form.data_renovacao || ""}
                onChange={e => setForm(f => ({ ...f, data_renovacao: e.target.value }))}
              />
            </div>
          </div>

          {/* Módulos */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-muted-foreground font-medium">
                Módulos Contratados ({form.modulos_ativos.length} selecionados)
              </label>
              {modulosBloqueados ? (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-warning bg-warning/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Alterações bloqueadas até a renovação
                    {form.data_renovacao && ` (${format(parseISO(form.data_renovacao), "dd/MM/yyyy", { locale: ptBR })})`}
                  </span>
                  <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => setModulosBloqueados(false)}>
                    <RefreshCw className="w-3 h-3 mr-1" /> Renovar Agora
                  </Button>
                </div>
              ) : (
                <span className="text-[10px] text-success bg-success/10 px-2 py-0.5 rounded-full">
                  ✓ Módulos editáveis — renovação em andamento
                </span>
              )}
            </div>

            <div className={`grid md:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-60 overflow-y-auto pr-1 ${modulosBloqueados ? "opacity-60 pointer-events-none" : ""}`}>
              {modulos.map(m => (
                <button
                  key={m.modulo_id}
                  onClick={() => toggleModulo(m.modulo_id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-colors border ${
                    form.modulos_ativos.includes(m.modulo_id)
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border/60 text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  <CheckCircle2 className={`w-3 h-3 flex-shrink-0 ${form.modulos_ativos.includes(m.modulo_id) ? "opacity-100" : "opacity-30"}`} />
                  {m.nome}
                </button>
              ))}
            </div>

            {modulosBloqueados && (
              <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Inclusão/exclusão de módulos só é permitida uma vez por mês, no ato da renovação. Clique em "Renovar Agora" para liberar.
              </p>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving || !form.nome_municipio || !form.estado}>
              {saving ? "Salvando..." : editingId ? "Salvar Alterações" : "Cadastrar Cliente"}
            </Button>
          </div>
        </div>
      )}

      {/* LISTA */}
      {clientes.length === 0 && !showForm && (
        <div className="py-16 text-center text-muted-foreground border border-dashed border-border rounded-2xl">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>Nenhum cliente cadastrado. Clique em "Novo Cliente" para começar.</p>
        </div>
      )}

      <div className="space-y-2">
        {clientes.map(c => {
          const sm = STATUS_META[c.status] || STATUS_META.trial;
          const isExpanded = expandedId === c.id;
          const bloqueado = !podeAlterarModulos(c);
          return (
            <div key={c.id} className="rounded-2xl border border-border/60 bg-card overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{c.nome_municipio} – {c.estado}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.populacao?.toLocaleString("pt-BR")} hab. ·{" "}
                    <span className={`font-medium capitalize ${PLANO_COLOR[c.plano]}`}>{c.plano}</span>
                    {c.valor_mensal ? ` · R$ ${Number(c.valor_mensal).toLocaleString("pt-BR")}/mês` : ""}
                    {c.data_renovacao && (
                      <span className={`ml-2 ${bloqueado ? "text-success" : "text-warning"}`}>
                        · {bloqueado ? `Renova ${format(parseISO(c.data_renovacao), "dd/MM", { locale: ptBR })}` : "Renovação disponível"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-medium ${sm.color}`}>{sm.label}</span>
                  {bloqueado && <Lock className="w-3 h-3 text-muted-foreground" title="Módulos bloqueados até renovação" />}
                  <span className="text-xs text-muted-foreground hidden md:block">
                    <Package className="w-3 h-3 inline mr-1" />{(c.modulos_ativos || []).length} módulos
                  </span>
                  <button onClick={() => startEdit(c)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => setExpandedId(isExpanded ? null : c.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-border/60 p-4 space-y-3">
                  <div className="grid md:grid-cols-3 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">Responsável</div>
                      <div>{c.nome_responsavel || "—"}</div>
                      <div className="text-xs text-muted-foreground">{c.email_responsavel}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Usuários</div>
                      <div>{(c.usuarios_cidadaos_ativos || 0).toLocaleString()} / {(c.limite_usuarios_cidadaos || 0).toLocaleString()} cidadãos</div>
                      <div className="text-xs text-muted-foreground">{c.usuarios_agentes_ativos || 0} / {c.limite_usuarios_agentes} agentes</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Status do Contrato</div>
                      <div className="flex gap-1.5 flex-wrap">
                        {["trial", "ativo", "suspenso", "cancelado"].map(s => (
                          <button
                            key={s}
                            onClick={() => changeStatus(c, s)}
                            className={`text-[10px] px-2 py-0.5 rounded uppercase font-medium transition-colors ${c.status === s ? STATUS_META[s].color : "bg-muted text-muted-foreground"}`}
                          >{s}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                      Módulos Ativos ({(c.modulos_ativos || []).length})
                      {bloqueado && <Lock className="w-3 h-3 text-muted-foreground" />}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(c.modulos_ativos || []).map(mid => {
                        const m = modulos.find(x => x.modulo_id === mid);
                        return m ? (
                          <span key={mid} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">{m.nome}</span>
                        ) : null;
                      })}
                    </div>
                    {bloqueado && c.data_renovacao && (
                      <p className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Próxima alteração de módulos disponível em {format(parseISO(c.data_renovacao), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
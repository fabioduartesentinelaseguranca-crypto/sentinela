import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { CreditCard, Plus, Users, Building2, CheckCircle2, Star } from "lucide-react";

const MODULOS_DEFAULT = [
  { modulo_id: "cidadao_ocorrencias", nome: "Registro de Ocorrências" },
  { modulo_id: "cidadao_panico", nome: "Botão de Pânico" },
  { modulo_id: "cidadao_biometria_coacao", nome: "Biometria / Senha de Coação" },
  { modulo_id: "cidadao_rotas_seguras", nome: "Rotas Seguras" },
  { modulo_id: "cidadao_caminhe_comigo", nome: "Caminhe Comigo" },
  { modulo_id: "cidadao_perimetro_infantil", nome: "Cerca Virtual Escolar" },
  { modulo_id: "cidadao_perfil_medico", nome: "Perfil Médico de Emergência" },
  { modulo_id: "cidadao_rede_anjos", nome: "Rede de Anjos da Guarda" },
  { modulo_id: "cidadao_dicas_anonimas", nome: "Denúncias Anônimas" },
  { modulo_id: "agente_mapa_tatico", nome: "Mapa Tático Real-Time" },
  { modulo_id: "agente_central_despacho", nome: "Central de Despacho IA" },
  { modulo_id: "agente_gestao_turno", nome: "Gestão de Turnos e Escalas" },
  { modulo_id: "agente_fadiga", nome: "Monitoramento de Fadiga" },
  { modulo_id: "agente_psicologico", nome: "Avaliações Psicológicas" },
  { modulo_id: "agente_checklist_equipamentos", nome: "Checklist de Equipamentos" },
  { modulo_id: "agente_treinamento", nome: "Central de Treinamentos" },
  { modulo_id: "agente_bo_juridico", nome: "BO Jurídico Automático" },
  { modulo_id: "gestao_kpis", nome: "KPIs Estratégicos" },
  { modulo_id: "gestao_heatmap", nome: "Heatmap Operacional" },
  { modulo_id: "gestao_analise_preditiva", nome: "Análise Preditiva Criminal" },
  { modulo_id: "gestao_frota", nome: "Gestão de Frota e Telemetria" },
  { modulo_id: "gestao_estoque_tatico", nome: "Estoque Tático (QR)" },
  { modulo_id: "gestao_cameras", nome: "Gestão de Câmeras CFTV" },
  { modulo_id: "gestao_procurados", nome: "Quadro de Procurados" },
  { modulo_id: "defesa_civil_cercas", nome: "Cercas Geográficas (Defesa Civil)" },
  { modulo_id: "defesa_civil_iluminacao", nome: "Gestão de Iluminação Pública" },
];

const PLANOS_DEFAULT = [
  {
    plano_id: "basico", nome: "Plano Básico",
    descricao: "Para municípios de pequeno porte com necessidades essenciais de segurança.",
    faixa_populacional: "Até 20.000 hab.", populacao_min: 0, populacao_max: 20000,
    preco_base: 2900, limite_cidadaos: 2000, limite_agentes: 15,
    modulos_incluidos: ["cidadao_ocorrencias", "agente_mapa_tatico"],
  },
  {
    plano_id: "essencial", nome: "Plano Essencial",
    descricao: "Segurança cidadã e gestão operacional para municípios médios.",
    faixa_populacional: "20.001 a 100.000 hab.", populacao_min: 20001, populacao_max: 100000,
    preco_base: 7900, limite_cidadaos: 10000, limite_agentes: 50,
    modulos_incluidos: [
      "cidadao_ocorrencias", "cidadao_panico", "cidadao_biometria_coacao",
      "cidadao_rotas_seguras", "cidadao_perfil_medico", "cidadao_dicas_anonimas",
      "agente_mapa_tatico", "agente_central_despacho", "agente_gestao_turno",
      "agente_checklist_equipamentos", "gestao_kpis",
    ],
  },
  {
    plano_id: "avancado", nome: "Plano Avançado",
    descricao: "Gestão completa com IA, defesa civil e proteção infantil.",
    faixa_populacional: "100.001 a 500.000 hab.", populacao_min: 100001, populacao_max: 500000,
    preco_base: 18900, limite_cidadaos: 50000, limite_agentes: 200,
    modulos_incluidos: [
      "cidadao_ocorrencias", "cidadao_panico", "cidadao_biometria_coacao",
      "cidadao_rotas_seguras", "cidadao_caminhe_comigo", "cidadao_perimetro_infantil",
      "cidadao_perfil_medico", "cidadao_rede_anjos", "cidadao_dicas_anonimas",
      "agente_mapa_tatico", "agente_central_despacho", "agente_gestao_turno",
      "agente_fadiga", "agente_psicologico", "agente_checklist_equipamentos",
      "agente_treinamento", "agente_bo_juridico",
      "gestao_kpis", "gestao_heatmap", "gestao_frota", "gestao_procurados",
      "defesa_civil_cercas",
    ],
  },
  {
    plano_id: "premium", nome: "Plano Premium",
    descricao: "Ecossistema completo de inteligência urbana para grandes metrópoles.",
    faixa_populacional: "Acima de 500.000 hab.", populacao_min: 500001, populacao_max: 99999999,
    preco_base: 45000, limite_cidadaos: 500000, limite_agentes: 1000,
    modulos_incluidos: [
      "cidadao_ocorrencias", "cidadao_panico", "cidadao_biometria_coacao",
      "cidadao_rotas_seguras", "cidadao_caminhe_comigo", "cidadao_perimetro_infantil",
      "cidadao_perfil_medico", "cidadao_rede_anjos", "cidadao_dicas_anonimas",
      "agente_mapa_tatico", "agente_central_despacho", "agente_gestao_turno",
      "agente_fadiga", "agente_psicologico", "agente_checklist_equipamentos",
      "agente_treinamento", "agente_bo_juridico",
      "gestao_kpis", "gestao_heatmap", "gestao_analise_preditiva",
      "gestao_frota", "gestao_estoque_tatico", "gestao_cameras",
      "gestao_procurados", "defesa_civil_cercas", "defesa_civil_iluminacao",
    ],
  },
];

const PLANO_COLOR = {
  basico: "from-border/40 to-border/20 border-border/60",
  essencial: "from-primary/20 to-primary/5 border-primary/30",
  avancado: "from-warning/20 to-warning/5 border-warning/30",
  premium: "from-chart-5/20 to-chart-5/5 border-chart-5/30",
};

const PLANO_RING = {
  basico: "ring-2 ring-border",
  essencial: "ring-2 ring-primary",
  avancado: "ring-2 ring-warning",
  premium: "ring-2 ring-chart-5",
};

export default function PlanosManager() {
  const [planos, setPlanos] = useState([]);
  const [clienteAtivo, setClienteAtivo] = useState(null);
  const [nomeModulos, setNomeModulos] = useState({});
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const load = async () => {
    const [list, clientes, mods] = await Promise.all([
      base44.entities.PlanoAssinatura.list(),
      base44.entities.ClienteMunicipal.filter({ status: "ativo" }, "-created_date", 1),
      base44.entities.ModuloSentinela.list(),
    ]);
    setPlanos(list);
    setClienteAtivo(clientes[0] || null);
    // Build modulo_id -> nome map from DB or defaults
    const map = {};
    (mods.length ? mods : MODULOS_DEFAULT).forEach(m => { map[m.modulo_id] = m.nome; });
    setNomeModulos(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const seed = async () => {
    setSeeding(true);
    await base44.entities.PlanoAssinatura.bulkCreate(PLANOS_DEFAULT);
    await load();
    setSeeding(false);
  };

  if (loading) return <div className="py-20 text-center text-muted-foreground">Carregando planos...</div>;

  const listaPlanos = planos.length ? planos : PLANOS_DEFAULT;
  const planoCliente = clienteAtivo?.plano;
  const modulosCliente = new Set(clienteAtivo?.modulos_ativos || []);
  const valorCliente = clienteAtivo?.valor_mensal;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Planos de Assinatura</h2>
          <p className="text-sm text-muted-foreground">Modelo híbrido: faixa populacional + módulos</p>
        </div>
        {planos.length === 0 && (
          <Button onClick={seed} disabled={seeding}>
            <Plus className="w-4 h-4 mr-1.5" /> {seeding ? "Criando..." : "Inicializar Planos Padrão"}
          </Button>
        )}
      </div>

      {/* Resumo do cliente ativo */}
      {clienteAtivo && (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex flex-wrap gap-4 items-center">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground mb-0.5">Cliente ativo</div>
            <div className="font-bold">{clienteAtivo.nome_municipio} – {clienteAtivo.estado}</div>
            <div className="text-sm text-muted-foreground capitalize">
              Plano: <span className="font-semibold text-foreground">{planoCliente}</span>
              {" · "}{modulosCliente.size} módulos contratados
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground mb-0.5">Valor mensal</div>
            <div className="text-2xl font-bold text-primary">
              R$ {(valorCliente || 0).toLocaleString("pt-BR")}
            </div>
          </div>
        </div>
      )}

      {/* Card customizado do cliente ativo */}
      {clienteAtivo && (
        <div className="rounded-2xl border-2 border-primary/50 bg-gradient-to-br from-primary/10 to-primary/5 p-5 relative">
          <div className="absolute top-3 right-3 flex items-center gap-1 bg-primary text-primary-foreground text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
            <Star className="w-3 h-3" /> Plano Atual
          </div>
          <div className="flex items-start justify-between mb-3 pr-24">
            <div>
              <div className="font-bold text-base">{clienteAtivo.nome_municipio} – {clienteAtivo.estado}</div>
              <div className="text-xs text-muted-foreground mt-0.5 capitalize">
                Plano base: <span className="font-medium text-foreground">{planoCliente}</span>
                {clienteAtivo.populacao ? ` · ${clienteAtivo.populacao.toLocaleString("pt-BR")} hab.` : ""}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                R$ {(valorCliente || 0).toLocaleString("pt-BR")}
              </div>
              <div className="text-xs text-muted-foreground">/mês (contratado)</div>
            </div>
          </div>

          <div className="flex gap-4 text-xs text-muted-foreground mb-4">
            <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {(clienteAtivo.limite_usuarios_cidadaos || 0).toLocaleString("pt-BR")} cidadãos</span>
            <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {clienteAtivo.limite_usuarios_agentes || 0} agentes</span>
          </div>

          <div className="border-t border-border/30 pt-3">
            <div className="text-xs font-semibold mb-2">{modulosCliente.size} módulos contratados:</div>
            <div className="flex flex-wrap gap-1">
              {[...modulosCliente].map(mid => (
                <span key={mid} className="text-[10px] px-1.5 py-0.5 rounded bg-success/15 text-success flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  {nomeModulos[mid] || mid}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Cards de planos do catálogo */}
      <div className="grid md:grid-cols-2 gap-4">
        {listaPlanos.map(p => {
          const colorClass = PLANO_COLOR[p.plano_id] || PLANO_COLOR.basico;
          return (
            <div key={p.plano_id} className={`rounded-2xl border bg-gradient-to-br p-5 ${colorClass}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-bold text-base">{p.nome}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{p.faixa_populacional}</div>
                </div>
                <div className="text-right">
                  <div className="text-xl font-bold">R$ {(p.preco_base || 0).toLocaleString("pt-BR")}</div>
                  <div className="text-xs text-muted-foreground">/mês</div>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{p.descricao}</p>
              <div className="flex gap-4 text-xs text-muted-foreground mb-3">
                <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {(p.limite_cidadaos || 0).toLocaleString("pt-BR")} cidadãos</span>
                <span className="flex items-center gap-1"><Building2 className="w-3 h-3" /> {p.limite_agentes} agentes</span>
              </div>
              <div className="border-t border-border/30 pt-3">
                <div className="text-xs font-semibold mb-2">{(p.modulos_incluidos || []).length} módulos incluídos:</div>
                <div className="flex flex-wrap gap-1">
                  {(p.modulos_incluidos || []).map(mid => (
                    <span key={mid} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">
                      {nomeModulos[mid] || mid}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabela comparativa */}
      <div className="rounded-2xl border border-border/60 bg-card p-4">
        <h3 className="font-semibold text-sm mb-3">Tabela de Preços por Faixa Populacional</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-muted-foreground">
              <th className="text-left py-2 font-medium">Plano</th>
              <th className="text-left py-2 font-medium">População</th>
              <th className="text-left py-2 font-medium">Preço Base/Mês</th>
              <th className="text-left py-2 font-medium">Cidadãos</th>
              <th className="text-left py-2 font-medium">Agentes</th>
            </tr>
          </thead>
          <tbody>
            {listaPlanos.map(p => (
              <tr key={p.plano_id} className={`border-b border-border/40 ${planoCliente === p.plano_id ? "bg-primary/5 font-semibold" : ""}`}>
                <td className="py-2 capitalize flex items-center gap-1.5">
                  {p.plano_id}
                  {planoCliente === p.plano_id && <Star className="w-3 h-3 text-primary" />}
                </td>
                <td className="py-2 text-muted-foreground">{p.faixa_populacional}</td>
                <td className="py-2 font-mono">R$ {(p.preco_base || 0).toLocaleString("pt-BR")}</td>
                <td className="py-2 text-muted-foreground">{(p.limite_cidadaos || 0).toLocaleString("pt-BR")}</td>
                <td className="py-2 text-muted-foreground">{p.limite_agentes}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground mt-3">* Módulos adicionais fora do plano são cobrados separadamente. Usuários acima do limite têm acréscimo de R$ 0,50/usuário cidadão e R$ 50,00/agente.</p>
      </div>
    </div>
  );
}
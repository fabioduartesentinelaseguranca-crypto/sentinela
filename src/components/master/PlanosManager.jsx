import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { CreditCard, Plus, Users, Building2 } from "lucide-react";

const PLANOS_DEFAULT = [
  {
    plano_id: "basico",
    nome: "Plano Básico",
    descricao: "Para municípios de pequeno porte com necessidades essenciais de segurança.",
    faixa_populacional: "Até 20.000 hab.",
    populacao_min: 0,
    populacao_max: 20000,
    preco_base: 2900,
    limite_cidadaos: 2000,
    limite_agentes: 15,
    modulos_incluidos: ["cidadao_ocorrencias", "agente_mapa_tatico"],
  },
  {
    plano_id: "essencial",
    nome: "Plano Essencial",
    descricao: "Segurança cidadã e gestão operacional para municípios médios.",
    faixa_populacional: "20.001 a 100.000 hab.",
    populacao_min: 20001,
    populacao_max: 100000,
    preco_base: 7900,
    limite_cidadaos: 10000,
    limite_agentes: 50,
    modulos_incluidos: [
      "cidadao_ocorrencias", "cidadao_panico", "cidadao_biometria_coacao",
      "cidadao_rotas_seguras", "cidadao_perfil_medico", "cidadao_dicas_anonimas",
      "agente_mapa_tatico", "agente_central_despacho", "agente_gestao_turno",
      "agente_checklist_equipamentos", "gestao_kpis",
    ],
  },
  {
    plano_id: "avancado",
    nome: "Plano Avançado",
    descricao: "Gestão completa com IA, defesa civil e proteção infantil.",
    faixa_populacional: "100.001 a 500.000 hab.",
    populacao_min: 100001,
    populacao_max: 500000,
    preco_base: 18900,
    limite_cidadaos: 50000,
    limite_agentes: 200,
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
    plano_id: "premium",
    nome: "Plano Premium",
    descricao: "Ecossistema completo de inteligência urbana para grandes metrópoles.",
    faixa_populacional: "Acima de 500.000 hab.",
    populacao_min: 500001,
    populacao_max: 99999999,
    preco_base: 45000,
    limite_cidadaos: 500000,
    limite_agentes: 1000,
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

export default function PlanosManager() {
  const [planos, setPlanos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const load = async () => {
    const list = await base44.entities.PlanoAssinatura.list();
    setPlanos(list);
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

      <div className="grid md:grid-cols-2 gap-4">
        {(planos.length ? planos : PLANOS_DEFAULT).map(p => {
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
              <div className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{(p.modulos_incluidos || []).length} módulos incluídos</span>
              </div>
            </div>
          );
        })}
      </div>

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
            {(planos.length ? planos : PLANOS_DEFAULT).map(p => (
              <tr key={p.plano_id} className="border-b border-border/40">
                <td className="py-2 font-medium capitalize">{p.plano_id}</td>
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
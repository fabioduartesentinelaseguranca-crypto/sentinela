import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Package, Plus, Check, Lock } from "lucide-react";

const MODULOS_DEFAULT = [
  { modulo_id: "cidadao_ocorrencias", nome: "Registro de Ocorrências", descricao: "Cidadão reporta crimes, trânsito, saúde e defesa civil", categoria: "cidadao", planos_incluidos: ["basico","essencial","avancado","premium"], preco_adicional: 0 },
  { modulo_id: "cidadao_panico", nome: "Botão de Pânico", descricao: "Ativação imediata com envio de localização e áudio", categoria: "cidadao", planos_incluidos: ["essencial","avancado","premium"], preco_adicional: 500 },
  { modulo_id: "cidadao_biometria_coacao", nome: "Biometria / Senha de Coação", descricao: "Calculadora disfarçada com PIN silencioso que aciona a central", categoria: "cidadao", planos_incluidos: ["essencial","avancado","premium"], preco_adicional: 500 },
  { modulo_id: "cidadao_rotas_seguras", nome: "Rotas Seguras", descricao: "Cálculo de rota com menor índice de risco criminal", categoria: "cidadao", planos_incluidos: ["essencial","avancado","premium"], preco_adicional: 300 },
  { modulo_id: "cidadao_caminhe_comigo", nome: "Caminhe Comigo", descricao: "Compartilhamento de trajeto em tempo real com contatos", categoria: "cidadao", planos_incluidos: ["avancado","premium"], preco_adicional: 400 },
  { modulo_id: "cidadao_perimetro_infantil", nome: "Cerca Virtual Escolar", descricao: "Geofencing infantil ao redor de escolas e creches", categoria: "cidadao", planos_incluidos: ["avancado","premium"], preco_adicional: 600 },
  { modulo_id: "cidadao_perfil_medico", nome: "Perfil Médico de Emergência", descricao: "Dados de saúde acessíveis em emergências", categoria: "saude", planos_incluidos: ["essencial","avancado","premium"], preco_adicional: 200 },
  { modulo_id: "cidadao_rede_anjos", nome: "Rede de Anjos da Guarda", descricao: "Voluntários certificados para apoio em emergências", categoria: "cidadao", planos_incluidos: ["avancado","premium"], preco_adicional: 400 },
  { modulo_id: "cidadao_dicas_anonimas", nome: "Denúncias Anônimas", descricao: "Canal seguro de denúncias sem identificação", categoria: "cidadao", planos_incluidos: ["essencial","avancado","premium"], preco_adicional: 200 },
  { modulo_id: "agente_mapa_tatico", nome: "Mapa Tático Real-Time", descricao: "Mapa com ocorrências, agentes, câmeras e viaturas em tempo real", categoria: "agente", planos_incluidos: ["basico","essencial","avancado","premium"], preco_adicional: 0 },
  { modulo_id: "agente_central_despacho", nome: "Central de Despacho IA", descricao: "Triagem e despacho priorizado por inteligência artificial", categoria: "ia", planos_incluidos: ["essencial","avancado","premium"], preco_adicional: 800 },
  { modulo_id: "agente_gestao_turno", nome: "Gestão de Turnos e Escalas", descricao: "Otimização de escala de serviço e prontidão", categoria: "agente", planos_incluidos: ["essencial","avancado","premium"], preco_adicional: 300 },
  { modulo_id: "agente_fadiga", nome: "Monitoramento de Fadiga", descricao: "Acompanhamento do nível de fadiga e bem-estar dos agentes", categoria: "agente", planos_incluidos: ["avancado","premium"], preco_adicional: 400 },
  { modulo_id: "agente_psicologico", nome: "Avaliações Psicológicas", descricao: "Auto-avaliação e acompanhamento psicológico dos agentes", categoria: "saude", planos_incluidos: ["avancado","premium"], preco_adicional: 500 },
  { modulo_id: "agente_checklist_equipamentos", nome: "Checklist de Equipamentos", descricao: "Controle de equipamentos táticos e viaturas", categoria: "agente", planos_incluidos: ["essencial","avancado","premium"], preco_adicional: 200 },
  { modulo_id: "agente_treinamento", nome: "Central de Treinamentos", descricao: "Módulos de treinamento, quiz e certificações digitais", categoria: "agente", planos_incluidos: ["avancado","premium"], preco_adicional: 600 },
  { modulo_id: "agente_bo_juridico", nome: "BO Jurídico Automático", descricao: "Redação automática de boletins com IA integrando telemetria", categoria: "ia", planos_incluidos: ["avancado","premium"], preco_adicional: 700 },
  { modulo_id: "gestao_kpis", nome: "KPIs Estratégicos", descricao: "Indicadores de desempenho operacional e segurança", categoria: "gestao", planos_incluidos: ["essencial","avancado","premium"], preco_adicional: 400 },
  { modulo_id: "gestao_heatmap", nome: "Heatmap Operacional", descricao: "Mapas de calor dinâmicos de criminalidade", categoria: "gestao", planos_incluidos: ["avancado","premium"], preco_adicional: 500 },
  { modulo_id: "gestao_analise_preditiva", nome: "Análise Preditiva Criminal", descricao: "Modelos preditivos de padrões criminais e prevenção", categoria: "ia", planos_incluidos: ["premium"], preco_adicional: 1200 },
  { modulo_id: "gestao_frota", nome: "Gestão de Frota e Telemetria", descricao: "Telemetria de viaturas e manutenção preventiva", categoria: "gestao", planos_incluidos: ["avancado","premium"], preco_adicional: 600 },
  { modulo_id: "gestao_estoque_tatico", nome: "Estoque Tático (QR)", descricao: "Inventário tático com QR Code em tempo real", categoria: "gestao", planos_incluidos: ["premium"], preco_adicional: 500 },
  { modulo_id: "gestao_cameras", nome: "Gestão de Câmeras CFTV", descricao: "Integração e monitoramento de câmeras municipais", categoria: "gestao", planos_incluidos: ["premium"], preco_adicional: 800 },
  { modulo_id: "gestao_procurados", nome: "Quadro de Procurados", descricao: "Base de dados de criminosos procurados", categoria: "gestao", planos_incluidos: ["avancado","premium"], preco_adicional: 300 },
  { modulo_id: "defesa_civil_cercas", nome: "Cercas Geográficas (Defesa Civil)", descricao: "Geofencing de áreas de risco com alertas em massa", categoria: "defesa_civil", planos_incluidos: ["avancado","premium"], preco_adicional: 600 },
  { modulo_id: "defesa_civil_iluminacao", nome: "Gestão de Iluminação Pública", descricao: "Mapeamento e controle de postes e iluminação", categoria: "defesa_civil", planos_incluidos: ["premium"], preco_adicional: 500 },
];

const CATEGORIA_META = {
  cidadao: { label: "Cidadão", color: "bg-primary/15 text-primary" },
  agente: { label: "Agente", color: "bg-warning/15 text-warning" },
  gestao: { label: "Gestão", color: "bg-success/15 text-success" },
  ia: { label: "IA", color: "bg-chart-5/15 text-chart-5" },
  saude: { label: "Saúde", color: "bg-emergency/15 text-emergency" },
  defesa_civil: { label: "Defesa Civil", color: "bg-chart-3/15 text-chart-3" },
};

export default function ModulosManager() {
  const [modulos, setModulos] = useState([]);
  const [clienteAtivo, setClienteAtivo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);

  const load = async () => {
    const [list, clientes] = await Promise.all([
      base44.entities.ModuloSentinela.list(),
      base44.entities.ClienteMunicipal.filter({ status: "ativo" }, "-created_date", 1),
    ]);
    setModulos(list);
    setClienteAtivo(clientes[0] || null);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const seed = async () => {
    setSeeding(true);
    await base44.entities.ModuloSentinela.bulkCreate(MODULOS_DEFAULT);
    await load();
    setSeeding(false);
  };

  const toggleAtivo = async (m) => {
    await base44.entities.ModuloSentinela.update(m.id, { ativo: !m.ativo });
    load();
  };

  if (loading) return <div className="py-20 text-center text-muted-foreground">Carregando módulos...</div>;

  const modulosContratados = new Set(clienteAtivo?.modulos_ativos || []);
  // Use DB modulos if available, else fallback to defaults for display
  const listaModulos = modulos.length > 0 ? modulos : MODULOS_DEFAULT;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Módulos da Plataforma</h2>
          <p className="text-sm text-muted-foreground">
            {listaModulos.length} módulos
            {clienteAtivo && (
              <span className="ml-2 text-primary font-medium">
                · Cliente ativo: <span className="font-bold">{clienteAtivo.nome_municipio}</span> ({modulosContratados.size} contratados)
              </span>
            )}
          </p>
        </div>
        {modulos.length === 0 && (
          <Button onClick={seed} disabled={seeding}>
            <Plus className="w-4 h-4 mr-1.5" /> {seeding ? "Carregando..." : "Inicializar Módulos Padrão"}
          </Button>
        )}
      </div>

      {!clienteAtivo && (
        <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-sm text-warning">
          Nenhum cliente com status <strong>ativo</strong> encontrado. Os cadeados abaixo refletem o cliente ativo.
        </div>
      )}

      {["cidadao", "agente", "gestao", "ia", "saude", "defesa_civil"].map(cat => {
        const list = listaModulos.filter(m => m.categoria === cat);
        if (!list.length) return null;
        const meta = CATEGORIA_META[cat];
        return (
          <div key={cat} className="rounded-2xl border border-border/60 bg-card p-4">
            <div className={`inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full mb-3 ${meta.color}`}>
              {meta.label}
            </div>
            <div className="grid md:grid-cols-2 gap-2">
              {list.map(m => {
                const contratado = modulosContratados.has(m.modulo_id);
                const ativo = m.ativo !== false; // default true for MODULOS_DEFAULT items
                return (
                  <div
                    key={m.id || m.modulo_id}
                    className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                      contratado
                        ? "border-success/40 bg-success/5"
                        : "border-border/30 bg-muted/20 opacity-70"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${contratado ? "bg-success/15" : "bg-muted"}`}>
                      {contratado
                        ? <Check className="w-3.5 h-3.5 text-success" />
                        : <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-medium text-sm flex items-center gap-1.5 ${contratado ? "" : "text-muted-foreground"}`}>
                        {m.nome}
                        {!contratado && (
                          <span className="text-[9px] uppercase tracking-wider bg-muted text-muted-foreground px-1.5 py-0.5 rounded">não contratado</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{m.descricao}</div>
                      <div className="flex items-center gap-2 mt-1.5">
                        {m.preco_adicional > 0 && (
                          <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded">
                            +R$ {m.preco_adicional.toLocaleString("pt-BR")}/mês
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          Planos: {(m.planos_incluidos || []).join(", ")}
                        </span>
                      </div>
                    </div>
                    {m.id && (
                      <button
                        onClick={() => toggleAtivo(m)}
                        title={ativo ? "Desativar módulo globalmente" : "Ativar módulo globalmente"}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${ativo ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}
                      >
                        <Package className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
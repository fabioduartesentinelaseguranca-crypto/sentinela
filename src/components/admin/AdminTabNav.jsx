import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useModulos } from "@/lib/useModulos.jsx";

const GROUPS = [
  {
    label: "📊 Visão Geral",
    tabs: [
      { id: "overview", label: "Dashboard" },
      { id: "tactical", label: "⚡ Comando Tático" },
      { id: "manager", label: "Gestor" },
      { id: "kpis", label: "KPIs Estratégicos", modulo: "gestao_kpis" },
      { id: "analytics", label: "Analítico" },
      { id: "report", label: "Relatório PDF" },
    ],
  },
  {
    label: "🗺️ Inteligência & Mapas",
    tabs: [
      { id: "opheatmap", label: "Mapa Operacional", modulo: "gestao_heatmap" },
      { id: "heatmap", label: "Mapa Preditivo", modulo: "gestao_heatmap" },
      { id: "forensic", label: "Inteligência Forense", modulo: "gestao_analise_preditiva" },
      { id: "tips", label: "Denúncias", modulo: "cidadao_dicas_anonimas" },
      { id: "wanted", label: "Procurados", modulo: "gestao_procurados" },
    ],
  },
  {
    label: "👮 Agentes & Escalas",
    tabs: [
      { id: "schedule", label: "Calendário de Escalas", modulo: "agente_gestao_turno" },
      { id: "smartshift", label: "Escala Inteligente", modulo: "agente_gestao_turno" },
      { id: "patrol", label: "Zonas de Patrulha" },
      { id: "ranking", label: "Ranking" },
      { id: "achievements", label: "Conquistas" },
      { id: "training", label: "Capacitação", modulo: "agente_treinamento" },
    ],
  },
  {
    label: "🤝 Comunidade",
    tabs: [
      { id: "guardians", label: "Anjos da Guarda", modulo: "cidadao_rede_anjos" },
    ],
  },
  {
    label: "📋 Documentos",
    tabs: [
      { id: "boletins", label: "Boletins de Ocorrência", modulo: "agente_bo_juridico" },
    ],
  },
  {
    label: "🚗 Frota & Equipamentos",
    tabs: [
      { id: "vehicles", label: "Viaturas", modulo: "gestao_frota" },
      { id: "fleet_maintenance", label: "Manutenção Frota", modulo: "gestao_frota" },
      { id: "inventory", label: "Estoque Geral" },
      { id: "tactical_stock", label: "Estoque Tático QR", modulo: "gestao_estoque_tatico" },
      { id: "maintenance", label: "Tickets Manutenção" },
    ],
  },
  {
    label: "🎥 Vigilância",
    tabs: [
      { id: "cameras", label: "Câmeras", modulo: "gestao_cameras" },
      { id: "video", label: "Análise de Vídeo", modulo: "gestao_cameras" },
      { id: "cercas_escolares", label: "🏫 Cercas Virtuais Escolares", modulo: "cidadao_perimetro_infantil" },
      { id: "biometria_escolar", label: "🫱 Biometria Escolar", modulo: "cidadao_perimetro_infantil" },
      { id: "checklist_biometria", label: "✅ Checklist Vínculos", modulo: "cidadao_perimetro_infantil" },
    ],
  },
  {
    label: "🧠 Saúde & RH",
    tabs: [
      { id: "fatigue_risk", label: "Risco de Fadiga 🔴", modulo: "agente_fadiga" },
      { id: "psych", label: "Avaliações Psicológicas", modulo: "agente_psicologico" },
      { id: "psych_appointments", label: "Consultas Agendadas", modulo: "agente_psicologico" },
    ],
  },
  {
    label: "📈 Relatórios",
    tabs: [
      { id: "productivity", label: "Produtividade Mensal" },
      { id: "performance_reports", label: "Desempenho & Engajamento" },
      { id: "efficiency_report", label: "Eficiência Operacional" },
    ],
  },
  {
    label: "🩺 Saúde do Sistema",
    tabs: [
      { id: "system_health", label: "Checklist E2E" },
      { id: "qa_estresse", label: "🔥 QA & Estresse" },
    ],
  },
];

export default function AdminTabNav({ activeTab, onTabChange }) {
  const { hasModulo } = useModulos();

  const [openGroup, setOpenGroup] = useState(() => {
    for (const g of GROUPS) {
      if (g.tabs.some((t) => t.id === activeTab && t.id !== "overview")) return g.label;
    }
    return null;
  });

  // Filter tabs and groups by active modules
  const filteredGroups = GROUPS.map(g => ({
    ...g,
    tabs: g.tabs.filter(t => !t.modulo || hasModulo(t.modulo)),
  })).filter(g => g.tabs.length > 0);

  return (
    <div className="flex flex-wrap gap-2 border-b border-border/60 pb-3">
      {filteredGroups.map((group) => {
        const isOpen = openGroup === group.label;
        const hasActive = group.tabs.some((t) => t.id === activeTab);

        return (
          <div key={group.label} className="relative">
            <button
              onClick={() => setOpenGroup(isOpen ? null : group.label)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                hasActive
                  ? "bg-primary/20 text-primary border border-primary/40"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {group.label}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>

            {isOpen && (
              <div className="absolute top-full left-0 mt-1 z-20 bg-card border border-border/60 rounded-xl shadow-xl p-1.5 min-w-[180px] flex flex-col gap-0.5">
                {group.tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => { onTabChange(tab.id); setOpenGroup(null); }}
                    className={`text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeTab === tab.id
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
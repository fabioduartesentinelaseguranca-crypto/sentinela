import { useState } from "react";
import { ChevronDown } from "lucide-react";

const GROUPS = [
  {
    label: "📊 Visão Geral",
    tabs: [
      { id: "overview", label: "Dashboard" },
      { id: "manager", label: "Gestor" },
      { id: "kpis", label: "KPIs Estratégicos" },
      { id: "analytics", label: "Analítico" },
      { id: "report", label: "Relatório PDF" },
    ],
  },
  {
    label: "🗺️ Inteligência & Mapas",
    tabs: [
      { id: "opheatmap", label: "Mapa Operacional" },
      { id: "heatmap", label: "Mapa Preditivo" },
      { id: "forensic", label: "Inteligência Forense" },
      { id: "tips", label: "Denúncias" },
      { id: "wanted", label: "Procurados" },
    ],
  },
  {
    label: "👮 Agentes & Escalas",
    tabs: [
      { id: "schedule", label: "Calendário de Escalas" },
      { id: "smartshift", label: "Escala Inteligente" },
      { id: "patrol", label: "Zonas de Patrulha" },
      { id: "ranking", label: "Ranking" },
      { id: "achievements", label: "Conquistas" },
      { id: "training", label: "Capacitação" },
    ],
  },
  {
    label: "🚗 Frota & Equipamentos",
    tabs: [
      { id: "vehicles", label: "Viaturas" },
      { id: "fleet_maintenance", label: "Manutenção Frota" },
      { id: "inventory", label: "Estoque Geral" },
      { id: "tactical_stock", label: "Estoque Tático QR" },
      { id: "maintenance", label: "Tickets Manutenção" },
    ],
  },
  {
    label: "🎥 Vigilância",
    tabs: [
      { id: "cameras", label: "Câmeras" },
      { id: "video", label: "Análise de Vídeo" },
    ],
  },
  {
    label: "🧠 Saúde & RH",
    tabs: [
      { id: "fatigue_risk", label: "Risco de Fadiga 🔴" },
      { id: "psych", label: "Avaliações Psicológicas" },
      { id: "psych_appointments", label: "Consultas Agendadas" },
    ],
  },
  {
    label: "📈 Relatórios",
    tabs: [
      { id: "productivity", label: "Produtividade Mensal" },
      { id: "performance_reports", label: "Desempenho & Engajamento" },
    ],
  },
];

export default function AdminTabNav({ activeTab, onTabChange }) {
  const [openGroup, setOpenGroup] = useState(() => {
    for (const g of GROUPS) {
      if (g.tabs.some((t) => t.id === activeTab)) return g.label;
    }
    return GROUPS[0].label;
  });

  return (
    <div className="flex flex-wrap gap-2 border-b border-border/60 pb-3">
      {GROUPS.map((group) => {
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
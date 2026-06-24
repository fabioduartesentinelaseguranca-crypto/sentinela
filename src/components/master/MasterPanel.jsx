import { useState } from "react";
import { Shield, Users, Package, CreditCard, LogOut, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import ClientesManager from "./ClientesManager";
import ModulosManager from "./ModulosManager";
import PlanosManager from "./PlanosManager";

const TABS = [
  { id: "clientes", label: "Clientes", icon: Building2 },
  { id: "modulos", label: "Módulos", icon: Package },
  { id: "planos", label: "Planos", icon: CreditCard },
];

export default function MasterPanel({ onLogout }) {
  const [activeTab, setActiveTab] = useState("clientes");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/60 bg-card px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight">SENTINELA</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest">Painel Master</div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onLogout}>
          <LogOut className="w-4 h-4 mr-1.5" /> Sair
        </Button>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {/* Tab nav */}
        <div className="flex gap-2 border-b border-border/60 pb-0">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
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

        {activeTab === "clientes" && <ClientesManager />}
        {activeTab === "modulos" && <ModulosManager />}
        {activeTab === "planos" && <PlanosManager />}
      </div>
    </div>
  );
}
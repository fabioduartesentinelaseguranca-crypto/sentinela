import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import StatCard from "@/components/shared/StatCard";
import { TYPE_META, STATUS_META } from "@/lib/occurrenceMeta";
import { Users, FileText, ShieldCheck, CheckCircle2, Clock, AlertTriangle, BarChart2 } from "lucide-react";
import CameraManager from "@/components/admin/CameraManager";
import AnalyticsDashboard from "@/components/admin/AnalyticsDashboard";
import PdfReportGenerator from "@/components/admin/PdfReportGenerator";
import PatrolScheduler from "@/components/admin/PatrolScheduler";
import VehicleManager from "@/components/admin/VehicleManager";
import ManagerDashboard from "@/components/admin/ManagerDashboard";
import TrainingManager from "@/components/admin/TrainingManager";
import InventoryManager from "@/components/admin/InventoryManager";
import AgentLeaderboard from "@/components/admin/AgentLeaderboard";
import MaintenanceManager from "@/components/admin/MaintenanceManager";
import GeofenceAlertBanner from "@/components/admin/GeofenceAlertBanner";
import TipModerationPanel from "@/components/admin/TipModerationPanel";
import ShiftCalendar from "@/components/admin/ShiftCalendar";
import PsychPanel from "@/components/admin/PsychPanel";
import HeatmapPatrolDashboard from "@/components/admin/HeatmapPatrolDashboard";
import TeamAchievements from "@/pages/TeamAchievements";
import StrategicKPIs from "@/components/admin/StrategicKPIs";
import OperationalHeatmap from "@/components/admin/OperationalHeatmap";
import WantedBoard from "@/pages/WantedBoard";
import VideoAnalysisPanel from "@/components/admin/VideoAnalysisPanel";
import SmartShiftAllocator from "@/components/admin/SmartShiftAllocator";
import ForensicIntelligence from "@/components/admin/ForensicIntelligence";
import TacticalStockManager from "@/components/admin/TacticalStockManager";
import PsychAppointmentManager from "@/components/admin/PsychAppointmentManager";
import FleetMaintenanceManager from "@/components/admin/FleetMaintenanceManager";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AdminDashboard() {
  const [occurrences, setOccurrences] = useState([]);
  const [users, setUsers] = useState([]);
  const [pendingDocs, setPendingDocs] = useState([]);
  const [agents, setAgents] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");

  const load = async () => {
    const [occs, allUsers, vehs] = await Promise.all([
      base44.entities.Occurrence.list("-created_date", 500),
      base44.entities.User.list("-created_date", 200),
      base44.entities.Vehicle.list("-created_date", 100),
    ]);
    setOccurrences(occs);
    setUsers(allUsers);
    setVehicles(vehs);
    setPendingDocs(allUsers.filter((u) => u.protective_measure_status === "pending"));
    setAgents(allUsers.filter((u) => u.role === "agent"));
  };

  useEffect(() => { load(); }, []);

  const approveDoc = async (u) => {
    await base44.entities.User.update(u.id, { protective_measure_status: "active" });
    toast.success(`Medida protetiva de ${u.full_name} aprovada`);
    load();
  };

  const rejectDoc = async (u) => {
    await base44.entities.User.update(u.id, { protective_measure_status: "none" });
    toast.info(`Medida protetiva de ${u.full_name} rejeitada`);
    load();
  };

  const setRole = async (u, role) => {
    await base44.entities.User.update(u.id, { role });
    toast.success(`${u.full_name} → ${role}`);
    load();
  };

  const openCount = occurrences.filter((o) => o.status === "open").length;
  const resolvedCount = occurrences.filter((o) => o.status === "resolved").length;
  const citizenCount = users.filter((u) => u.role === "citizen" || !u.role).length;
  const agentCount = users.filter((u) => u.role === "agent").length;

  const TABS = [
    { id: "overview", label: "Visão Geral" },
    { id: "kpis", label: "KPIs Estratégicos" },
    { id: "opheatmap", label: "Mapa de Calor Operacional" },
    { id: "manager", label: "Dashboard Gestor" },
    { id: "analytics", label: "Analítico" },
    { id: "vehicles", label: "Viaturas" },
    { id: "patrol", label: "Escalas e Patrulha" },
    { id: "inventory", label: "Estoque Tático" },
    { id: "maintenance", label: "Manutenção" },
    { id: "ranking", label: "Ranking Agentes" },
    { id: "tips", label: "Denúncias" },
    { id: "schedule", label: "Escalas" },
    { id: "heatmap", label: "Mapa Preditivo" },
    { id: "psych", label: "Psicológico" },
    { id: "training", label: "Capacitação" },
    { id: "report", label: "Relatório PDF" },
    { id: "achievements", label: "Conquistas da Equipe" },
    { id: "cameras", label: "Câmeras" },
    { id: "wanted", label: "Mural de Procurados" },
    { id: "video", label: "Análise de Vídeo" },
    { id: "smartshift", label: "Escala Inteligente" },
    { id: "forensic", label: "Inteligência Forense" },
    { id: "tactical_stock", label: "Estoque Tático QR" },
    { id: "psych_appointments", label: "Consultas Psicológicas" },
    { id: "fleet_maintenance", label: "Manutenção Frota" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Painel Administrativo</h1>
        <p className="text-sm text-muted-foreground mt-1">Visão geral da plataforma Sentinela.</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 flex-wrap border-b border-border/60 pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm rounded-t-lg transition-colors ${
              activeTab === t.id
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── GEOFENCE ALERTS (always visible) ─────────────── */}
      <GeofenceAlertBanner />

      {/* ── OVERVIEW TAB ─────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <StatCard label="Ocorrências abertas" value={openCount} icon={AlertTriangle} accent="warning" />
            <StatCard label="Resolvidas" value={resolvedCount} icon={CheckCircle2} accent="success" />
            <StatCard label="Cidadãos" value={citizenCount} icon={Users} />
            <StatCard label="Agentes" value={agentCount} icon={ShieldCheck} accent="primary" />
          </div>

          {pendingDocs.length > 0 && (
            <div className="rounded-2xl border border-warning/40 bg-warning/5 p-5">
              <h2 className="font-semibold flex items-center gap-2 mb-4 text-warning">
                <Clock className="w-4 h-4" /> Medidas Protetivas Pendentes ({pendingDocs.length})
              </h2>
              <div className="space-y-2">
                {pendingDocs.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/60">
                    <div>
                      <div className="text-sm font-medium">{u.full_name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                      {u.protective_measure_doc_url && (
                        <a href={u.protective_measure_doc_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline">Ver documento →</a>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => approveDoc(u)}>
                        <CheckCircle2 className="w-3 h-3 mr-1" /> Aprovar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => rejectDoc(u)}>Rejeitar</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="font-semibold flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-primary" /> Gestão de Usuários
            </h2>
            <div className="rounded-2xl border border-border/60 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Usuário</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Cadastro</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Perfil</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground hidden md:table-cell">Pontos</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium">{u.full_name}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs hidden md:table-cell">
                        {format(new Date(u.created_date), "dd/MM/yy")}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {["citizen", "agent", "psychologist", "admin"].map((r) => (
                            <button
                              key={r}
                              onClick={() => setRole(u, r)}
                              className={`text-[10px] uppercase px-2 py-1 rounded font-medium transition-colors ${
                                (u.role || "citizen") === r
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                              }`}
                            >{r}</button>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs hidden md:table-cell">{u.points || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="font-semibold flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-primary" /> Ocorrências Recentes
            </h2>
            <div className="space-y-2">
              {occurrences.slice(0, 10).map((o) => {
                const tm = TYPE_META[o.type] || TYPE_META.crime;
                const sm = STATUS_META[o.status || "open"];
                const Icon = tm.icon;
                return (
                  <div key={o.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card">
                    <div className={`w-8 h-8 rounded-lg ${tm.bg} ${tm.color} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{o.subtype || tm.label}</span>
                      {o.address && <span className="text-xs text-muted-foreground ml-2">{o.address}</span>}
                    </div>
                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${sm.bg} ${sm.color} font-medium`}>{sm.label}</span>
                    <span className="text-[11px] text-muted-foreground font-mono hidden md:block">{format(new Date(o.created_date), "dd/MM HH:mm")}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── KPIs TAB ──────────────────────────────────────── */}
      {activeTab === "kpis" && <StrategicKPIs occurrences={occurrences} />}

      {/* ── OPERATIONAL HEATMAP TAB ───────────────────────── */}
      {activeTab === "opheatmap" && <OperationalHeatmap occurrences={occurrences} />}

      {/* ── MANAGER DASHBOARD TAB ─────────────────────────── */}
      {activeTab === "manager" && (
        <ManagerDashboard occurrences={occurrences} vehicles={vehicles} />
      )}

      {/* ── VEHICLES TAB ──────────────────────────────────── */}
      {activeTab === "vehicles" && (
        <VehicleManager agents={agents} />
      )}

      {/* ── ANALYTICS TAB ─────────────────────────────────── */}
      {activeTab === "analytics" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Dashboard Analítico</h2>
            <span className="text-xs text-muted-foreground">({occurrences.length} ocorrências carregadas)</span>
          </div>
          <AnalyticsDashboard occurrences={occurrences} />
        </div>
      )}

      {/* ── PATROL TAB ─────────────────────────────────── */}
      {activeTab === "patrol" && (
        <div className="space-y-4">
          <PatrolScheduler agents={agents} />
        </div>
      )}

      {/* ── REPORT TAB ─────────────────────────────────── */}
      {activeTab === "report" && (
        <PdfReportGenerator occurrences={occurrences} users={users} />
      )}

      {/* ── INVENTORY TAB ─────────────────────────────────── */}
      {activeTab === "inventory" && <InventoryManager agents={agents} />}

      {/* ── MAINTENANCE TAB ───────────────────────────────── */}
      {activeTab === "maintenance" && <MaintenanceManager />}

      {/* ── RANKING TAB ───────────────────────────────────── */}
      {activeTab === "ranking" && <AgentLeaderboard agents={agents} occurrences={occurrences} />}

      {/* ── TIPS MODERATION TAB ───────────────────────────── */}
      {activeTab === "tips" && <TipModerationPanel />}

      {/* ── SHIFT CALENDAR TAB ────────────────────────────── */}
      {activeTab === "schedule" && <ShiftCalendar agents={agents} />}

      {/* ── HEATMAP TAB ───────────────────────────────────── */}
      {activeTab === "heatmap" && <HeatmapPatrolDashboard />}

      {/* ── PSYCH TAB ─────────────────────────────────────── */}
      {activeTab === "psych" && <PsychPanel />}

      {/* ── TRAINING TAB ──────────────────────────────────── */}
      {activeTab === "training" && <TrainingManager />}

      {/* ── ACHIEVEMENTS TAB ──────────────────────────────── */}
      {activeTab === "achievements" && <TeamAchievements />}

      {/* ── CAMERAS TAB ─────────────────────────────────── */}
      {activeTab === "cameras" && <CameraManager />}

      {/* ── WANTED BOARD TAB ──────────────────────────────── */}
      {activeTab === "wanted" && <WantedBoard />}

      {/* ── VIDEO ANALYSIS TAB ────────────────────────────── */}
      {activeTab === "video" && <VideoAnalysisPanel />}

      {/* ── SMART SHIFT ALLOCATOR TAB ─────────────────────── */}
      {activeTab === "smartshift" && <SmartShiftAllocator agents={agents} />}

      {/* ── FORENSIC INTELLIGENCE TAB ─────────────────────── */}
      {activeTab === "forensic" && <ForensicIntelligence />}

      {/* ── TACTICAL STOCK QR TAB ─────────────────────────── */}
      {activeTab === "tactical_stock" && <TacticalStockManager />}

      {/* ── PSYCH APPOINTMENTS TAB ────────────────────────── */}
      {activeTab === "psych_appointments" && <PsychAppointmentManager />}

      {/* ── FLEET MAINTENANCE TAB ─────────────────────────── */}
      {activeTab === "fleet_maintenance" && <FleetMaintenanceManager />}
    </div>
  );
}
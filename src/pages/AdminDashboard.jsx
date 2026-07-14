import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import StatCard from "@/components/shared/StatCard";
import { TYPE_META, STATUS_META } from "@/lib/occurrenceMeta";
import { Users, FileText, ShieldCheck, CheckCircle2, Clock, AlertTriangle, BarChart2 } from "lucide-react";
import AdminOverview from "@/components/admin/AdminOverview";
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
import CheckpointGuard from "@/pages/CheckpointGuard";
import VideoAnalysisPanel from "@/components/admin/VideoAnalysisPanel";
import SmartShiftAllocator from "@/components/admin/SmartShiftAllocator";
import ForensicIntelligence from "@/components/admin/ForensicIntelligence";
import TacticalStockManager from "@/components/admin/TacticalStockManager";
import PsychAppointmentManager from "@/components/admin/PsychAppointmentManager";
import FleetMaintenanceManager from "@/components/admin/FleetMaintenanceManager";
import FatigueRiskPanel from "@/components/admin/FatigueRiskPanel";
import ProductivityReport from "@/components/admin/ProductivityReport";
import PerformanceReports from "@/components/admin/PerformanceReports";
import OperationalEfficiencyReport from "@/components/admin/OperationalEfficiencyReport";
import MonthlyOccurrenceReport from "@/components/admin/MonthlyOccurrenceReport";
import SystemHealthDashboard from "@/components/admin/SystemHealthDashboard";
import QaEstressePanel from "@/components/admin/QaEstressePanel";
import TacticalCommandCenter from "@/components/admin/TacticalCommandCenter";
import GuardianManager from "@/components/admin/GuardianManager";
import BoletimOcorrenciaPanel from "@/components/admin/BoletimOcorrenciaPanel";
import BoletinsOcorrenciaList from "@/components/admin/BoletinsOcorrenciaList";
import CercaVirtualEscolar from "@/pages/CercaVirtualEscolar";
import ChecklistBiometria from "@/components/admin/ChecklistBiometria";
import AdminTabNav from "@/components/admin/AdminTabNav";
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

  return (
    <div className={`${activeTab === "overview" ? "px-4 md:px-6 py-4" : "max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8"} space-y-4`}>
      {activeTab !== "overview" && (
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Painel Administrativo</h1>
            <p className="text-sm text-muted-foreground mt-1">Visão geral da plataforma Sentinela.</p>
          </div>
          <Button size="sm" onClick={async () => {
            try {
              const res = await base44.functions.invoke("gerarDocumentacaoPDF", {});
              const blob = new Blob([res.data], { type: "application/pdf" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "Sentinela_Documentacao_Completa.pdf";
              a.click();
              URL.revokeObjectURL(url);
              toast.success("Documentação baixada com sucesso!");
            } catch (e) {
              toast.error("Erro ao gerar documentação");
            }
          }}>
            <FileText className="w-4 h-4 mr-1.5" /> Baixar Documentação PDF
          </Button>
        </div>
      )}

      <AdminTabNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* ── GEOFENCE ALERTS (always visible) ─────────────── */}
      <GeofenceAlertBanner />

      {/* ── OVERVIEW TAB ─────────────────────────────────── */}
      {activeTab === "overview" && (
        <AdminOverview occurrences={occurrences} users={users} />
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
        <div className="space-y-6">
          <MonthlyOccurrenceReport />
          <PdfReportGenerator occurrences={occurrences} users={users} />
        </div>
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
      {activeTab === "wanted" && <CheckpointGuard initialModule="procurados" />}

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

      {/* ── FATIGUE RISK PANEL TAB ────────────────────────── */}
      {activeTab === "fatigue_risk" && <FatigueRiskPanel />}

      {/* ── PRODUCTIVITY REPORT TAB ───────────────────────── */}
      {activeTab === "productivity" && <ProductivityReport />}

      {/* ── PERFORMANCE REPORTS TAB ───────────────────────── */}
      {activeTab === "performance_reports" && <PerformanceReports />}

      {/* ── OPERATIONAL EFFICIENCY REPORT TAB ────────────── */}
      {activeTab === "efficiency_report" && <OperationalEfficiencyReport />}

      {/* ── TACTICAL COMMAND CENTER TAB ───────────────────── */}
      {activeTab === "tactical" && <TacticalCommandCenter />}

      {/* ── SYSTEM HEALTH CHECKLIST TAB ───────────────────── */}
      {activeTab === "system_health" && <SystemHealthDashboard />}

      {/* ── QA & ESTRESSE TAB ─────────────────────────────── */}
      {activeTab === "qa_estresse" && <QaEstressePanel />}

      {/* ── GUARDIANS TAB ─────────────────────────────────── */}
      {activeTab === "guardians" && <GuardianManager />}

      {/* ── CERCAS VIRTUAIS ESCOLARES TAB ─────────────────── */}
      {activeTab === "cercas_escolares" && <CercaVirtualEscolar />}

      {/* ── BIOMETRIA ESCOLAR TAB ─────────────────────────── */}
      {activeTab === "biometria_escolar" && <CheckpointGuard initialModule="escolar" />}

      {/* ── CHECKLIST BIOMÉTRICO TAB ───────────────────────── */}
      {activeTab === "checklist_biometria" && <ChecklistBiometria />}

      {/* ── BOLETINS DE OCORRÊNCIA TAB ───────────────────── */}
      {activeTab === "boletins" && (
        <div className="space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Boletins de Ocorrência Pré-Preenchidos
          </h2>
          <p className="text-sm text-muted-foreground">
            Selecione um alerta finalizado para visualizar e aprovar o BO gerado por IA.
          </p>
          <BoletinsOcorrenciaList />
        </div>
      )}
    </div>
  );
}
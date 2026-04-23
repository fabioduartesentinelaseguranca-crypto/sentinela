import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { getCurrentLocation } from "@/lib/geo";
import { TYPE_META } from "@/lib/occurrenceMeta";
import StatCard from "@/components/shared/StatCard";
import ShiftManager from "@/components/agent/ShiftManager";
import OccurrenceRow from "@/components/agent/OccurrenceRow";
import OccurrenceChat from "@/components/agent/OccurrenceChat";
import LiveMap from "@/components/agent/LiveMap";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Map as MapIcon, Flame, Users, Siren, Bell, BellOff, FileText, Wrench } from "lucide-react";
import NearCamerasAlert, { findNearbyCameras } from "@/components/shared/NearCamerasAlert";
import { useAgentAlerts } from "@/hooks/useAgentAlerts";
import { usePatrolZoneBoundary } from "@/hooks/usePatrolZoneBoundary";
import { sortByUrgency } from "@/lib/urgencyScore";
import BiometricCheckIn from "@/components/agent/BiometricCheckIn";
import CameraStreamViewer from "@/components/agent/CameraStreamViewer";
import PredictivePatrol from "@/components/admin/PredictivePatrol";
import ShiftReport from "@/components/agent/ShiftReport";
import CriticalAlert from "@/components/agent/CriticalAlert";
import ResolveOccurrenceDialog from "@/components/agent/ResolveOccurrenceDialog";
import AgentMedalCard from "@/components/agent/AgentMedalCard";
import MaintenanceTicketDialog from "@/components/agent/MaintenanceTicketDialog";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useShiftBreadcrumb } from "@/hooks/useShiftBreadcrumb";
import { useVehicleTelemetry } from "@/hooks/useVehicleTelemetry";
import { toast } from "sonner";

export default function AgentDashboard() {
  const { user } = useAuth();
  const [occurrences, setOccurrences] = useState([]);
  const [agents, setAgents] = useState([]);
  const [center, setCenter] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [heatmap, setHeatmap] = useState(false);
  const [filter, setFilter] = useState("all");
  const [chatOccurrence, setChatOccurrence] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [cameras, setCameras] = useState([]);
  const [selectedOccurrence, setSelectedOccurrence] = useState(null);
  const [activeShift, setActiveShift] = useState(null);
  const [boundaryAlert, setBoundaryAlert] = useState(null);
  const [streamCamera, setStreamCamera] = useState(null);
  const [streamOpen, setStreamOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [criticalOcc, setCriticalOcc] = useState(null);
  const [resolveOcc, setResolveOcc] = useState(null);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [feedbacks, setFeedbacks] = useState([]);

  // Must be declared BEFORE usePushNotifications
  const { permissionGranted, askPermission } = useAgentAlerts(true);

  usePushNotifications({
    enabled: permissionGranted,
    agentId: user?.id,
    onCritical: (occ) => setCriticalOcc(occ),
  });

  // Breadcrumb: record route during shift
  useShiftBreadcrumb({
    shiftId: activeShift?.id,
    agentId: user?.id,
    agentName: user?.full_name,
    enabled: !!activeShift,
  });

  // Telemetria: push GPS to Vehicle + User every 15s
  useVehicleTelemetry({
    agentId: user?.id,
    vehicleId: activeShift?.vehicle_id,
    enabled: !!activeShift,
  });

  usePatrolZoneBoundary({
    userId: user?.id,
    userName: user?.full_name,
    currentLocation: center,
    onBoundaryAlert: (info) => setBoundaryAlert(info),
  });

  const load = async () => {
    const [occs, allAgents, cams, shifts, fbs] = await Promise.all([
      base44.entities.Occurrence.filter({}, "-created_date", 100),
      base44.entities.User.filter({ role: "agent" }),
      base44.entities.Camera.list("-created_date", 500),
      user?.id ? base44.entities.Shift.filter({ agent_id: user.id, status: "active" }, "-created_date", 1) : Promise.resolve([]),
      base44.entities.CitizenFeedback.list("-created_date", 200),
    ]);
    setOccurrences(occs);
    setAgents(allAgents);
    setCameras(cams);
    setActiveShift(shifts[0] || null);
    setFeedbacks(fbs);
  };

  useEffect(() => {
    load();
    (async () => {
      const loc = await getCurrentLocation();
      setCenter(loc);
      if (user?.id) {
        base44.auth.updateMe({ last_location: { ...loc, updated_at: new Date().toISOString() } }).catch(() => {});
      }
    })();
  }, [user?.id]);

  const openOccurrences = occurrences.filter((o) => o.status === "open");
  const panicOccurrences = occurrences.filter((o) => o.type === "panic" && o.status !== "resolved");
  const myActive = occurrences.filter((o) => o.assigned_agent_id === user?.id && o.status === "in_progress");

  const rawFiltered = occurrences.filter((o) => {
    if (filter === "all") return o.status !== "resolved";
    if (filter === "mine") return o.assigned_agent_id === user?.id;
    return o.type === filter;
  });

  // Sort by urgency score (critical/panic first, then time decay + reporter credibility)
  const filtered = sortByUrgency(rawFiltered, occurrences);

  const assign = async (o) => {
    await base44.entities.Occurrence.update(o.id, { assigned_agent_id: user.id, status: "in_progress" });
    toast.success("Ocorrência assumida");
    load();
  };

  const openResolve = (o) => {
    setResolveOcc(o);
    setResolveOpen(true);
  };

  const afterResolved = async (o) => {
    // Gamificação: conceder pontos ao cidadão reportante se aplicável
    if (o?.awarded_points && o?.reporter_id) {
      const reporter = await base44.entities.User.filter({ id: o.reporter_id });
      const current = reporter[0];
      if (current) {
        await base44.entities.User.update(current.id, { points: (current.points || 0) + o.awarded_points });
        await base44.entities.PointsLog.create({
          user_id: current.id,
          user_name: current.full_name,
          points: o.awarded_points,
          reason: "Ocorrência resolvida",
          occurrence_id: o.id,
        });
      }
    }
    load();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Central do Agente</h1>
          <p className="text-sm text-muted-foreground mt-1">Ocorrências ativas, viatura e comunicação tática.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setMaintenanceOpen(true)}>
            <Wrench className="w-4 h-4 mr-1.5" /> Manutenção
          </Button>
          {activeShift && (
            <Button variant="outline" size="sm" onClick={() => setReportOpen(true)}>
              <FileText className="w-4 h-4 mr-1.5" /> Relatório de Turno
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard label="Abertas" value={openOccurrences.length} icon={AlertTriangle} accent="warning" />
        <StatCard label="Pânico Ativo" value={panicOccurrences.length} icon={Siren} accent="emergency" />
        <StatCard label="Meus atendimentos" value={myActive.length} icon={MapIcon} />
        <StatCard label="Agentes em serviço" value={agents.filter((a) => a.last_location).length} icon={Users} accent="success" />
      </div>

      {/* Biometric check-in (shown only when no active shift) */}
      {!activeShift && (
        <BiometricCheckIn
          userId={user?.id}
          userName={user?.full_name}
          activeShift={activeShift}
          onVerified={load}
        />
      )}

      {/* Patrol zone boundary alert */}
      {boundaryAlert && (
        <div className="flex items-center justify-between p-3 rounded-xl border border-warning/50 bg-warning/5 text-sm">
          <span className="text-warning font-medium">
            ⚠ Você está {boundaryAlert.distanceM?.toFixed(0)}m fora da zona "{boundaryAlert.zone?.name}"
          </span>
          <button onClick={() => setBoundaryAlert(null)} className="text-xs text-muted-foreground hover:text-foreground ml-4">✕</button>
        </div>
      )}

      {/* Notification permission banner */}
      {!permissionGranted && (
        <div className="flex items-center justify-between p-3 rounded-xl border border-warning/40 bg-warning/5 text-sm">
          <span className="flex items-center gap-2 text-warning">
            <BellOff className="w-4 h-4" />
            Ative as notificações para receber alertas de pânico e ocorrências críticas.
          </span>
          <Button size="sm" variant="outline" onClick={askPermission}>
            <Bell className="w-3.5 h-3.5 mr-1" /> Ativar alertas
          </Button>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="text-lg font-semibold">Ocorrências</h2>
            <div className="flex items-center gap-2">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas ativas</SelectItem>
                  <SelectItem value="mine">Minhas</SelectItem>
                  {Object.entries(TYPE_META).map(([k, m]) => (
                    <SelectItem key={k} value={k}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant={showMap ? "default" : "outline"} size="sm" onClick={() => setShowMap(!showMap)}>
                <MapIcon className="w-4 h-4 mr-1.5" /> {showMap ? "Ocultar" : "Mapa"}
              </Button>
              {showMap && (
                <Button variant={heatmap ? "default" : "outline"} size="sm" onClick={() => setHeatmap(!heatmap)}>
                  <Flame className="w-4 h-4 mr-1.5" /> Calor
                </Button>
              )}
            </div>
          </div>

          {showMap && (
            <LiveMap
              occurrences={filtered}
              agents={agents}
              cameras={cameras}
              center={center}
              heatmap={heatmap}
              shiftId={activeShift?.id}
              onCameraClick={(cam) => { setStreamCamera(cam); setStreamOpen(true); }}
            />
          )}

          <div className="space-y-2">
            {filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground p-6 text-center border border-dashed rounded-xl">
                Nenhuma ocorrência com este filtro.
              </div>
            ) : (
              filtered.map((o) => {
                const nearbyCams = findNearbyCameras(cameras, o.lat, o.lng);
                return (
                  <div key={o.id}>
                    <OccurrenceRow
                      occurrence={o}
                      currentAgentId={user?.id}
                      onOpenChat={(occ) => { setChatOccurrence(occ); setChatOpen(true); }}
                      onAssign={assign}
                      onResolve={openResolve}
                      onSelect={() => setSelectedOccurrence(selectedOccurrence?.id === o.id ? null : o)}
                    />
                    {selectedOccurrence?.id === o.id && nearbyCams.length > 0 && (
                      <div className="mt-1 ml-2">
                        <NearCamerasAlert cameras={nearbyCams} onClose={() => setSelectedOccurrence(null)} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-4">
          <ShiftManager userId={user?.id} />

          <div className="rounded-2xl border border-border/60 bg-card p-4">
            <PredictivePatrol occurrences={occurrences} />
          </div>

          {user?.id && (
            <AgentMedalCard agentId={user.id} occurrences={occurrences} feedbacks={feedbacks} />
          )}

          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <h3 className="font-semibold flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-primary" />
              Agentes ativos
            </h3>
            <div className="space-y-2">
              {agents.filter((a) => a.last_location).slice(0, 6).map((a) => (
                <div key={a.id} className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  <span className="flex-1 truncate">{a.full_name}</span>
                  <span className="text-[11px] text-muted-foreground font-mono">{a.agent_badge}</span>
                </div>
              ))}
              {agents.filter((a) => a.last_location).length === 0 && (
                <div className="text-xs text-muted-foreground">Nenhum agente com localização registrada.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <MaintenanceTicketDialog
        open={maintenanceOpen}
        onOpenChange={setMaintenanceOpen}
        agentId={user?.id}
        agentName={user?.full_name}
      />
      <ResolveOccurrenceDialog
        occurrence={resolveOcc}
        open={resolveOpen}
        onOpenChange={setResolveOpen}
        onResolved={() => afterResolved(resolveOcc)}
      />
      <OccurrenceChat occurrence={chatOccurrence} open={chatOpen} onOpenChange={setChatOpen} />
      <CameraStreamViewer camera={streamCamera} open={streamOpen} onOpenChange={setStreamOpen} />
      {criticalOcc && (
        <CriticalAlert
          occurrence={criticalOcc}
          agentId={user?.id}
          onAccept={(occ) => { setCriticalOcc(null); load(); }}
          onDismiss={() => setCriticalOcc(null)}
        />
      )}
      <ShiftReport
        shift={activeShift}
        agentName={user?.full_name}
        open={reportOpen}
        onOpenChange={setReportOpen}
      />
    </div>
  );
}
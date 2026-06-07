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
import { AlertTriangle, Map as MapIcon, Flame, Users, Siren, Bell, BellOff, FileText, Wrench, ClipboardList, Brain, Video, PlusCircle, Navigation, Search, X, Clock, CheckCircle2, ListFilter } from "lucide-react";
import { Input } from "@/components/ui/input";
import MapSearchBar from "@/components/agent/MapSearchBar";
import RegisterOccurrenceDialog from "@/components/citizen/RegisterOccurrenceDialog";
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
import VehicleChecklistDialog from "@/components/agent/VehicleChecklistDialog";
import EquipmentChecklistDialog from "@/components/agent/EquipmentChecklistDialog";
import PsychSelfEvalForm from "@/components/agent/PsychSelfEvalForm";
import OfflineRadio from "@/components/agent/OfflineRadio";
import VirtualPatrolMode from "@/components/agent/VirtualPatrolMode";
import FatigueMonitor from "@/components/agent/FatigueMonitor";
import ShiftMissions from "@/components/agent/ShiftMissions";
import UnifiedChat from "@/components/agent/UnifiedChat";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useProximityAlerts } from "@/hooks/useProximityAlerts";
import { useShiftBreadcrumb } from "@/hooks/useShiftBreadcrumb";
import { useVehicleTelemetry } from "@/hooks/useVehicleTelemetry";
import { usePriorityAlerts } from "@/hooks/usePriorityAlerts";
import { useEmergencyProximityAlert } from "@/hooks/useEmergencyProximityAlert";
import { findNearestUnit } from "@/lib/nearestUnitRouter";
import { toast } from "sonner";
import { nowISO } from "@/lib/deviceTime";

export default function AgentDashboard() {
  const { user } = useAuth();
  const [occurrences, setOccurrences] = useState([]);
  const [agents, setAgents] = useState([]);
  const [center, setCenter] = useState(null);
  const [showMap, setShowMap] = useState(false);
  const [heatmap, setHeatmap] = useState(false);
  const [patrolZones, setPatrolZones] = useState([]);
  const [mapFilteredOccs, setMapFilteredOccs] = useState(null);
  const [mapFilteredCams, setMapFilteredCams] = useState(null);
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
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [psychOpen, setPsychOpen] = useState(false);
  const [equipmentOpen, setEquipmentOpen] = useState(false);
  const [feedbacks, setFeedbacks] = useState([]);
  const [virtualPatrolOpen, setVirtualPatrolOpen] = useState(false);
  const [virtualPatrolTarget, setVirtualPatrolTarget] = useState(null);
  const [proximityAlert, setProximityAlert] = useState(null); // {occ, dist, routeUrl}
  const [registerOpen, setRegisterOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("active"); // active | in_progress | resolved | all
  const [searchQuery, setSearchQuery] = useState("");

  // Must be declared BEFORE usePushNotifications
  const { permissionGranted, askPermission } = useAgentAlerts(true);

  // Alertas sonoros prioritários (global)
  const rawFiltered2 = occurrences.filter((o) => o.status !== "resolved");
  usePriorityAlerts({
    occurrences: rawFiltered2,
    enabled: permissionGranted,
    onNewCritical: (occ) => {
      toast.error(`🚨 OCORRÊNCIA CRÍTICA: ${occ.subtype || occ.type}`, {
        description: occ.address || "Localização não informada",
        duration: 10000,
      });
    },
  });

  // Alerta sonoro específico: emergência em até 5km (sirene diferenciada)
  useEmergencyProximityAlert({
    occurrences: rawFiltered2,
    agentLocation: center,
    enabled: permissionGranted,
    onNearbyEmergency: ({ occ, dist }) => {
      const nearest = findNearestUnit({ agents, occurrenceLat: occ.lat, occurrenceLng: occ.lng });
      toast.error(`🚨 EMERGÊNCIA A ${dist.toFixed(1)}KM: ${occ.subtype || occ.type}`, {
        description: occ.address || "Endereço não informado",
        duration: 12000,
        action: nearest ? {
          label: "🗺 Ver rota",
          onClick: () => window.open(nearest.routeUrl, "_blank"),
        } : undefined,
      });
    },
  });

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
  useProximityAlerts({
    enabled: !!activeShift && !!center,
    agentLocation: center,
    agentId: user?.id,
    radiusKm: 3,
    onNearbyAlert: (occ, dist, routeUrl) => setProximityAlert({ occ, dist, routeUrl }),
  });

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
    const safe = (p) => p.catch(() => []);
    const [occs, allAgents, cams, shifts, fbs, zones] = await Promise.all([
      safe(base44.entities.Occurrence.list("-created_date", 200)),
      safe(base44.entities.User.filter({ role: "agent" })),
      safe(base44.entities.Camera.list("-created_date", 500)),
      user?.id ? safe(base44.entities.Shift.filter({ agent_id: user.id, status: "active" }, "-created_date", 1)) : Promise.resolve([]),
      safe(base44.entities.CitizenFeedback.list("-created_date", 200)),
      safe(base44.entities.PatrolZone.list("-created_date", 100)),
    ]);
    setOccurrences(occs);
    setAgents(allAgents);
    setCameras(cams);
    setActiveShift(shifts[0] || null);
    setFeedbacks(fbs);
    setPatrolZones(zones);
  };

  useEffect(() => {
    if (!user?.id) return;
    load();
    (async () => {
      const loc = await getCurrentLocation();
      setCenter(loc);
      base44.auth.updateMe({ last_location: { ...loc, updated_at: nowISO() } }).catch(() => {});
    })();
  }, [user?.id]);

  const openOccurrences = occurrences.filter((o) => o.status === "open");
  const inProgressOccurrences = occurrences.filter((o) => o.status === "in_progress");
  const resolvedOccurrences = occurrences.filter((o) => o.status === "resolved");
  const panicOccurrences = occurrences.filter((o) => o.type === "panic" && o.status !== "resolved");
  const myActive = occurrences.filter((o) => o.assigned_agent_id === user?.id && o.status === "in_progress");

  // Avg response time: time from created_date to when status became in_progress (approx: updated_date when in_progress)
  const resolvedWithTime = occurrences.filter((o) => o.status === "resolved" && o.created_date && o.updated_date);
  const avgResponseMin = resolvedWithTime.length > 0
    ? Math.round(resolvedWithTime.reduce((sum, o) => {
        const diff = (new Date(o.updated_date) - new Date(o.created_date)) / 60000;
        return sum + diff;
      }, 0) / resolvedWithTime.length)
    : null;

  const rawFiltered = occurrences.filter((o) => {
    // Status filter
    if (statusFilter === "active") { if (o.status !== "open") return false; }
    else if (statusFilter === "in_progress") { if (o.status !== "in_progress") return false; }
    else if (statusFilter === "resolved") { if (o.status !== "resolved") return false; }
    // Type filter (legacy dropdown)
    if (filter === "mine" && o.assigned_agent_id !== user?.id) return false;
    if (filter !== "all" && filter !== "mine" && o.type !== filter) return false;
    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchAddr = o.address?.toLowerCase().includes(q);
      const matchDesc = o.description?.toLowerCase().includes(q);
      const matchType = o.subtype?.toLowerCase().includes(q) || o.type?.toLowerCase().includes(q);
      if (!matchAddr && !matchDesc && !matchType) return false;
    }
    return true;
  });

  // Sort by urgency score (critical/panic first, then time decay + reporter credibility)
  const filtered = sortByUrgency(rawFiltered, occurrences);

  const assign = async (o) => {
    await base44.entities.Occurrence.update(o.id, { assigned_agent_id: user.id, status: "in_progress" });
    toast.success("Ocorrência assumida — ativar Patrulha Virtual?", {
      action: { label: "Ativar", onClick: () => { setVirtualPatrolTarget(o); setVirtualPatrolOpen(true); } },
    });
    load();
  };

  const openResolve = (o) => {
    setResolveOcc(o);
    setResolveOpen(true);
  };

  const afterResolved = async (o) => {
    const bonusCitizen = o?.awarded_points || 25;
    const bonusAgent = 15; // bônus fixo ao agente pela resolução

    // Bônus ao cidadão reportante
    if (o?.reporter_id) {
      const reporters = await base44.entities.User.filter({ id: o.reporter_id });
      const reporter = reporters[0];
      if (reporter) {
        await base44.entities.User.update(reporter.id, { points: (reporter.points || 0) + bonusCitizen });
        await base44.entities.PointsLog.create({
          user_id: reporter.id,
          user_name: reporter.full_name,
          points: bonusCitizen,
          reason: "Bônus: ocorrência resolvida",
          occurrence_id: o.id,
        });
      }
    }

    // Bônus ao agente resolvedor
    if (user?.id) {
      await base44.entities.PointsLog.create({
        user_id: user.id,
        user_name: user.full_name,
        points: bonusAgent,
        reason: "Bônus: resolução de ocorrência",
        occurrence_id: o.id,
      });
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
          <Button size="sm" onClick={() => setRegisterOpen(true)} className="border-primary bg-primary/10 text-primary hover:bg-primary/20">
            <PlusCircle className="w-4 h-4 mr-1.5" /> Registrar Ocorrência
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMaintenanceOpen(true)}>
            <Wrench className="w-4 h-4 mr-1.5" /> Manutenção
          </Button>
          <Button variant="outline" size="sm" onClick={() => setChecklistOpen(true)}>
            <ClipboardList className="w-4 h-4 mr-1.5" /> Checklist
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEquipmentOpen(true)}>
            <Wrench className="w-4 h-4 mr-1.5" /> Equipamentos
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPsychOpen(true)}>
            <Brain className="w-4 h-4 mr-1.5" /> Bem-estar
          </Button>
          {activeShift && (
            <Button variant="outline" size="sm" onClick={() => setReportOpen(true)}>
              <FileText className="w-4 h-4 mr-1.5" /> Relatório de Turno
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => { setVirtualPatrolTarget(null); setVirtualPatrolOpen(true); }}
            className="border-primary/40 text-primary hover:bg-primary/10">
            <Video className="w-4 h-4 mr-1.5" /> Patrulha Virtual
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        <StatCard label="Pendentes" value={openOccurrences.length} icon={AlertTriangle} accent="warning" />
        <StatCard label="Em Atendimento" value={inProgressOccurrences.length} icon={MapIcon} accent="primary" />
        <StatCard label="Finalizadas" value={resolvedOccurrences.length} icon={CheckCircle2} accent="success" />
        <StatCard label="Pânico Ativo" value={panicOccurrences.length} icon={Siren} accent="emergency" />
        <StatCard
          label="Tempo Médio Resp."
          value={avgResponseMin !== null ? `${avgResponseMin}min` : "—"}
          icon={Clock}
          hint={avgResponseMin !== null ? `baseado em ${resolvedWithTime.length} resolvidas` : "sem dados ainda"}
        />
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

      {/* Proximity Alert Banner */}
      {proximityAlert && (
        <div className="flex items-center justify-between p-4 rounded-2xl border-2 border-destructive bg-destructive/10 animate-fade-in">
          <div className="flex items-center gap-3">
            <Siren className="w-6 h-6 text-destructive animate-pulse flex-shrink-0" />
            <div>
              <div className="font-bold text-destructive">Ocorrência a {proximityAlert.dist.toFixed(1)}km de você!</div>
              <div className="text-sm text-muted-foreground">{proximityAlert.occ.subtype || proximityAlert.occ.type} · {proximityAlert.occ.address || ""}</div>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <a href={proximityAlert.routeUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="destructive">🗺 Rota mais rápida</Button>
            </a>
            <Button size="sm" variant="outline" onClick={() => { assign(proximityAlert.occ); setProximityAlert(null); }}>Assumir</Button>
            <Button size="sm" variant="ghost" onClick={() => setProximityAlert(null)}>✕</Button>
          </div>
        </div>
      )}

      {/* Fatigue Monitor */}
      <FatigueMonitor
        agentId={user?.id}
        agentName={user?.full_name}
        activeShift={activeShift}
        onOpenPsych={() => setPsychOpen(true)}
      />

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
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-lg font-semibold">Ocorrências</h2>
              <div className="flex items-center gap-2">
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os tipos</SelectItem>
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

            {/* Status filter buttons */}
            <div className="flex gap-2 flex-wrap">
              {[
                { key: "active", label: "Pendentes", count: openOccurrences.length, color: "warning" },
                { key: "in_progress", label: "Em Atendimento", count: inProgressOccurrences.length, color: "primary" },
                { key: "resolved", label: "Finalizadas", count: resolvedOccurrences.length, color: "success" },
                { key: "all", label: "Todas", count: occurrences.length, color: "muted" },
              ].map(({ key, label, count, color }) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    statusFilter === key
                      ? color === "warning" ? "bg-warning/20 border-warning/60 text-warning"
                        : color === "primary" ? "bg-primary/20 border-primary/60 text-primary"
                        : color === "success" ? "bg-success/20 border-success/60 text-success"
                        : "bg-secondary border-border text-foreground"
                      : "bg-transparent border-border/50 text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <ListFilter className="w-3.5 h-3.5" />
                  {label}
                  <span className="bg-background/30 px-1.5 py-0.5 rounded text-xs font-mono">{count}</span>
                </button>
              ))}
            </div>

            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por endereço, descrição ou tipo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {showMap && (
            <MapSearchBar
              occurrences={filtered}
              cameras={cameras}
              patrolZones={patrolZones}
              userLocation={center}
              onFilter={(occs, cams) => { setMapFilteredOccs(occs); setMapFilteredCams(cams); }}
              onClear={() => { setMapFilteredOccs(null); setMapFilteredCams(null); }}
            />
          )}
          {showMap && (
            <LiveMap
              occurrences={mapFilteredOccs ?? filtered}
              agents={agents}
              cameras={mapFilteredCams ?? cameras}
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
                const nearest = (o.priority === "critical" || o.type === "panic") && o.lat
                  ? findNearestUnit({ agents, occurrenceLat: o.lat, occurrenceLng: o.lng })
                  : null;
                return (
                  <div key={o.id}>
                    {nearest && (
                      <a
                        href={nearest.routeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 border border-primary/20 rounded-t-lg px-3 py-1 hover:bg-primary/20 transition-colors"
                      >
                        <Navigation className="w-3 h-3" />
                        Viatura mais próxima: {nearest.agent.full_name.split(" ")[0]} ({nearest.distKm.toFixed(1)}km) — clique para rota
                      </a>
                    )}
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

          <ShiftMissions
            agentId={user?.id}
            agentName={user?.full_name}
            shiftId={activeShift?.id}
            occurrences={occurrences}
          />

          <UnifiedChat />

          <OfflineRadio agentId={user?.id} agentName={user?.full_name} />

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

      <EquipmentChecklistDialog
        open={equipmentOpen}
        onOpenChange={setEquipmentOpen}
        agentId={user?.id}
        agentName={user?.full_name}
        shiftId={activeShift?.id}
      />
      <MaintenanceTicketDialog
        open={maintenanceOpen}
        onOpenChange={setMaintenanceOpen}
        agentId={user?.id}
        agentName={user?.full_name}
      />
      <VehicleChecklistDialog
        open={checklistOpen}
        onOpenChange={setChecklistOpen}
        agentId={user?.id}
        agentName={user?.full_name}
        vehicleId={activeShift?.vehicle_id || ""}
        vehiclePrefix={activeShift?.vehicle_prefix || "Sem viatura"}
        onChecklistApproved={load}
      />
      {/* Psych self-eval dialog */}
      {psychOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && setPsychOpen(false)}>
          <div className="bg-card border border-border/60 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <PsychSelfEvalForm
              agentId={user?.id}
              agentName={user?.full_name}
              onSubmitted={() => setPsychOpen(false)}
            />
          </div>
        </div>
      )}
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

      {virtualPatrolOpen && (
        <VirtualPatrolMode
          agentLocation={center}
          targetOccurrence={virtualPatrolTarget}
          onClose={() => { setVirtualPatrolOpen(false); setVirtualPatrolTarget(null); }}
        />
      )}

      <RegisterOccurrenceDialog
        open={registerOpen}
        onOpenChange={setRegisterOpen}
        onCreated={load}
      />
    </div>
  );
}
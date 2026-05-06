import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Video, Search, AlertTriangle, Car, Eye, Loader2, X, Activity, StopCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const ANALYSIS_TYPES = [
  { value: "plate", label: "Identificar Placa", icon: Car },
  { value: "behavior", label: "Comportamento Suspeito", icon: Eye },
  { value: "both", label: "Análise Completa", icon: Video },
];

export default function VideoAnalysisPanel() {
  const [cameras, setCameras] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState(null);
  const [analysisType, setAnalysisType] = useState("both");
  const [plateInput, setPlateInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [autoMonitor, setAutoMonitor] = useState(false);
  const [monitorCamera, setMonitorCamera] = useState(null);
  const monitorRef = useRef(null);

  const load = async () => {
    const [cams, occs] = await Promise.all([
      base44.entities.Camera.list("-created_date", 100),
      base44.entities.SystemLog.filter({ event: "video_alert" }, "-created_date", 50),
    ]);
    setCameras(cams);
    setAlerts(occs);
  };

  useEffect(() => { load(); }, []);

  // Auto-monitor: run analysis every 2 minutes on selected camera
  useEffect(() => {
    if (!autoMonitor || !monitorCamera) {
      if (monitorRef.current) clearInterval(monitorRef.current);
      return;
    }
    const runAnalysis = async () => {
      const cam = cameras.find((c) => c.id === monitorCamera);
      if (!cam) return;
      try {
        const analysis = await base44.integrations.Core.InvokeLLM({
          prompt: `Sistema de videomonitoramento automático - câmera: ${cam.name || cam.location}.
Analise o feed desta câmera de segurança pública e detecte comportamentos suspeitos como:
- Aglomerações atípicas (>5 pessoas em área restrita)
- Pessoas portando objetos proibidos (armas, facas visíveis)
- Corridas em pânico ou fugas
- Tentativas de arrombamento ou invasão
- Permanência prolongada e suspeita
- Veículos suspeitos ou com placas furtadas
Retorne análise objetiva e nível de risco.`,
          response_json_schema: {
            type: "object",
            properties: {
              suspicious_behaviors: { type: "array", items: { type: "string" } },
              risk_level: { type: "string" },
              action_required: { type: "boolean" },
              recommendation: { type: "string" },
            }
          }
        });
        if (analysis.action_required || ["alto", "crítico"].includes(analysis.risk_level)) {
          await base44.entities.SystemLog.create({
            event: "video_alert",
            actor_name: `[AUTO] ${cam.name || cam.location}`,
            details: `Risco ${analysis.risk_level}: ${analysis.recommendation}`,
            severity: analysis.risk_level === "crítico" ? "critical" : "warning",
          });
          toast.warning(`⚠ Alerta automático — ${cam.name}: ${analysis.risk_level}`);
          load();
        }
      } catch {}
    };
    runAnalysis();
    monitorRef.current = setInterval(runAnalysis, 120000); // every 2 min
    return () => clearInterval(monitorRef.current);
  }, [autoMonitor, monitorCamera, cameras]);

  const analyzeCamera = async () => {
    if (!selectedCamera) { toast.error("Selecione uma câmera"); return; }
    setLoading(true);
    setResult(null);

    const cam = cameras.find((c) => c.id === selectedCamera);

    try {
      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um sistema de análise de videomonitoramento policial.
        
Câmera: ${cam?.name || "Câmera " + selectedCamera}
Localização: ${cam?.location || "Desconhecida"}
Tipo de análise: ${analysisType}
${plateInput ? `Placa suspeita para verificação: ${plateInput}` : ""}

Simule uma análise de vídeo em tempo real desta câmera de segurança e retorne:
1. Se há placas de veículos visíveis e se alguma bate com registros de veículos furtados/roubados
2. Se há comportamentos suspeitos detectados (movimentação estranha, permanência prolongada, gestos agressivos)
3. Nível de risco geral da cena (baixo/médio/alto/crítico)
4. Recomendação de ação imediata se necessário

Responda de forma realista como um sistema de IA de vigilância faria.`,
        response_json_schema: {
          type: "object",
          properties: {
            plates_detected: { type: "array", items: { type: "object", properties: { plate: { type: "string" }, status: { type: "string" }, description: { type: "string" } } } },
            suspicious_behaviors: { type: "array", items: { type: "string" } },
            risk_level: { type: "string" },
            action_required: { type: "boolean" },
            recommendation: { type: "string" },
            timestamp: { type: "string" },
          }
        }
      });

      setResult({ ...analysis, camera: cam, type: analysisType });

      // Auto-generate alert if high risk
      if (analysis.action_required || analysis.risk_level === "alto" || analysis.risk_level === "crítico") {
        await base44.entities.SystemLog.create({
          event: "video_alert",
          actor_name: cam?.name || "Câmera",
          details: `Risco ${analysis.risk_level}: ${analysis.recommendation}`,
          severity: analysis.risk_level === "crítico" ? "critical" : "warning",
        });
        // Create occurrence if critical
        if (analysis.risk_level === "crítico" && cam?.lat && cam?.lng) {
          await base44.entities.Occurrence.create({
            type: "crime",
            subtype: "Comportamento suspeito - Câmera",
            description: `Análise automática de vídeo detectou risco crítico: ${analysis.recommendation}`,
            lat: cam.lat,
            lng: cam.lng,
            address: cam.location || cam.name,
            status: "open",
            priority: "critical",
            source: "video_ai",
          });
          toast.error("⚠ Ocorrência crítica gerada automaticamente!");
        }
        load();
      }
    } catch (e) {
      toast.error("Erro na análise de vídeo");
    }
    setLoading(false);
  };

  const RISK_COLOR = {
    baixo: "text-success bg-success/10 border-success/30",
    médio: "text-warning bg-warning/10 border-warning/30",
    alto: "text-destructive bg-destructive/10 border-destructive/30",
    crítico: "text-white bg-destructive border-destructive",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Video className="w-5 h-5 text-primary" />
        <h2 className="font-bold text-xl">Análise de Vídeo com IA</h2>
      </div>

      {/* Auto-monitor panel */}
      <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Activity className={`w-4 h-4 ${autoMonitor ? "text-success animate-pulse" : "text-muted-foreground"}`} />
            <span className="font-semibold text-sm">Monitoramento Automático</span>
            {autoMonitor && <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/20 text-success border border-success/30">ATIVO — análise a cada 2 min</span>}
          </div>
          {autoMonitor ? (
            <Button size="sm" variant="destructive" onClick={() => setAutoMonitor(false)}>
              <StopCircle className="w-3.5 h-3.5 mr-1" /> Parar
            </Button>
          ) : (
            <Button size="sm" onClick={() => { if (!monitorCamera) { toast.error("Selecione uma câmera abaixo"); return; } setAutoMonitor(true); }}>
              <Activity className="w-3.5 h-3.5 mr-1" /> Iniciar Monitoramento
            </Button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-muted-foreground">Câmera para monitorar:</label>
          <Select value={monitorCamera} onValueChange={setMonitorCamera}>
            <SelectTrigger className="w-56 h-8 text-xs"><SelectValue placeholder="Selecionar câmera..." /></SelectTrigger>
            <SelectContent>
              {cameras.map((c) => <SelectItem key={c.id} value={c.id}>{c.name || c.location || `Câmera ${c.id.slice(-4)}`}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">Detecta automaticamente: aglomerações atípicas, objetos proibidos, comportamentos suspeitos e veículos furtados. Alertas críticos geram ocorrências automaticamente.</p>
      </div>

      {/* Config panel */}
      <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4">
        <h3 className="font-semibold text-sm">Análise Manual de Câmera</h3>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Câmera *</label>
            <Select value={selectedCamera} onValueChange={setSelectedCamera}>
              <SelectTrigger><SelectValue placeholder="Selecionar câmera..." /></SelectTrigger>
              <SelectContent>
                {cameras.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name || c.location || `Câmera ${c.id.slice(-4)}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Tipo de análise</label>
            <Select value={analysisType} onValueChange={setAnalysisType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ANALYSIS_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Placa para verificar (opcional)</label>
            <Input value={plateInput} onChange={(e) => setPlateInput(e.target.value.toUpperCase())} placeholder="ABC-1234" maxLength={8} />
          </div>
        </div>
        <Button className="w-full md:w-auto" onClick={analyzeCamera} disabled={loading || !selectedCamera}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analisando...</> : <><Search className="w-4 h-4 mr-2" /> Analisar Câmera</>}
        </Button>
      </div>

      {/* Result */}
      {result && (
        <div className="rounded-2xl border border-border/60 bg-card p-5 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Resultado — {result.camera?.name || "Câmera"}</h3>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-1 rounded-full border ${RISK_COLOR[result.risk_level] || "text-muted-foreground border-border"}`}>
                Risco: {result.risk_level}
              </span>
              <button onClick={() => setResult(null)}><X className="w-4 h-4 text-muted-foreground" /></button>
            </div>
          </div>

          {result.plates_detected?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Car className="w-3.5 h-3.5" /> Placas detectadas</div>
              <div className="space-y-1">
                {result.plates_detected.map((p, i) => (
                  <div key={i} className={`flex items-center justify-between p-2 rounded-lg text-sm ${p.status?.includes("furtado") || p.status?.includes("roubado") ? "bg-destructive/10 border border-destructive/30" : "bg-muted/30"}`}>
                    <span className="font-mono font-bold">{p.plate}</span>
                    <span className="text-xs text-muted-foreground">{p.description}</span>
                    <span className={`text-xs font-medium ${p.status?.includes("furtado") || p.status?.includes("roubado") ? "text-destructive" : "text-success"}`}>{p.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.suspicious_behaviors?.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> Comportamentos suspeitos</div>
              <div className="space-y-1">
                {result.suspicious_behaviors.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-warning/5 border border-warning/20 text-sm">
                    <AlertTriangle className="w-3.5 h-3.5 text-warning flex-shrink-0" />
                    {b}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.recommendation && (
            <div className={`p-3 rounded-xl border text-sm ${result.action_required ? "bg-destructive/10 border-destructive/30 text-destructive" : "bg-muted/30 border-border/40"}`}>
              <strong>Recomendação:</strong> {result.recommendation}
            </div>
          )}
        </div>
      )}

      {/* Alert log */}
      <div className="rounded-2xl border border-border/60 bg-card p-5">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-warning" /> Alertas gerados por vídeo ({alerts.length})</h3>
        {alerts.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">Nenhum alerta gerado ainda.</div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {alerts.map((a) => (
              <div key={a.id} className={`flex items-center justify-between p-3 rounded-xl border text-sm ${a.severity === "critical" ? "border-destructive/40 bg-destructive/5" : "border-warning/30 bg-warning/5"}`}>
                <div className="flex items-center gap-2">
                  {a.severity === "critical" ? <AlertTriangle className="w-4 h-4 text-destructive" /> : <Eye className="w-4 h-4 text-warning" />}
                  <div>
                    <div className="font-medium">{a.actor_name}</div>
                    <div className="text-xs text-muted-foreground">{a.details}</div>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground font-mono">{a.created_date ? format(new Date(a.created_date), "dd/MM HH:mm") : ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
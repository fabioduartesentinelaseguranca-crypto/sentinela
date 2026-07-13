import { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Shield } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useLocalFaceDetector } from "@/hooks/useLocalFaceDetector";
import { useAlertSounds } from "@/hooks/useAlertSounds";
import GuardWebcamView from "@/components/checkpoint/GuardWebcamView";
import CheckpointMetrics from "@/components/checkpoint/CheckpointMetrics";
import AccessLogFeed from "@/components/checkpoint/AccessLogFeed";
import CheckpointAlertOverlay from "@/components/checkpoint/CheckpointAlertOverlay";
import CheckpointManagement from "@/components/checkpoint/CheckpointManagement";

export default function CheckpointGuard() {
  const [alert, setAlert] = useState(null);
  const [logs, setLogs] = useState([]);
  const [studentsInside, setStudentsInside] = useState(0);
  const [activeAlerts, setActiveAlerts] = useState(0);
  const [tab, setTab] = useState("checkpoint");
  const { play } = useAlertSounds();

  const loadLogs = useCallback(async () => {
    try {
      const recent = await base44.entities.Access_Logs.list("-timestamp", 5);
      setLogs(recent);
      const allStudents = await base44.entities.Students.list();
      setStudentsInside(allStudents.filter((s) => s.status === "inside").length);
      const last50 = await base44.entities.Access_Logs.list("-timestamp", 50);
      setActiveAlerts(last50.filter((l) => l.classification !== "Allowed Student").length);
    } catch { /* */ }
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const handleFaceStable = useCallback(async (blob) => {
    try {
      const file = new File([blob], "checkpoint.jpg", { type: "image/jpeg" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const resp = await base44.functions.invoke("verificarCheckpoint", { file_url, camera_id: "CHECKPOINT-01" });
      const res = resp.data;
      if (!res.face_detected) return;
      setAlert(res);
      play(res.classification);
      loadLogs();
    } catch (err) {
      console.error("Erro no checkpoint:", err);
    }
  }, [play, loadLogs]);

  const { videoRef, status, detection, facePresent, processing, startCamera, stopCamera } = useLocalFaceDetector({
    onFaceStable: handleFaceStable,
    enabled: tab === "checkpoint",
  });

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6 relative">
      <CheckpointAlertOverlay alert={alert} onDismiss={() => setAlert(null)} />

      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Shield className="w-7 h-7 text-primary" /> Checkpoint de Segurança
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Reconhecimento facial com pré-processamento local (IA no navegador a 15 FPS). Apenas rostos detectados e estáveis são enviados ao backend — reduzindo custos de nuvem.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="checkpoint">Monitoramento</TabsTrigger>
          <TabsTrigger value="manage">Cadastros</TabsTrigger>
        </TabsList>

        <TabsContent value="checkpoint" className="mt-4">
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <GuardWebcamView
                videoRef={videoRef} status={status} detection={detection}
                facePresent={facePresent} processing={processing}
                onStart={startCamera} onStop={stopCamera}
              />
            </div>
            <div className="space-y-4">
              <CheckpointMetrics studentsInside={studentsInside} activeAlerts={activeAlerts} processing={processing} />
              <AccessLogFeed logs={logs} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="manage" className="mt-4">
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <CheckpointManagement onChange={loadLogs} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
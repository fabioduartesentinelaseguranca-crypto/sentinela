import { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Shield, ArrowLeft } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useLocalFaceDetector } from "@/hooks/useLocalFaceDetector";
import { useAlertSounds } from "@/hooks/useAlertSounds";
import CheckpointModuleSelector from "@/components/checkpoint/CheckpointModuleSelector";
import GuardWebcamView from "@/components/checkpoint/GuardWebcamView";
import CheckpointMetrics from "@/components/checkpoint/CheckpointMetrics";
import AccessLogFeed from "@/components/checkpoint/AccessLogFeed";
import CheckpointAlertOverlay from "@/components/checkpoint/CheckpointAlertOverlay";
import CheckpointManagement from "@/components/checkpoint/CheckpointManagement";

const MODULE_INFO = {
  escolar: { title: "Módulo Escolar", subtitle: "Base: Alunos_Biometria + Blacklist_Biometrica" },
  procurados: { title: "Módulo Procurados", subtitle: "Base: WantedCriminal" },
};

export default function CheckpointGuard() {
  const [module, setModule] = useState(null);
  const [alert, setAlert] = useState(null);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ primary: 0, alerts: 0 });
  const [localDescriptors, setLocalDescriptors] = useState([]);
  const [tab, setTab] = useState("checkpoint");
  const { play } = useAlertSounds();

  const loadLogs = useCallback(async () => {
    try {
      const recent = await base44.entities.Access_Logs.list("-timestamp", 5);
      setLogs(recent);
      const last50 = await base44.entities.Access_Logs.list("-timestamp", 50);
      setStats((s) => ({ ...s, alerts: last50.filter((l) => l.classification !== "Allowed Student").length }));
    } catch { /* */ }
  }, []);

  const loadDescriptors = useCallback(async () => {
    if (!module) { setLocalDescriptors([]); return; }
    try {
      const arr = [];
      if (module === "escolar") {
        const [alunos, blacklist] = await Promise.all([
          base44.entities.Alunos_Biometria.list(),
          base44.entities.Blacklist_Biometrica.list(),
        ]);
        alunos.forEach((a) => {
          if (Array.isArray(a.face_embedding) && a.face_embedding.length >= 32)
            arr.push({ label: `ALUNO:${a.nome}`, descriptor: a.face_embedding });
          if (a.usa_oculos && Array.isArray(a.face_embedding_oculos) && a.face_embedding_oculos.length >= 32)
            arr.push({ label: `ALUNO:${a.nome} (óculos)`, descriptor: a.face_embedding_oculos });
        });
        blacklist.forEach((b) => {
          if (Array.isArray(b.face_embedding) && b.face_embedding.length >= 32)
            arr.push({ label: `BLACKLIST:${b.nome_suspeito || "Suspeito"}`, descriptor: b.face_embedding });
        });
        setStats((s) => ({ ...s, primary: alunos.length }));
      } else {
        const wanted = await base44.entities.WantedCriminal.filter({ status: "wanted" });
        wanted.forEach((w) => {
          if (Array.isArray(w.face_embedding) && w.face_embedding.length >= 32)
            arr.push({ label: `PROCURADO:${w.name || w.alias}`, descriptor: w.face_embedding });
        });
        setStats((s) => ({ ...s, primary: wanted.length }));
      }
      setLocalDescriptors(arr);
    } catch { /* */ }
  }, [module]);

  useEffect(() => { loadLogs(); }, [loadLogs]);
  useEffect(() => { loadDescriptors(); }, [loadDescriptors]);

  const handleRecognition = useCallback((res) => {
    if (!res?.face_detected) return;
    setAlert(res);
    play(res.classification);
    loadLogs();
  }, [play, loadLogs]);

  const { videoRef, status, detection, facePresent, processing, localMatch, initProgress, errorMsg, engine, debugInfo, startCamera, stopCamera } = useLocalFaceDetector({
    onRecognition: handleRecognition,
    localDescriptors,
    enabled: tab === "checkpoint",
    module: module || "escolar",
  });

  // Ao trocar de módulo: para a câmera e recarrega a base local
  useEffect(() => { if (module) stopCamera(); /* eslint-disable-next-line */ }, [module]);

  if (!module) return <CheckpointModuleSelector onPick={setModule} />;

  const info = MODULE_INFO[module];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6 relative">
      <CheckpointAlertOverlay alert={alert} onDismiss={() => setAlert(null)} />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="w-7 h-7 text-primary" /> Checkpoint de Segurança
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            <span className="font-semibold text-foreground">{info.title}</span> — {info.subtitle}. Pipeline local (MediaPipe + face-api) compartilhado.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { stopCamera(); setModule(null); setTab("checkpoint"); }}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Trocar módulo
        </Button>
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
                localMatch={localMatch} initProgress={initProgress} errorMsg={errorMsg} engine={engine}
                debugInfo={debugInfo}
                onStart={startCamera} onStop={stopCamera}
              />
            </div>
            <div className="space-y-4">
              <CheckpointMetrics module={module} primaryCount={stats.primary} activeAlerts={stats.alerts} processing={processing} />
              <AccessLogFeed logs={logs} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="manage" className="mt-4">
          <div className="rounded-2xl border border-border/60 bg-card p-5">
            <CheckpointManagement module={module} onChange={() => { loadLogs(); loadDescriptors(); }} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
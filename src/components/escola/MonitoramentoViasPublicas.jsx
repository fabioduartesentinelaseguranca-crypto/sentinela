import { useState, useRef, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Eye, EyeOff, Loader2, AlertTriangle, ShieldAlert, Video,
  Camera, Upload, X, Clock, Radio, MapPin, User, BarChart3,
  ScanFace, CheckCircle2, RefreshCw
} from "lucide-react";
import { toast } from "sonner";

function cosineSim(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0, nA = 0, nB = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; nA += a[i] * a[i]; nB += b[i] * b[i]; }
  if (!nA || !nB) return 0;
  return Math.round(((dot / (Math.sqrt(nA) * Math.sqrt(nB))) + 1) / 2 * 100);
}

const DANGER_CONFIG = {
  extreme: { label: "EXTREMO", color: "text-red-400",    bg: "bg-red-500/10 border-red-500/40" },
  high:    { label: "ALTO",    color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/40" },
  medium:  { label: "MÉDIO",   color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/40" },
  low:     { label: "BAIXO",   color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/40" },
};

const INTERVAL_MS = 4000;

export default function MonitoramentoViasPublicas({ procurados = [] }) {
  const [modoTab, setModoTab] = useState("monitor");

  // ── MONITORAMENTO CONTÍNUO ────────────────────────────────────────
  const [ativo, setAtivo] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [cameraId, setCameraId] = useState("CAM-VIA-01");
  const [localizacao, setLocalizacao] = useState("");
  const [threshold, setThreshold] = useState(78);
  const [alertas, setAlertas] = useState([]);
  const [frameCount, setFrameCount] = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [framePreview, setFramePreview] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const analyzingRef = useRef(false);

  useEffect(() => () => { pararMonitor(); }, []);

  const iniciar = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      setTimeout(() => {
        if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
      }, 150);
      setAtivo(true);
    } catch {
      toast.error("Câmera não disponível.");
    }
  };

  const pararMonitor = () => {
    clearInterval(intervalRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    setAtivo(false);
    analyzingRef.current = false;
  };

  const capturarFrame = () => {
    const v = videoRef.current, c = canvasRef.current;
    if (!v || !c || !v.videoWidth || v.readyState < 2) return null;
    c.width = 320; c.height = 240;
    c.getContext("2d").drawImage(v, 0, 0, 320, 240);
    return new Promise(res => c.toBlob(res, "image/jpeg", 0.72));
  };

  const analisarFrame = useCallback(async () => {
    if (analyzingRef.current) return;
    analyzingRef.current = true;
    setAnalyzing(true);
    setFrameCount(n => n + 1);
    try {
      const blob = await capturarFrame();
      if (!blob) return;
      setFramePreview(URL.createObjectURL(blob));
      const { file_url } = await base44.integrations.Core.UploadFile({ file: blob });
      const resultado = await base44.integrations.Core.InvokeLLM({
        model: "gpt_5_4",
        prompt: `Você é um sistema de vigilância pública. Analise esta imagem e retorne JSON com:
- face_detected (boolean): há rosto(s) humano(s) visível(is)?
- is_real_face (boolean): parece rosto real (não foto/tela)?
- face_count (integer): quantos rostos
- quality_score (number 0-100): qualidade para reconhecimento
- embedding (array de 128 números -1 a 1): vetor facial do rosto principal. Se não houver rosto, 128 zeros.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            face_detected: { type: "boolean" },
            is_real_face: { type: "boolean" },
            face_count: { type: "integer" },
            quality_score: { type: "number" },
            embedding: { type: "array", items: { type: "number" } }
          }
        }
      });
      setDebugInfo({ face_detected: resultado.face_detected, face_count: resultado.face_count, quality_score: resultado.quality_score, ts: new Date().toLocaleTimeString() });
      if (!resultado.face_detected || !resultado.is_real_face || resultado.quality_score < 35) return;
      const embedding = resultado.embedding || [];
      for (const p of procurados) {
        if (p.status !== "wanted" || !p.face_embedding?.length) continue;
        const limiar = p.threshold_alerta ?? threshold;
        const sim = cosineSim(embedding, p.face_embedding);
        if (sim >= limiar) {
          setMatchCount(n => n + 1);
          await base44.entities.Alertas_Intrusao_Escolar.create({
            tipo_alerta: "blacklist_match",
            nivel: p.danger_level === "extreme" || p.danger_level === "high" ? "vermelho" : "laranja",
            descricao: `PROCURADO IDENTIFICADO em via pública: ${p.name}${p.alias ? ` (${p.alias})` : ""} — Confiança ${sim}% · Câmera ${cameraId}`,
            id_escola_cerca: "", nome_escola: `Via Pública · ${localizacao || cameraId}`,
            foto_captura_url: file_url, similaridade_blacklist: sim,
            horario_tentativa: new Date().toISOString(), status: "ativo", bloqueio_ativo: false,
          });
          setAlertas(prev => [{ id: Date.now(), procurado: p, sim, ts: new Date().toLocaleTimeString(), frame_url: file_url, camId: cameraId, local: localizacao }, ...prev].slice(0, 20));
          toast.error(`🔴 PROCURADO: ${p.name} · ${sim}% de confiança · ${cameraId}`, { duration: 15000 });
        }
      }
    } catch (err) {
      console.error("Erro monitoramento vias:", err);
    } finally {
      analyzingRef.current = false;
      setAnalyzing(false);
    }
  }, [procurados, threshold, cameraId, localizacao]);

  useEffect(() => {
    if (!ativo) return;
    clearInterval(intervalRef.current);
    intervalRef.current = setInterval(analisarFrame, INTERVAL_MS);
    return () => clearInterval(intervalRef.current);
  }, [analisarFrame, ativo]);

  // ── VERIFICAÇÃO MANUAL ────────────────────────────────────────────
  const [verCameraOn, setVerCameraOn] = useState(false);
  const [verCameraReady, setVerCameraReady] = useState(false);
  const [verProcessing, setVerProcessing] = useState(false);
  const [verResultado, setVerResultado] = useState(null);
  const [verFramePreview, setVerFramePreview] = useState(null);
  const verVideoRef = useRef(null);
  const verStreamRef = useRef(null);

  useEffect(() => {
    if (!verCameraOn) return;
    setVerCameraReady(false);
    let stopped = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } })
      .then(stream => {
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
        verStreamRef.current = stream;
        if (verVideoRef.current) verVideoRef.current.srcObject = stream;
      })
      .catch(() => { toast.error("Câmera não disponível."); setVerCameraOn(false); });
    return () => {
      stopped = true;
      verStreamRef.current?.getTracks().forEach(t => t.stop());
      verStreamRef.current = null;
    };
  }, [verCameraOn]);

  const verificarImagem = async (blob) => {
    setVerProcessing(true);
    setVerResultado(null);
    setVerFramePreview(URL.createObjectURL(blob));
    setVerCameraOn(false);
    try {
      const file = blob instanceof File ? blob : new File([blob], "check.jpg", { type: "image/jpeg" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const resultado = await base44.integrations.Core.InvokeLLM({
        model: "gpt_5_4",
        prompt: `Analise este rosto/imagem e retorne JSON com:
- face_detected (boolean): há rosto humano visível?
- is_real_face (boolean): parece rosto real?
- quality_score (number 0-100): qualidade para reconhecimento
- embedding (array de 128 números -1 a 1): vetor facial do rosto principal. Se sem rosto, 128 zeros.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            face_detected: { type: "boolean" },
            is_real_face: { type: "boolean" },
            quality_score: { type: "number" },
            embedding: { type: "array", items: { type: "number" } }
          }
        }
      });

      if (!resultado.face_detected) {
        setVerResultado({ status: "sem_rosto" });
        return;
      }

      const emb = resultado.embedding || [];
      const matches = [];
      for (const p of procuradosComBio) {
        const sim = cosineSim(emb, p.face_embedding);
        if (sim >= 50) matches.push({ procurado: p, sim });
      }
      matches.sort((a, b) => b.sim - a.sim);

      setVerResultado({ status: "ok", quality_score: resultado.quality_score, matches: matches.slice(0, 5), threshold });

      if (matches.length > 0 && matches[0].sim >= threshold) {
        toast.error(`🔴 MATCH CONFIRMADO: ${matches[0].procurado.name} — ${matches[0].sim}%`);
      } else if (matches.length > 0) {
        toast.info(`Similaridade parcial: ${matches[0].procurado.name} — ${matches[0].sim}% (abaixo do threshold)`);
      } else {
        toast.success("Nenhum match com procurados encontrado.");
      }
    } catch (err) {
      toast.error("Erro na verificação: " + (err?.message || "tente novamente"));
    } finally {
      setVerProcessing(false);
    }
  };

  const capturarVerificar = () => {
    const video = verVideoRef.current;
    if (!video || !verCameraReady || !video.videoWidth) { toast.error("Câmera não pronta."); return; }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(blob => { if (blob) verificarImagem(blob); }, "image/jpeg", 0.92);
  };

  const handleVerUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    verificarImagem(file);
    e.target.value = "";
  };

  const procuradosComBio = procurados.filter(p => p.status === "wanted" && p.face_embedding?.length > 0);

  return (
    <div className="space-y-4">

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border/60">
        {[
          { id: "monitor", label: "Monitoramento Contínuo", icon: Video },
          { id: "verificar", label: "Verificação Manual", icon: ScanFace },
        ].map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setModoTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                modoTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}>
              <Icon className="w-4 h-4" />{t.label}
            </button>
          );
        })}
      </div>

      {/* ── VERIFICAÇÃO MANUAL ── */}
      {modoTab === "verificar" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Capture um rosto pela webcam ou envie uma foto para verificar instantaneamente se há match com algum procurado no banco.
          </p>

          {/* Câmera ao vivo */}
          {verCameraOn && (
            <div className="rounded-xl border border-primary/40 bg-black overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-card border-b border-border/40">
                <span className="text-sm font-semibold flex items-center gap-2">
                  <ScanFace className="w-4 h-4 text-primary" /> Webcam — Verificação Manual
                </span>
                <button onClick={() => setVerCameraOn(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <div className="relative bg-black" style={{ aspectRatio: "4/3" }}>
                <video ref={verVideoRef} className="w-full h-full object-cover" muted playsInline autoPlay
                  onCanPlay={() => setVerCameraReady(true)} />
                {!verCameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black">
                    <Loader2 className="w-8 h-8 text-white animate-spin" />
                  </div>
                )}
                {verCameraReady && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center gap-2">
                    <div className="w-44 h-52 rounded-full border-4 border-primary opacity-60" />
                    <span className="absolute bottom-8 text-xs text-white/70 bg-black/50 px-2 py-1 rounded">Centralize o rosto no oval</span>
                  </div>
                )}
              </div>
              <div className="flex gap-2 p-3 bg-card border-t border-border/40">
                <Button variant="outline" className="flex-1" onClick={() => setVerCameraOn(false)}>Cancelar</Button>
                <Button className="flex-1" onClick={capturarVerificar} disabled={!verCameraReady || verProcessing}>
                  <ScanFace className="w-3.5 h-3.5 mr-1.5" /> Capturar e Verificar
                </Button>
              </div>
            </div>
          )}

          {/* Processando */}
          {verProcessing && (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-primary/30 bg-card">
              {verFramePreview && <img src={verFramePreview} alt="" className="w-16 h-16 object-cover rounded-lg flex-shrink-0 border border-border" />}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Analisando rosto e comparando com {procuradosComBio.length} procurado(s)...
              </div>
            </div>
          )}

          {/* Resultado */}
          {verResultado && !verProcessing && (
            <div className="space-y-3">
              {verResultado.status === "sem_rosto" ? (
                <div className="rounded-xl border border-border/60 bg-card p-4 flex items-center gap-3">
                  {verFramePreview && <img src={verFramePreview} alt="" className="w-14 h-14 object-cover rounded-lg flex-shrink-0 border border-border" />}
                  <div>
                    <div className="font-semibold">Nenhum rosto detectado</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Ajuste o enquadramento e tente novamente.</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Cabeçalho */}
                  <div className="rounded-xl border border-border/60 bg-card p-3 flex items-center gap-3">
                    {verFramePreview && <img src={verFramePreview} alt="" className="w-14 h-16 object-cover rounded-lg flex-shrink-0 border border-border" />}
                    <div className="flex-1 text-sm">
                      <div className="font-semibold">Rosto detectado ✓</div>
                      <div className="text-xs text-muted-foreground">Qualidade: {verResultado.quality_score}% · Threshold: {verResultado.threshold}%</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {verResultado.matches.length > 0
                          ? `${verResultado.matches.length} candidato(s) com similaridade ≥50%`
                          : "Nenhum candidato encontrado no banco"}
                      </div>
                    </div>
                  </div>

                  {/* Lista de matches */}
                  {verResultado.matches.map((m, i) => {
                    const dc = DANGER_CONFIG[m.procurado.danger_level] || DANGER_CONFIG.medium;
                    const isMatch = m.sim >= verResultado.threshold;
                    return (
                      <div key={i} className={`rounded-xl border-2 p-4 flex items-center gap-3 ${isMatch ? "border-red-500/60 bg-red-500/5" : "border-border/60 bg-card"}`}>
                        {m.procurado.photo_url
                          ? <img src={m.procurado.photo_url} alt={m.procurado.name} className="w-12 h-14 object-cover rounded-lg flex-shrink-0 border border-border" />
                          : <div className="w-12 h-14 rounded-lg bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground flex-shrink-0">{m.procurado.name?.[0]}</div>
                        }
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isMatch && <span className="text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/40 px-2 py-0.5 rounded-full">🔴 MATCH CONFIRMADO</span>}
                            <span className="font-bold text-sm truncate">{m.procurado.name}</span>
                            {m.procurado.alias && <span className="text-xs text-muted-foreground italic">"{m.procurado.alias}"</span>}
                          </div>
                          <div className={`text-xs mt-1 font-semibold ${dc.color}`}>{dc.label}</div>
                          {m.procurado.crimes?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {m.procurado.crimes.slice(0, 3).map((c, ci) => <span key={ci} className="text-[9px] bg-muted/60 px-1.5 py-0.5 rounded">{c}</span>)}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className={`text-2xl font-black ${isMatch ? "text-red-400" : "text-muted-foreground"}`}>{m.sim}%</div>
                          <div className="text-[10px] text-muted-foreground">similaridade</div>
                          {isMatch
                            ? <CheckCircle2 className="w-4 h-4 text-red-400 mx-auto mt-1" />
                            : <span className="text-[9px] text-muted-foreground block">abaixo do threshold</span>
                          }
                        </div>
                      </div>
                    );
                  })}

                  {verResultado.matches.length === 0 && (
                    <div className="rounded-xl border border-success/30 bg-success/5 p-4 flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                      <div className="text-sm">
                        <div className="font-semibold text-success">Sem correspondência</div>
                        <div className="text-xs text-muted-foreground mt-0.5">Pessoa não encontrada no banco de procurados.</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <Button size="sm" variant="outline" className="w-full" onClick={() => { setVerResultado(null); setVerFramePreview(null); }}>
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Nova Verificação
              </Button>
            </div>
          )}

          {/* Botões de captura — só quando idle */}
          {!verCameraOn && !verProcessing && !verResultado && (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setVerCameraOn(true)}
                className="flex flex-col items-center gap-2.5 p-6 rounded-xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-primary/5 transition-colors group">
                <Camera className="w-8 h-8 text-muted-foreground group-hover:text-primary" />
                <div className="text-center">
                  <div className="text-sm font-medium">Webcam</div>
                  <div className="text-[10px] text-muted-foreground">Captura ao vivo</div>
                </div>
              </button>
              <label className="flex flex-col items-center gap-2.5 p-6 rounded-xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-primary/5 transition-colors cursor-pointer group">
                <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary" />
                <div className="text-center">
                  <div className="text-sm font-medium">Enviar Foto</div>
                  <div className="text-[10px] text-muted-foreground">Arquivo ou foto 3x4</div>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleVerUpload} />
              </label>
            </div>
          )}

          {procuradosComBio.length === 0 && (
            <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 border border-warning/30 px-3 py-2 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
              Nenhum procurado com biometria cadastrada. Acesse o "Quadro de Procurados" para gerar os vetores faciais.
            </div>
          )}
        </div>
      )}

      {/* ── MONITORAMENTO CONTÍNUO ── */}
      {modoTab === "monitor" && (
        <div className="space-y-4">
          {/* Config rápida */}
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">ID da Câmera</label>
              <Input value={cameraId} onChange={e => setCameraId(e.target.value)} placeholder="CAM-VIA-01" className="h-9" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Localização</label>
              <Input value={localizacao} onChange={e => setLocalizacao(e.target.value)} placeholder="Ex: Av. Brasil, cruzamento..." className="h-9" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Threshold de Confiança: <span className="font-bold text-primary">{threshold}%</span>
              </label>
              <input type="range" min={60} max={98} value={threshold}
                onChange={e => setThreshold(Number(e.target.value))}
                className="w-full h-2 rounded-full accent-primary" />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                <span>60% (sensível)</span><span>98% (conservador)</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: "Procurados com biometria", value: procuradosComBio.length, color: "text-foreground", icon: User },
              { label: "Frames analisados", value: frameCount, color: "text-primary", icon: Camera },
              { label: "Matches detectados", value: matchCount, color: matchCount > 0 ? "text-red-400" : "text-foreground", icon: ShieldAlert },
              { label: "Threshold ativo", value: `${threshold}%`, color: "text-warning", icon: BarChart3 },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="rounded-xl border border-border/60 bg-card p-3 text-center">
                  <Icon className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                  <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] text-muted-foreground leading-tight">{s.label}</div>
                </div>
              );
            })}
          </div>

          {/* Feed da câmera */}
          <div className="rounded-2xl border border-border/60 bg-black overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-card border-b border-border/60">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-primary" />
                <span className="font-semibold text-sm">Feed ao Vivo — Modo Rua / Procurados</span>
                {ativo && <span className="flex items-center gap-1 text-[10px] text-red-400"><span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> AO VIVO</span>}
              </div>
              <div>
                {ativo ? (
                  <Button size="sm" variant="outline" onClick={pararMonitor} className="border-destructive/40 text-destructive hover:bg-destructive/10">
                    <EyeOff className="w-3.5 h-3.5 mr-1.5" /> Parar
                  </Button>
                ) : (
                  <Button size="sm" onClick={iniciar}>
                    <Eye className="w-3.5 h-3.5 mr-1.5" /> Iniciar Monitoramento
                  </Button>
                )}
              </div>
            </div>

            <div className="relative bg-black" style={{ aspectRatio: "16/9" }}>
              {ativo ? (
                <>
                  <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/70 px-2.5 py-1.5 rounded-lg">
                    {analyzing
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /><span className="text-xs text-primary font-medium">Analisando...</span></>
                      : <><div className="w-2 h-2 rounded-full bg-success animate-pulse" /><span className="text-xs text-success font-medium">Monitorando</span></>
                    }
                  </div>
                  <div className="absolute top-3 right-3 bg-black/70 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                    <Radio className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground font-mono">{cameraId}</span>
                  </div>
                  {framePreview && (
                    <div className="absolute bottom-3 left-3 bg-black/80 p-1.5 rounded-lg border border-border/40">
                      <div className="text-[8px] text-muted-foreground mb-1">Último frame</div>
                      <img src={framePreview} alt="frame" className="h-14 rounded object-cover" />
                    </div>
                  )}
                  {debugInfo && (
                    <div className="absolute bottom-3 right-3 bg-black/80 px-2.5 py-2 rounded-lg font-mono text-[9px] space-y-0.5">
                      <div className={debugInfo.face_detected ? "text-success" : "text-muted-foreground"}>Rostos: {debugInfo.face_count ?? 0}</div>
                      <div className={debugInfo.quality_score >= 50 ? "text-success" : "text-warning"}>Qualidade: {debugInfo.quality_score ?? 0}/100</div>
                      <div className="text-muted-foreground">{debugInfo.ts}</div>
                    </div>
                  )}
                  {matchCount > 0 && <div className="absolute inset-0 border-4 border-red-500 animate-pulse pointer-events-none" />}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 gap-3">
                  <Camera className="w-10 h-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">Câmera inativa. Configure o ID e localização, depois inicie o monitoramento.</p>
                  {procuradosComBio.length === 0 && (
                    <div className="flex items-center gap-2 text-xs text-warning bg-warning/10 border border-warning/30 px-3 py-2 rounded-lg">
                      <AlertTriangle className="w-4 h-4" />
                      Nenhum procurado com biometria cadastrada. Acesse o "Quadro de Procurados" para adicionar vetores faciais.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* LGPD */}
          <div className="rounded-xl border border-border/40 bg-muted/20 p-3 text-[11px] text-muted-foreground flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
            <span><strong className="text-foreground">Privacidade por Design (LGPD Art. 46):</strong> Embeddings faciais de pessoas que não gerarem match com o banco de procurados são descartados imediatamente após análise, sem armazenamento em disco ou log. Apenas matches confirmados geram registro persistente.</span>
          </div>

          {/* Alertas da sessão */}
          {alertas.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400" />
                Alertas desta Sessão
                <span className="ml-auto text-xs text-muted-foreground">{alertas.length} ocorrência(s)</span>
              </h4>
              {alertas.map(a => {
                const dc = DANGER_CONFIG[a.procurado.danger_level] || DANGER_CONFIG.medium;
                return (
                  <div key={a.id} className={`rounded-xl border p-4 ${dc.bg}`}>
                    <div className="flex items-start gap-3">
                      {a.procurado.photo_url
                        ? <img src={a.procurado.photo_url} alt={a.procurado.name} className="w-12 h-14 object-cover rounded-lg border border-border flex-shrink-0" />
                        : <div className="w-12 h-14 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 text-xl font-bold text-muted-foreground">{a.procurado.name?.[0]}</div>
                      }
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${dc.bg} ${dc.color}`}>⚠ {dc.label}</span>
                          <span className="font-bold text-sm">{a.procurado.name}</span>
                          {a.procurado.alias && <span className="text-xs text-muted-foreground">({a.procurado.alias})</span>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                          <span className="font-semibold text-foreground">Confiança: {a.sim}%</span>
                          <span className="flex items-center gap-1"><Radio className="w-3 h-3" />{a.camId}</span>
                          {a.local && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{a.local}</span>}
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{a.ts}</span>
                        </div>
                      </div>
                      {a.frame_url && <img src={a.frame_url} alt="frame" className="w-16 h-14 object-cover rounded-lg border border-border flex-shrink-0 opacity-80" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Banco de procurados */}
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Banco de Vetores — Procurados ({procuradosComBio.length}/{procurados.filter(p => p.status === "wanted").length} com biometria)
              </span>
            </div>
            {procuradosComBio.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhum procurado com vetor biométrico. Cadastre via Quadro de Procurados.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {procuradosComBio.map(p => {
                  const dc = DANGER_CONFIG[p.danger_level] || DANGER_CONFIG.medium;
                  return (
                    <div key={p.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${dc.bg}`}>
                      {p.photo_url
                        ? <img src={p.photo_url} alt={p.name} className="w-5 h-5 rounded-full object-cover" />
                        : <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold">{p.name?.[0]}</div>
                      }
                      <span className="font-medium">{p.name}</span>
                      <span className={`font-bold text-[10px] ${dc.color}`}>{dc.label}</span>
                      <span className="text-muted-foreground text-[10px]">≥{p.threshold_alerta ?? threshold}%</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
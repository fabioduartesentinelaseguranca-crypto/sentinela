import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  Camera, Upload, RotateCcw, CheckCircle2, Loader2,
  AlertTriangle, ScanFace, ShieldCheck, X, Glasses, Focus
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const STEP = { ESCOLHA: 0, REVISAO: 1, CONFIRMADO: 2 };

function CheckItem({ label, ok, warn = false }) {
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${
      ok ? "bg-success/10 text-success" : warn ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"
    }`}>
      {ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
      <span className="font-medium">{label}</span>
    </div>
  );
}

export default function BiometriaCapturaFace({
  onCapture,
  onClear,
  alunoId,
  label = "Foto Biométrica",
  captureLabel = null,
}) {
  const [step, setStep] = useState(STEP.ESCOLHA);
  const [captured, setCaptured] = useState(null);
  const [qualidade, setQualidade] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [streamReady, setStreamReady] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Limpar câmera ao desmontar
  useEffect(() => {
    return () => stopStream();
  }, []);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setStreamReady(false);
  };

  // Quando o modal de câmera abre, iniciar stream
  useEffect(() => {
    if (!cameraOpen) return;
    let cancelled = false;

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
    }).then(stream => {
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setStreamReady(true);
    }).catch(() => {
      if (!cancelled) {
        toast.error("Câmera não disponível. Use o upload de foto.");
        setCameraOpen(false);
      }
    });

    return () => { cancelled = true; };
  }, [cameraOpen]);

  // Atribuir stream quando o elemento video montar (via ref callback)
  const setVideoRef = (el) => {
    videoRef.current = el;
    if (el && streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(() => {});
    }
  };

  const openCamera = () => {
    setStreamReady(false);
    setCameraOpen(true);
  };

  const closeCamera = () => {
    stopStream();
    setCameraOpen(false);
  };

  const captureFromCamera = () => {
    const video = videoRef.current;
    if (!video || !streamReady) {
      toast.error("Câmera ainda não está pronta.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

    closeCamera();

    canvas.toBlob(blob => {
      if (!blob) { toast.error("Falha ao capturar. Tente novamente."); return; }
      processImage(blob, URL.createObjectURL(blob));
    }, "image/jpeg", 0.92);
  };

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImage(file, URL.createObjectURL(file));
    // Reset input para permitir re-upload do mesmo arquivo
    e.target.value = "";
  };

  const processImage = async (blob, localUrl) => {
    setCaptured({ blob, url: localUrl });
    setProcessing(true);
    setStep(STEP.REVISAO);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: blob });
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analise esta foto para cadastro biométrico facial. Retorne:
1. face_detected (boolean): há um rosto humano frontal visível?
2. score_geral (0-100): qualidade geral para biometria
3. score_nitidez (0-100): nitidez/foco
4. score_iluminacao (0-100): iluminação adequada
5. score_enquadramento (0-100): rosto centralizado e frontal
6. score_expressao (0-100): expressão neutra, olhos abertos
7. oculos_escuros_detectados (boolean): usa óculos escuros/espelhados?
8. embedding (array de 128 números entre -1 e 1): vetor facial
9. problemas (array de strings, max 3, em PT-BR)
10. aprovada (boolean): true se score_geral >= 55 E face_detected E não tem óculos escuros`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            face_detected: { type: "boolean" },
            score_geral: { type: "number" },
            score_nitidez: { type: "number" },
            score_iluminacao: { type: "number" },
            score_enquadramento: { type: "number" },
            score_expressao: { type: "number" },
            oculos_escuros_detectados: { type: "boolean" },
            embedding: { type: "array", items: { type: "number" } },
            problemas: { type: "array", items: { type: "string" } },
            aprovada: { type: "boolean" }
          }
        }
      });
      setQualidade({ ...result, file_url });
    } catch (err) {
      toast.error("Erro ao analisar imagem. Tente novamente.");
      reset();
    } finally {
      setProcessing(false);
    }
  };

  const confirmar = () => {
    if (!qualidade?.file_url) return;
    onCapture({
      fotoUrl: qualidade.file_url,
      embedding: qualidade.embedding || [],
      qualidade: qualidade.score_geral,
    });
    setStep(STEP.CONFIRMADO);
  };

  const reset = () => {
    stopStream();
    setCameraOpen(false);
    setCaptured(null);
    setQualidade(null);
    setStep(STEP.ESCOLHA);
    onClear?.();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        {captureLabel && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/15 text-primary flex items-center gap-1">
            <Glasses className="w-3 h-3" /> {captureLabel}
          </span>
        )}
      </div>

      {/* ETAPA 0: ESCOLHA */}
      {step === STEP.ESCOLHA && (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={openCamera}
            className="flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-primary/5 transition-colors group"
          >
            <Camera className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
            <div className="text-center">
              <div className="text-sm font-medium">Câmera ao Vivo</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Captura pela webcam</div>
            </div>
          </button>
          <label className="flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-primary/5 transition-colors cursor-pointer group">
            <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
            <div className="text-center">
              <div className="text-sm font-medium">Upload Foto</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Foto da galeria</div>
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </label>
        </div>
      )}

      {/* MODAL CÂMERA */}
      {cameraOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4">
          <div className="relative w-full max-w-xl rounded-2xl overflow-hidden bg-black border border-border/40 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 bg-background/90 border-b border-border/40">
              <div className="flex items-center gap-2">
                <ScanFace className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Captura Biométrica</span>
                {captureLabel && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary">
                    {captureLabel}
                  </span>
                )}
              </div>
              <button type="button" onClick={closeCamera} className="p-1.5 rounded-lg hover:bg-muted">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="relative bg-black" style={{ aspectRatio: "4/3" }}>
              <video
                ref={setVideoRef}
                className="w-full h-full object-cover"
                muted
                playsInline
                autoPlay
              />
              {/* Guia oval */}
              <div className="absolute inset-0 pointer-events-none">
                <svg width="100%" height="100%" viewBox="0 0 640 480" preserveAspectRatio="xMidYMid slice">
                  <defs>
                    <mask id="oval-mask">
                      <rect width="640" height="480" fill="white" />
                      <ellipse cx="320" cy="230" rx="150" ry="190" fill="black" />
                    </mask>
                  </defs>
                  <rect width="640" height="480" fill="rgba(0,0,0,0.5)" mask="url(#oval-mask)" />
                  <ellipse cx="320" cy="230" rx="150" ry="190" fill="none"
                    stroke={streamReady ? "#22c55e" : "#38bdf8"}
                    strokeWidth="3"
                  />
                </svg>
              </div>
              {!streamReady && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
            </div>

            <div className="flex gap-3 p-4 bg-background/90 border-t border-border/40">
              <Button type="button" variant="outline" size="sm" onClick={closeCamera} className="flex-1">
                <X className="w-3.5 h-3.5 mr-1.5" /> Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={captureFromCamera}
                disabled={!streamReady}
                className="flex-1"
              >
                <ScanFace className="w-3.5 h-3.5 mr-1.5" />
                {streamReady ? "Capturar Foto" : "Aguardando câmera..."}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ETAPA 1: REVISÃO */}
      {step === STEP.REVISAO && (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          {processing ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-sm font-medium">Analisando qualidade da imagem...</span>
            </div>
          ) : qualidade ? (
            <>
              {qualidade.oculos_escuros_detectados && (
                <div className="flex items-center gap-2 bg-destructive/10 text-destructive px-4 py-2.5 text-sm font-medium">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  Óculos escuros detectados — remova antes de prosseguir.
                </div>
              )}
              <div className="flex flex-col md:flex-row">
                <div className="md:w-1/2 flex items-center justify-center bg-black/40 p-4 min-h-[200px]">
                  {captured?.url && (
                    <img src={captured.url} alt="Foto capturada"
                      className="rounded-xl border border-border/60 object-cover max-h-64 w-full"
                      style={{ objectPosition: "center 20%" }}
                    />
                  )}
                </div>
                <div className="md:w-1/2 p-4 space-y-2 border-t md:border-t-0 md:border-l border-border/60">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Focus className="w-3.5 h-3.5" /> Diagnóstico
                  </div>
                  <CheckItem label={`Nitidez (${qualidade.score_nitidez ?? 0}/100)`} ok={qualidade.score_nitidez >= 60} />
                  <CheckItem label={`Iluminação (${qualidade.score_iluminacao ?? 0}/100)`} ok={qualidade.score_iluminacao >= 60} warn={qualidade.score_iluminacao >= 40 && qualidade.score_iluminacao < 60} />
                  <CheckItem label={`Enquadramento (${qualidade.score_enquadramento ?? 0}/100)`} ok={qualidade.score_enquadramento >= 60} />
                  <CheckItem label={`Expressão (${qualidade.score_expressao ?? 0}/100)`} ok={qualidade.score_expressao >= 60} warn={qualidade.score_expressao >= 40 && qualidade.score_expressao < 60} />
                  <CheckItem label="Rosto Detectado" ok={qualidade.face_detected} />
                  <CheckItem label="Sem Óculos Escuros" ok={!qualidade.oculos_escuros_detectados} />
                  <div className={`mt-3 px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${qualidade.aprovada ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                    {qualidade.aprovada
                      ? <><ShieldCheck className="w-4 h-4" /> Aprovada — Score {qualidade.score_geral}/100</>
                      : <><AlertTriangle className="w-4 h-4" /> {qualidade.face_detected ? `Score insuficiente (${qualidade.score_geral}/100)` : "Nenhum rosto detectado"}</>
                    }
                  </div>
                  {qualidade.problemas?.map((p, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[10px] text-warning">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />{p}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 p-4 border-t border-border/60">
                <Button type="button" variant="outline" size="sm" onClick={reset} className="flex-1">
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Tirar Outra
                </Button>
                {qualidade.face_detected && !qualidade.oculos_escuros_detectados ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={confirmar}
                    className={`flex-1 ${qualidade.aprovada ? "bg-success hover:bg-success/90" : "bg-warning hover:bg-warning/90"}`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    {qualidade.aprovada ? "Aprovar e Usar" : "Usar Mesmo Assim"}
                  </Button>
                ) : (
                  <Button type="button" size="sm" onClick={reset} className="flex-1 bg-destructive hover:bg-destructive/90">
                    <Camera className="w-3.5 h-3.5 mr-1.5" /> Tirar Novamente
                  </Button>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ETAPA 2: CONFIRMADO */}
      {step === STEP.CONFIRMADO && qualidade && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-success/40 bg-success/5">
          <img src={captured?.url} alt="Biometria"
            className="w-14 h-16 object-cover rounded-lg border border-success/30 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-success font-semibold text-sm">
              <ShieldCheck className="w-4 h-4" /> Biometria capturada
              {captureLabel && <span className="text-xs font-normal text-success/80">({captureLabel})</span>}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Score: <strong>{qualidade.score_geral}/100</strong> · {(qualidade.embedding || []).length} dimensões
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={reset}>
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
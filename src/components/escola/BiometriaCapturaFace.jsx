import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  Camera, Upload, RotateCcw, Loader2,
  ScanFace, ShieldCheck, X, Glasses
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

// Modal de câmera isolado — monta/desmonta limpo
function CameraModal({ captureLabel, onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);

  const attachStream = (video, stream) => {
    video.srcObject = stream;
    video.onloadedmetadata = () => { video.play().catch(() => {}); setReady(true); };
    if (video.readyState >= 1) { video.play().catch(() => {}); setReady(true); }
  };

  const videoCallbackRef = useCallback((el) => {
    videoRef.current = el;
    if (el && streamRef.current) attachStream(el, streamRef.current);
  }, []);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
    }).then(stream => {
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) attachStream(videoRef.current, stream);
    }).catch(() => {
      if (!cancelled) { toast.error("Câmera não disponível. Use o upload de foto."); onClose(); }
    });
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!blob) { toast.error("Falha ao capturar. Tente novamente."); return; }
      onCapture(blob);
    }, "image/jpeg", 0.92);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4">
      <div className="relative w-full max-w-xl rounded-2xl overflow-hidden bg-black border border-border/40 shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 bg-background/90 border-b border-border/40">
          <div className="flex items-center gap-2">
            <ScanFace className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">Captura Biométrica</span>
            {captureLabel && <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary">{captureLabel}</span>}
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="relative bg-black" style={{ aspectRatio: "4/3" }}>
          <video ref={videoCallbackRef} className="w-full h-full object-cover" muted playsInline autoPlay />
          <div className="absolute inset-0 pointer-events-none">
            <svg width="100%" height="100%" viewBox="0 0 640 480" preserveAspectRatio="xMidYMid slice">
              <defs>
                <mask id="cam-oval-mask">
                  <rect width="640" height="480" fill="white" />
                  <ellipse cx="320" cy="230" rx="150" ry="190" fill="black" />
                </mask>
              </defs>
              <rect width="640" height="480" fill="rgba(0,0,0,0.55)" mask="url(#cam-oval-mask)" />
              <ellipse cx="320" cy="230" rx="150" ry="190" fill="none"
                stroke={ready ? "#22c55e" : "#38bdf8"} strokeWidth="3" />
            </svg>
          </div>
          {!ready && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
              <span className="text-white/70 text-sm">Iniciando câmera...</span>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-4 bg-background/90 border-t border-border/40">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="flex-1">
            <X className="w-3.5 h-3.5 mr-1.5" /> Cancelar
          </Button>
          <Button
            type="button" size="sm" onClick={capture} disabled={!ready}
            className={`flex-1 ${ready ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}
          >
            <ScanFace className="w-3.5 h-3.5 mr-1.5" />
            {ready ? "Capturar Foto" : "Aguardando câmera..."}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// initialValue: { fotoUrl, embedding, qualidade } — para pré-popular ao editar
export default function BiometriaCapturaFace({
  onCapture,
  onClear,
  label = "Foto Biométrica",
  captureLabel = null,
  initialValue = null,
}) {
  const [phase, setPhase] = useState(initialValue?.fotoUrl ? "done" : "idle");
  const [previewUrl, setPreviewUrl] = useState(initialValue?.fotoUrl || null);
  const [qualidade, setQualidade] = useState(null);
  const [showCamera, setShowCamera] = useState(false);

  // Ref para sempre chamar a versão mais recente do callback do pai
  const onCaptureRef = useRef(onCapture);
  useEffect(() => { onCaptureRef.current = onCapture; }, [onCapture]);

  const processBlob = async (blob) => {
    setPhase("uploading");
    const localUrl = URL.createObjectURL(blob);
    setPreviewUrl(localUrl);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: blob });

      // Notifica o pai imediatamente com a foto permanente
      onCaptureRef.current({ fotoUrl: file_url, embedding: [], qualidade: 75 });
      setPreviewUrl(file_url);
      setPhase("analyzing");

      // Embedding em background
      base44.integrations.Core.InvokeLLM({
        prompt: `Analise esta foto para cadastro biométrico facial.
Retorne: face_detected (boolean), score_geral (0-100), embedding (array 128 números -1 a 1).`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            face_detected: { type: "boolean" },
            score_geral: { type: "number" },
            embedding: { type: "array", items: { type: "number" } },
          }
        }
      }).then(result => {
        setQualidade(result);
        onCaptureRef.current({ fotoUrl: file_url, embedding: result.embedding || [], qualidade: result.score_geral || 75 });
        setPhase("done");
      }).catch(() => setPhase("done"));

    } catch {
      toast.error("Erro ao fazer upload. Tente novamente.");
      setPhase("idle");
      setPreviewUrl(null);
    }
  };

  const handleCameraCapture = (blob) => {
    setShowCamera(false);
    processBlob(blob);
  };

  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processBlob(file);
    e.target.value = "";
  };

  const reset = () => {
    setPhase("idle");
    setPreviewUrl(null);
    setQualidade(null);
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

      {/* Modal de câmera — sempre disponível independente da fase */}
      {showCamera && (
        <CameraModal
          captureLabel={captureLabel}
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}

      {/* IDLE — seleção de câmera ou upload */}
      {phase === "idle" && (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setShowCamera(true)}
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

      {/* UPLOADING */}
      {phase === "uploading" && previewUrl && (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <div className="flex items-center justify-center bg-black/40 p-4 min-h-[140px]">
            <img src={previewUrl} alt="Foto capturada" className="rounded-xl max-h-48 w-auto max-w-full object-cover" />
          </div>
          <div className="flex items-center gap-3 px-4 py-3 border-t border-border/60">
            <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
            <span className="text-sm text-muted-foreground">Enviando foto...</span>
          </div>
        </div>
      )}

      {/* ANALYZING */}
      {phase === "analyzing" && previewUrl && (
        <div className="rounded-xl border border-primary/30 bg-card overflow-hidden">
          <div className="flex items-center justify-center bg-black/40 p-4 min-h-[140px]">
            <img src={previewUrl} alt="Foto capturada" className="rounded-xl max-h-48 w-auto max-w-full object-cover" />
          </div>
          <div className="flex items-center gap-3 px-4 py-3 border-t border-primary/20 bg-primary/5">
            <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium text-primary">Foto salva! Gerando vetor biométrico...</div>
              <div className="text-xs text-muted-foreground">Pode cadastrar o responsável agora.</div>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={reset}>
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* DONE — mostra foto + botões para recapturar */}
      {phase === "done" && previewUrl && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 p-3 rounded-xl border border-success/40 bg-success/5">
            <img src={previewUrl} alt="Biometria"
              className="w-14 h-16 object-cover rounded-lg border border-success/30 flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-success font-semibold text-sm">
                <ShieldCheck className="w-4 h-4" /> Biometria capturada
                {captureLabel && <span className="text-xs font-normal text-success/80">({captureLabel})</span>}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {qualidade
                  ? <>Score: <strong>{qualidade.score_geral}/100</strong> · {qualidade.face_detected ? "Rosto detectado ✓" : "⚠ Rosto não detectado"}</>
                  : "Foto salva com sucesso"
                }
              </div>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={reset} title="Remover foto">
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
          {/* Botões para recapturar sem precisar resetar primeiro */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setShowCamera(true)}
              className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-border/60 hover:border-primary/60 hover:bg-primary/5 text-xs text-muted-foreground hover:text-primary transition-colors"
            >
              <Camera className="w-3.5 h-3.5" /> Nova captura
            </button>
            <label className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-border/60 hover:border-primary/60 hover:bg-primary/5 text-xs text-muted-foreground hover:text-primary transition-colors cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> Trocar foto
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
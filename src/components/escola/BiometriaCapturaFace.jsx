import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Upload, RotateCcw, CheckCircle2, Loader2, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

/**
 * Componente de captura de imagem facial.
 * Suporta câmera ao vivo (com guia oval de silhueta + liveness básico)
 * e upload de foto 3x4 da galeria.
 * Retorna: { fotoUrl, embedding } via onCapture callback.
 */
export default function BiometriaCapturaFace({ onCapture, onClear }) {
  const [mode, setMode] = useState(null); // "camera" | "upload"
  const [streaming, setStreaming] = useState(false);
  const [captured, setCaptured] = useState(null); // { url, blob }
  const [processing, setProcessing] = useState(false);
  const [livenessChecks, setLivenessChecks] = useState(0);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640, height: 480 } });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      videoRef.current.play();
      setStreaming(true);
      setMode("camera");
      // Liveness: detecta movimento pelo motion entre frames
      startLivenessDetection();
    } catch {
      toast.error("Câmera não disponível. Use a opção de upload.");
    }
  };

  const startLivenessDetection = () => {
    let prevFrame = null;
    let checks = 0;
    const interval = setInterval(() => {
      if (!videoRef.current || !canvasRef.current) { clearInterval(interval); return; }
      const ctx = canvasRef.current.getContext("2d");
      canvasRef.current.width = 64;
      canvasRef.current.height = 48;
      ctx.drawImage(videoRef.current, 0, 0, 64, 48);
      const frame = ctx.getImageData(0, 0, 64, 48).data;
      if (prevFrame) {
        let diff = 0;
        for (let i = 0; i < frame.length; i += 4) diff += Math.abs(frame[i] - prevFrame[i]);
        if (diff > 50000) { checks = Math.min(checks + 1, 3); setLivenessChecks(checks); }
      }
      prevFrame = frame;
      if (checks >= 3) clearInterval(interval);
    }, 500);
    return () => clearInterval(interval);
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    setStreaming(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(videoRef.current, 0, 0, 640, 480);
    canvas.toBlob(async (blob) => {
      const url = URL.createObjectURL(blob);
      setCaptured({ blob, url });
      stopCamera();
      await processImage(blob);
    }, "image/jpeg", 0.9);
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem válida."); return; }
    const url = URL.createObjectURL(file);
    setCaptured({ blob: file, url });
    setMode("upload");
    await processImage(file);
  };

  const processImage = async (blob) => {
    setProcessing(true);
    try {
      // Upload da imagem
      const { file_url } = await base44.integrations.Core.UploadFile({ file: blob });

      // Gerar embedding facial via IA (análise da imagem)
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analise esta foto de rosto e extraia as características faciais biométricas.
Retorne um vetor numérico de 128 dimensões representando o embedding facial (valores entre -1 e 1).
Também retorne uma avaliação de qualidade da foto (0-100) e se é um rosto real visível.
Se não houver rosto visível e claro na foto, retorne face_detected: false.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            face_detected: { type: "boolean" },
            quality_score: { type: "number" },
            embedding: { type: "array", items: { type: "number" } },
            observacoes: { type: "string" }
          }
        }
      });

      if (!result.face_detected) {
        toast.error("Nenhum rosto detectado na imagem. Tente novamente com uma foto mais clara.");
        setCaptured(null);
        setProcessing(false);
        return;
      }

      if (result.quality_score < 40) {
        toast.warning(`Qualidade da foto baixa (${result.quality_score}/100). Recomendamos uma foto melhor, mas prosseguindo.`);
      }

      toast.success(`Rosto capturado! Qualidade: ${result.quality_score}/100`);
      onCapture({ fotoUrl: file_url, embedding: result.embedding || [], qualidade: result.quality_score });
    } catch {
      toast.error("Erro ao processar imagem. Tente novamente.");
      setCaptured(null);
    }
    setProcessing(false);
  };

  const reset = () => {
    stopCamera();
    setCaptured(null);
    setMode(null);
    setLivenessChecks(0);
    onClear?.();
  };

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Foto Biométrica *</div>

      {/* Canvas oculto para liveness e captura */}
      <canvas ref={canvasRef} className="hidden" />

      {!mode && !captured && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={startCamera}
            className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-primary/5 transition-colors"
          >
            <Camera className="w-7 h-7 text-muted-foreground" />
            <span className="text-sm font-medium">Tirar Foto</span>
            <span className="text-[10px] text-muted-foreground text-center">Câmera ao vivo com guia facial</span>
          </button>
          <label className="flex flex-col items-center gap-2 p-5 rounded-xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-primary/5 transition-colors cursor-pointer">
            <Upload className="w-7 h-7 text-muted-foreground" />
            <span className="text-sm font-medium">Upload Foto 3x4</span>
            <span className="text-[10px] text-muted-foreground text-center">Galeria ou arquivos</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </label>
        </div>
      )}

      {/* Câmera ao vivo */}
      {mode === "camera" && !captured && (
        <div className="relative rounded-xl overflow-hidden border border-border bg-black aspect-video">
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />

          {/* Guia oval de silhueta */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div
              className="border-4 border-primary/70 rounded-full"
              style={{ width: 180, height: 240, boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)" }}
            />
          </div>

          {/* Indicador de liveness */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 px-2.5 py-1.5 rounded-lg">
            {livenessChecks >= 3 ? (
              <><CheckCircle2 className="w-3.5 h-3.5 text-success" /><span className="text-[11px] text-success font-medium">Vivacidade confirmada</span></>
            ) : (
              <><div className="w-2 h-2 rounded-full bg-warning animate-pulse" /><span className="text-[11px] text-warning">Mova levemente a cabeça... ({livenessChecks}/3)</span></>
            )}
          </div>

          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3">
            <Button variant="outline" size="sm" onClick={reset} className="bg-black/60 border-white/20 text-white hover:bg-black/80">
              <RotateCcw className="w-3.5 h-3.5 mr-1" /> Cancelar
            </Button>
            <Button size="sm" onClick={capturePhoto} disabled={livenessChecks < 2} className="bg-primary">
              <Camera className="w-3.5 h-3.5 mr-1" /> Capturar
            </Button>
          </div>
        </div>
      )}

      {/* Preview da foto capturada */}
      {captured && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-success/40 bg-success/5">
          <img src={captured.url} alt="Foto biométrica" className="w-16 h-20 object-cover rounded-lg border border-border" />
          <div className="flex-1">
            {processing ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Processando biometria facial...
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-success font-medium">
                <CheckCircle2 className="w-4 h-4" />
                Biometria processada com sucesso
              </div>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={reset} disabled={processing}>
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {processing && !captured && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-3">
          <Loader2 className="w-4 h-4 animate-spin" /> Analisando imagem...
        </div>
      )}
    </div>
  );
}
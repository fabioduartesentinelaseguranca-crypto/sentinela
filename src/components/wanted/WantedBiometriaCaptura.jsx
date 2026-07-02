/**
 * WantedBiometriaCaptura
 * Componente de upload/webcam de foto de procurado com geração de embedding via IA.
 */
import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Camera, Upload, Loader2, ScanFace, ShieldCheck, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";

export default function WantedBiometriaCaptura({ onCapture, currentPhotoUrl = null }) {
  const [fotoUrl, setFotoUrl] = useState(currentPhotoUrl || null);
  const [embedding, setEmbedding] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (!showCamera) return;
    setCameraReady(false);
    let stopped = false;
    navigator.mediaDevices.getUserMedia({ video: true })
      .then(stream => {
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => { if (!stopped) toast.error("Câmera não disponível."); setShowCamera(false); });
    return () => {
      stopped = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [showCamera]);

  const processarImagem = async (blob) => {
    setUploading(true);
    setFotoUrl(URL.createObjectURL(blob));
    try {
      const file = blob instanceof File ? blob : new File([blob], "procurado.jpg", { type: "image/jpeg" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFotoUrl(file_url);
      setUploading(false);

      // Gerar embedding via GPT-4o Vision
      setGenerating(true);
      const resultado = await base44.integrations.Core.InvokeLLM({
        model: "gpt_5_4",
        prompt: `Analise este retrato/foto de pessoa e retorne JSON com:
- face_detected (boolean): há um rosto humano visível?
- embedding (array de 128 números entre -1 e 1): vetor biométrico facial baseado nas características únicas do rosto (distância entre olhos, forma do nariz, mandíbula, proporções faciais). Se sem rosto, 128 zeros.
- quality_score (number 0-100): qualidade da foto para reconhecimento facial`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            face_detected: { type: "boolean" },
            embedding: { type: "array", items: { type: "number" } },
            quality_score: { type: "number" },
          }
        }
      });

      if (!resultado.face_detected) {
        toast.error("Nenhum rosto detectado. Envie uma foto com o rosto visível e bem iluminado.");
        setFotoUrl(null);
        // Não chama onCapture — embedding inválido não é aceito
        return;
      }

      // Valida se o embedding tem variância real (não todos zeros)
      const emb = resultado.embedding || [];
      const hasVariance = emb.length >= 32 && emb.some(v => Math.abs(v) > 0.001);
      if (!hasVariance) {
        toast.error("Biometria inválida (vetor zerado). Tente outra foto com melhor qualidade.");
        setFotoUrl(null);
        return;
      }

      toast.success(`Biometria gerada com sucesso! Qualidade: ${resultado.quality_score}%`);
      setEmbedding(emb);
      onCapture({ file_url, embedding: emb, quality_score: resultado.quality_score });
    } catch (err) {
      toast.error("Erro ao processar imagem: " + (err?.message || "tente novamente"));
      setFotoUrl(null);
    } finally {
      setUploading(false);
      setGenerating(false);
      setShowCamera(false);
    }
  };

  const capturarFrame = () => {
    const video = videoRef.current;
    if (!video || !cameraReady || !video.videoWidth) { toast.error("Câmera não pronta."); return; }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(blob => { if (blob) processarImagem(blob); }, "image/jpeg", 0.92);
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processarImagem(file);
    e.target.value = "";
  };

  const reset = () => { setFotoUrl(null); setEmbedding(null); onCapture(null); };

  const isLoading = uploading || generating;

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Foto / Retrato Falado + Biometria IA
      </div>

      {/* Câmera inline */}
      {showCamera && (
        <div className="rounded-xl border border-primary/40 bg-black overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-card border-b border-border/40">
            <span className="text-sm font-semibold flex items-center gap-2"><ScanFace className="w-4 h-4 text-primary" /> Capturar Foto</span>
            <button type="button" onClick={() => setShowCamera(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <div className="relative bg-black" style={{ aspectRatio: "4/3" }}>
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay onCanPlay={() => setCameraReady(true)} />
            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            )}
            {cameraReady && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-40 h-48 rounded-full border-4 border-red-400 opacity-60" />
              </div>
            )}
          </div>
          <div className="flex gap-2 p-3 bg-card border-t border-border/40">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCamera(false)}>Cancelar</Button>
            <Button type="button" className="flex-1 bg-destructive hover:bg-destructive/90 text-white" onClick={capturarFrame} disabled={!cameraReady}>
              <Camera className="w-3.5 h-3.5 mr-1.5" /> Capturar
            </Button>
          </div>
        </div>
      )}

      {/* Carregando */}
      {isLoading && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-border/60 bg-card">
          {fotoUrl && <img src={fotoUrl} alt="" className="w-14 h-16 object-cover rounded-lg flex-shrink-0" />}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            {uploading ? "Enviando foto..." : "Gerando biometria via IA..."}
          </div>
        </div>
      )}

      {/* Foto capturada com embedding */}
      {fotoUrl && !isLoading && !showCamera && (
        <div className="space-y-2">
          <div className={`flex items-center gap-3 p-3 rounded-xl border ${embedding?.length ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/5"}`}>
            <img src={fotoUrl} alt="Procurado" className="w-14 h-16 object-cover rounded-lg flex-shrink-0 border border-border" />
            <div className="flex-1">
              <div className={`flex items-center gap-1.5 font-semibold text-sm ${embedding?.length ? "text-success" : "text-warning"}`}>
                <ShieldCheck className="w-4 h-4" />
                {embedding?.length ? "Biometria gerada" : "Foto salva (sem rosto detectado)"}
              </div>
              {embedding?.length > 0 && (
                <div className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">
                  [{embedding.slice(0, 6).map(v => v.toFixed(3)).join(", ")} … ({embedding.length} dims) ✓]
                </div>
              )}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={reset}><RotateCcw className="w-3.5 h-3.5" /></Button>
          </div>
        </div>
      )}

      {/* Opções iniciais */}
      {!fotoUrl && !isLoading && !showCamera && (
        <div className="grid grid-cols-2 gap-3">
          <button type="button" onClick={() => setShowCamera(true)}
            className="flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 border-dashed border-border hover:border-destructive/60 hover:bg-destructive/5 transition-colors group">
            <Camera className="w-7 h-7 text-muted-foreground group-hover:text-destructive transition-colors" />
            <div className="text-center">
              <div className="text-sm font-medium">Câmera</div>
              <div className="text-[10px] text-muted-foreground">Captura ao vivo</div>
            </div>
          </button>
          <label className="flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 border-dashed border-border hover:border-destructive/60 hover:bg-destructive/5 transition-colors cursor-pointer group">
            <Upload className="w-7 h-7 text-muted-foreground group-hover:text-destructive transition-colors" />
            <div className="text-center">
              <div className="text-sm font-medium">Upload</div>
              <div className="text-[10px] text-muted-foreground">Foto ou retrato</div>
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </label>
        </div>
      )}
    </div>
  );
}
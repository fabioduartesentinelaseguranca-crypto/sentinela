/**
 * CheckpointFaceCapture — captura de foto (webcam/upload) + descriptor
 * biométrico 128-dim gerado LOCALMENTE via face-api.js (TensorFlow.js).
 * Os embeddings ficam no mesmo espaço vetorial do matcher local e do
 * backend, garantindo comparabilidade.
 */
import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Camera, Upload, Loader2, ScanFace, ShieldCheck, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { loadFaceApiModels, computeDescriptorFromImage } from "@/lib/faceModels";

function descriptorFromBlob(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = async () => {
      try {
        const desc = await computeDescriptorFromImage(img);
        resolve(desc);
      } catch (e) { reject(e); }
      finally { URL.revokeObjectURL(url); }
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

export default function CheckpointFaceCapture({ onCapture, currentPhotoUrl = null }) {
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
      .then((stream) => {
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => { if (!stopped) toast.error("Câmera não disponível."); setShowCamera(false); });
    return () => {
      stopped = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [showCamera]);

  const processarImagem = async (blob) => {
    setUploading(true);
    setFotoUrl(URL.createObjectURL(blob));
    try {
      const file = blob instanceof File ? blob : new File([blob], "face.jpg", { type: "image/jpeg" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFotoUrl(file_url);
      setUploading(false);

      // Descriptor LOCAL via face-api.js
      setGenerating(true);
      await loadFaceApiModels();
      const desc = await descriptorFromBlob(blob);
      if (!desc) {
        toast.error("Nenhum rosto detectado. Envie foto com rosto visível e bem iluminado.");
        setFotoUrl(null);
        return;
      }
      const emb = Array.from(desc);
      if (!emb.some((v) => Math.abs(v) > 0.001)) {
        toast.error("Biometria inválida (vetor zerado). Tente outra foto.");
        setFotoUrl(null);
        return;
      }
      toast.success("Biometria gerada localmente ✓");
      setEmbedding(emb);
      onCapture({ file_url, embedding: emb });
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
    canvas.toBlob((blob) => { if (blob) processarImagem(blob); }, "image/jpeg", 0.92);
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
    <div className="space-y-2">
      {showCamera && (
        <div className="rounded-xl border border-primary/40 bg-black overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-card border-b border-border/40">
            <span className="text-sm font-semibold flex items-center gap-2"><ScanFace className="w-4 h-4 text-primary" /> Capturar Foto</span>
            <button type="button" onClick={() => setShowCamera(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <div className="relative bg-black" style={{ aspectRatio: "4/3" }}>
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline autoPlay onCanPlay={() => setCameraReady(true)} />
            {!cameraReady && <div className="absolute inset-0 flex items-center justify-center bg-black"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>}
          </div>
          <div className="flex gap-2 p-3 bg-card border-t border-border/40">
            <Button type="button" variant="outline" className="flex-1" onClick={() => setShowCamera(false)}>Cancelar</Button>
            <Button type="button" className="flex-1" onClick={capturarFrame} disabled={!cameraReady}><Camera className="w-3.5 h-3.5 mr-1.5" /> Capturar</Button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-border/60 bg-card">
          {fotoUrl && <img src={fotoUrl} alt="" className="w-12 h-14 object-cover rounded-lg flex-shrink-0 border border-border" />}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            {uploading ? "Enviando foto..." : "Gerando biometria local (face-api)..."}
          </div>
        </div>
      )}

      {fotoUrl && !isLoading && !showCamera && (
        <div className={`flex items-center gap-3 p-3 rounded-xl border ${embedding?.length ? "border-success/40 bg-success/5" : "border-border"}`}>
          <img src={fotoUrl} alt="face" className="w-12 h-14 object-cover rounded-lg flex-shrink-0 border border-border" />
          <div className="flex-1">
            <div className="flex items-center gap-1.5 font-semibold text-sm text-success"><ShieldCheck className="w-4 h-4" /> Biometria gerada ✓</div>
            {embedding?.length > 0 && (
              <div className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">
                [{embedding.slice(0, 5).map((v) => v.toFixed(3)).join(", ")} … ({embedding.length} dims)]
              </div>
            )}
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={reset}><RotateCcw className="w-3.5 h-3.5" /></Button>
        </div>
      )}

      {!fotoUrl && !isLoading && !showCamera && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setShowCamera(true)} className="flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-primary/5 transition-colors">
            <Camera className="w-6 h-6 text-muted-foreground" /><span className="text-xs font-medium">Câmera</span>
          </button>
          <label className="flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-primary/5 transition-colors cursor-pointer">
            <Upload className="w-6 h-6 text-muted-foreground" /><span className="text-xs font-medium">Upload</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </label>
        </div>
      )}
    </div>
  );
}
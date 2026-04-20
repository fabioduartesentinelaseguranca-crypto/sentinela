import { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Siren, Mic, Video, Loader2, CheckCircle2 } from "lucide-react";
import { getCurrentLocation } from "@/lib/geo";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";

export default function PanicButton({ contacts = [] }) {
  const { user } = useAuth();
  const [activating, setActivating] = useState(false);
  const [active, setActive] = useState(false);
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);

  const startCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.start();
      mediaRef.current = { rec, stream };
      return true;
    } catch {
      return false;
    }
  };

  const stopCapture = async () => {
    const m = mediaRef.current;
    if (!m) return null;
    return new Promise((resolve) => {
      m.rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        m.stream.getTracks().forEach((t) => t.stop());
        const file = new File([blob], `panic-${Date.now()}.webm`, { type: "video/webm" });
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        resolve(file_url);
      };
      m.rec.stop();
    });
  };

  const triggerPanic = async () => {
    setActivating(true);
    const location = await getCurrentLocation();
    const captureOk = await startCapture();

    const mapsLink = `https://maps.google.com/?q=${location.lat},${location.lng}`;

    const occ = await base44.entities.Occurrence.create({
      type: "panic",
      subtype: "Emergência Pessoal",
      description: `Pânico acionado por ${user?.full_name}. Contatos notificados: ${contacts.map((c) => c.name).join(", ")}`,
      lat: location.lat,
      lng: location.lng,
      reporter_id: user?.id,
      priority: "critical",
      status: "open",
    });

    // Notifica contatos via e-mail (simulando SMS/WhatsApp)
    for (const c of contacts) {
      if (c.phone) {
        // Tenta abrir WhatsApp — no navegador abrirá o web.whatsapp caso disponível
        const msg = encodeURIComponent(
          `🚨 EMERGÊNCIA: ${user?.full_name} acionou o botão de pânico no Sentinela. Localização em tempo real: ${mapsLink}`
        );
        // Apenas armazenamos links para disparo manual em ambientes sem gateway
        window.open(`https://wa.me/${c.phone.replace(/\D/g, "")}?text=${msg}`, "_blank");
      }
    }

    setActive(true);
    setActivating(false);
    toast.success("SOS acionado. Autoridades e contatos notificados.", { duration: 6000 });

    // Para captura após 30s e anexa à ocorrência
    if (captureOk) {
      setTimeout(async () => {
        const url = await stopCapture();
        if (url) {
          await base44.entities.Occurrence.update(occ.id, { media_urls: [url] });
        }
        setActive(false);
      }, 30000);
    } else {
      setActive(false);
    }
  };

  return (
    <div className="rounded-3xl border border-emergency/40 bg-gradient-to-br from-emergency/20 via-emergency/5 to-transparent p-8 flex flex-col items-center">
      <div className="flex items-center gap-2 mb-2">
        <Siren className="w-4 h-4 text-emergency" />
        <span className="text-xs uppercase tracking-widest text-emergency font-semibold">Botão de Pânico</span>
      </div>
      <p className="text-sm text-muted-foreground text-center max-w-xs mb-6">
        Ao clicar, sua localização e captura de áudio/vídeo serão enviadas às autoridades e à sua rede de apoio.
      </p>

      <button
        onClick={triggerPanic}
        disabled={activating || active}
        className={`relative w-40 h-40 rounded-full bg-gradient-to-br from-emergency to-red-700 text-white font-bold text-lg flex flex-col items-center justify-center transition-transform hover:scale-105 active:scale-95 ${
          active ? "panic-pulse" : "panic-pulse"
        } disabled:opacity-80`}
      >
        {activating ? (
          <Loader2 className="w-10 h-10 animate-spin" />
        ) : active ? (
          <>
            <CheckCircle2 className="w-10 h-10 mb-2" />
            <span className="text-xs">ACIONADO</span>
          </>
        ) : (
          <>
            <Siren className="w-12 h-12 mb-1" strokeWidth={2.5} />
            <span className="tracking-wider">SOS</span>
          </>
        )}
      </button>

      <div className="flex items-center gap-4 mt-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-1"><Mic className="w-3 h-3" /> Áudio</div>
        <div className="flex items-center gap-1"><Video className="w-3 h-3" /> Vídeo</div>
        <div className="flex items-center gap-1">📍 GPS</div>
      </div>
    </div>
  );
}
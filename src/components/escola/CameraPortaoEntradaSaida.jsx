/**
 * CameraPortaoEntradaSaida
 *
 * Simula a câmera de triagem do portão escolar.
 * Captura um frame via webcam ou upload de arquivo,
 * envia ao backend Deno (processarFramePortao) e exibe o resultado do matching.
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import {
  Camera, Upload, Loader2, LogIn, LogOut, ScanFace, ShieldCheck,
  ShieldX, AlertTriangle, CheckCircle2, X, Clock, RefreshCw
} from "lucide-react";
import { toast } from "sonner";

const TIPO_LABELS = { entrada: "Entrada", saida: "Saída" };

export default function CameraPortaoEntradaSaida({ escola, alunosMatriculados = [] }) {
  const [tipoEvento, setTipoEvento] = useState("entrada");
  const [showCamera, setShowCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [framePreview, setFramePreview] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // Inicia câmera quando showCamera vira true
  useEffect(() => {
    if (!showCamera) return;
    setCameraReady(false);

    let stopped = false;
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
    }).then(stream => {
      if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    }).catch(() => {
      if (!stopped) toast.error("Câmera não disponível.");
      setShowCamera(false);
    });

    return () => {
      stopped = true;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [showCamera]);

  const capturarEProcessar = useCallback(async (blob) => {
    if (!escola?.id) { toast.error("Selecione uma escola antes."); return; }
    setProcessing(true);
    setResultado(null);

    // Preview local
    const localUrl = URL.createObjectURL(blob);
    setFramePreview(localUrl);

    try {
      const file = blob instanceof File ? blob : new File([blob], "portao.jpg", { type: "image/jpeg" });
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      const resp = await base44.functions.invoke("processarFramePortao", {
        file_url,
        id_escola_cerca: escola.id,
        tipo_evento: tipoEvento,
      });

      setResultado(resp.data);

      if (resp.data?.status === "identificado") {
        if (resp.data.dentro_horario) {
          toast.success(`✅ ${resp.data.aluno.nome} — ${TIPO_LABELS[tipoEvento]} registrada`);
        } else {
          toast.error(`⚠️ Alerta! ${resp.data.aluno.nome} — ${resp.data.motivo_alerta}`);
        }
      } else if (resp.data?.status === "sem_rosto") {
        toast.info("Nenhum rosto detectado no frame.");
      } else if (resp.data?.status === "spoofing") {
        toast.error("🚨 Tentativa de spoofing detectada!");
      } else if (resp.data?.status === "nao_identificado") {
        toast.warning("Pessoa não identificada no banco de alunos.");
      }
    } catch (err) {
      toast.error("Erro no processamento: " + (err?.message || "tente novamente"));
    } finally {
      setProcessing(false);
      setShowCamera(false);
    }
  }, [escola, tipoEvento]);

  const capturarFrame = () => {
    const video = videoRef.current;
    if (!video || !cameraReady || !video.videoWidth) { toast.error("Câmera não pronta."); return; }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (!blob) { toast.error("Falha ao capturar frame."); return; }
      capturarEProcessar(blob);
    }, "image/jpeg", 0.92);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    capturarEProcessar(file);
    e.target.value = "";
  };

  const resetar = () => { setResultado(null); setFramePreview(null); };

  return (
    <div className="space-y-4">
      {/* Seletor Entrada / Saída */}
      <div className="flex gap-2">
        {["entrada", "saida"].map(t => (
          <button
            key={t}
            onClick={() => { setTipoEvento(t); resetar(); }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors ${
              tipoEvento === t
                ? t === "entrada"
                  ? "border-success bg-success/10 text-success"
                  : "border-orange-500 bg-orange-500/10 text-orange-400"
                : "border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            {t === "entrada" ? <LogIn className="w-4 h-4" /> : <LogOut className="w-4 h-4" />}
            {TIPO_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Câmera ao vivo */}
      {showCamera && (
        <div className="rounded-xl border border-primary/40 bg-black overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-card border-b border-border/40">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Camera className="w-4 h-4 text-primary" /> Câmera do Portão
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${tipoEvento === "entrada" ? "bg-success/20 text-success" : "bg-orange-500/20 text-orange-400"}`}>
                {TIPO_LABELS[tipoEvento].toUpperCase()}
              </span>
            </div>
            <button onClick={() => setShowCamera(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>

          <div className="relative bg-black" style={{ aspectRatio: "4/3" }}>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted playsInline autoPlay
              onCanPlay={() => setCameraReady(true)}
            />
            {!cameraReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
                <span className="text-white/60 text-sm">Iniciando câmera...</span>
              </div>
            )}
            {/* Overlay oval */}
            {cameraReady && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-44 h-52 rounded-full border-4 border-primary opacity-60" />
                <span className="absolute bottom-8 text-xs text-white/70">Centralize o rosto no oval</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 p-3 bg-card border-t border-border/40">
            <Button variant="outline" className="flex-1" onClick={() => setShowCamera(false)}>Cancelar</Button>
            <Button
              className={`flex-1 ${tipoEvento === "entrada" ? "bg-success hover:bg-success/90" : "bg-orange-500 hover:bg-orange-600"} text-white`}
              onClick={capturarFrame}
              disabled={!cameraReady || processing}
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <ScanFace className="w-4 h-4 mr-1.5" />}
              Capturar e Identificar
            </Button>
          </div>
        </div>
      )}

      {/* Processando */}
      {processing && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-primary/30 bg-card">
          {framePreview && <img src={framePreview} alt="frame" className="w-16 h-16 object-cover rounded-lg flex-shrink-0" />}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            Processando via IA — Comparando biometria...
          </div>
        </div>
      )}

      {/* Resultado */}
      {resultado && !processing && (
        <ResultadoPortao resultado={resultado} tipoEvento={tipoEvento} framePreview={framePreview} onReset={resetar} />
      )}

      {/* Botões de captura — só mostra se não está processando e não tem resultado */}
      {!showCamera && !processing && !resultado && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setShowCamera(true)}
            className="flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-primary/5 transition-colors group"
          >
            <Camera className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
            <div className="text-center">
              <div className="text-sm font-medium">Câmera ao Vivo</div>
              <div className="text-[10px] text-muted-foreground">Captura pelo portão</div>
            </div>
          </button>
          <label className="flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-primary/5 transition-colors cursor-pointer group">
            <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
            <div className="text-center">
              <div className="text-sm font-medium">Enviar Foto</div>
              <div className="text-[10px] text-muted-foreground">Foto ou arquivo</div>
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>
      )}

      {/* Dica de alunos sem biometria */}
      {alunosMatriculados.filter(a => !a.face_embedding?.length).length > 0 && (
        <div className="flex items-start gap-2 text-xs text-warning bg-warning/10 border border-warning/30 px-3 py-2 rounded-lg">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>
            <strong>{alunosMatriculados.filter(a => !a.face_embedding?.length).length} aluno(s)</strong> sem biometria cadastrada — não serão identificados na câmera.
          </span>
        </div>
      )}
    </div>
  );
}

function ResultadoPortao({ resultado, tipoEvento, framePreview, onReset }) {
  const tipoLabel = TIPO_LABELS[tipoEvento];

  if (resultado.status === "sem_rosto") {
    return (
      <ResultCard cor="muted" icone={<ScanFace className="w-5 h-5 text-muted-foreground" />} titulo="Nenhum rosto detectado" subtitulo="Ajuste o enquadramento da câmera e tente novamente." onReset={onReset} framePreview={framePreview} />
    );
  }

  if (resultado.status === "spoofing") {
    return (
      <ResultCard cor="red" icone={<ShieldX className="w-5 h-5 text-red-400" />} titulo="Spoofing detectado" subtitulo={`Tipo: ${resultado.spoofing_type?.replace(/_/g, " ")} — acesso negado.`} onReset={onReset} framePreview={framePreview} />
    );
  }

  if (resultado.status === "nao_identificado") {
    return (
      <ResultCard cor="orange" icone={<AlertTriangle className="w-5 h-5 text-orange-400" />} titulo="Pessoa não identificada" subtitulo={`Similaridade máxima: ${resultado.melhor_sim ?? 0}% (mínimo: 70%). Aluno não cadastrado.`} onReset={onReset} framePreview={framePreview} />
    );
  }

  if (resultado.status === "identificado") {
    const { aluno, dentro_horario, motivo_alerta, confianca_score, alerta_disparado } = resultado;
    return (
      <div className={`rounded-2xl border-2 p-4 space-y-3 ${dentro_horario ? "border-success/50 bg-success/5" : "border-orange-500/50 bg-orange-500/5"}`}>
        <div className="flex items-start gap-3">
          {framePreview && (
            <img src={framePreview} alt="frame" className="w-14 h-14 object-cover rounded-lg flex-shrink-0 border border-border" />
          )}
          {aluno.foto_url && (
            <img src={aluno.foto_url} alt={aluno.nome} className="w-14 h-14 object-cover rounded-lg flex-shrink-0 border border-border" />
          )}
          <div className="flex-1">
            <div className={`flex items-center gap-2 font-bold text-base ${dentro_horario ? "text-success" : "text-orange-400"}`}>
              {dentro_horario
                ? <CheckCircle2 className="w-5 h-5" />
                : <AlertTriangle className="w-5 h-5" />
              }
              {aluno.nome}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">Mat. {aluno.matricula}</div>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-primary" />
                Confiança: <strong className="text-foreground">{confianca_score}%</strong>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {tipoLabel}: {aluno.horario_entrada && aluno.horario_saida
                  ? `${aluno.horario_entrada} – ${aluno.horario_saida}`
                  : "—"}
              </span>
            </div>
          </div>
        </div>

        <div className={`rounded-xl px-3 py-2 text-xs font-medium flex items-center gap-2 ${dentro_horario ? "bg-success/15 text-success" : "bg-orange-500/15 text-orange-400"}`}>
          {dentro_horario
            ? <><CheckCircle2 className="w-3.5 h-3.5" /> {tipoLabel} dentro do horário — registro salvo.</>
            : <><AlertTriangle className="w-3.5 h-3.5" /> {motivo_alerta} {alerta_disparado ? "• Responsáveis notificados." : ""}</>
          }
        </div>

        <Button size="sm" variant="outline" onClick={onReset} className="w-full">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Novo Registro
        </Button>
      </div>
    );
  }

  return null;
}

function ResultCard({ cor, icone, titulo, subtitulo, onReset, framePreview }) {
  const cores = {
    muted: "border-border/60 bg-card",
    red: "border-red-500/40 bg-red-500/5",
    orange: "border-orange-500/40 bg-orange-500/5",
  };
  return (
    <div className={`rounded-2xl border-2 p-4 space-y-3 ${cores[cor]}`}>
      <div className="flex items-center gap-3">
        {framePreview && <img src={framePreview} alt="frame" className="w-12 h-12 object-cover rounded-lg flex-shrink-0 border border-border" />}
        <div className="flex items-center gap-2">
          {icone}
          <div>
            <div className="font-semibold text-sm">{titulo}</div>
            <div className="text-xs text-muted-foreground">{subtitulo}</div>
          </div>
        </div>
      </div>
      <Button size="sm" variant="outline" onClick={onReset} className="w-full">
        <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Tentar Novamente
      </Button>
    </div>
  );
}
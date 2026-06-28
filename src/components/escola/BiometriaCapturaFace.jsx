import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import {
  Camera, Upload, RotateCcw, CheckCircle2, Loader2,
  AlertTriangle, ScanFace, ShieldCheck, ZoomIn, Sun, User, X,
  Glasses, Eye, Focus
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

/**
 * Fluxo: ESCOLHA → CAPTURA (webcam HD) → REVISÃO (split-screen) → CONFIRMADO
 * Suporte a cadastro duplo para alunos com óculos de grau.
 */

const STEP = { ESCOLHA: 0, CAPTURA: 1, REVISAO: 2, CONFIRMADO: 3 };

// ── Aplicar correção de contraste/brilho no canvas ───────────────────────────
function applyImageEnhancement(canvas) {
  const ctx = canvas.getContext("2d");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Calcular luminosidade média
  let totalLum = 0;
  for (let i = 0; i < data.length; i += 4) {
    totalLum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  const avgLum = totalLum / (data.length / 4);

  // Ajuste de brilho: compensar câmeras escuras
  const brightnessAdj = avgLum < 100 ? (120 - avgLum) / 2.5 : 0;
  // Ajuste de contraste leve
  const contrastFactor = 1.15;
  const intercept = 128 * (1 - contrastFactor);

  for (let i = 0; i < data.length; i += 4) {
    data[i]     = Math.min(255, Math.max(0, data[i]     * contrastFactor + intercept + brightnessAdj));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * contrastFactor + intercept + brightnessAdj));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * contrastFactor + intercept + brightnessAdj));
  }
  ctx.putImageData(imageData, 0, 0);
}

// ── Laplacian variance para detectar blur ──────────────────────────────────
function computeBlurScore(canvas) {
  const ctx = canvas.getContext("2d");
  const w = Math.min(canvas.width, 320);
  const h = Math.min(canvas.height, 240);
  const img = ctx.getImageData(0, 0, w, h);
  const data = img.data;

  // Converter para grayscale e aplicar Laplacian
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }

  let variance = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const lap =
        -gray[(y - 1) * w + x] - gray[(y + 1) * w + x] -
        gray[y * w + (x - 1)] - gray[y * w + (x + 1)] +
        4 * gray[y * w + x];
      variance += lap * lap;
      count++;
    }
  }
  const v = variance / count;
  // Normalizar: >200 = muito nítido, <20 = muito borrado
  return Math.min(100, Math.round((v / 200) * 100));
}

// ── Avaliar iluminação ─────────────────────────────────────────────────────
function computeLightingScore(canvas) {
  const ctx = canvas.getContext("2d");
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = img.data;
  let sum = 0;
  for (let i = 0; i < data.length; i += 4) {
    sum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  const avg = sum / (data.length / 4);
  // 80-180 lux = ideal (score 100). Muito escuro ou muito claro = penaliza.
  if (avg < 40) return Math.round((avg / 40) * 50);
  if (avg > 220) return Math.round((1 - (avg - 220) / 35) * 60);
  if (avg >= 80 && avg <= 170) return 100;
  if (avg >= 40 && avg < 80) return 50 + Math.round(((avg - 40) / 40) * 50);
  return 60 + Math.round(((220 - avg) / 50) * 40);
}

function CheckItem({ label, ok, warn = false }) {
  return (
    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm ${
      ok ? "bg-success/10 text-success" : warn ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"
    }`}>
      {ok
        ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        : <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      }
      <span className="font-medium">{label}</span>
    </div>
  );
}

export default function BiometriaCapturaFace({
  onCapture,
  onClear,
  alunoId,
  label = "Foto Biométrica",
  captureLabel = null // ex: "Com Óculos" ou "Sem Óculos"
}) {
  const [step, setStep] = useState(STEP.ESCOLHA);
  const [captured, setCaptured] = useState(null);   // { url, blob }
  const [qualidade, setQualidade] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [livenessChecks, setLivenessChecks] = useState(0);
  const [localScores, setLocalScores] = useState(null); // scores calculados localmente
  const livenessRef = useRef(0);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const livenessIntervalRef = useRef(null);

  useEffect(() => () => {
    stopCamera();
    clearInterval(livenessIntervalRef.current);
  }, []);

  // Teclas Esc / Enter na etapa de revisão
  useEffect(() => {
    if (step !== STEP.REVISAO) return;
    const handler = (e) => {
      if (e.key === "Escape") reset();
      if (e.key === "Enter" && qualidade && qualidade.face_detected && !saving) confirmar();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [step, qualidade, saving]);

  // ── câmera ─────────────────────────────────────────────────────────────
  const [cameraModalOpen, setCameraModalOpen] = useState(false);

  const startCamera = async () => {
    setCameraModalOpen(true);
    // pequeno delay para o modal montar antes de acessar o ref do video
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 1280, min: 640 },
            height: { ideal: 720, min: 480 },
          }
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        livenessRef.current = 0;
        setLivenessChecks(0);
        setStep(STEP.CAPTURA);
        startLiveness();
      } catch {
        setCameraModalOpen(false);
        toast.error("Câmera não disponível. Use o upload de foto.");
      }
    }, 100);
  };

  const closeCameraModal = () => {
    stopCamera();
    setCameraModalOpen(false);
    if (step === STEP.CAPTURA) setStep(STEP.ESCOLHA);
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    clearInterval(livenessIntervalRef.current);
  };

  const startLiveness = () => {
    let prevFrame = null;
    const livenessCanvas = document.createElement("canvas");
    livenessCanvas.width = 64;
    livenessCanvas.height = 48;
    const ctx = livenessCanvas.getContext("2d");

    livenessIntervalRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      ctx.drawImage(video, 0, 0, 64, 48);
      const frame = ctx.getImageData(0, 0, 64, 48).data;
      if (prevFrame) {
        let diff = 0;
        for (let i = 0; i < frame.length; i += 4) diff += Math.abs(frame[i] - prevFrame[i]);
        if (diff > 40000 && livenessRef.current < 3) {
          livenessRef.current++;
          setLivenessChecks(livenessRef.current);
        }
      }
      prevFrame = new Uint8ClampedArray(frame);
      if (livenessRef.current >= 3) clearInterval(livenessIntervalRef.current);
    }, 500);
  };

  const captureFromCamera = () => {
    const video = videoRef.current;
    if (!video) return;

    // Usar canvas dedicado para captura (não o canvas do liveness)
    const captureCanvas = document.createElement("canvas");
    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    captureCanvas.width = vw;
    captureCanvas.height = vh;
    captureCanvas.getContext("2d").drawImage(video, 0, 0, vw, vh);

    // Aplicar correção de contraste/brilho
    applyImageEnhancement(captureCanvas);

    // Calcular scores locais
    const blurScore = computeBlurScore(captureCanvas);
    const lightScore = computeLightingScore(captureCanvas);
    setLocalScores({ blur: blurScore, light: lightScore });

    captureCanvas.toBlob(blob => {
      if (!blob) { toast.error("Falha ao capturar imagem. Tente novamente."); return; }
      const url = URL.createObjectURL(blob);
      stopCamera();
      setCameraModalOpen(false);
      processImage(blob, url);
    }, "image/jpeg", 0.95);
  };

  // ── upload ─────────────────────────────────────────────────────────────
  const handleUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem válida."); return; }
    const url = URL.createObjectURL(file);
    processImage(file, url);
  };

  // ── análise de qualidade via IA ────────────────────────────────────────
  const processImage = async (blob, localUrl) => {
    setCaptured({ blob, url: localUrl });
    setProcessing(true);
    setStep(STEP.REVISAO);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: blob });

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um sistema especializado em verificação de qualidade de imagem biométrica facial para cadastro escolar seguro.
Analise a foto com rigor técnico e retorne:

1. face_detected (boolean): há exatamente um rosto humano visível e frontal?
2. score_geral (0-100): qualidade geral para biometria
3. score_nitidez (0-100): foto está nítida/em foco? (≥60 aceitável)
4. score_iluminacao (0-100): iluminação adequada, sem sombras severas ou superexposição? (≥60 aceitável)
5. score_enquadramento (0-100): rosto centralizado, pose frontal (yaw/pitch/roll≈0)? (≥60 aceitável)
6. score_expressao (0-100): expressão neutra, olhos abertos, sem careta? (≥60 aceitável)
7. oculos_escuros_detectados (boolean): a pessoa usa óculos escuros/lentes espelhadas que ocultam a íris?
8. embedding (array de 128 números entre -1 e 1): vetor de características faciais prioritizando distância interpupilar, linha do maxilar, base do nariz, sobrancelhas (ignorar armação de óculos e reflexos)
9. problemas (array de strings): lista dos principais problemas (max 3 itens, texto em PT-BR)
10. aprovada (boolean): true somente se score_geral >= 55 E face_detected = true E oculos_escuros_detectados = false

Seja rigoroso: fotos sem rosto claro, muito borradas, ou com óculos escuros devem ter aprovada: false.`,
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
    } catch {
      toast.error("Erro ao analisar imagem. Tente novamente.");
      reset();
    }
    setProcessing(false);
  };

  // ── confirmar e vincular ───────────────────────────────────────────────
  const confirmar = async () => {
    if (!qualidade?.file_url) return;
    setSaving(true);
    try {
      onCapture({
        fotoUrl: qualidade.file_url,
        embedding: qualidade.embedding || [],
        qualidade: qualidade.score_geral,
        label: captureLabel,
      });
      setStep(STEP.CONFIRMADO);
    } catch {
      toast.error("Erro ao vincular biometria. Tente novamente.");
    }
    setSaving(false);
  };

  const reset = () => {
    stopCamera();
    setCameraModalOpen(false);
    setCaptured(null);
    setQualidade(null);
    setLocalScores(null);
    setLivenessChecks(0);
    livenessRef.current = 0;
    setStep(STEP.ESCOLHA);
    onClear?.();
  };

  const stepLabels = ["Método", "Captura", "Revisão", "OK"];

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

      {/* Stepper */}
      {step > STEP.ESCOLHA && (
        <div className="flex items-center gap-1 mb-2">
          {stepLabels.map((l, i) => (
            <div key={i} className="flex items-center gap-1 flex-1">
              <div className={`flex-1 h-0.5 rounded ${i < step ? "bg-primary" : "bg-border"} ${i === 0 ? "hidden" : ""}`} />
              <div className={`px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap ${
                i === step ? "bg-primary text-primary-foreground" :
                i < step ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
              }`}>
                {i < step && "✓ "}{l}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ETAPA 0: ESCOLHA ── */}
      {step === STEP.ESCOLHA && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={startCamera}
            className="flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-primary/5 transition-colors group"
          >
            <Camera className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
            <div className="text-center">
              <div className="text-sm font-medium">Câmera ao Vivo</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">HD com guia oval e liveness</div>
            </div>
          </button>
          <label className="flex flex-col items-center gap-2.5 p-5 rounded-xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-primary/5 transition-colors cursor-pointer group">
            <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
            <div className="text-center">
              <div className="text-sm font-medium">Upload Foto</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Foto 3x4 da galeria</div>
            </div>
            <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
          </label>
        </div>
      )}

      {/* ── MODAL: CÂMERA AO VIVO ── */}
      {cameraModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-xl rounded-2xl overflow-hidden bg-black border border-border/40 shadow-2xl">
            {/* Header do modal */}
            <div className="flex items-center justify-between px-4 py-3 bg-background/90 border-b border-border/40">
              <div className="flex items-center gap-2">
                <ScanFace className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Captura Biométrica</span>
                {captureLabel && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/15 text-primary flex items-center gap-1">
                    <Glasses className="w-3 h-3" /> {captureLabel}
                  </span>
                )}
              </div>
              <button onClick={closeCameraModal} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Área da câmera */}
            <div className="relative bg-black" style={{ aspectRatio: "4/3" }}>
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />

              {/* Overlay escuro com óvalo aberto */}
              <div className="absolute inset-0 pointer-events-none">
                <svg width="100%" height="100%" viewBox="0 0 640 480" preserveAspectRatio="xMidYMid slice">
                  <defs>
                    <mask id={`oval-modal-mask-${label}`}>
                      <rect width="640" height="480" fill="white" />
                      <ellipse cx="320" cy="235" rx="155" ry="195" fill="black" />
                    </mask>
                  </defs>
                  {/* Fundo escurecido fora do óvalo */}
                  <rect width="640" height="480" fill="rgba(0,0,0,0.55)" mask={`url(#oval-modal-mask-${label})`} />
                  {/* Borda animada do óvalo */}
                  <ellipse cx="320" cy="235" rx="155" ry="195" fill="none"
                    stroke={livenessChecks >= 3 ? "#22c55e" : "#38bdf8"}
                    strokeWidth="3.5"
                    strokeDasharray={livenessChecks >= 3 ? "none" : "12 7"}
                  />
                  {/* Marcadores de canto do óvalo */}
                  <line x1="320" y1="36" x2="320" y2="60" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
                  <line x1="320" y1="410" x2="320" y2="434" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
                  <line x1="158" y1="235" x2="182" y2="235" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
                  <line x1="458" y1="235" x2="482" y2="235" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
                  {/* Texto guia dentro do óvalo */}
                  {livenessChecks < 3 && (
                    <text x="320" y="455" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="12" fontFamily="sans-serif">
                      Posicione o rosto aqui
                    </text>
                  )}
                </svg>
              </div>

              {/* Badge de status liveness — topo */}
              <div className="absolute top-3 left-0 right-0 flex justify-center pointer-events-none">
                <div className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 shadow-lg ${
                  livenessChecks >= 3
                    ? "bg-success text-white"
                    : "bg-black/75 text-white"
                }`}>
                  {livenessChecks >= 3
                    ? <><CheckCircle2 className="w-3.5 h-3.5" /> Pronto para capturar</>
                    : <><div className="w-2 h-2 rounded-full bg-primary animate-pulse" /> Mova levemente a cabeça ({livenessChecks}/3)</>
                  }
                </div>
              </div>

              {/* Info HD */}
              <div className="absolute bottom-14 left-3 text-[9px] text-white/40 pointer-events-none select-none">
                HD 720p+ · Correção automática ativa
              </div>
            </div>

            {/* Botões de ação */}
            <div className="flex gap-3 p-4 bg-background/90 border-t border-border/40">
              <Button variant="outline" size="sm" onClick={closeCameraModal} className="flex-1">
                <X className="w-3.5 h-3.5 mr-1.5" /> Cancelar
              </Button>
              <Button
                size="sm"
                onClick={captureFromCamera}
                disabled={livenessChecks < 2}
                className={`flex-1 ${livenessChecks >= 3 ? "bg-success hover:bg-success/90" : "bg-primary hover:bg-primary/90"}`}
              >
                <ScanFace className="w-3.5 h-3.5 mr-1.5" />
                {livenessChecks >= 3 ? "Capturar Agora" : "Aguardando liveness..."}
              </Button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── ETAPA 2: REVISÃO (split-screen) ── */}
      {step === STEP.REVISAO && (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          {processing ? (
            <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-sm font-medium">Analisando qualidade da imagem...</span>
              <span className="text-xs">Verificando nitidez, iluminação, enquadramento e expressão</span>
            </div>
          ) : qualidade ? (
            <>
              {/* Alerta óculos escuros */}
              {qualidade.oculos_escuros_detectados && (
                <div className="flex items-center gap-2 bg-destructive/10 text-destructive px-4 py-2.5 text-sm font-medium">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  Óculos escuros ou lentes espelhadas detectados — remova antes de prosseguir.
                </div>
              )}

              <div className="flex flex-col md:flex-row">
                {/* Lado esquerdo — Preview com zoom no rosto */}
                <div className="md:w-1/2 flex items-center justify-center bg-black/40 p-4 min-h-[200px]">
                  {captured?.url && (
                    <img
                      src={captured.url}
                      alt="Foto capturada"
                      className="rounded-xl border border-border/60 object-cover"
                      style={{
                        maxHeight: 280,
                        width: "100%",
                        objectFit: "cover",
                        objectPosition: "center 25%",
                      }}
                    />
                  )}
                </div>

                {/* Lado direito — Checklist diagnóstico */}
                <div className="md:w-1/2 p-4 space-y-2 border-t md:border-t-0 md:border-l border-border/60">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Focus className="w-3.5 h-3.5" /> Diagnóstico Automático
                  </div>

                  <CheckItem
                    label={`Foco / Nitidez (${qualidade.score_nitidez ?? 0}/100)`}
                    ok={qualidade.score_nitidez >= 60}
                  />
                  <CheckItem
                    label={`Iluminação (${qualidade.score_iluminacao ?? 0}/100)`}
                    ok={qualidade.score_iluminacao >= 60}
                    warn={qualidade.score_iluminacao >= 40 && qualidade.score_iluminacao < 60}
                  />
                  <CheckItem
                    label={`Posição Frontal (${qualidade.score_enquadramento ?? 0}/100)`}
                    ok={qualidade.score_enquadramento >= 60}
                  />
                  <CheckItem
                    label={`Expressão Neutra (${qualidade.score_expressao ?? 0}/100)`}
                    ok={qualidade.score_expressao >= 60}
                    warn={qualidade.score_expressao >= 40 && qualidade.score_expressao < 60}
                  />
                  <CheckItem
                    label="Rosto Detectado"
                    ok={qualidade.face_detected}
                  />
                  <CheckItem
                    label="Sem Óculos Escuros"
                    ok={!qualidade.oculos_escuros_detectados}
                  />

                  {/* Score geral */}
                  <div className={`mt-3 px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 ${
                    qualidade.aprovada ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                  }`}>
                    {qualidade.aprovada
                      ? <><ShieldCheck className="w-4 h-4" /> Aprovada — Score {qualidade.score_geral}/100</>
                      : <><AlertTriangle className="w-4 h-4" /> {qualidade.face_detected ? `Qualidade insuficiente (${qualidade.score_geral}/100)` : "Nenhum rosto detectado"}</>
                    }
                  </div>

                  {/* Problemas */}
                  {qualidade.problemas?.length > 0 && (
                    <div className="space-y-1 pt-1">
                      {qualidade.problemas.map((p, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-[10px] text-warning">
                          <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />{p}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-[10px] text-muted-foreground pt-1">
                    Atalhos: <kbd className="bg-muted px-1 rounded">Esc</kbd> descartar · <kbd className="bg-muted px-1 rounded">Enter</kbd> aprovar
                  </div>
                </div>
              </div>

              {/* Botões de ação */}
              <div className="flex gap-2 p-4 border-t border-border/60">
                <Button variant="outline" size="sm" onClick={reset} className="flex-1">
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Descartar e Tirar Outra
                </Button>
                {qualidade.face_detected && !qualidade.oculos_escuros_detectados ? (
                  <Button
                    size="sm"
                    onClick={confirmar}
                    disabled={saving || (!qualidade.aprovada && qualidade.score_nitidez < 40)}
                    className={`flex-1 ${qualidade.aprovada ? "bg-success hover:bg-success/90" : "bg-warning hover:bg-warning/90"}`}
                  >
                    {saving
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    }
                    {qualidade.aprovada ? "Aprovar e Salvar" : "Usar Mesmo Assim"}
                  </Button>
                ) : (
                  <Button size="sm" onClick={reset} className="flex-1 bg-destructive hover:bg-destructive/90">
                    <Camera className="w-3.5 h-3.5 mr-1.5" /> Tirar Novamente
                  </Button>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}

      {/* ── ETAPA 3: CONFIRMADO ── */}
      {step === STEP.CONFIRMADO && qualidade && (
        <div className="flex items-center gap-3 p-3 rounded-xl border border-success/40 bg-success/5">
          <img
            src={captured?.url}
            alt="Biometria"
            className="w-14 object-cover rounded-lg border border-success/30 flex-shrink-0"
            style={{ height: 72 }}
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
          <Button variant="ghost" size="sm" onClick={reset} title="Refazer biometria">
            <RotateCcw className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
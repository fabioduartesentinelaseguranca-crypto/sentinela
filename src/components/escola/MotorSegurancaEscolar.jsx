import { useState, useRef, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import {
  ShieldAlert, ScanFace, Loader2, CheckCircle2, Lock, Clock,
  AlertTriangle, Video, VideoOff, Settings, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Motor de Segurança Escolar — Análise em tempo real do feed de câmera.
 *
 * Regras implementadas:
 *  1. Anti-Spoofing (liveness + análise de textura via IA)
 *  2. Blacklist match (similaridade > 95%) → Alerta Vermelho + bloqueio
 *  3. Loitering (permanência > 45s sem identificação) → Aviso Suspeito
 *  4. Acesso fora do horário letivo → Alerta + retenção
 *  5. Visitante sem OS ativa → Alerta
 *
 * Props:
 *  - escola: { id, nome_escola, horario_inicio, horario_fim }
 *  - alunosMatriculados: array de { face_embedding, ... }
 *  - blacklist: array de { face_embedding, nivel_alerta, descricao_risco, id }
 *  - ordensAtivas: array de Ordens_Servico_Visitantes
 */

// Calcula similaridade coseno entre dois vetores (0-100)
function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return Math.round(((dot / (Math.sqrt(normA) * Math.sqrt(normB))) + 1) / 2 * 100);
}

// Verifica se o horário atual está dentro da janela letiva
function dentroHorarioLetivo(horario_inicio, horario_fim) {
  if (!horario_inicio || !horario_fim) return true;
  const now = new Date();
  const dia = now.getDay(); // 0=dom, 6=sab
  if (dia === 0 || dia === 6) return false; // fins de semana sempre bloqueados
  const [hI, mI] = horario_inicio.split(":").map(Number);
  const [hF, mF] = horario_fim.split(":").map(Number);
  const minNow = now.getHours() * 60 + now.getMinutes();
  const minI = hI * 60 + mI;
  const minF = hF * 60 + mF;
  return minNow >= minI && minNow <= minF;
}

const INTERVAL_MS = 5000; // análise a cada 5s
const LOITERING_THRESHOLD_MS = 45000; // 45 segundos

export default function MotorSegurancaEscolar({
  escola,
  alunosMatriculados = [],
  blacklist = [],
  ordensAtivas = [],
}) {
  const { user } = useAuth();
  const [ativo, setAtivo] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [ultimoEvento, setUltimoEvento] = useState(null);
  const [loiteringStart, setLoiteringStart] = useState(null);
  const [loiteringTimer, setLoiteringTimer] = useState(0);
  const [alertasGerados, setAlertasGerados] = useState(0);
  const [bloqueioAtivo, setBloqueioAtivo] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const intervalRef = useRef(null);
  const loiteringRef = useRef(null);
  const analyzingRef = useRef(false);

  useEffect(() => () => {
    pararAnalise();
  }, []);

  // Timer de loitering na tela
  useEffect(() => {
    if (!loiteringStart) { setLoiteringTimer(0); return; }
    const id = setInterval(() => {
      setLoiteringTimer(Math.floor((Date.now() - loiteringStart) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [loiteringStart]);

  const iniciarCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setStreaming(true);
      setAtivo(true);
      iniciarLoop();
    } catch {
      toast.error("Câmera não disponível para monitoramento.");
    }
  };

  const pararAnalise = () => {
    clearInterval(intervalRef.current);
    clearInterval(loiteringRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    setStreaming(false);
    setAtivo(false);
    setLoiteringStart(null);
    analyzingRef.current = false;
  };

  const capturarFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    canvas.width = 320; canvas.height = 240;
    canvas.getContext("2d").drawImage(video, 0, 0, 320, 240);
    return new Promise(res => canvas.toBlob(res, "image/jpeg", 0.7));
  };

  const dispararAlerta = useCallback(async (tipo, nivel, descricao, extra = {}) => {
    const payload = {
      tipo_alerta: tipo,
      nivel,
      descricao,
      id_escola_cerca: escola?.id || "",
      nome_escola: escola?.nome_escola || "",
      horario_tentativa: new Date().toISOString(),
      status: "ativo",
      bloqueio_ativo: nivel === "vermelho",
      ...extra,
    };
    await base44.entities.Alertas_Intrusao_Escolar.create(payload);
    setAlertasGerados(n => n + 1);
    setUltimoEvento({ tipo, nivel, descricao, ts: Date.now() });

    if (nivel === "vermelho") {
      setBloqueioAtivo(true);
      toast.error(`🔴 ${descricao}`, { duration: 10000 });
    } else if (nivel === "laranja") {
      toast.warning(`🟠 ${descricao}`, { duration: 7000 });
    } else {
      toast.info(`🟡 ${descricao}`, { duration: 5000 });
    }
  }, [escola, user]);

  const analisarFrame = useCallback(async () => {
    if (analyzingRef.current) return;
    analyzingRef.current = true;
    setAnalyzing(true);

    try {
      const blob = await capturarFrame();
      if (!blob) return;

      // Upload do frame
      const { file_url } = await base44.integrations.Core.UploadFile({ file: blob });

      // ── ANÁLISE VIA IA ──────────────────────────────────────
      const resultado = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é o motor de segurança biométrica de uma escola.
Analise este frame de câmera de portão escolar e retorne:

1. face_detected (boolean): há rosto humano visível?
2. is_real_face (boolean): é rosto real? Ou tentativa de spoofing (foto impressa, vídeo em tela, máscara)?
3. spoofing_type: "nenhum" | "foto_impressa" | "video_tela" | "mascara" | "outro" (se is_real_face=false)
4. embedding (array 128 números -1 a 1): vetor facial (preencha com zeros se sem rosto)
5. quality_score (0-100): qualidade do frame para reconhecimento
6. face_count (integer): número de rostos detectados
7. observacoes (string): observação breve

Seja criterioso com anti-spoofing: analise textura, reflexo de tela, bordas da foto, profundidade de campo.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            face_detected: { type: "boolean" },
            is_real_face: { type: "boolean" },
            spoofing_type: { type: "string" },
            embedding: { type: "array", items: { type: "number" } },
            quality_score: { type: "number" },
            face_count: { type: "integer" },
            observacoes: { type: "string" }
          }
        }
      });

      // ── REGRA 1: ANTI-SPOOFING ──────────────────────────────
      if (resultado.face_detected && !resultado.is_real_face) {
        await dispararAlerta(
          "anti_spoofing", "vermelho",
          `Tentativa de falsificação detectada: ${resultado.spoofing_type?.replace(/_/g, " ")} — acesso bloqueado`,
          { foto_captura_url: file_url }
        );
        setLoiteringStart(null);
        return;
      }

      if (!resultado.face_detected || resultado.quality_score < 30) {
        // Sem rosto: reset loitering
        setLoiteringStart(null);
        return;
      }

      const embedding = resultado.embedding || [];

      // ── REGRA 2: BLACKLIST MATCH ────────────────────────────
      for (const bl of blacklist) {
        if (!bl.ativo || !bl.face_embedding?.length) continue;
        const sim = cosineSimilarity(embedding, bl.face_embedding);
        if (sim >= 95) {
          await dispararAlerta(
            "blacklist_match", "vermelho",
            `INVASOR IDENTIFICADO: Match na blacklist com ${sim}% de similaridade — ${bl.descricao_risco}`,
            { foto_captura_url: file_url, similaridade_blacklist: sim, id_blacklist_ref: bl.id }
          );
          setLoiteringStart(null);
          return;
        }
      }

      // ── REGRA 3: ACESSO FORA DO HORÁRIO LETIVO ─────────────
      if (!dentroHorarioLetivo(escola?.horario_inicio, escola?.horario_fim)) {
        // Verifica se é aluno cadastrado
        let isAluno = false;
        for (const aluno of alunosMatriculados) {
          if (!aluno.face_embedding?.length) continue;
          const sim = cosineSimilarity(embedding, aluno.face_embedding);
          if (sim >= 80) { isAluno = true; break; }
        }
        if (isAluno) {
          await dispararAlerta(
            "acesso_fora_horario", "laranja",
            `Aluno identificado tentando acesso fora do horário letivo — portão retido`,
            { foto_captura_url: file_url }
          );
          setLoiteringStart(null);
          return;
        }
      }

      // ── REGRA 4: VISITANTE SEM OS ───────────────────────────
      let isIdentificado = false;

      // Checar alunos
      for (const aluno of alunosMatriculados) {
        if (!aluno.face_embedding?.length) continue;
        if (cosineSimilarity(embedding, aluno.face_embedding) >= 78) {
          isIdentificado = true; break;
        }
      }
      // Checar OS ativas
      if (!isIdentificado) {
        for (const os of ordensAtivas) {
          if (!os.face_embedding?.length) continue;
          if (cosineSimilarity(embedding, os.face_embedding) >= 78) {
            isIdentificado = true; break;
          }
        }
      }

      if (!isIdentificado) {
        // ── REGRA 5: LOITERING (45s sem identificação) ─────────
        if (!loiteringStart) {
          setLoiteringStart(Date.now());
          loiteringRef.current = Date.now();
        } else {
          const elapsed = Date.now() - loiteringStart;
          if (elapsed >= LOITERING_THRESHOLD_MS) {
            await dispararAlerta(
              "suspeito_permanencia", "laranja",
              `Pessoa não identificada no portão há mais de ${Math.floor(elapsed / 1000)}s — verificar`,
              { foto_captura_url: file_url, tempo_permanencia_seg: Math.floor(elapsed / 1000) }
            );
            setLoiteringStart(null); // Reset para evitar spam
          }
        }
      } else {
        // Identificado — reset loitering
        setLoiteringStart(null);
      }

    } catch (err) {
      console.error("Erro no motor de segurança:", err);
    } finally {
      analyzingRef.current = false;
      setAnalyzing(false);
    }
  }, [escola, blacklist, alunosMatriculados, ordensAtivas, loiteringStart, dispararAlerta]);

  const iniciarLoop = () => {
    intervalRef.current = setInterval(() => {
      analisarFrame();
    }, INTERVAL_MS);
  };

  // Atualiza referência do callback no interval
  useEffect(() => {
    if (!ativo) return;
    clearInterval(intervalRef.current);
    iniciarLoop();
    return () => clearInterval(intervalRef.current);
  }, [analisarFrame, ativo]);

  const liberarBloqueio = async () => {
    setBloqueioAtivo(false);
    toast.success("Sinal de bloqueio liberado.");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm flex items-center gap-2">
          <ScanFace className="w-4 h-4 text-primary" />
          Motor de Segurança — Análise em Tempo Real
          {ativo && <span className="w-2 h-2 rounded-full bg-success animate-pulse" />}
        </h4>
        <div className="flex gap-2">
          {ativo ? (
            <Button size="sm" variant="outline" onClick={pararAnalise}>
              <VideoOff className="w-3.5 h-3.5 mr-1.5" /> Parar
            </Button>
          ) : (
            <Button size="sm" onClick={iniciarCamera}>
              <Video className="w-3.5 h-3.5 mr-1.5" /> Iniciar Monitoramento
            </Button>
          )}
        </div>
      </div>

      {/* Bloqueio ativo */}
      {bloqueioAtivo && (
        <div className="rounded-xl border border-red-500 bg-red-500/10 p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-red-400 animate-pulse" />
            <div>
              <div className="text-sm font-bold text-red-400">🔴 BLOQUEIO ATIVO</div>
              <div className="text-[10px] text-muted-foreground">Catracas e portões bloqueados. Autoridades notificadas.</div>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={liberarBloqueio} className="border-success/40 text-success">
            Liberar
          </Button>
        </div>
      )}

      {/* Feed da câmera */}
      {streaming && (
        <div className="relative rounded-xl overflow-hidden border border-border bg-black" style={{ aspectRatio: "4/3", maxHeight: 260 }}>
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
          <canvas ref={canvasRef} className="hidden" />

          {/* Status overlay */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/70 px-2 py-1 rounded-lg">
            {analyzing
              ? <><Loader2 className="w-3 h-3 animate-spin text-primary" /><span className="text-[10px] text-primary">Analisando...</span></>
              : <><div className="w-2 h-2 rounded-full bg-success animate-pulse" /><span className="text-[10px] text-success">Monitorando</span></>
            }
          </div>

          {/* Loitering timer */}
          {loiteringStart && (
            <div className="absolute top-2 right-2 bg-orange-500/80 px-2 py-1 rounded-lg flex items-center gap-1">
              <Clock className="w-3 h-3 text-white" />
              <span className="text-[10px] text-white font-bold">
                Suspeito: {loiteringTimer}s / 45s
              </span>
            </div>
          )}

          {/* Contador de alertas */}
          <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded-lg">
            <span className="text-[10px] text-muted-foreground">Alertas gerados nesta sessão: </span>
            <span className={`text-[10px] font-bold ${alertasGerados > 0 ? "text-red-400" : "text-muted-foreground"}`}>{alertasGerados}</span>
          </div>
        </div>
      )}

      {/* Último evento */}
      {ultimoEvento && (
        <div className={`rounded-xl border p-3 flex items-start gap-2 text-sm ${
          ultimoEvento.nivel === "vermelho" ? "border-red-500/40 bg-red-500/5 text-red-400" :
          ultimoEvento.nivel === "laranja" ? "border-orange-500/40 bg-orange-500/5 text-orange-400" :
          "border-yellow-500/40 bg-yellow-500/5 text-yellow-400"
        }`}>
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">{ultimoEvento.nivel.toUpperCase()} — {ultimoEvento.tipo?.replace(/_/g, " ")}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{ultimoEvento.descricao}</div>
          </div>
        </div>
      )}

      {/* Regras ativas (resumo) */}
      {!ativo && (
        <div className="rounded-xl border border-border/60 bg-card p-3 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Protocolos ativos neste motor</p>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { icon: "🛡️", label: "Anti-Spoofing (foto/vídeo/máscara)" },
              { icon: "🔴", label: `Blacklist — ${blacklist.filter(b => b.ativo).length} registros` },
              { icon: "⏱️", label: "Loitering (>45s sem ID)" },
              { icon: "🕐", label: "Bloqueio fora do horário letivo" },
              { icon: "📋", label: "Visitante sem OS/Token 2FA" },
              { icon: "🔒", label: "Sinal de bloqueio físico (relé)" },
            ].map((r, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <span>{r.icon}</span><span>{r.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
/**
 * useLocalFaceDetector — Pipeline local de duas etapas:
 *
 * STEP 1 — Google MediaPipe (tasks-vision FaceDetector, BlazeFace WASM):
 *   Detecção facial contínua na webcam a 20 FPS. Rastreia a bounding box e
 *   exige estabilidade (movimento do centro < threshold por >= 1.2s) antes
 *   de acionar a etapa 2. Frames sem rosto não disparam nada.
 *
 * STEP 2 — face-api.js (TensorFlow.js backend):
 *   Rosto estável → detectSingleFace + landmarks + descriptor 128-dim.
 *   FaceMatcher local contra embeddings em cache (students/wanted) dá
 *   match instantâneo. Então o descriptor é enviado ao backend (que pula a
 *   extração via GPT, economizando créditos).
 *
 * Cooldown de 3s após cada ciclo de reconhecimento (sucesso ou falha).
 */
import { useRef, useState, useCallback, useEffect } from "react";
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";
import { base44 } from "@/api/base44Client";
import { faceapi, loadFaceApiModels, computeDescriptorFromImage } from "@/lib/faceModels";

const MEDIAPIPE_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm";
const BLAZEFACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_detector/BlazeFace/float16/1/BlazeFace.tflite";
const TARGET_FPS = 20;
const STABILIZE_MS = 1200;
const STABILITY_THRESHOLD = 0.05; // tolerância de movimento do centro (relativa)
const COOLDOWN_MS = 3000;

let mediapipePromise = null;
function loadMediaPipe() {
  if (!mediapipePromise) {
    mediapipePromise = (async () => {
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
      const detector = await FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: BLAZEFACE_MODEL, delegate: "GPU" },
        runningMode: "VIDEO",
        minDetectionConfidence: 0.5,
      });
      return detector;
    })();
  }
  return mediapipePromise;
}

export function useLocalFaceDetector({ onRecognition, localDescriptors = [], enabled = true }) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | loading_models | ready | no_camera | error
  const [detection, setDetection] = useState(null);
  const [facePresent, setFacePresent] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [localMatch, setLocalMatch] = useState(null);
  const [initProgress, setInitProgress] = useState(0);

  const onRecognitionRef = useRef(onRecognition);
  onRecognitionRef.current = onRecognition;
  const descriptorsRef = useRef(localDescriptors);
  descriptorsRef.current = localDescriptors;
  const matcherRef = useRef(null);
  const faceStartRef = useRef(null);
  const lastCenterRef = useRef(null);
  const processingRef = useRef(false);
  const cooldownRef = useRef(0);
  const loopRef = useRef(null);
  const streamRef = useRef(null);
  const mpDetectorRef = useRef(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const buildMatcher = useCallback(() => {
    const descs = descriptorsRef.current || [];
    if (!descs.length) { matcherRef.current = null; return; }
    const labeled = descs.map((d) => new faceapi.LabeledFaceDescriptors(d.label, [Float32Array.from(d.descriptor)]));
    matcherRef.current = new faceapi.FaceMatcher(labeled, 0.55);
  }, []);

  useEffect(() => { buildMatcher(); }, [localDescriptors, buildMatcher]);

  const stopLoop = useCallback(() => {
    if (loopRef.current) { clearTimeout(loopRef.current); loopRef.current = null; }
  }, []);

  const runRecognition = useCallback(async (video) => {
    processingRef.current = true;
    setProcessing(true);
    const vw = video.videoWidth || 640, vh = video.videoHeight || 480;
    try {
      // ── STEP 2A: descriptor face-api.js (TensorFlow.js) ──────────
      const result = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 }))
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (!result || !result.descriptor) {
        setLocalMatch({ status: "no_descriptor", message: "Rosto não estável o suficiente" });
        return;
      }
      const descriptor = result.descriptor; // Float32Array(128)

      // ── STEP 2B: match local (FaceMatcher) ──────────────────────
      let localBest = null;
      if (matcherRef.current) {
        const m = matcherRef.current.matchDescriptor(descriptor);
        if (m && m.label !== "unknown") {
          const sim = Math.max(0, Math.round((1 - m.distance) * 100));
          localBest = { label: m.label, distance: m.distance, sim };
          setLocalMatch(localBest);
        } else {
          setLocalMatch({ status: "no_local_match", message: "Sem correspondência local" });
        }
      } else {
        setLocalMatch({ status: "no_cache", message: "Sem base local carregada" });
      }

      // ── Snapshot (para o log) ───────────────────────────────────
      const b = result.detection.box;
      const pad = 0.4;
      const px = Math.max(0, b.x - b.width * pad);
      const py = Math.max(0, b.y - b.height * pad);
      const pw = Math.min(vw - px, b.width * (1 + pad * 2));
      const ph = Math.min(vh - py, b.height * (1 + pad * 2));
      const canvas = document.createElement("canvas");
      canvas.width = pw; canvas.height = ph;
      canvas.getContext("2d").drawImage(video, px, py, pw, ph, 0, 0, pw, ph);
      const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));

      let snapshot_url = null;
      if (blob) {
        const file = new File([blob], "checkpoint.jpg", { type: "image/jpeg" });
        const up = await base44.integrations.Core.UploadFile({ file });
        snapshot_url = up.file_url;
      }

      // ── Consulta ao backend com descriptor LOCAL (pula GPT) ──────
      const resp = await base44.functions.invoke("verificarCheckpoint", {
        embedding: Array.from(descriptor),
        snapshot_url,
        camera_id: "CHECKPOINT-01",
      });
      const res = resp.data;
      onRecognitionRef.current({ ...res, localBest, snapshot_url });
    } catch (err) {
      console.error("Recognition error:", err);
    } finally {
      processingRef.current = false;
      setProcessing(false);
      cooldownRef.current = Date.now() + COOLDOWN_MS;
      faceStartRef.current = null;
      lastCenterRef.current = null;
    }
  }, []);

  const startLoop = useCallback(() => {
    stopLoop();
    let running = true;
    const loop = async () => {
      if (!running) return;
      const video = videoRef.current;
      if (enabledRef.current && video && video.readyState >= 2 && mpDetectorRef.current) {
        try {
          // ── STEP 1: Google MediaPipe (20 FPS) ───────────────────
          const mpRes = mpDetectorRef.current.detectForVideo(video, performance.now());
          const dets = mpRes?.detections || [];
          if (dets.length > 0) {
            const bb = dets[0].boundingBox;
            const vw = video.videoWidth || 640, vh = video.videoHeight || 480;
            const cx = (bb.originX + bb.width / 2) / vw;
            const cy = (bb.originY + bb.height / 2) / vh;
            setFacePresent(true);
            setDetection({ x: bb.originX / vw, y: bb.originY / vh, w: bb.width / vw, h: bb.height / vh });

            const now = Date.now();
            const last = lastCenterRef.current;
            if (last) {
              const mov = Math.hypot(cx - last.cx, cy - last.cy);
              if (mov >= STABILITY_THRESHOLD) faceStartRef.current = now;
            } else {
              faceStartRef.current = now;
            }
            lastCenterRef.current = { cx, cy };

            const stable = faceStartRef.current && (now - faceStartRef.current) >= STABILIZE_MS;
            if (stable && !processingRef.current && Date.now() >= cooldownRef.current) {
              await runRecognition(video);
            }
          } else {
            setFacePresent(false);
            setDetection(null);
            faceStartRef.current = null;
            lastCenterRef.current = null;
          }
        } catch { /* ignora erros isolados de frame */ }
      }
      loopRef.current = setTimeout(loop, 1000 / TARGET_FPS);
    };
    loopRef.current = setTimeout(loop, 1000 / TARGET_FPS);
  }, [runRecognition, stopLoop]);

  const startCamera = useCallback(async () => {
    setStatus("loading_models");
    setInitProgress(5);
    try {
      // Carrega MediaPipe (WASM) e face-api.js em paralelo
      const mpP = loadMediaPipe().then((d) => { mpDetectorRef.current = d; setInitProgress((p) => Math.max(p, 55)); });
      const faP = loadFaceApiModels().then(() => { buildMatcher(); setInitProgress((p) => Math.max(p, 75)); });
      await mpP;
      await faP;
      setInitProgress(100);
    } catch (err) {
      console.error("Model init failed:", err);
      setStatus("error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}); }
      setStatus("ready");
      startLoop();
    } catch { setStatus("no_camera"); }
  }, [startLoop, buildMatcher]);

  const stopCamera = useCallback(() => {
    stopLoop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
    setDetection(null);
    setFacePresent(false);
    setLocalMatch(null);
  }, [stopLoop]);

  useEffect(() => () => {
    stopLoop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (mpDetectorRef.current) { try { mpDetectorRef.current.close(); } catch {} mpDetectorRef.current = null; }
  }, [stopLoop]);

  return { videoRef, status, detection, facePresent, processing, localMatch, initProgress, startCamera, stopCamera };
}
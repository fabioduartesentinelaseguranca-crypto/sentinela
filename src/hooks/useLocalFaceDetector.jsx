/**
 * useLocalFaceDetector
 * Detecção facial LOCAL no navegador via face-api.js (TinyFaceDetector).
 * Scana a webcam a 15 FPS. Só dispara onFaceStable(blob) quando um rosto
 * está estável por >1s. Reduz drasticamente chamadas ao backend/cloud.
 */
import { useRef, useState, useCallback, useEffect } from "react";
import * as faceapi from "@vladmandic/face-api";

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model/";
const TARGET_FPS = 15;
const STABILIZE_MS = 1000;
const COOLDOWN_MS = 4000;

let modelsPromise = null;
function loadModels() {
  if (!modelsPromise) {
    modelsPromise = faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  }
  return modelsPromise;
}

export function useLocalFaceDetector({ onFaceStable, enabled = true }) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | loading_models | ready | no_camera | error
  const [detection, setDetection] = useState(null);
  const [facePresent, setFacePresent] = useState(false);
  const [processing, setProcessing] = useState(false);

  const onFaceStableRef = useRef(onFaceStable);
  onFaceStableRef.current = onFaceStable;
  const faceStartRef = useRef(null);
  const processingRef = useRef(false);
  const loopRef = useRef(null);
  const streamRef = useRef(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const stopLoop = useCallback(() => {
    if (loopRef.current) { clearTimeout(loopRef.current); loopRef.current = null; }
  }, []);

  const startLoop = useCallback(() => {
    stopLoop();
    let running = true;
    const loop = async () => {
      if (!running) return;
      const video = videoRef.current;
      if (enabledRef.current && video && video.readyState >= 2) {
        try {
          const det = await faceapi.detectSingleFace(
            video,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 })
          );
          if (det) {
            setFacePresent(true);
            const vw = video.videoWidth || 640;
            const vh = video.videoHeight || 480;
            setDetection({
              x: det.box.x / vw, y: det.box.y / vh,
              w: det.box.width / vw, h: det.box.height / vh
            });
            const now = Date.now();
            if (!faceStartRef.current) faceStartRef.current = now;
            if (now - faceStartRef.current >= STABILIZE_MS && !processingRef.current) {
              processingRef.current = true;
              setProcessing(true);
              faceStartRef.current = null;
              const b = det.box;
              const pad = 0.4;
              const px = Math.max(0, b.x - b.width * pad);
              const py = Math.max(0, b.y - b.height * pad);
              const pw = Math.min(vw - px, b.width * (1 + pad * 2));
              const ph = Math.min(vh - py, b.height * (1 + pad * 2));
              const canvas = document.createElement("canvas");
              canvas.width = pw; canvas.height = ph;
              canvas.getContext("2d").drawImage(video, px, py, pw, ph, 0, 0, pw, ph);
              canvas.toBlob(async (blob) => {
                try {
                  if (blob) await onFaceStableRef.current(blob);
                } catch { /* erro tratado no caller */ }
                finally {
                  processingRef.current = false;
                  setProcessing(false);
                  setTimeout(() => { faceStartRef.current = null; }, COOLDOWN_MS);
                }
              }, "image/jpeg", 0.85);
            }
          } else {
            setFacePresent(false);
            setDetection(null);
            faceStartRef.current = null;
          }
        } catch { /* ignora erros de frame isolados */ }
      }
      loopRef.current = setTimeout(loop, 1000 / TARGET_FPS);
    };
    loopRef.current = setTimeout(loop, 1000 / TARGET_FPS);
  }, [stopLoop]);

  const startCamera = useCallback(async () => {
    setStatus("loading_models");
    try { await loadModels(); }
    catch { setStatus("error"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setStatus("ready");
      startLoop();
    } catch {
      setStatus("no_camera");
    }
  }, [startLoop]);

  const stopCamera = useCallback(() => {
    stopLoop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus("idle");
    setDetection(null);
    setFacePresent(false);
  }, [stopLoop]);

  useEffect(() => {
    return () => {
      stopLoop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [stopLoop]);

  return { videoRef, status, detection, facePresent, processing, startCamera, stopCamera };
}
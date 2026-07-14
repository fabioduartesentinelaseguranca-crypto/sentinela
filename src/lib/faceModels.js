/**
 * faceModels — carregamento compartilhado dos modelos face-api.js
 * (tinyFaceDetector + faceLandmark68Net + faceRecognitionNet) a partir de CDN.
 * Usado tanto no cadastro quanto no pipeline de checkpoint para garantir
 * que todos os embeddings fiquem no mesmo espaço vetorial (comparáveis).
 */
import * as faceapi from "@vladmandic/face-api";

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model/";

let modelsPromise = null;
export function loadFaceApiModels() {
  if (!modelsPromise) {
    modelsPromise = Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
  }
  return modelsPromise;
}

export { faceapi };

/**
 * Computa o descriptor facial 128-dim (Float32Array) de um elemento img/video.
 * Retorna null se nenhum rosto for detectado.
 */
export async function computeDescriptorFromImage(input) {
  await loadFaceApiModels();
  const result = await faceapi
    .detectSingleFace(input, new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.4 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  return result?.descriptor || null;
}
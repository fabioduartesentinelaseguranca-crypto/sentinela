/**
 * WebAuthn helpers for biometric authentication (TouchID / FaceID / Windows Hello).
 * Uses the browser's PublicKeyCredential API — no external service needed.
 */

const RP_NAME = "Sentinela Segurança";
const STORAGE_KEY = "sentinela_webauthn_cred_id";

function strToUint8(str) {
  return new TextEncoder().encode(str);
}
function bufToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function base64ToBuf(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export function isWebAuthnSupported() {
  return (
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential === "function"
  );
}

export function hasSavedCredential() {
  return !!localStorage.getItem(STORAGE_KEY);
}

/**
 * Register a new biometric credential for the user.
 * @param {string} userId
 * @param {string} userName
 */
export async function registerBiometric(userId, userName) {
  if (!isWebAuthnSupported()) throw new Error("WebAuthn não suportado neste dispositivo.");

  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: RP_NAME },
      user: {
        id: strToUint8(userId),
        name: userName,
        displayName: userName,
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },   // ES256
        { alg: -257, type: "public-key" }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform", // device biometric only
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60000,
    },
  });

  const credId = bufToBase64(credential.rawId);
  localStorage.setItem(STORAGE_KEY, credId);
  return credId;
}

/**
 * Authenticate with saved biometric credential.
 * Resolves true on success, throws on failure/cancel.
 */
export async function authenticateBiometric() {
  if (!isWebAuthnSupported()) throw new Error("WebAuthn não suportado neste dispositivo.");

  const savedId = localStorage.getItem(STORAGE_KEY);
  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const options = {
    publicKey: {
      challenge,
      timeout: 60000,
      userVerification: "required",
    },
  };

  if (savedId) {
    options.publicKey.allowCredentials = [
      { id: base64ToBuf(savedId), type: "public-key" },
    ];
  }

  await navigator.credentials.get(options);
  return true;
}

export function removeSavedCredential() {
  localStorage.removeItem(STORAGE_KEY);
}
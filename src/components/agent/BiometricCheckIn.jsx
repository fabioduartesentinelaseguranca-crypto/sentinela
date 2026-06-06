import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Fingerprint, ShieldCheck, ShieldOff, Loader2, KeyRound, Trash2 } from "lucide-react";
import {
  isWebAuthnSupported,
  hasSavedCredential,
  registerBiometric,
  authenticateBiometric,
  removeSavedCredential,
} from "@/lib/webauthn";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { nowISO, nowTimestamp } from "@/lib/deviceTime";

const VERIFY_KEY = "sentinela_biometric_verified";
const VERIFY_TTL = 8 * 60 * 60 * 1000; // 8 hours

function isCurrentlyVerified() {
  const ts = sessionStorage.getItem(VERIFY_KEY);
  if (!ts) return false;
  return (Date.now() - parseInt(ts)) < VERIFY_TTL;
}

export default function BiometricCheckIn({ userId, userName, onVerified, activeShift }) {
  const [supported, setSupported] = useState(false);
  const [hasCredential, setHasCredential] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [verified, setVerified] = useState(false);
  const [plate, setPlate] = useState("");
  const [prefix, setPrefix] = useState("");
  const [checkingIn, setCheckingIn] = useState(false);

  useEffect(() => {
    setSupported(isWebAuthnSupported());
    setHasCredential(hasSavedCredential());
    setVerified(isCurrentlyVerified());
  }, []);

  const register = async () => {
    setRegistering(true);
    try {
      await registerBiometric(userId, userName);
      setHasCredential(true);
      toast.success("Biometria cadastrada com sucesso!");
    } catch (e) {
      toast.error(e.message || "Erro ao cadastrar biometria");
    }
    setRegistering(false);
  };

  const verify = async () => {
    setVerifying(true);
    try {
      await authenticateBiometric();
      sessionStorage.setItem(VERIFY_KEY, nowTimestamp().toString());
      setVerified(true);
      toast.success("Identidade verificada via biometria ✓");
      onVerified?.();
    } catch (e) {
      toast.error("Verificação biométrica falhou. Tente novamente.");
    }
    setVerifying(false);
  };

  const checkIn = async () => {
    if (!prefix) return toast.error("Informe o prefixo da viatura");
    setCheckingIn(true);
    await base44.entities.Shift.create({
      agent_id: userId,
      vehicle_plate: plate,
      vehicle_prefix: prefix,
      start_time: nowISO(),
      status: "active",
    });
    await base44.entities.SystemLog.create({
      event: "biometric_checkin",
      actor_id: userId,
      actor_name: userName,
      details: `Check-in biométrico realizado na viatura ${prefix}`,
      severity: "info",
    });
    toast.success("Check-in realizado com autenticação biométrica");
    setCheckingIn(false);
    onVerified?.();
  };

  if (activeShift) return null;

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Fingerprint className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Verificação de Identidade</h3>
        {verified && (
          <span className="ml-auto flex items-center gap-1 text-xs text-success font-medium">
            <ShieldCheck className="w-3.5 h-3.5" /> Verificado
          </span>
        )}
      </div>

      {!supported && (
        <div className="flex items-center gap-2 text-xs text-warning">
          <ShieldOff className="w-4 h-4" />
          WebAuthn não suportado neste dispositivo. Use login convencional.
        </div>
      )}

      {supported && !hasCredential && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Cadastre sua biometria (TouchID / FaceID / Windows Hello) para login rápido ao iniciar o turno.
          </p>
          <Button onClick={register} disabled={registering} variant="outline" className="w-full">
            {registering ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Fingerprint className="w-4 h-4 mr-2" />}
            Cadastrar Biometria
          </Button>
        </div>
      )}

      {supported && hasCredential && !verified && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Confirme sua identidade antes de iniciar o turno.
          </p>
          <Button onClick={verify} disabled={verifying} className="w-full">
            {verifying ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Fingerprint className="w-4 h-4 mr-2" />}
            Verificar com Biometria
          </Button>
          <button
            onClick={() => { removeSavedCredential(); setHasCredential(false); }}
            className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 mx-auto"
          >
            <Trash2 className="w-3 h-3" /> Remover credencial salva
          </button>
        </div>
      )}

      {(!supported || verified) && (
        <div className="space-y-3 pt-1">
          <div>
            <Label className="text-xs">Prefixo da Viatura *</Label>
            <Input value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} placeholder="VTR-0042" className="font-mono mt-1" />
          </div>
          <div>
            <Label className="text-xs">Placa (opcional)</Label>
            <Input value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} placeholder="ABC1D23" className="font-mono mt-1" />
          </div>
          <Button onClick={checkIn} disabled={checkingIn} className="w-full">
            {checkingIn ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
            Iniciar Turno
          </Button>
        </div>
      )}
    </div>
  );
}
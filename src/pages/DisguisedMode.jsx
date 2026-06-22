import { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getCurrentLocation } from "@/lib/geo";
import { useAuth } from "@/lib/AuthContext";
import { nowISO } from "@/lib/deviceTime";

// Fake calculator with silent SOS via secret sequence and coercion PIN detection.
// Normal disarm PIN clears the faux alarm. Coercion PIN pretends to disarm but silently
// fires a critical red alert — the user is under duress.

export default function DisguisedMode() {
  const { user } = useAuth();
  const [display, setDisplay] = useState("0");
  const [prev, setPrev] = useState(null);
  const [op, setOp] = useState(null);
  const [fresh, setFresh] = useState(true);
  const [sosTriggered, setSosTriggered] = useState(false);
  const [disarmActive, setDisarmActive] = useState(true);
  const secretSeq = useRef([]);
  const trackRef = useRef(null);
  const sosLocked = useRef(false);

  // Silent background location tracking
  useEffect(() => {
    trackRef.current = setInterval(async () => {
      const loc = await getCurrentLocation();
      if (user?.id) {
        base44.auth.updateMe({ last_location: { ...loc, updated_at: nowISO() } }).catch(() => {});
      }
    }, 15000);
    return () => clearInterval(trackRef.current);
  }, [user?.id]);

  const triggerSilentSOS = async (reason) => {
    if (sosLocked.current) return;
    sosLocked.current = true;
    setSosTriggered(true);
    const loc = await getCurrentLocation();
    await Promise.all([
      base44.entities.Occurrence.create({
        type: "panic",
        subtype: "Emergência Pessoal",
        description: `[MODO DISFARÇADO] ${reason || "Pânico silencioso"} acionado por ${user?.full_name}`,
        lat: loc.lat, lng: loc.lng, reporter_id: user?.id,
        priority: "critical", status: "open",
      }),
      base44.entities.Alertas_Inteligencia_IA.create({
        id_usuario: user?.id,
        tipo_gatilho: "SENHA_COERCAO",
        data_hora_brasilia: new Date().toISOString(),
        geolocalizacao_latitude: loc.lat,
        geolocalizacao_longitude: loc.lng,
        status_alerta: "TRIAGEM_IA",
        resumo_despacho_ia: `CÓDIGO VERMELHO — ${user?.full_name} está sob coação. Senha de coação digitada. Usuário rendido.`,
        grau_prioridade_ia: "CRÍTICO_RISCO_MORTE",
      }),
    ]);
    setTimeout(() => { setSosTriggered(false); sosLocked.current = false; }, 10000);
  };

  const checkPins = () => {
    const typed = display;
    const disarmPin = user?.disarm_pin;
    const coercionPin = user?.coercion_pin;

    // Coercion PIN — pretend to disarm, fire silent red alert
    if (coercionPin && typed === coercionPin && disarmActive) {
      // Fake disarm: show a harmless-looking result
      setDisplay("0");
      setDisarmActive(false);
      triggerSilentSOS("Senha de coação — usuário rendido");
      return true;
    }

    // Normal disarm PIN — quietly disarm the faux alarm
    if (disarmPin && typed === disarmPin && disarmActive) {
      setDisplay("0");
      setDisarmActive(false);
      return true;
    }

    return false;
  };

  const handleNumber = (n) => {
    secretSeq.current = [...secretSeq.current.slice(-5), n];
    if (secretSeq.current.join("") === "91191") {
      triggerSilentSOS("Sequência secreta");
    }
    setDisplay(fresh ? n : display === "0" ? n : display + n);
    setFresh(false);
  };

  const handleOp = (o) => {
    setPrev(parseFloat(display));
    setOp(o);
    setFresh(true);
  };

  const handleEqual = () => {
    if (op === null && prev === null) {
      // Typing a raw number and pressing = — check PINs
      if (checkPins()) return;
    }
    if (op === null || prev === null) return;
    const curr = parseFloat(display);
    let result;
    if (op === "+") result = prev + curr;
    else if (op === "-") result = prev - curr;
    else if (op === "×") result = prev * curr;
    else if (op === "÷") result = curr !== 0 ? prev / curr : "Erro";
    setDisplay(String(parseFloat((+result).toFixed(10))));
    setPrev(null); setOp(null); setFresh(true);
  };

  const handleClear = () => { setDisplay("0"); setPrev(null); setOp(null); setFresh(true); secretSeq.current = []; };

  const handleDecimal = () => { if (!display.includes(".")) { setDisplay(display + "."); setFresh(false); } };

  const handleToggleSign = () => { setDisplay(String(-parseFloat(display))); };

  const handlePercent = () => { setDisplay(String(parseFloat(display) / 100)); };

  const btn = (label, onClick, style = "") => (
    <button
      onClick={onClick}
      className={`h-16 w-full rounded-full text-xl font-semibold flex items-center justify-center active:opacity-70 transition-opacity select-none ${style}`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-black flex items-end justify-center pb-8 px-4">
      <div className="w-full max-w-xs">
        {/* Display */}
        <div className="px-4 mb-4 text-right">
          <div className="text-[60px] font-thin text-white leading-none overflow-hidden" style={{ wordBreak: "break-all" }}>
            {display.length > 9 ? parseFloat(display).toExponential(3) : display}
          </div>
        </div>

        {/* Buttons */}
        <div className="grid grid-cols-4 gap-3">
          {btn("AC", handleClear, "bg-[#a5a5a5] text-black")}
          {btn("+/-", handleToggleSign, "bg-[#a5a5a5] text-black")}
          {btn("%", handlePercent, "bg-[#a5a5a5] text-black")}
          {btn("÷", () => handleOp("÷"), op === "÷" ? "bg-white text-[#ff9f0a]" : "bg-[#ff9f0a] text-white")}

          {["7","8","9"].map((n) => btn(n, () => handleNumber(n), "bg-[#333333] text-white"))}
          {btn("×", () => handleOp("×"), op === "×" ? "bg-white text-[#ff9f0a]" : "bg-[#ff9f0a] text-white")}

          {["4","5","6"].map((n) => btn(n, () => handleNumber(n), "bg-[#333333] text-white"))}
          {btn("−", () => handleOp("-"), op === "-" ? "bg-white text-[#ff9f0a]" : "bg-[#ff9f0a] text-white")}

          {["1","2","3"].map((n) => btn(n, () => handleNumber(n), "bg-[#333333] text-white"))}
          {btn("+", () => handleOp("+"), op === "+" ? "bg-white text-[#ff9f0a]" : "bg-[#ff9f0a] text-white")}

          <button
            onClick={() => handleNumber("0")}
            className="col-span-2 h-16 rounded-full bg-[#333333] text-white text-xl font-semibold flex items-center px-6 active:opacity-70 transition-opacity select-none"
          >
            0
          </button>
          {btn(".", handleDecimal, "bg-[#333333] text-white")}
          {btn("=", handleEqual, "bg-[#ff9f0a] text-white")}
        </div>

        <p className="text-center text-[10px] text-[#333] mt-6 select-none">Calculadora</p>
      </div>
    </div>
  );
}
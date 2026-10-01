import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { requestAccess, verifyAccess } from "../api/api";

const PIN_LENGTH = 6;
const RESEND_SECONDS = 300;

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function Auth() {
  const [email, setEmail] = useState("");
  const [pinDigits, setPinDigits] = useState(Array(PIN_LENGTH).fill(""));
  const [step, setStep] = useState("email");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const inputRefs = useRef([]);
  const timerRef = useRef(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const pin = pinDigits.join("");

  useEffect(() => {
    if (step !== "pin" || resendTimer <= 0) return;
    timerRef.current = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [step, resendTimer]);

  const startResendTimer = useCallback(() => {
    clearInterval(timerRef.current);
    setResendTimer(RESEND_SECONDS);
  }, []);

  async function handleRequestPin(e) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      await requestAccess(email);
      setStep("pin");
      startResendTimer();
      setMessage({ type: "success", text: "PIN enviado. Revisa el mail para verlo." });
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setMessage(null);
    try {
      await requestAccess(email);
      startResendTimer();
      setMessage({ type: "success", text: "PIN reenviado. Revisa el mail para verlo." });
    } catch (err) {
      setMessage({ type: "error", text: err.message });
    }
  }

  async function handleVerifyPin(e) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await verifyAccess(email, pin);
      login(res.token, email);
      navigate("/");
    } catch {
      setMessage({ type: "error", text: "Error: Código incorrecto" });
    } finally {
      setLoading(false);
    }
  }

  function handlePinChange(index, value) {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const newDigits = [...pinDigits];
    newDigits[index] = digit;
    setPinDigits(newDigits);
    if (digit && index < PIN_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePinKeyDown(index, e) {
    if (e.key === "Backspace" && !pinDigits[index] && index > 0) {
      const newDigits = [...pinDigits];
      newDigits[index - 1] = "";
      setPinDigits(newDigits);
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePinPaste(e) {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, PIN_LENGTH);
    if (!text) return;
    const newDigits = [...pinDigits];
    for (let i = 0; i < PIN_LENGTH; i++) {
      newDigits[i] = text[i] || "";
    }
    setPinDigits(newDigits);
    const nextIndex = Math.min(text.length, PIN_LENGTH - 1);
    inputRefs.current[nextIndex]?.focus();
  }

  function handleChangeEmail() {
    clearInterval(timerRef.current);
    setStep("email");
    setMessage(null);
    setPinDigits(Array(PIN_LENGTH).fill(""));
    setResendTimer(0);
  }

  return (
    <div className="auth-container">
      {step === "email" ? (
        <>
          <h2>Iniciar Sesión</h2>
          <p className="subtitle">Ingresa tu email para recibir un código de acceso</p>
          <form onSubmit={handleRequestPin}>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? "Enviando..." : "Enviar PIN"}
            </button>
          </form>
        </>
      ) : (
        <>
          <h2>Verificar PIN</h2>
          <p className="subtitle">Ingresa el PIN de 6 dígitos enviado a {email}</p>
          <form onSubmit={handleVerifyPin}>
            <div className="pin-input-container">
              {pinDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  className="pin-input-box"
                  value={digit}
                  onChange={(e) => handlePinChange(i, e.target.value)}
                  onKeyDown={(e) => handlePinKeyDown(i, e)}
                  onPaste={handlePinPaste}
                  onFocus={(e) => e.target.select()}
                />
              ))}
            </div>
            <div className="resend-container">
              {resendTimer > 0 ? (
                <span className="resend-text">
                  Reenviar código en {formatTime(resendTimer)}
                </span>
              ) : (
                <button type="button" className="resend-button" onClick={handleResend}>
                  Reenviar código
                </button>
              )}
            </div>
            <button className="btn-primary" type="submit" disabled={loading || pin.length < PIN_LENGTH}>
              {loading ? "Verificando..." : "Verificar"}
            </button>
          </form>
          <p style={{ marginTop: 12, fontSize: 13, textAlign: "center" }}>
            <button
              style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", fontSize: 13 }}
              onClick={handleChangeEmail}
            >
              Cambiar email
            </button>
          </p>
        </>
      )}
      {message && (
        <div className={`auth-message ${message.type}`}>
          {message.text}
        </div>
      )}
    </div>
  );
}

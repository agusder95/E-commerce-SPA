import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { requestAccess, verifyAccess } from '../api/auth';
import { PIN_LENGTH, RESEND_SECONDS, PENDING_EMAIL_KEY, PENDING_EMAIL_EXPIRES_KEY } from '../model/pin';

export default function usePinAuth() {
  const [email, setEmail] = useState(() => localStorage.getItem(PENDING_EMAIL_KEY) || "");
  const [requestedEmail, setRequestedEmail] = useState(() => localStorage.getItem(PENDING_EMAIL_KEY) || "");
  const [showReturnToPin, setShowReturnToPin] = useState(false);
  const [pinDigits, setPinDigits] = useState(Array(PIN_LENGTH).fill(""));
  const [step, setStep] = useState(() => localStorage.getItem(PENDING_EMAIL_KEY) ? "pin" : "email");
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(() => {
    const expiresAt = Number(localStorage.getItem(PENDING_EMAIL_EXPIRES_KEY));
    return expiresAt ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)) : 0;
  });
  const timerRef = useRef(null);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
    localStorage.setItem(PENDING_EMAIL_EXPIRES_KEY, String(Date.now() + RESEND_SECONDS * 1000));
  }, []);

  async function handleRequestPin(e) {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (requestedEmail && normalizedEmail === requestedEmail) {
      setMessage({ type: "error", text: "Ingresa un email diferente al anterior." });
      setShowReturnToPin(true);
      return;
    }

    setLoading(true);
    setMessage(null);
    setShowReturnToPin(false);
    try {
      await requestAccess(normalizedEmail, requestedEmail || null);
      setEmail(normalizedEmail);
      setRequestedEmail(normalizedEmail);
      localStorage.setItem(PENDING_EMAIL_KEY, normalizedEmail);
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
      localStorage.removeItem(PENDING_EMAIL_KEY);
      localStorage.removeItem(PENDING_EMAIL_EXPIRES_KEY);
      navigate(location.state?.from || "/", { replace: true });
    } catch {
      setMessage({ type: "error", text: "Error: Código incorrecto" });
    } finally {
      setLoading(false);
    }
  }

  function handleChangeEmail() {
    clearInterval(timerRef.current);
    setStep("email");
    setEmail("");
    setMessage(null);
    setShowReturnToPin(false);
    setPinDigits(Array(PIN_LENGTH).fill(""));
  }

  function handleReturnToPin() {
    setEmail(requestedEmail);
    setStep("pin");
    setMessage(null);
    setShowReturnToPin(false);
  }


  return {
    email, step, message, loading, resendTimer, pinDigits, showReturnToPin,
    canVerify: pin.length === PIN_LENGTH, onPinDigits: setPinDigits,
    onEmail: value => { setEmail(value); setShowReturnToPin(false); },
    requestPin: handleRequestPin, verifyPin: handleVerifyPin, resend: handleResend,
    changeEmail: handleChangeEmail, returnToPin: handleReturnToPin,
  };
}

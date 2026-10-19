import { useRef } from 'react';
import { PIN_LENGTH } from '../model/pin';

export default function PinInput({ value: pinDigits, onChange }) {
  const inputRefs = useRef([]);
  function handlePinChange(index, value) {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const newDigits = [...pinDigits];
    newDigits[index] = digit;
    onChange(newDigits);
    if (digit && index < PIN_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePinKeyDown(index, e) {
    if (e.key === "Backspace" && !pinDigits[index] && index > 0) {
      const newDigits = [...pinDigits];
      newDigits[index - 1] = "";
      onChange(newDigits);
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
    onChange(newDigits);
    const nextIndex = Math.min(text.length, PIN_LENGTH - 1);
    inputRefs.current[nextIndex]?.focus();
  }


  return <div className="pin-input-container">
              {pinDigits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { inputRefs.current[i] = el; }}
                  aria-label={`Dígito ${i + 1} del PIN`}
                  autoComplete={i === 0 ? "one-time-code" : "off"}
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
            </div>;
}

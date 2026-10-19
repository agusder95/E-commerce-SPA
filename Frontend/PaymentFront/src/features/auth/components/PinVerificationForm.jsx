import PinInput from './PinInput';
import { formatTime } from '../model/pin';

export default function PinVerificationForm({ email, pinDigits, loading, resendTimer, canVerify,
  onPinDigits, onSubmit, onResend, onChangeEmail }) {
  return <>
    <h2>Verificar PIN</h2>
    <p className="subtitle">Ingresa el PIN de 6 dígitos enviado a {email}</p>
    <form onSubmit={onSubmit}>
      <PinInput value={pinDigits} onChange={onPinDigits} />
      <div className="resend-container">{resendTimer > 0
        ? <span className="resend-text">Reenviar código en {formatTime(resendTimer)}</span>
        : <button type="button" className="resend-button" onClick={onResend}>Reenviar código</button>}</div>
      <button className="btn-primary" type="submit" disabled={loading || !canVerify}>
        {loading ? 'Verificando...' : 'Verificar'}
      </button>
    </form>
    <p className="auth-change-email"><button type="button" className="resend-button" onClick={onChangeEmail}>Cambiar email</button></p>
  </>;
}

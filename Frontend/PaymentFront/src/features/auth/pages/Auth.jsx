import usePinAuth from '../hooks/usePinAuth';
import EmailAccessForm from '../components/EmailAccessForm';
import PinVerificationForm from '../components/PinVerificationForm';
import Feedback from '../../../shared/ui/Feedback';

export default function Auth() {
  const auth = usePinAuth();
  return <div className="auth-container">
    {auth.step === 'email'
      ? <EmailAccessForm email={auth.email} loading={auth.loading} onEmail={auth.onEmail} onSubmit={auth.requestPin} />
      : <PinVerificationForm email={auth.email} pinDigits={auth.pinDigits} loading={auth.loading}
        resendTimer={auth.resendTimer} canVerify={auth.canVerify} onPinDigits={auth.onPinDigits}
        onSubmit={auth.verifyPin} onResend={auth.resend} onChangeEmail={auth.changeEmail} />}
    <Feedback error={auth.message?.type === 'error' ? auth.message.text : ''}
      notice={auth.message?.type === 'success' ? auth.message.text : ''} />
    {auth.showReturnToPin && auth.step === 'email' && <button type="button"
      className="btn-secondary auth-return-pin" onClick={auth.returnToPin}>Volver a ingresar el PIN enviado</button>}
  </div>;
}

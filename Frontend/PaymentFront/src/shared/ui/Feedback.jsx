export default function Feedback({ error, notice }) {
  return <>{error && <p role="alert" className="auth-message error">{error}</p>}
    {notice && <p role="status" className="auth-message success">{notice}</p>}</>;
}

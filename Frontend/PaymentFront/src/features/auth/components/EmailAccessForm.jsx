export default function EmailAccessForm({ email, loading, onEmail, onSubmit }) {
  return <>
    <h2>Iniciar Sesión</h2>
    <p className="subtitle">Ingresa tu email para recibir un código de acceso</p>
          <form onSubmit={onSubmit}>
            <div className="form-group">
              <label htmlFor="access-email">Email</label>
              <input
                id="access-email"
                autoComplete="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => {
                  onEmail(e.target.value);
                }}
                required
              />
            </div>
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? "Enviando..." : "Enviar PIN"}
            </button>
          </form>
  </>;
}

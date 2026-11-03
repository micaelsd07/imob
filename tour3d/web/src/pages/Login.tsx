import { FormEvent, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/painel" replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
      nav(loc.state?.from || '/painel', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <aside className="login-hero">
        <div className="login-hero-inner">
          <div className="brand brand-light">Fabelle <span>Tour 3D</span></div>
          <h1>Mostre o imóvel por dentro, cômodo por cômodo.</h1>
          <p>Envie as fotos de cada ambiente e gere um tour virtual 360° que o cliente gira, explora e percorre direto do celular.</p>
          <ul className="login-points">
            <li>📷 Guia passo a passo de como fotografar</li>
            <li>🧭 Navegação entre sala, quartos, cozinha e garagem</li>
            <li>🔗 Link pronto para WhatsApp e portais</li>
          </ul>
        </div>
      </aside>

      <main className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="brand only-mobile">Fabelle <span>Tour 3D</span></div>
          <h2>Entrar no painel</h2>
          <p className="muted">Acesso exclusivo para corretores e imobiliárias.</p>

          <label className="field">
            <span>E-mail</span>
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@imobiliaria.com" />
          </label>
          <label className="field">
            <span>Senha</span>
            <div className="input-group">
              <input type={show ? 'text' : 'password'} autoComplete="current-password" required value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              <button type="button" className="input-addon" onClick={() => setShow(!show)}>{show ? 'Ocultar' : 'Mostrar'}</button>
            </div>
          </label>

          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn btn-primary btn-block" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
          <p className="hint">Primeiro acesso: <b>admin@fabelle.com</b> / <b>fabelle123</b></p>
        </form>
      </main>
    </div>
  );
}

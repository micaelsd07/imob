import { FormEvent, useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { api, User } from '../lib/api';
import { useAuth } from '../lib/auth';

export default function Team() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  return (
    <Layout>
      <div className="page-head">
        <div>
          <h1>{isAdmin ? 'Equipe e conta' : 'Minha conta'}</h1>
          <p className="muted">{isAdmin ? 'Cadastre os corretores que vão usar o painel.' : 'Altere sua senha de acesso.'}</p>
        </div>
      </div>
      <div className={isAdmin ? 'team' : ''}>
        {isAdmin && <Members me={user!.id} />}
        <Password />
      </div>
    </Layout>
  );
}

function Members({ me }: { me: number }) {
  const [list, setList] = useState<User[] | null>(null);
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'corretor' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { api<User[]>('/users').then(setList).catch((e) => setError(e.message)); }, []);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      setList(await api<User[]>('/users', { method: 'POST', json: f }));
      setF({ name: '', email: '', password: '', role: 'corretor' });
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  const del = async (u: User) => {
    if (!confirm(`Excluir ${u.name}? Os ${u.property_count} imóvel(is) e fotos dele também serão apagados.`)) return;
    try { setList(await api<User[]>(`/users/${u.id}`, { method: 'DELETE' })); } catch (err) { setError((err as Error).message); }
  };

  return (
    <div className="stack">
      <div className="card">
        <h2 className="card-title">Equipe ({list?.length ?? '–'})</h2>
        {!list ? <div className="center-pad"><div className="spinner" /></div> : (
          <div className="members">
            {list.map((u) => (
              <div className="member" key={u.id}>
                <div className="avatar">{u.name[0]}</div>
                <div className="member-info">
                  <b>{u.name} {u.id === me && <small className="muted">(você)</small>}</b>
                  <small className="muted">{u.email} · {u.property_count} imóvel(is)</small>
                </div>
                <span className={`tag ${u.role === 'admin' ? 'tag-gold' : 'tag-gray'}`}>{u.role === 'admin' ? 'Admin' : 'Corretor'}</span>
                {u.id !== me && <button className="icon-btn danger" title="Excluir" onClick={() => del(u)}>🗑</button>}
              </div>
            ))}
          </div>
        )}
      </div>
      <form className="card" onSubmit={add}>
        <h2 className="card-title">Adicionar corretor</h2>
        <p className="muted">Envie o e-mail e a senha para a pessoa entrar no painel.</p>
        <div className="form-grid">
          <label className="field"><span>Nome</span><input required value={f.name} onChange={set('name')} /></label>
          <label className="field"><span>E-mail</span><input type="email" required value={f.email} onChange={set('email')} /></label>
          <label className="field"><span>Senha inicial</span><input required minLength={6} value={f.password} onChange={set('password')} placeholder="mínimo 6 caracteres" /></label>
          <label className="field"><span>Permissão</span>
            <select value={f.role} onChange={set('role')}>
              <option value="corretor">Corretor (só os próprios imóveis)</option>
              <option value="admin">Administrador (gerencia a equipe)</option>
            </select>
          </label>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="actions"><button className="btn btn-primary" disabled={busy}>{busy ? 'Salvando…' : 'Adicionar'}</button></div>
      </form>
    </div>
  );
}

function Password() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api('/auth/password', { method: 'PUT', json: { current, next } });
      setMsg({ ok: true, t: 'Senha alterada.' }); setCurrent(''); setNext('');
    } catch (err) { setMsg({ ok: false, t: (err as Error).message }); }
  };
  return (
    <form className="card" onSubmit={submit} style={{ alignSelf: 'start' }}>
      <h2 className="card-title">Trocar minha senha</h2>
      <label className="field mt"><span>Senha atual</span><input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} /></label>
      <label className="field"><span>Nova senha</span><input type="password" required minLength={6} value={next} onChange={(e) => setNext(e.target.value)} /></label>
      {msg && <div className={`alert ${msg.ok ? 'alert-ok' : 'alert-error'}`}>{msg.t}</div>}
      <button className="btn btn-primary btn-block">Salvar nova senha</button>
    </form>
  );
}

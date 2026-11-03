import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { api, brl, Property } from '../lib/api';

export default function Dashboard() {
  const [list, setList] = useState<Property[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [q, setQ] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { api<Property[]>('/properties').then(setList).catch((e) => setError(e.message)); }, []);

  const filtered = (list ?? []).filter((p) =>
    `${p.title} ${p.city ?? ''} ${p.address ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  const published = (list ?? []).filter((p) => p.published).length;
  const rooms = (list ?? []).reduce((n, p) => n + (p.room_count ?? 0), 0);

  return (
    <Layout>
      <div className="page-head">
        <div>
          <h1>Meus imóveis</h1>
          <p className="muted">Cadastre um imóvel, envie as fotos e gere o tour 3D.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>+ Novo imóvel</button>
      </div>

      <div className="stats">
        <div className="stat"><small>Imóveis</small><b>{list?.length ?? '–'}</b></div>
        <div className="stat"><small>Tours publicados</small><b>{list ? published : '–'}</b></div>
        <div className="stat"><small>Cômodos fotografados</small><b>{list ? rooms : '–'}</b></div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {list && list.length > 0 && (
        <input className="search" placeholder="Buscar por título, cidade ou endereço…" value={q} onChange={(e) => setQ(e.target.value)} />
      )}

      {!list ? (
        <div className="center-pad"><div className="spinner" /></div>
      ) : list.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🏡</div>
          <h3>Nenhum imóvel ainda</h3>
          <p className="muted">Comece cadastrando o primeiro imóvel. Depois você envia as fotos de cada cômodo.</p>
          <button className="btn btn-primary" onClick={() => setCreating(true)}>Cadastrar primeiro imóvel</button>
        </div>
      ) : (
        <div className="grid">
          {filtered.map((p) => (
            <Link to={`/painel/imoveis/${p.id}`} className="prop-card" key={p.id}>
              <div className="prop-cover" style={p.cover ? { backgroundImage: `url(${p.cover})` } : undefined}>
                {!p.cover && <span>Sem fotos</span>}
                <span className={`badge ${p.published ? 'badge-green' : 'badge-gray'}`}>{p.published ? 'Publicado' : 'Rascunho'}</span>
              </div>
              <div className="prop-body">
                <b>{p.title}</b>
                <small className="muted">{[p.address, p.city].filter(Boolean).join(' · ') || 'Endereço não informado'}</small>
                <div className="prop-meta">
                  <span>{p.room_count} cômodo{p.room_count === 1 ? '' : 's'}</span>
                  {p.price ? <span className="price">{brl(p.price)}</span> : null}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {creating && <NewPropertyModal onClose={() => setCreating(false)} />}
    </Layout>
  );
}

function NewPropertyModal({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const [title, setTitle] = useState('');
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const p = await api<Property>('/properties', { method: 'POST', json: { title, city } });
      nav(`/painel/imoveis/${p.id}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h3>Novo imóvel</h3>
        <p className="muted">Você completa os outros dados no próximo passo.</p>
        <label className="field"><span>Título do anúncio</span>
          <input autoFocus required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Apartamento 3 quartos no Centro" />
        </label>
        <label className="field"><span>Cidade</span>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Ex.: São Paulo - SP" />
        </label>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Criando…' : 'Criar e continuar'}</button>
        </div>
      </form>
    </div>
  );
}

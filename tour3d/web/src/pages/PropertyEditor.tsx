import { DragEvent, FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import PanoViewer, { ViewerHandle } from '../components/PanoViewer';
import PhotoGuide, { SHOT_ORDER } from '../components/PhotoGuide';
import { api, imageSize, isPanorama, Property, Room, ROOM_TYPES, roomIcon } from '../lib/api';

const STEPS = ['Dados do imóvel', 'Fotos dos cômodos', 'Conectar cômodos', 'Gerar e publicar'];

export default function PropertyEditor() {
  const { id } = useParams();
  const nav = useNavigate();
  const [p, setP] = useState<Property | null>(null);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Property>(`/properties/${id}`).then((data) => {
      setP(data);
      setStep(data.rooms.length === 0 ? (data.address ? 1 : 0) : data.rooms.some((r) => r.hotspots.length) ? 3 : 2);
    }).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <Layout><div className="alert alert-error">{error}</div><Link to="/painel">← Voltar</Link></Layout>;
  if (!p) return <Layout><div className="center-pad"><div className="spinner" /></div></Layout>;

  const done = [!!p.title && !!(p.address || p.city), p.rooms.length > 0, p.rooms.some((r) => r.hotspots.length > 0), p.published];

  const remove = async () => {
    if (!confirm(`Excluir "${p.title}" e todas as fotos? Esta ação não pode ser desfeita.`)) return;
    await api(`/properties/${p.id}`, { method: 'DELETE' });
    nav('/painel');
  };

  return (
    <Layout>
      <div className="page-head">
        <div>
          <Link to="/painel" className="back">← Meus imóveis</Link>
          <h1>{p.title}</h1>
        </div>
        <div className="row">
          {p.published && <a className="btn btn-ghost" href={`/tour/${p.slug}`} target="_blank" rel="noreferrer">Ver tour ↗</a>}
          <button className="btn btn-danger-ghost" onClick={remove}>Excluir</button>
        </div>
      </div>

      <ol className="stepper">
        {STEPS.map((s, i) => (
          <li key={s} className={`${i === step ? 'active' : ''} ${done[i] ? 'done' : ''}`} onClick={() => setStep(i)}>
            <span className="step-n">{done[i] && i !== step ? '✓' : i + 1}</span>
            <span className="step-label">{s}</span>
          </li>
        ))}
      </ol>

      {step === 0 && <StepDetails p={p} onSaved={(np) => { setP(np); setStep(1); }} />}
      {step === 1 && <StepPhotos p={p} setP={setP} onNext={() => setStep(2)} />}
      {step === 2 && <StepConnect p={p} setP={setP} onNext={() => setStep(3)} onBack={() => setStep(1)} />}
      {step === 3 && <StepPublish p={p} setP={setP} goto={setStep} />}
    </Layout>
  );
}

/* ---------------- Passo 1: dados ---------------- */
function StepDetails({ p, onSaved }: { p: Property; onSaved: (p: Property) => void }) {
  const [f, setF] = useState({
    title: p.title ?? '', address: p.address ?? '', city: p.city ?? '', price: p.price ?? '',
    bedrooms: p.bedrooms ?? '', bathrooms: p.bathrooms ?? '', area: p.area ?? '', description: p.description ?? '',
  });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try { onSaved(await api<Property>(`/properties/${p.id}`, { method: 'PUT', json: f })); } finally { setBusy(false); }
  };

  return (
    <form className="card" onSubmit={submit}>
      <h2 className="card-title">Dados do imóvel</h2>
      <p className="muted">Essas informações aparecem no tour público, ao lado das imagens.</p>
      <div className="form-grid">
        <label className="field span-2"><span>Título</span><input required value={f.title} onChange={set('title')} /></label>
        <label className="field"><span>Endereço</span><input value={f.address} onChange={set('address')} placeholder="Rua, número, bairro" /></label>
        <label className="field"><span>Cidade</span><input value={f.city} onChange={set('city')} /></label>
        <label className="field"><span>Preço (R$)</span><input type="number" min="0" value={f.price} onChange={set('price')} /></label>
        <label className="field"><span>Área (m²)</span><input type="number" min="0" value={f.area} onChange={set('area')} /></label>
        <label className="field"><span>Quartos</span><input type="number" min="0" value={f.bedrooms} onChange={set('bedrooms')} /></label>
        <label className="field"><span>Banheiros</span><input type="number" min="0" value={f.bathrooms} onChange={set('bathrooms')} /></label>
        <label className="field span-2"><span>Descrição</span><textarea rows={4} value={f.description} onChange={set('description')} /></label>
      </div>
      <div className="actions"><button className="btn btn-primary" disabled={busy}>{busy ? 'Salvando…' : 'Salvar e ir para as fotos →'}</button></div>
    </form>
  );
}

/* ---------------- Passo 2: fotos ---------------- */
type Pending = { key: string; file: File; preview: string; type: string; name: string; w: number; h: number; status: 'wait' | 'sending' | 'error'; error?: string };

const typeLabel = (t: string) => ROOM_TYPES.find((r) => r.value === t)?.label.split(' /')[0] ?? 'Cômodo';
const kindOf = (w?: number | null, h?: number | null) =>
  isPanorama(w, h) ? { cls: 'tag-green', txt: '360°' } : w && h && w / h > 2.15 ? { cls: 'tag-blue', txt: 'Panorâmica' } : { cls: 'tag-gray', txt: 'Foto comum' };

function StepPhotos({ p, setP, onNext }: { p: Property; setP: (p: Property) => void; onNext: () => void }) {
  const [queue, setQueue] = useState<Pending[]>([]);
  const [drag, setDrag] = useState(false);
  const [showGuide, setShowGuide] = useState(p.rooms.length === 0);
  const inputRef = useRef<HTMLInputElement>(null);

  const nameFor = (type: string, taken: string[]) => {
    const base = typeLabel(type);
    if (!taken.includes(base)) return base;
    let n = 2;
    while (taken.includes(`${base} ${n}`)) n++;
    return `${base} ${n}`;
  };

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type));
    const taken = [...p.rooms.map((r) => r.name), ...queue.map((q) => q.name)];
    const order = ['fachada', 'sala', 'cozinha', 'corredor', 'quarto', 'banheiro', 'lavanderia', 'garagem'];
    const items: Pending[] = [];
    for (const [i, file] of list.entries()) {
      const { width, height } = await imageSize(file).catch(() => ({ width: 0, height: 0 }));
      const type = order[Math.min(p.rooms.length + queue.length + i, order.length - 1)];
      const name = nameFor(type, taken);
      taken.push(name);
      items.push({ key: crypto.randomUUID(), file, preview: URL.createObjectURL(file), type, name, w: width, h: height, status: 'wait' });
    }
    setQueue((q) => [...q, ...items]);
  };

  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); };
  const upd = (key: string, patch: Partial<Pending>) => setQueue((q) => q.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const sendAll = async () => {
    for (const item of queue) {
      if (item.status === 'sending') continue;
      upd(item.key, { status: 'sending' });
      const fd = new FormData();
      fd.append('name', item.name);
      fd.append('type', item.type);
      fd.append('width', String(item.w));
      fd.append('height', String(item.h));
      fd.append('image', item.file);
      try {
        setP(await api<Property>(`/properties/${p.id}/rooms`, { method: 'POST', body: fd }));
        URL.revokeObjectURL(item.preview);
        setQueue((q) => q.filter((x) => x.key !== item.key));
      } catch (e) {
        upd(item.key, { status: 'error', error: (e as Error).message });
      }
    }
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const ids = p.rooms.map((r) => r.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    setP(await api<Property>(`/properties/${p.id}/reorder`, { method: 'POST', json: { ids } }));
  };

  const updateRoom = async (r: Room, patch: Record<string, string>) => {
    setP(await api<Property>(`/rooms/${r.id}`, { method: 'PUT', json: patch }));
  };

  const replace = async (r: Room, file: File) => {
    const { width, height } = await imageSize(file);
    const fd = new FormData();
    fd.append('image', file);
    fd.append('width', String(width));
    fd.append('height', String(height));
    setP(await api<Property>(`/rooms/${r.id}`, { method: 'PUT', body: fd }));
  };

  const del = async (r: Room) => {
    if (!confirm(`Excluir o cômodo "${r.name}"?`)) return;
    setP(await api<Property>(`/rooms/${r.id}`, { method: 'DELETE' }));
  };

  return (
    <div className="stack">
      <div className="card">
        <div className="card-row">
          <div>
            <h2 className="card-title">Como tirar as fotos</h2>
            <p className="muted">Uma foto por cômodo, tirada do centro, na ordem do caminho do visitante.</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowGuide(!showGuide)}>{showGuide ? 'Esconder guia' : 'Ver guia completo'}</button>
        </div>
        {showGuide ? <PhotoGuide /> : (
          <div className="order-chips">{SHOT_ORDER.map((s, i) => <span key={s.name} className="chip">{i + 1}. {s.icon} {s.name}</span>)}</div>
        )}
      </div>

      <div className="card">
        <h2 className="card-title">Enviar fotos</h2>
        <div
          className={`dropzone ${drag ? 'over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <div className="dropzone-icon">⬆️</div>
          <b>Arraste as fotos aqui ou toque para escolher</b>
          <small className="muted">JPG, PNG ou WEBP · até 40 MB · pode enviar várias de uma vez</small>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
        </div>

        {queue.length > 0 && (
          <>
            <p className="muted mt">Confira o cômodo de cada foto antes de enviar:</p>
            <div className="queue">
              {queue.map((q) => {
                const k = kindOf(q.w, q.h);
                return (
                  <div className="queue-item" key={q.key}>
                    <img src={q.preview} alt="" />
                    <div className="queue-fields">
                      <select value={q.type} onChange={(e) => upd(q.key, { type: e.target.value, name: typeLabel(e.target.value) })}>
                        {ROOM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                      </select>
                      <input value={q.name} onChange={(e) => upd(q.key, { name: e.target.value })} />
                      <div className="row-sm">
                        <span className={`tag ${k.cls}`}>{k.txt}</span>
                        <small className="muted">{q.w}×{q.h}</small>
                        {q.status === 'sending' && <small>Enviando…</small>}
                        {q.status === 'error' && <small className="text-error">{q.error}</small>}
                      </div>
                      {k.txt === 'Foto comum' && <small className="muted">Dica: com foto 360° o cliente consegue olhar em volta.</small>}
                    </div>
                    <button className="icon-btn" title="Remover" onClick={() => setQueue((x) => x.filter((i) => i.key !== q.key))}>✕</button>
                  </div>
                );
              })}
            </div>
            <div className="actions"><button className="btn btn-primary" onClick={sendAll}>Enviar {queue.length} foto{queue.length > 1 ? 's' : ''}</button></div>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-row">
          <h2 className="card-title">Cômodos do tour ({p.rooms.length})</h2>
          <small className="muted">Use as setas para ajustar a ordem do caminho.</small>
        </div>
        {p.rooms.length === 0 ? <p className="muted">Nenhuma foto enviada ainda.</p> : (
          <div className="rooms">
            {p.rooms.map((r, i) => {
              const k = kindOf(r.width, r.height);
              return (
                <div className="room" key={r.id}>
                  <span className="room-n">{i + 1}</span>
                  <img src={r.url} alt={r.name} />
                  <div className="room-info">
                    <input className="room-name" defaultValue={r.name} onBlur={(e) => e.target.value !== r.name && updateRoom(r, { name: e.target.value })} />
                    <div className="row-sm">
                      <select value={r.type} onChange={(e) => updateRoom(r, { type: e.target.value })}>
                        {ROOM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                      </select>
                      <span className={`tag ${k.cls}`}>{k.txt}</span>
                      {p.start_room_id === r.id && <span className="tag tag-gold">Início</span>}
                    </div>
                  </div>
                  <div className="room-actions">
                    <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} title="Subir">↑</button>
                    <button className="icon-btn" disabled={i === p.rooms.length - 1} onClick={() => move(i, 1)} title="Descer">↓</button>
                    <label className="icon-btn" title="Trocar foto">⟳
                      <input type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => e.target.files?.[0] && replace(r, e.target.files[0])} />
                    </label>
                    <button className="icon-btn danger" onClick={() => del(r)} title="Excluir">🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="actions"><button className="btn btn-primary" disabled={!p.rooms.length} onClick={onNext}>Próximo: conectar cômodos →</button></div>
      </div>
    </div>
  );
}

/* ---------------- Passo 3: conectar ---------------- */
function StepConnect({ p, setP, onNext, onBack }: { p: Property; setP: (p: Property) => void; onNext: () => void; onBack: () => void }) {
  const [roomId, setRoomId] = useState<number>(p.start_room_id ?? p.rooms[0]?.id);
  const [pick, setPick] = useState<{ yaw: number; pitch: number } | null>(null);
  const [msg, setMsg] = useState('');
  const viewer = useRef<ViewerHandle>(null);
  const room = p.rooms.find((r) => r.id === roomId) ?? p.rooms[0];

  if (!room) return <div className="card"><p>Envie as fotos primeiro.</p><button className="btn btn-primary" onClick={onBack}>← Fotos</button></div>;

  const flash = (t: string) => { setMsg(t); setTimeout(() => setMsg(''), 2500); };
  const byId = (id: number) => p.rooms.find((r) => r.id === id);

  const addHotspot = async (target: number) => {
    if (!pick) return;
    setP(await api<Property>(`/rooms/${room.id}/hotspots`, { method: 'POST', json: { target_room_id: target, ...pick } }));
    setPick(null);
    flash(`Passagem para "${byId(target)?.name}" criada.`);
  };

  const removeHotspot = async (hid: number) => {
    setP(await api<Property>(`/hotspots/${hid}`, { method: 'DELETE' }));
  };

  const saveInitialView = async () => {
    const v = viewer.current?.getView();
    if (!v) return;
    setP(await api<Property>(`/rooms/${room.id}`, { method: 'PUT', json: { initial_yaw: String(v.yaw) } }));
    flash('Visão inicial salva: o visitante vai começar olhando para esse ponto.');
  };

  const setStart = async () => {
    setP(await api<Property>(`/properties/${p.id}`, { method: 'PUT', json: { start_room_id: room.id } }));
    flash(`"${room.name}" é agora o primeiro cômodo do tour.`);
  };

  const autoConnect = async () => {
    if (!confirm('Criar passagens automáticas seguindo a ordem dos cômodos (cada um liga ao próximo e ao anterior)? Depois você pode ajustar a posição.')) return;
    let last = p;
    const has = (from: Room, to: number) => from.hotspots.some((h) => h.target_room_id === to);
    for (let i = 0; i < p.rooms.length - 1; i++) {
      const a = p.rooms[i], b = p.rooms[i + 1];
      if (!has(a, b.id)) last = await api<Property>(`/rooms/${a.id}/hotspots`, { method: 'POST', json: { target_room_id: b.id, yaw: 0, pitch: -12 } });
      if (!has(b, a.id)) last = await api<Property>(`/rooms/${b.id}/hotspots`, { method: 'POST', json: { target_room_id: a.id, yaw: 180, pitch: -12 } });
    }
    setP(last);
    flash('Cômodos conectados na ordem.');
  };

  return (
    <div className="connect">
      <aside className="card connect-side">
        <h2 className="card-title">Cômodos</h2>
        <div className="connect-list">
          {p.rooms.map((r) => (
            <button key={r.id} className={`connect-room ${r.id === room.id ? 'active' : ''}`} onClick={() => { setRoomId(r.id); setPick(null); }}>
              <img src={r.url} alt="" />
              <span>{roomIcon(r.type)} {r.name}<small>{r.hotspots.length} passage{r.hotspots.length === 1 ? 'm' : 'ns'}</small></span>
            </button>
          ))}
        </div>
        <button className="btn btn-ghost btn-block" onClick={autoConnect}>⚡ Conectar automaticamente</button>
      </aside>

      <section className="connect-main">
        <div className="howto">
          <b>Como conectar:</b> gire a imagem até a porta ou passagem e <b>toque nela</b>. Depois escolha para qual cômodo ela leva.
          Toque em uma passagem existente para removê-la.
        </div>
        <div className="viewer-box">
          <PanoViewer
            ref={viewer}
            src={room.url}
            width={room.width}
            height={room.height}
            initialYaw={room.initial_yaw}
            editing
            onPick={setPick}
            hotspots={room.hotspots.map((h) => ({ ...h, targetName: byId(h.target_room_id)?.name, targetIcon: roomIcon(byId(h.target_room_id)?.type ?? '') }))}
            onHotspotClick={(h) => confirm(`Remover a passagem para "${byId(h.target_room_id)?.name}"?`) && removeHotspot(h.id)}
          />
          {pick && (
            <div className="pick-pop">
              <b>Esta passagem leva para:</b>
              <div className="pick-list">
                {p.rooms.filter((r) => r.id !== room.id).map((r) => (
                  <button key={r.id} className="chip chip-btn" onClick={() => addHotspot(r.id)}>{roomIcon(r.type)} {r.name}</button>
                ))}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setPick(null)}>Cancelar</button>
            </div>
          )}
          {msg && <div className="toast">{msg}</div>}
        </div>
        <div className="row wrap">
          <button className="btn btn-ghost" onClick={saveInitialView}>🎯 Salvar visão inicial deste cômodo</button>
          <button className="btn btn-ghost" onClick={setStart} disabled={p.start_room_id === room.id}>
            {p.start_room_id === room.id ? '✓ Cômodo inicial do tour' : '🏁 Definir como início do tour'}
          </button>
          <span className="grow" />
          <button className="btn btn-primary" onClick={onNext}>Próximo: gerar tour →</button>
        </div>
      </section>
    </div>
  );
}

/* ---------------- Passo 4: publicar ---------------- */
function StepPublish({ p, setP, goto }: { p: Property; setP: (p: Property) => void; goto: (n: number) => void }) {
  const [copied, setCopied] = useState('');
  const url = `${location.origin}/tour/${p.slug}`;
  const embed = `<iframe src="${url}" width="100%" height="600" style="border:0" allowfullscreen></iframe>`;
  const hasLinks = p.rooms.some((r) => r.hotspots.length);
  const isolated = p.rooms.length > 1 ? p.rooms.filter((r) => !r.hotspots.length && !p.rooms.some((o) => o.hotspots.some((h) => h.target_room_id === r.id))) : [];

  const checks = [
    { ok: !!(p.address || p.city), txt: 'Dados do imóvel preenchidos', step: 0 },
    { ok: p.rooms.length > 0, txt: `${p.rooms.length} cômodo(s) com foto`, step: 1 },
    { ok: p.rooms.length <= 1 || hasLinks, txt: 'Cômodos conectados entre si', step: 2 },
    { ok: isolated.length === 0, txt: isolated.length ? `Cômodos sem ligação: ${isolated.map((r) => r.name).join(', ')}` : 'Todos os cômodos alcançáveis', step: 2 },
  ];

  const toggle = async () => setP(await api<Property>(`/properties/${p.id}`, { method: 'PUT', json: { published: !p.published } }));
  const copy = (txt: string, key: string) => {
    navigator.clipboard?.writeText(txt).then(() => { setCopied(key); setTimeout(() => setCopied(''), 2000); });
  };
  const start = p.rooms.find((r) => r.id === p.start_room_id) ?? p.rooms[0];

  return (
    <div className="publish">
      <div className="card">
        <h2 className="card-title">Prévia do tour</h2>
        {start ? (
          <div className="viewer-box short">
            <PreviewTour p={p} />
          </div>
        ) : <p className="muted">Envie fotos para ver a prévia.</p>}
      </div>

      <div className="stack">
        <div className="card">
          <h2 className="card-title">Verificação</h2>
          <ul className="checks">
            {checks.map((c) => (
              <li key={c.txt} className={c.ok ? 'ok' : 'warn'} onClick={() => !c.ok && goto(c.step)}>
                <span>{c.ok ? '✓' : '!'}</span>{c.txt}
              </li>
            ))}
          </ul>
          <button className={`btn btn-block ${p.published ? 'btn-ghost' : 'btn-primary'}`} disabled={!p.rooms.length} onClick={toggle}>
            {p.published ? 'Despublicar tour' : '🚀 Gerar e publicar tour'}
          </button>
        </div>

        {p.published && (
          <div className="card">
            <h2 className="card-title">Compartilhar</h2>
            <label className="field"><span>Link do tour</span>
              <div className="input-group">
                <input readOnly value={url} onFocus={(e) => e.target.select()} />
                <button className="input-addon" onClick={() => copy(url, 'link')}>{copied === 'link' ? 'Copiado!' : 'Copiar'}</button>
              </div>
            </label>
            <div className="row wrap">
              <a className="btn btn-whats" target="_blank" rel="noreferrer"
                href={`https://wa.me/?text=${encodeURIComponent(`Faça um tour virtual 3D pelo imóvel "${p.title}": ${url}`)}`}>WhatsApp</a>
              <a className="btn btn-ghost" href={url} target="_blank" rel="noreferrer">Abrir tour ↗</a>
            </div>
            <label className="field mt"><span>Código para incorporar no site</span>
              <textarea readOnly rows={3} value={embed} onFocus={(e) => e.target.select()} />
            </label>
            <button className="btn btn-ghost btn-sm" onClick={() => copy(embed, 'embed')}>{copied === 'embed' ? 'Copiado!' : 'Copiar código'}</button>
          </div>
        )}
      </div>
    </div>
  );
}

function PreviewTour({ p }: { p: Property }) {
  const [id, setId] = useState(p.start_room_id ?? p.rooms[0].id);
  const r = p.rooms.find((x) => x.id === id) ?? p.rooms[0];
  const byId = (i: number) => p.rooms.find((x) => x.id === i);
  return (
    <>
      <PanoViewer src={r.url} width={r.width} height={r.height} initialYaw={r.initial_yaw} onNavigate={setId}
        hotspots={r.hotspots.map((h) => ({ ...h, targetName: byId(h.target_room_id)?.name, targetIcon: roomIcon(byId(h.target_room_id)?.type ?? '') }))} />
      <div className="preview-label">{roomIcon(r.type)} {r.name}</div>
    </>
  );
}

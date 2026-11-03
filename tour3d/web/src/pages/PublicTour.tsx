import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import PanoViewer from '../components/PanoViewer';
import { api, brl, Property, roomIcon } from '../lib/api';

export default function PublicTour() {
  const { slug } = useParams();
  const [p, setP] = useState<Property | null>(null);
  const [error, setError] = useState('');
  const [roomId, setRoomId] = useState<number | null>(null);
  const [info, setInfo] = useState(false);
  const [rotate, setRotate] = useState(true);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<Property>(`/public/tours/${slug}`).then((d) => {
      setP(d);
      setRoomId(d.start_room_id ?? d.rooms[0]?.id ?? null);
      document.title = `${d.title} · Tour 3D`;
    }).catch((e) => setError(e.message));
  }, [slug]);

  if (error) return <div className="center-screen dark"><div className="empty"><div className="empty-icon">🔒</div><h3>{error}</h3></div></div>;
  if (!p) return <div className="center-screen dark"><div className="spinner" /></div>;

  const room = p.rooms.find((r) => r.id === roomId) ?? p.rooms[0];
  if (!room) return <div className="center-screen dark"><h3>Este tour ainda não tem fotos.</h3></div>;
  const byId = (i: number) => p.rooms.find((r) => r.id === i);
  const idx = p.rooms.indexOf(room);

  const fullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else rootRef.current?.requestFullscreen?.();
  };

  return (
    <div className="tour" ref={rootRef}>
      <PanoViewer
        src={room.url}
        width={room.width}
        height={room.height}
        initialYaw={room.initial_yaw}
        autoRotate={rotate}
        onNavigate={setRoomId}
        hotspots={room.hotspots.map((h) => ({ ...h, targetName: byId(h.target_room_id)?.name, targetIcon: roomIcon(byId(h.target_room_id)?.type ?? '') }))}
      />

      <header className="tour-top">
        <div>
          <small>{p.agency ?? 'Tour virtual'}</small>
          <h1>{p.title}</h1>
        </div>
        <div className="tour-tools">
          <button className={`tool ${rotate ? 'on' : ''}`} onClick={() => setRotate(!rotate)} title="Girar sozinho">⟲</button>
          <button className="tool" onClick={fullscreen} title="Tela cheia">⛶</button>
          <button className={`tool ${info ? 'on' : ''}`} onClick={() => setInfo(!info)} title="Detalhes do imóvel">ℹ</button>
        </div>
      </header>

      <div className="tour-room">
        <span>{roomIcon(room.type)}</span> {room.name}
        <small>{idx + 1} / {p.rooms.length}</small>
      </div>

      {info && (
        <aside className="tour-info">
          <button className="icon-btn light close" onClick={() => setInfo(false)}>✕</button>
          {p.price ? <div className="tour-price">{brl(p.price)}</div> : null}
          <h2>{p.title}</h2>
          <p className="muted-light">{[p.address, p.city].filter(Boolean).join(' · ')}</p>
          <div className="tour-specs">
            {p.area ? <div><b>{p.area} m²</b><small>Área</small></div> : null}
            {p.bedrooms != null ? <div><b>{p.bedrooms}</b><small>Quartos</small></div> : null}
            {p.bathrooms != null ? <div><b>{p.bathrooms}</b><small>Banheiros</small></div> : null}
            <div><b>{p.rooms.length}</b><small>Ambientes</small></div>
          </div>
          {p.description && <p className="tour-desc">{p.description}</p>}
        </aside>
      )}

      <nav className="tour-strip">
        <button className="strip-arrow" disabled={idx === 0} onClick={() => setRoomId(p.rooms[idx - 1].id)}>‹</button>
        <div className="strip-items">
          {p.rooms.map((r) => (
            <button key={r.id} className={`strip-item ${r.id === room.id ? 'active' : ''}`} onClick={() => setRoomId(r.id)}>
              <img src={r.url} alt="" loading="lazy" />
              <span>{roomIcon(r.type)} {r.name}</span>
            </button>
          ))}
        </div>
        <button className="strip-arrow" disabled={idx === p.rooms.length - 1} onClick={() => setRoomId(p.rooms[idx + 1].id)}>›</button>
      </nav>

      <div className="tour-hint">Arraste para olhar em volta · toque nas setas para entrar nos cômodos</div>
    </div>
  );
}

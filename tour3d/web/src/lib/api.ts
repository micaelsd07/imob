export type Hotspot = { id: number; room_id: number; target_room_id: number; yaw: number; pitch: number; label?: string | null };
export type Room = {
  id: number; property_id: number; name: string; type: string; sort: number;
  url: string; width: number | null; height: number | null; initial_yaw: number; hotspots: Hotspot[];
};
export type Property = {
  id: number; title: string; slug: string; address?: string | null; city?: string | null;
  price?: number | null; bedrooms?: number | null; bathrooms?: number | null; area?: number | null;
  description?: string | null; published: boolean; start_room_id: number | null; rooms: Room[];
  room_count?: number; cover?: string | null; agency?: string;
};
export type User = { id: number; name: string; email: string; agency?: string; role?: string; property_count?: number; created_at?: string };

const TOKEN_KEY = 'tour3d_token';
export const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
export const setToken = (t: string | null) => {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* sem storage */ }
};

export async function api<T = unknown>(path: string, opts: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body = opts.body;
  if (opts.json !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.json); }
  const res = await fetch(`/api${path}`, { ...opts, headers, body });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/auth/login') { setToken(null); location.href = '/login'; }
  if (!res.ok) throw new Error(data.error || 'Falha na comunicação com o servidor.');
  return data as T;
}

/** Lê largura/altura da imagem no navegador antes do envio. */
export function imageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(img.src); };
    img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    img.src = URL.createObjectURL(file);
  });
}

export const isPanorama = (w?: number | null, h?: number | null) => !!w && !!h && Math.abs(w / h - 2) < 0.15;

export const ROOM_TYPES: { value: string; label: string; icon: string }[] = [
  { value: 'fachada', label: 'Fachada / Entrada', icon: '🏠' },
  { value: 'sala', label: 'Sala', icon: '🛋️' },
  { value: 'cozinha', label: 'Cozinha', icon: '🍳' },
  { value: 'quarto', label: 'Quarto', icon: '🛏️' },
  { value: 'suite', label: 'Suíte', icon: '🛁' },
  { value: 'banheiro', label: 'Banheiro', icon: '🚿' },
  { value: 'corredor', label: 'Corredor', icon: '🚪' },
  { value: 'lavanderia', label: 'Lavanderia', icon: '🧺' },
  { value: 'varanda', label: 'Varanda', icon: '🌿' },
  { value: 'garagem', label: 'Garagem', icon: '🚗' },
  { value: 'area-externa', label: 'Área externa / Lazer', icon: '🏊' },
  { value: 'outro', label: 'Outro', icon: '📍' },
];
export const roomIcon = (t: string) => ROOM_TYPES.find((r) => r.value === t)?.icon ?? '📍';
export const brl = (v?: number | null) =>
  v == null ? '' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

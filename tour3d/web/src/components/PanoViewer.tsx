import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import * as THREE from 'three';
import type { Hotspot } from '../lib/api';

/**
 * Visualizador 360°/3D.
 * - Foto 360° (proporção 2:1) vira uma esfera completa: o visitante olha em todas as direções.
 * - Panorâmica comum do celular (muito larga) vira uma faixa curva.
 * - Foto normal é exibida em perspectiva curva com movimento limitado.
 * Ângulos: yaw (horizontal, graus, 0 = centro da foto, positivo = direita) e pitch (vertical, graus).
 */

export type ViewerHandle = { getView: () => { yaw: number; pitch: number } };

type Props = {
  src: string;
  width?: number | null;
  height?: number | null;
  initialYaw?: number;
  hotspots?: (Hotspot & { targetName?: string; targetIcon?: string })[];
  onNavigate?: (targetRoomId: number) => void;
  onPick?: (pos: { yaw: number; pitch: number }) => void;
  onHotspotClick?: (h: Hotspot) => void;
  autoRotate?: boolean;
  editing?: boolean;
};

const R = 500;
const toRad = THREE.MathUtils.degToRad;

function geometryFor(w?: number | null, h?: number | null) {
  const a = w && h ? w / h : 2;
  let hfov: number, vfov: number;
  if (a >= 1.85 && a <= 2.15) { hfov = 360; vfov = 180; }           // 360° equiretangular
  else if (a > 2.15) { vfov = 70; hfov = Math.min(360, a * vfov); }  // panorâmica do celular
  else { hfov = 85; vfov = Math.min(150, (2 * Math.atan(Math.tan(toRad(hfov / 2)) / a) * 180) / Math.PI * 1.15); } // foto comum
  return { hfov, vfov, full: hfov >= 360 };
}

const PanoViewer = forwardRef<ViewerHandle, Props>(function PanoViewer(
  { src, width, height, initialYaw = 0, hotspots = [], onNavigate, onPick, onHotspotClick, autoRotate, editing },
  ref,
) {
  const mountRef = useRef<HTMLDivElement>(null);
  const hotRef = useRef<HTMLDivElement>(null);
  const state = useRef({ yaw: initialYaw, pitch: 0, fov: 75, targetFov: 75, limits: geometryFor(width, height), idle: 0 });
  const three = useRef<{ renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; mesh?: THREE.Mesh } | null>(null);
  const propsRef = useRef({ hotspots, onNavigate, onPick, onHotspotClick, autoRotate, editing });
  propsRef.current = { hotspots, onNavigate, onPick, onHotspotClick, autoRotate, editing };
  const [loading, setLoading] = useState(true);
  const [fade, setFade] = useState(false);

  useImperativeHandle(ref, () => ({
    getView: () => ({ yaw: Math.round(state.current.yaw * 10) / 10, pitch: Math.round(state.current.pitch * 10) / 10 }),
  }));

  // Cria cena uma única vez
  useEffect(() => {
    const el = mountRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0d0f14');
    const camera = new THREE.PerspectiveCamera(75, 1, 1, 1100);
    three.current = { renderer, scene, camera };

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = el;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    // ---- Controles: arrastar, pinça, roda do mouse, teclado ----
    const pointers = new Map<number, { x: number; y: number }>();
    let start = { x: 0, y: 0, yaw: 0, pitch: 0, moved: false };
    let pinchDist = 0;
    const canvas = renderer.domElement;
    canvas.style.touchAction = 'none';

    const down = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const s = state.current;
      start = { x: e.clientX, y: e.clientY, yaw: s.yaw, pitch: s.pitch, moved: false };
      s.idle = 0;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
    };
    const move = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const s = state.current;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        s.targetFov = THREE.MathUtils.clamp(s.targetFov * (pinchDist / d), 30, 100);
        pinchDist = d;
        start.moved = true;
        return;
      }
      const dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) start.moved = true;
      const k = (s.fov / el.clientHeight) * 1.1;
      s.yaw = start.yaw - dx * k;
      s.pitch = start.pitch + dy * k;
      s.idle = 0;
    };
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (!start.moved && pointers.size === 0 && propsRef.current.editing && propsRef.current.onPick) {
        const rect = canvas.getBoundingClientRect();
        const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
        const ray = new THREE.Raycaster();
        ray.setFromCamera(ndc, camera);
        const d = ray.ray.direction;
        const yaw = THREE.MathUtils.radToDeg(Math.atan2(d.z, d.x)) - 180;
        const pitch = THREE.MathUtils.radToDeg(Math.asin(d.y));
        propsRef.current.onPick({ yaw: ((yaw + 540) % 360) - 180, pitch });
      }
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = state.current;
      s.targetFov = THREE.MathUtils.clamp(s.targetFov + e.deltaY * 0.05, 30, 100);
    };
    const key = (e: KeyboardEvent) => {
      const s = state.current;
      if (e.key === 'ArrowLeft') s.yaw -= 8;
      if (e.key === 'ArrowRight') s.yaw += 8;
      if (e.key === 'ArrowUp') s.pitch += 6;
      if (e.key === 'ArrowDown') s.pitch -= 6;
      s.idle = 0;
    };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('keydown', key);

    // ---- Loop de renderização ----
    let raf = 0, last = performance.now();
    const v = new THREE.Vector3();
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      const s = state.current;
      const L = s.limits;
      s.idle += dt;
      if (propsRef.current.autoRotate && s.idle > 4 && pointers.size === 0) s.yaw += dt * 3;
      s.fov += (s.targetFov - s.fov) * Math.min(1, dt * 10);
      // Limites de visão para fotos que não são 360°
      const halfV = Math.max(0, L.vfov / 2 - s.fov / 2);
      s.pitch = THREE.MathUtils.clamp(s.pitch, -Math.min(85, halfV), Math.min(85, halfV));
      if (!L.full) {
        const hfovCam = (2 * Math.atan(Math.tan(toRad(s.fov / 2)) * camera.aspect) * 180) / Math.PI;
        const halfH = Math.max(0, L.hfov / 2 - hfovCam / 2);
        s.yaw = THREE.MathUtils.clamp(s.yaw, -halfH, halfH);
      }
      camera.fov = s.fov;
      camera.updateProjectionMatrix();
      const lon = toRad(s.yaw + 180), lat = toRad(s.pitch);
      camera.lookAt(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon));
      renderer.render(scene, camera);

      // Posiciona os pontos de passagem (HTML) sobre a cena
      const box = hotRef.current;
      if (box) {
        const w = el.clientWidth, h = el.clientHeight;
        for (const node of Array.from(box.children) as HTMLElement[]) {
          const hy = toRad(Number(node.dataset.yaw) + 180), hp = toRad(Number(node.dataset.pitch));
          v.set(Math.cos(hp) * Math.cos(hy), Math.sin(hp), Math.cos(hp) * Math.sin(hy)).multiplyScalar(R * 0.9);
          v.project(camera);
          const visible = v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
          node.style.display = visible ? '' : 'none';
          if (visible) node.style.transform = `translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px) translate(-50%, -50%)`;
        }
      }
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('keydown', key);
      renderer.dispose();
      el.removeChild(canvas);
      three.current = null;
    };
  }, []);

  // Troca a imagem (cômodo)
  useEffect(() => {
    const t = three.current;
    if (!t) return;
    let cancelled = false;
    setLoading(true);
    new THREE.TextureLoader().load(
      src,
      (tex) => {
        if (cancelled) return tex.dispose();
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = t.renderer.capabilities.getMaxAnisotropy();
        const L = geometryFor(width ?? tex.image.width, height ?? tex.image.height);
        const phiLen = toRad(L.hfov), thetaLen = toRad(L.vfov);
        const geo = new THREE.SphereGeometry(R, 96, 64, Math.PI - phiLen / 2, phiLen, Math.PI / 2 - thetaLen / 2, thetaLen);
        geo.scale(-1, 1, 1);
        const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex }));
        if (t.mesh) {
          t.scene.remove(t.mesh);
          t.mesh.geometry.dispose();
          const m = t.mesh.material as THREE.MeshBasicMaterial;
          m.map?.dispose();
          m.dispose();
        }
        t.scene.add(mesh);
        t.mesh = mesh;
        const s = state.current;
        Object.assign(s, { limits: L, yaw: initialYaw, pitch: 0, fov: 90, targetFov: 75, idle: 0 });
        setLoading(false);
        setFade(false);
      },
      undefined,
      () => setLoading(false),
    );
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // Efeito "caminhar até a porta": gira até o ponto, aproxima e escurece antes de trocar de cômodo
  const walkTo = (h: Hotspot) => {
    const s = state.current;
    const from = { yaw: s.yaw, pitch: s.pitch };
    let dy = ((h.yaw - from.yaw + 540) % 360) - 180;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 650);
      const e = k * k * (3 - 2 * k);
      s.yaw = from.yaw + dy * e;
      s.pitch = from.pitch + (h.pitch - from.pitch) * e;
      s.targetFov = 75 - 40 * e;
      if (k > 0.55) setFade(true);
      if (k < 1) requestAnimationFrame(step);
      else propsRef.current.onNavigate?.(h.target_room_id);
    };
    dy = Math.abs(dy) < 0.01 ? 0 : dy;
    requestAnimationFrame(step);
  };

  return (
    <div className={`pano ${editing ? 'pano-editing' : ''}`}>
      <div ref={mountRef} className="pano-canvas" />
      <div ref={hotRef} className="pano-hotspots">
        {hotspots.map((h) => (
          <button
            key={h.id}
            data-yaw={h.yaw}
            data-pitch={h.pitch}
            className="hotspot"
            onClick={(e) => {
              e.stopPropagation();
              if (onHotspotClick) onHotspotClick(h);
              else walkTo(h);
            }}
          >
            <span className="hotspot-ring"><span className="hotspot-arrow">➜</span></span>
            <span className="hotspot-label">{h.targetIcon} {h.label || h.targetName}</span>
          </button>
        ))}
      </div>
      <div className={`pano-fade ${fade || loading ? 'on' : ''}`}>{loading && <div className="spinner" />}</div>
    </div>
  );
});

export default PanoViewer;

// 산책 코스 지도 (외부 지도 SDK 없이 SVG로 그리는 간략 지도)
// 지형·도로·코스는 SVG(미터 좌표), 마커·지명은 HTML 레이어로 그려 확대해도 글자 크기가 그대로다.
import { MAP } from './data.js';
import { toMeters, hazardSegments } from './logic.js';
import { icon } from './ui.js';

const POI_ICON = { store: 'store', police: 'shield', cctv: 'cctv' };
const MIN_MPP = 0.4; // 화면 1px당 미터 (작을수록 확대)
const MAX_MPP = 12;

const ptsAttr = (pts) => pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

export function mountMap(el, { course, slot, mid = null, me = null, interactive = true }) {
  const origin = { lat: course.lat, lng: course.lng };
  const m = (lat, lng) => toMeters(origin, { lat, lng });
  const route = course.path.map((p) => m(p.lat, p.lng));
  const hazards = hazardSegments(course, slot);
  const start = route[0];

  // 경로 근처(900m 이내)의 시설만 지도에 표시
  const pois = course.pois
    .map((p) => ({ ...p, ...m(p.lat, p.lng) }))
    .filter((p) => Math.hypot(p.x - start.x, p.y - start.y) <= 900);
  const midPt = mid ? m(mid.lat, mid.lng) : null;

  const poly = (pts, cls) => `<polygon class="${cls}" points="${ptsAttr(pts.map(([la, ln]) => m(la, ln)))}"/>`;
  const line = (pts, cls) => `<polyline class="${cls}" vector-effect="non-scaling-stroke" points="${ptsAttr(pts)}"/>`;

  const hazardLines = hazards.flatMap((h) => h.runs.map(([a, b]) => {
    const seg = route.slice(Math.max(0, a - (a === b ? 1 : 0)), b + 1);
    return line(seg, h.active ? 'm-haz' : 'm-haz off');
  })).join('');

  el.classList.add('map');
  el.innerHTML = `
    <svg class="map-svg" xmlns="http://www.w3.org/2000/svg" aria-label="${course.name} 지도">
      <rect class="m-land" x="-20000" y="-20000" width="40000" height="40000"/>
      ${MAP.parks.map((p) => poly(p, 'm-park')).join('')}
      ${MAP.water.map((p) => poly(p, 'm-water')).join('')}
      ${MAP.roads.map((r) => line(r.pts.map(([la, ln]) => m(la, ln)), r.major ? 'm-road major' : 'm-road')).join('')}
      ${line(route, 'm-route-casing')}
      ${line(route, 'm-route')}
      ${hazardLines}
    </svg>
    <div class="map-layer"></div>
    ${interactive ? `<div class="map-ctrl">
      <button type="button" data-z="in" aria-label="확대">${icon('plus', 18)}</button>
      <button type="button" data-z="out" aria-label="축소"><svg class="ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg></button>
      <button type="button" data-z="fit" aria-label="코스 전체 보기">${icon('route', 18)}</button>
    </div>` : ''}`;

  const svg = el.querySelector('svg');
  const layer = el.querySelector('.map-layer');

  // HTML 마커: 지명 → 시설 → 주의 구간 번호 → 중간 지점 → 출발점 순서로 쌓는다
  const markers = [];
  const add = (x, y, html, cls) => {
    const node = document.createElement('div');
    node.className = `mk ${cls}`;
    node.innerHTML = html;
    layer.appendChild(node);
    markers.push({ x, y, node });
  };
  MAP.labels.forEach((l) => { const p = m(l.lat, l.lng); add(p.x, p.y, `<span>${l.text}</span>`, `mk-label ${l.kind}`); });
  pois.forEach((p) => add(p.x, p.y, `<span title="${p.label}">${icon(POI_ICON[p.type], 13)}</span>`, `mk-poi ${p.type}`));
  hazards.forEach((h) => {
    const [a, b] = h.runs[0];
    const p = route[Math.round((a + b) / 2)];
    add(p.x, p.y, `<span>${h.no}</span>`, `mk-haz ${h.active ? '' : 'off'}`);
  });
  if (midPt) add(midPt.x, midPt.y, `<span>${icon('users', 13)}</span><em>중간 지점</em>`, 'mk-mid');
  add(start.x, start.y, `<span>${icon('pin', 14)}</span><em>${course.roundTrip ? '출발 · 반환' : '출발 · 도착'}</em>`, 'mk-start');
  // 안심 산책 중 현재 위치 (setMe로 이동)
  let meMarker = null;
  if (me) {
    const p = m(me.lat, me.lng);
    add(p.x, p.y, '<span></span>', 'mk-me');
    meMarker = markers[markers.length - 1];
  }

  // 보기 영역: 경로(+중간 지점, 표시된 시설)가 다 들어오도록
  const fitPts = [...route, ...pois, ...(midPt ? [midPt] : [])];
  const view = { cx: 0, cy: 0, mpp: 2 };
  const fit = () => {
    const xs = fitPts.map((p) => p.x);
    const ys = fitPts.map((p) => p.y);
    const w = el.clientWidth || 360;
    const h = el.clientHeight || 240;
    const pad = 36;
    view.cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    view.cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    view.mpp = Math.min(MAX_MPP, Math.max(MIN_MPP,
      (Math.max(...xs) - Math.min(...xs)) / Math.max(40, w - pad * 2),
      (Math.max(...ys) - Math.min(...ys)) / Math.max(40, h - pad * 2)));
  };
  const update = () => {
    const w = el.clientWidth || 360;
    const h = el.clientHeight || 240;
    const x0 = view.cx - (w / 2) * view.mpp;
    const y0 = view.cy - (h / 2) * view.mpp;
    svg.setAttribute('viewBox', `${x0} ${y0} ${w * view.mpp} ${h * view.mpp}`);
    markers.forEach((mk) => { mk.node.style.transform = `translate(${(mk.x - x0) / view.mpp}px, ${(mk.y - y0) / view.mpp}px)`; });
    el.classList.toggle('zoomed-out', view.mpp > 4);
  };
  fit();
  update();
  const ro = new ResizeObserver(() => update());
  ro.observe(el);

  if (interactive) {
    const zoom = (f) => { view.mpp = Math.min(MAX_MPP, Math.max(MIN_MPP, view.mpp * f)); update(); };
    el.querySelector('.map-ctrl').addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.z === 'in') zoom(0.7);
      else if (b.dataset.z === 'out') zoom(1 / 0.7);
      else { fit(); update(); }
    });
    el.addEventListener('wheel', (e) => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.15 : 1 / 1.15); }, { passive: false });

    // 한 손가락 드래그 = 이동, 두 손가락 = 확대/축소
    const pointers = new Map();
    let pinch = null;
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.map-ctrl')) return;
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mpp: view.mpp };
      }
    });
    el.addEventListener('pointermove', (e) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      pointers.set(e.pointerId, cur);
      if (pointers.size === 2 && pinch) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        view.mpp = Math.min(MAX_MPP, Math.max(MIN_MPP, (pinch.mpp * pinch.d) / Math.max(1, d)));
      } else if (pointers.size === 1) {
        view.cx -= (cur.x - prev.x) * view.mpp;
        view.cy -= (cur.y - prev.y) * view.mpp;
      }
      update();
    });
    const end = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null; };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }

  return {
    destroy: () => ro.disconnect(),
    setMe(pt) {
      if (!meMarker) return;
      const p = m(pt.lat, pt.lng);
      meMarker.x = p.x;
      meMarker.y = p.y;
      update();
    },
  };
}

// 기록 카드용 작은 경로 그림
export function routeThumb(course, w = 84, h = 64) {
  const origin = { lat: course.lat, lng: course.lng };
  const pts = course.path.map((p) => toMeters(origin, p));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const pad = 8;
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1);
  const scale = Math.min((w - pad * 2) / span, (h - pad * 2) / span);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const d = pts.map((p) => `${(w / 2 + (p.x - cx) * scale).toFixed(1)},${(h / 2 + (p.y - cy) * scale).toFixed(1)}`).join(' ');
  return `<svg class="route-thumb" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${d}" fill="none" stroke="var(--route)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${d.split(' ')[0].split(',')[0]}" cy="${d.split(' ')[0].split(',')[1]}" r="3.5" fill="var(--accent)"/></svg>`;
}

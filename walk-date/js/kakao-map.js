// 카카오 지도로 코스 보기 (config.js에 kakaoMapKey가 있을 때만). 실패하면 SVG 간략 지도를 쓴다.
import { CONFIG } from './config.js';
import { hazardSegments } from './logic.js';
import { icon } from './ui.js';

let sdk = null;

function loadKakao() {
  if (window.kakao?.maps?.LatLng) return Promise.resolve(window.kakao);
  if (!sdk) {
    sdk = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(CONFIG.kakaoMapKey)}&autoload=false`;
      s.onload = () => (window.kakao?.maps ? window.kakao.maps.load(() => resolve(window.kakao)) : reject(new Error('카카오 지도 키를 확인해 주세요')));
      s.onerror = () => reject(new Error('카카오 지도를 불러오지 못했어요'));
      document.head.appendChild(s);
      setTimeout(() => reject(new Error('카카오 지도 응답이 없어요')), 8000);
    }).catch((err) => { sdk = null; throw err; });
  }
  return sdk;
}

export const kakaoEnabled = () => Boolean(CONFIG.kakaoMapKey);

const POI_ICON = { store: 'store', police: 'shield', cctv: 'cctv' };

export async function mountKakaoMap(el, { course, slot, mid = null }) {
  const kakao = await loadKakao();
  const { maps } = kakao;
  el.innerHTML = '';
  el.classList.add('kakao');
  const ll = (p) => new maps.LatLng(p.lat, p.lng);
  const map = new maps.Map(el, { center: ll(course), level: 4 });
  const path = course.path.map(ll);
  new maps.Polyline({ map, path, strokeWeight: 6, strokeColor: '#E8805F', strokeOpacity: 0.95 });
  hazardSegments(course, slot).filter((h) => h.active).forEach((h) => h.runs.forEach(([a, b]) => {
    new maps.Polyline({ map, path: path.slice(Math.max(0, a - (a === b ? 1 : 0)), b + 1), strokeWeight: 7, strokeColor: '#C24E49', strokeStyle: 'shortdash' });
  }));
  const overlay = (p, html, z = 1) => new maps.CustomOverlay({ map, position: ll(p), content: html, xAnchor: 0.5, yAnchor: 0.5, zIndex: z });
  course.pois.forEach((p) => overlay(p, `<div class="kmk mk-poi ${p.type}"><span title="${p.label}">${icon(POI_ICON[p.type], 13)}</span></div>`));
  if (mid) overlay(mid, `<div class="kmk mk-mid"><span>${icon('users', 13)}</span></div>`, 2);
  overlay(course.path[0], `<div class="kmk mk-start"><span>${icon('pin', 14)}</span></div>`, 3);
  const bounds = new maps.LatLngBounds();
  path.forEach((p) => bounds.extend(p));
  if (mid) bounds.extend(ll(mid));
  map.setBounds(bounds);
  return { destroy: () => { el.innerHTML = ''; }, setMe() {} };
}

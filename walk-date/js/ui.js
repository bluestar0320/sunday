// 아이콘, 기본 강아지 일러스트, 사진 리사이즈 등 UI 유틸

const PATHS = {
  compass: '<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36z"/>',
  chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  back: '<path d="m15 18-6-6 6-6"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4M12 2v13"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  route: '<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>',
  star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>',
  bulb: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2Z"/>',
  cctv: '<path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  store: '<path d="M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  sparkle: '<path d="M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/>',
};

export function icon(name, size = 20, cls = '') {
  return `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`;
}

export const SAFETY_ICON = { crowd: 'users', light: 'bulb', cctv: 'cctv', view: 'eye', help: 'store' };

// 사진이 없을 때 쓰는 강아지 일러스트 (플랫 스타일)
export function dogArt(a) {
  const ink = '#2B2320';
  const line = 'stroke="rgba(0,0,0,.08)" stroke-width="3"';
  const ears = a.ear === 'pointy'
    ? `<path d="M116 210 L138 88 L198 168 Z" fill="${a.fur}" ${line}/><path d="M284 210 L262 88 L202 168 Z" fill="${a.fur}" ${line}/>
       <path d="M134 184 L145 120 L180 166 Z" fill="${a.muzzle}" opacity=".7"/><path d="M266 184 L255 120 L220 166 Z" fill="${a.muzzle}" opacity=".7"/>`
    : '';
  const floppy = a.ear === 'floppy'
    ? `<ellipse cx="108" cy="255" rx="36" ry="80" transform="rotate(16 108 255)" fill="${a.earColor || a.fur}" ${line}/>
       <ellipse cx="292" cy="255" rx="36" ry="80" transform="rotate(-16 292 255)" fill="${a.earColor || a.fur}" ${line}/>`
    : '';
  return `<svg class="dog-art" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="강아지 일러스트">
    <rect width="400" height="500" fill="${a.bg}"/>
    <circle cx="200" cy="240" r="175" fill="#fff" opacity=".35"/>
    <path d="M60 500 C72 395 138 352 200 352 C262 352 328 395 340 500 Z" fill="${a.fur}" ${line}/>
    ${ears}
    <ellipse cx="200" cy="248" rx="102" ry="96" fill="${a.fur}" ${line}/>
    ${a.spot ? `<path d="M200 156 C186 200 186 250 200 262 C214 250 214 200 200 156 Z" fill="${a.spot}"/>` : ''}
    <ellipse cx="200" cy="294" rx="54" ry="40" fill="${a.muzzle}"/>
    ${floppy}
    <circle cx="164" cy="238" r="10" fill="${ink}"/><circle cx="236" cy="238" r="10" fill="${ink}"/>
    <circle cx="167" cy="234" r="3" fill="#fff"/><circle cx="239" cy="234" r="3" fill="#fff"/>
    <ellipse cx="148" cy="276" rx="13" ry="7" fill="#FF8F7A" opacity=".3"/><ellipse cx="252" cy="276" rx="13" ry="7" fill="#FF8F7A" opacity=".3"/>
    <ellipse cx="200" cy="276" rx="17" ry="12" fill="${ink}"/>
    <path d="M200 288 v10 M200 298 q-11 11 -23 4 M200 298 q11 11 23 4" stroke="${ink}" stroke-width="4" stroke-linecap="round" fill="none"/>
    <rect x="132" y="342" width="136" height="20" rx="10" fill="${a.collar}"/>
    <circle cx="200" cy="374" r="11" fill="#F5C542"/>
  </svg>`;
}

// 업로드한 사진을 줄여 dataURL로 (localStorage 용량 보호)
export async function resizeImage(file, maxSide = 900, quality = 0.8) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('이미지를 읽을 수 없어요'));
      el.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

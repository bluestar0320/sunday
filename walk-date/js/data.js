// 데모용 샘플 데이터 (마포구 일대)

import { courseStats, offsetLatLng, distanceKm } from './logic.js';

// ---------- 지도 기본 지형 (간략화한 마포구 일대) ----------
// 한강 북쪽 강변선 (서→동)
const BANK = [
  [37.5790, 126.8600], [37.5730, 126.8700], [37.5670, 126.8790], [37.5600, 126.8870],
  [37.5535, 126.8950], [37.5485, 126.9030], [37.5437, 126.9110], [37.5395, 126.9210], [37.5355, 126.9330],
];

// 강변선 위 위도 (경도로 보간)
export function bankLat(lng) {
  for (let i = 1; i < BANK.length; i++) {
    const [la1, ln1] = BANK[i - 1];
    const [la2, ln2] = BANK[i];
    if (lng <= ln2) return la1 + ((la2 - la1) * (lng - ln1)) / (ln2 - ln1);
  }
  return BANK[BANK.length - 1][0];
}

const ellipse = (lat, lng, rLat, rLng, n = 18) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return [lat + rLat * Math.sin(t), lng + rLng * Math.cos(t)];
  });

const shift = (pts, dLat) => pts.map(([la, ln]) => [la + dLat, ln]);

export const MAP = {
  water: [
    [...BANK, ...shift(BANK, -0.0085).reverse()],
    ellipse(37.5640, 126.8960, 0.0010, 0.0022), // 평화의공원 호수
  ],
  parks: [
    [...shift(BANK, 0.0016), ...BANK.slice().reverse()], // 한강공원 둔치
    [[37.5722, 126.8775], [37.5738, 126.8885], [37.5682, 126.8992], [37.5618, 126.8992], [37.5612, 126.8918], [37.5660, 126.8815]], // 월드컵공원
    ellipse(37.5660, 126.9110, 0.0028, 0.0038), // 성미산
  ],
  roads: [
    { name: '강변북로', pts: shift(BANK, 0.0020), major: true },
    { name: '월드컵로', pts: [[37.5495, 126.9135], [37.5560, 126.9030], [37.5610, 126.9000], [37.5700, 126.8998]], major: true },
    { name: '양화로', pts: [[37.5495, 126.9135], [37.5535, 126.9190], [37.5572, 126.9245]], major: true },
    { name: '', pts: [[37.5560, 126.9030], [37.5575, 126.9110], [37.5600, 126.9200], [37.5605, 126.9300]] },
    { name: '', pts: [[37.5520, 126.9050], [37.5560, 126.9100], [37.5600, 126.9150], [37.5700, 126.9160]] },
    { name: '', pts: [[37.5480, 126.9060], [37.5520, 126.9120], [37.5535, 126.9190]] },
  ],
  labels: [
    { text: '한강', lat: 37.5450, lng: 126.8930, kind: 'water' },
    { text: '망원동', lat: 37.5605, lng: 126.9040, kind: 'area' },
    { text: '연남동', lat: 37.5640, lng: 126.9210, kind: 'area' },
    { text: '서교동', lat: 37.5515, lng: 126.9215, kind: 'area' },
    { text: '상암동', lat: 37.5760, lng: 126.8920, kind: 'area' },
    { text: '합정역', lat: 37.5495, lng: 126.9135, kind: 'station' },
    { text: '망원역', lat: 37.5560, lng: 126.9100, kind: 'station' },
    { text: '홍대입구역', lat: 37.5572, lng: 126.9245, kind: 'station' },
    { text: '월드컵경기장역', lat: 37.5695, lng: 126.8990, kind: 'station' },
  ],
};

// ---------- 산책 코스 ----------
// path: [{ lat, lng, h? }] — h가 같은 연속 구간이 hazards[h] 주의 구간
// crowd: 시간대별 유동인구 (0 드묾, 1 보통, 2 많음) / lighting: 야간 조명 (0 어두움, 1 보통, 2 밝음)
// storeM / policeM: 출발점에서 가장 가까운 편의점 / 지구대(안심지킴이집) 거리(m)

// 강변을 따라 갔다가 조금 안쪽 길로 돌아오는 순환 경로
function riverLoop(lng1, lng2, near, far, n = 8) {
  const out = Array.from({ length: n + 1 }, (_, i) => { const ln = lng1 + ((lng2 - lng1) * i) / n; return [bankLat(ln) + near, ln]; });
  const back = out.map(([, ln]) => [bankLat(ln) + far, ln]).reverse();
  return [...out, ...back, out[0]];
}

const RAW_COURSES = [
  {
    id: 'c1', name: '망원한강공원 잔디길', type: '한강공원', note: '넓은 잔디, 반려견 놀이터 인근',
    // 망원 나들목(강변북로 아래 지하 통로)으로 진입
    path: [[bankLat(126.8985) + 0.0030, 126.8985, 0], [bankLat(126.8985) + 0.0018, 126.8985, 0], [bankLat(126.8985) + 0.0011, 126.8985, 0],
      ...riverLoop(126.8985, 126.8880, 0.0004, 0.0010).slice(1, -1), [bankLat(126.8985) + 0.0011, 126.8985, 0], [bankLat(126.8985) + 0.0018, 126.8985, 0], [bankLat(126.8985) + 0.0030, 126.8985, 0]],
    hazards: [{ note: '망원 나들목 지하 통로', when: 'night' }],
    safety: { crowd: { '이른 아침': 1, '점심': 1, '저녁': 2, '밤': 1 }, lighting: 2, cctv: true, openView: true, storeM: 150, policeM: 600 },
  },
  {
    id: 'c2', name: '경의선숲길 연남구간', type: '공원길', note: '카페 많고 저녁에도 북적여요', roundTrip: true,
    path: [[37.5574, 126.9230], [37.5598, 126.9238], [37.5622, 126.9247], [37.5646, 126.9257], [37.5668, 126.9266], [37.5688, 126.9274]],
    hazards: [],
    safety: { crowd: { '이른 아침': 1, '점심': 2, '저녁': 2, '밤': 2 }, lighting: 2, cctv: true, openView: true, storeM: 50, policeM: 400 },
  },
  {
    id: 'c3', name: '평화의공원 호수 둘레길', type: '공원', note: '호수 둘레길, 주차 가능',
    path: ellipse(37.5640, 126.8960, 0.0016, 0.0031).map(([la, ln]) => [la, ln, la > 37.5648 ? 0 : undefined]),
    hazards: [{ note: '호수 북쪽 산책로 (해 지면 인적 드묾)', when: 'night' }],
    safety: { crowd: { '이른 아침': 1, '점심': 2, '저녁': 1, '밤': 0 }, lighting: 1, cctv: true, openView: true, storeM: 400, policeM: 900 },
  },
  {
    id: 'c4', name: '하늘공원 억새길', type: '공원', note: '억새가 키보다 높고 계단이 많아요',
    path: ellipse(37.5688, 126.8850, 0.0030, 0.0055, 22).map(([la, ln]) => [la, ln, 0]),
    hazards: [{ note: '억새밭 구간 (시야 가림 · 조명 없음)', when: 'always' }],
    safety: { crowd: { '이른 아침': 1, '점심': 1, '저녁': 0, '밤': 0 }, lighting: 0, cctv: false, openView: false, storeM: 1200, policeM: 1500 },
  },
  {
    id: 'c5', name: '절두산 한강 산책로', type: '한강공원', note: '노을 명소, 자전거 도로 인접',
    path: riverLoop(126.9040, 126.9175, 0.0004, 0.0010, 10).map(([la, ln]) => [la, ln, ln > 126.9100 && ln < 126.9125 ? 0 : undefined]),
    hazards: [{ note: '당산철교 아래 구간', when: 'night' }],
    safety: { crowd: { '이른 아침': 1, '점심': 1, '저녁': 1, '밤': 0 }, lighting: 1, cctv: true, openView: true, storeM: 350, policeM: 800 },
  },
  {
    id: 'c6', name: '서교동 카페거리 루프', type: '도심', note: '반려견 동반 카페, 산책 후 쉬기 좋아요',
    path: [[37.5518, 126.9162], [37.5518, 126.9198], [37.5530, 126.9200], [37.5542, 126.9198], [37.5544, 126.9180], [37.5542, 126.9162], [37.5530, 126.9160], [37.5518, 126.9162]],
    hazards: [],
    safety: { crowd: { '이른 아침': 0, '점심': 2, '저녁': 2, '밤': 2 }, lighting: 2, cctv: true, openView: true, storeM: 30, policeM: 300 },
  },
  {
    id: 'c7', name: '망원동 주택가 골목길', type: '골목', note: '조용한 주택가, 차량 통행 적음',
    path: [[37.5570, 126.9030], [37.5576, 126.9041, 0], [37.5584, 126.9038, 0], [37.5591, 126.9050, 0], [37.5599, 126.9047, 0], [37.5603, 126.9062, 0],
      [37.5595, 126.9071, 0], [37.5586, 126.9065, 0], [37.5578, 126.9069, 0], [37.5572, 126.9056, 0], [37.5570, 126.9030]],
    hazards: [{ note: '가로등 · CCTV 없는 골목', when: 'always' }],
    safety: { crowd: { '이른 아침': 0, '점심': 1, '저녁': 1, '밤': 0 }, lighting: 0, cctv: false, openView: false, storeM: 200, policeM: 700 },
  },
  {
    id: 'c8', name: '성미산 숲길', type: '숲길', note: '숲 그늘 오르막, 흙길',
    // 남쪽 입구에서 시작해 산을 한 바퀴 도는 순환로
    path: (() => { const e = ellipse(37.5658, 126.9110, 0.0020, 0.0028, 16).slice(0, -1); const loop = [...e.slice(12), ...e.slice(0, 12)]; return [...loop, loop[0]].map(([la, ln], i, a) => [la, ln, i === 0 || i === a.length - 1 ? undefined : 0]); })(),
    hazards: [{ note: '숲길 오르막 (시야 가림 · 조명 없음)', when: 'always' }],
    safety: { crowd: { '이른 아침': 1, '점심': 1, '저녁': 0, '밤': 0 }, lighting: 0, cctv: false, openView: false, storeM: 600, policeM: 1100 },
  },
];

// 경로에서 거리·시간·중심점·안전 시설 위치를 계산
function buildCourse(raw) {
  const path = raw.path.map(([lat, lng, h]) => (h === undefined ? { lat, lng } : { lat, lng, h }));
  const lats = path.map((p) => p.lat);
  const lngs = path.map((p) => p.lng);
  const c = {
    ...raw,
    path,
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  };
  const start = path[0];
  const pois = [
    { type: 'store', label: '편의점', ...offsetLatLng(start, raw.safety.storeM, 35) },
    { type: 'police', label: '지구대', ...offsetLatLng(start, raw.safety.policeM, 15) },
  ];
  if (raw.safety.cctv) {
    // 경로를 따라 CCTV 3곳 (순환 경로에서 겹치는 위치는 하나만)
    [0.15, 0.45, 0.7].forEach((f) => {
      const p = path[Math.floor((path.length - 1) * f)];
      const dup = pois.some((q) => q.type === 'cctv' && distanceKm(q, p) < 0.08);
      if (!dup) pois.push({ type: 'cctv', label: 'CCTV', lat: p.lat, lng: p.lng });
    });
  }
  return { ...c, pois, ...courseStats(c) };
}

export const COURSES = RAW_COURSES.map(buildCourse);

// 샘플 강아지 캐릭터 이미지 (Higgsfield Z Image로 생성). 못 불러오면 일러스트(art)로 대신 표시
const CHARACTER_BASE = 'https://d8j0ntlcm91z4.cloudfront.net/user_37LLC5pqZCbhZJht1lqCXvClFEz/';
const CHARACTERS = {
  p1: 'hf_20261023_061133_580fb9ca-2df0-40b7-9346-b91ffddabf20_min.webp',
  p2: 'hf_20261023_061133_b588962d-2d24-46c2-abc9-87e1d89f379c_min.webp',
  p3: 'hf_20261023_061134_efbe37d2-5d2f-4ff8-9edb-7172d91e2350_min.webp',
  p4: 'hf_20261023_061133_40ab98ba-6f19-42d6-b631-241576d55823_min.webp',
  p5: 'hf_20261023_061704_4ca5172d-02c9-4e6f-afa7-36f11d650f4e_min.webp',
  p6: 'hf_20261023_061133_b7924e8a-adb1-453b-b2b8-aaea66edeafc_min.webp',
  p7: 'hf_20261023_061133_181ec193-3987-423c-b9b2-c2e6524bb569_min.webp',
  p8: 'hf_20261023_061133_9c40d399-d248-4316-9d01-1f9eaef34ca7_min.webp',
};

export const PEOPLE = [
  {
    id: 'p1', name: '지수', gender: '여성', birthYear: 1995, job: 'UX 디자이너',
    bio: '퇴근 후 망원한강에서 노을 보며 걷는 게 낙이에요. 커피 좋아해요 ☕',
    location: { lat: 37.5565, lng: 126.9010 }, walkTimes: ['저녁', '밤'],
    interests: ['카페', '사진', '전시'], art: { fur: '#E0A061', muzzle: '#FFF3E4', ear: 'pointy', bg: '#F6E7D8', collar: '#3B82F6' },
    dog: { name: '보리', breed: '웰시코기', size: '중형', age: 3, energy: '활발', friendly: true, traits: ['사람 좋아함', '공놀이 광'], health: { vaccinated: true, neutered: true, bite: false, allergies: '' } },
    verified: { phone: true, registry: true },
    manner: { count: 12, avg: 4.9, tags: { '시간 약속을 잘 지켜요': 10, '대화가 즐거워요': 8, '강아지를 잘 케어해요': 6 }, noShows: 0, lateCancels: 0 },
    likes: ['me'],
  },
  {
    id: 'p2', name: '민준', gender: '남성', birthYear: 1993, job: '개발자',
    bio: '재택근무라 점심 산책 자주 나가요. 같이 걸을 산책 메이트 구해요!',
    location: { lat: 37.5600, lng: 126.9100 }, walkTimes: ['점심', '저녁'],
    interests: ['러닝', '캠핑', '보드게임'], art: { fur: '#D98E4E', muzzle: '#FBEBD9', ear: 'pointy', bg: '#EAF0E6', collar: '#DC2626' },
    dog: { name: '콩이', breed: '시바견', size: '중형', age: 4, energy: '보통', friendly: true, traits: ['독립적', '간식에 진심'], health: { vaccinated: true, neutered: true, bite: false, allergies: '닭고기' } },
    verified: { phone: true, registry: true },
    manner: { count: 7, avg: 4.6, tags: { '매너가 좋아요': 6, '시간 약속을 잘 지켜요': 5 }, noShows: 0, lateCancels: 1 },
    likes: [],
    likesBack: true, // 데모: 내가 좋아요를 보내면 잠시 뒤 좋아요로 답함
  },
  {
    id: 'p3', name: '서연', gender: '여성', birthYear: 1997, job: '초등교사',
    bio: '주말 아침 일찍 공원 한 바퀴 돌아요. 소형견 친구 환영해요 🌸',
    location: { lat: 37.5640, lng: 126.8990 }, walkTimes: ['이른 아침', '저녁'],
    interests: ['독서', '베이킹', '요가'], art: { fur: '#FFFFFF', muzzle: '#FFFFFF', ear: 'floppy', earColor: '#F1E6DA', bg: '#F7E6EA', collar: '#EC4899' },
    dog: { name: '몽이', breed: '말티즈', size: '소형', age: 2, energy: '보통', friendly: true, traits: ['애교쟁이', '겁 조금 많음'], health: { vaccinated: true, neutered: false, bite: false, allergies: '' } },
    verified: { phone: true, registry: false },
    manner: { count: 3, avg: 5, tags: { '강아지를 잘 케어해요': 3, '대화가 즐거워요': 2 }, noShows: 0, lateCancels: 0 },
    likes: ['me'],
  },
  {
    id: 'p4', name: '도현', gender: '남성', birthYear: 1991, job: '셰프',
    bio: '대형견이랑 살아요. 하늘공원 억새길 걷는 거 좋아합니다.',
    location: { lat: 37.5700, lng: 126.8880 }, walkTimes: ['이른 아침', '밤'],
    interests: ['요리', '캠핑', '등산'], art: { fur: '#E7B56E', muzzle: '#F6D9A8', ear: 'floppy', earColor: '#D69E52', bg: '#E4EBF5', collar: '#15803D' },
    dog: { name: '하루', breed: '골든 리트리버', size: '대형', age: 5, energy: '활발', friendly: true, traits: ['순둥이', '수영 좋아함'], health: { vaccinated: true, neutered: true, bite: false, allergies: '' } },
    verified: { phone: true, registry: true },
    manner: { count: 18, avg: 4.8, tags: { '또 산책하고 싶어요': 14, '매너가 좋아요': 12, '강아지를 잘 케어해요': 9 }, noShows: 0, lateCancels: 0 },
    likes: ['me'],
  },
  {
    id: 'p5', name: '하은', gender: '여성', birthYear: 1994, job: '마케터',
    bio: '연남동 숲길 산책하고 카페 가는 루트 추천해 드릴게요!',
    location: { lat: 37.5620, lng: 126.9220 }, walkTimes: ['저녁'],
    interests: ['카페', '맛집', '사진'], art: { fur: '#FFFDF9', muzzle: '#FFFFFF', ear: 'floppy', earColor: '#F3ECE4', bg: '#ECE6F6', collar: '#8B5CF6' },
    dog: { name: '두부', breed: '비숑 프리제', size: '소형', age: 1, energy: '활발', friendly: true, traits: ['솜사탕', '에너지 폭발'], health: { vaccinated: false, neutered: false, bite: false, allergies: '' } },
    verified: { phone: true, registry: false },
    manner: { count: 0, avg: 0, tags: {}, noShows: 0, lateCancels: 0 },
    likes: [],
    likesBack: true, // 데모: 내가 좋아요를 보내면 잠시 뒤 좋아요로 답함
  },
  {
    id: 'p6', name: '준호', gender: '남성', birthYear: 1996, job: '대학원생',
    bio: '조용히 걷는 산책 좋아해요. 아이가 낯을 가려서 천천히 친해져요.',
    location: { lat: 37.5480, lng: 126.9130 }, walkTimes: ['밤'],
    interests: ['독서', '음악', '전시'], art: { fur: '#C9A27A', muzzle: '#EFE2D2', ear: 'pointy', bg: '#E5EFEC', collar: '#0F766E' },
    dog: { name: '단비', breed: '진돗개 믹스', size: '중형', age: 6, energy: '느긋', friendly: false, traits: ['의젓함', '낯가림'], health: { vaccinated: true, neutered: true, bite: true, allergies: '소고기' } },
    verified: { phone: true, registry: true },
    manner: { count: 9, avg: 4.3, tags: { '시간 약속을 잘 지켜요': 7, '매너가 좋아요': 5 }, noShows: 1, lateCancels: 0 },
    likes: ['me'],
  },
  {
    id: 'p7', name: '유나', gender: '여성', birthYear: 1992, job: '간호사',
    bio: '교대 근무라 평일 낮 산책 가능해요. 대형견 친구 대환영!',
    location: { lat: 37.5580, lng: 126.8970 }, walkTimes: ['점심', '이른 아침'],
    interests: ['등산', '러닝', '맛집'], art: { fur: '#2E2A28', muzzle: '#FFFFFF', ear: 'floppy', earColor: '#2E2A28', bg: '#F5EEDC', collar: '#F59E0B', spot: '#FFFFFF' },
    dog: { name: '태풍', breed: '보더 콜리', size: '대형', age: 3, energy: '활발', friendly: true, traits: ['천재견', '원반 마스터'], health: { vaccinated: true, neutered: true, bite: false, allergies: '' } },
    verified: { phone: true, registry: false },
    manner: { count: 6, avg: 4.7, tags: { '대화가 즐거워요': 5, '또 산책하고 싶어요': 4 }, noShows: 0, lateCancels: 2 },
    likes: [],
  },
  {
    id: 'p8', name: '태윤', gender: '남성', birthYear: 1995, job: '사진작가',
    bio: '산책하면서 강아지 사진 찍어드려요 📷 망원 근처 살아요.',
    location: { lat: 37.5540, lng: 126.9040 }, walkTimes: ['저녁', '점심'],
    interests: ['사진', '카페', '여행'], art: { fur: '#9B6B4A', muzzle: '#B98563', ear: 'floppy', earColor: '#7E5236', bg: '#F4E9E1', collar: '#0EA5E9' },
    dog: { name: '쿠키', breed: '푸들', size: '소형', age: 4, energy: '보통', friendly: true, traits: ['모델견', '얌전함'], health: { vaccinated: true, neutered: true, bite: false, allergies: '밀가루' } },
    verified: { phone: true, registry: true },
    manner: { count: 15, avg: 4.9, tags: { '대화가 즐거워요': 11, '시간 약속을 잘 지켜요': 10, '또 산책하고 싶어요': 9 }, noShows: 0, lateCancels: 0 },
    likes: ['me'],
  },
  {
    id: 'p9', name: '현우', gender: '남성', birthYear: 1994, job: '영업직',
    bio: '주말마다 한강 나가요.',
    location: { lat: 37.5550, lng: 126.9060 }, walkTimes: ['저녁'],
    interests: ['카페'], art: { fur: '#BFA58A', muzzle: '#F1E6D8', ear: 'pointy', bg: '#EDEDE6', collar: '#64748B' },
    dog: { name: '바둑이', breed: '믹스견', size: '소형', age: 3, energy: '보통', friendly: true, traits: ['활발함'], health: { vaccinated: true, neutered: true, bite: false, allergies: '' } },
    verified: { phone: true, registry: false },
    manner: { count: 4, avg: 2.5, tags: {}, noShows: 2, lateCancels: 3 }, // 노쇼 2회 → 추천 제외
    likes: ['me'],
  },
];

for (const p of PEOPLE) if (CHARACTERS[p.id]) p.img = CHARACTER_BASE + CHARACTERS[p.id];

export const DEFAULT_ME = {
  id: 'me', name: '', gender: '여성', lookingFor: '남성', birthYear: 1995, job: '',
  bio: '', location: { lat: 37.5560, lng: 126.9060 }, walkTimes: ['저녁'],
  interests: [], safeMode: true,
  art: { fur: '#E8C9A0', muzzle: '#FFF6EA', ear: 'floppy', earColor: '#D7AE7C', bg: '#F3EEE8', collar: '#FF6B3D' },
  dog: {
    name: '', breed: '', size: '소형', age: 2, energy: '보통', friendly: true, traits: [], photos: [],
    health: { vaccinated: false, neutered: false, bite: false, allergies: '' }, registryNo: '',
  },
  phone: '',
  verified: { phone: false, registry: false },
};

// 동네 산책 모임 (데모: 오늘 기준 며칠 뒤로 날짜를 잡는다)
const SLOT_HOURS = { '이른 아침': 7, '점심': 12, '저녁': 18, '밤': 21 };
const inDays = (n, slot) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(SLOT_HOURS[slot], 0, 0, 0); return d.toISOString(); };

export const GROUPS = [
  {
    id: 'g1', title: '망원한강 소형견 아침 산책', hostId: 'p3', courseId: 'c1', slot: '이른 아침', datetime: inDays(1, '이른 아침'),
    capacity: 6, sizeRule: '소형', members: ['p3', 'p8', 'p5'],
    note: '출근 전 40분 가볍게 걸어요. 처음 오셔도 괜찮아요! 배변봉투 꼭 챙겨주세요.',
  },
  {
    id: 'g2', title: '연남 숲길 퇴근길 산책', hostId: 'p5', courseId: 'c2', slot: '저녁', datetime: inDays(2, '저녁'),
    capacity: 5, sizeRule: '모두', members: ['p5', 'p1', 'p2', 'p8'],
    note: '경의선숲길 따라 걷고, 원하시는 분들은 동반 카페에서 쉬었다 가요.',
  },
  {
    id: 'g3', title: '평화의공원 대형견 점심 산책', hostId: 'p4', courseId: 'c3', slot: '점심', datetime: inDays(3, '점심'),
    capacity: 4, sizeRule: '대형', members: ['p4', 'p7'],
    note: '대형견끼리 여유 있게 호수 한 바퀴. 리드줄 필수예요.',
  },
  {
    id: 'g4', title: '서교동 카페거리 주말 산책', hostId: 'p8', courseId: 'c6', slot: '점심', datetime: inDays(4, '점심'),
    capacity: 6, sizeRule: '모두', members: ['p8', 'p6'],
    note: '산책하면서 강아지 사진 찍어드려요 📷 천천히 친해지는 아이도 환영!',
  },
];

export const INTERESTS = ['카페', '사진', '전시', '러닝', '캠핑', '보드게임', '독서', '베이킹', '요가', '요리', '등산', '맛집', '음악', '여행'];

// 상대방 자동 답장 (데모용)
export const AUTO_REPLIES = [
  '좋아요! {dog}도 {myDog} 만나면 엄청 좋아할 것 같아요 🐾',
  '저희 아이는 처음엔 조금 냄새 맡으면서 인사해요 ㅎㅎ',
  '산책 끝나고 근처 카페에서 커피 한잔 어때요?',
  '간식 챙겨갈게요! 혹시 알러지 있는 거 있나요?',
  '그 시간 괜찮아요. 도착하면 연락 주세요 😊',
];

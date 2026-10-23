// 매칭/거리/일정 계산 등 순수 로직 (브라우저와 Node 테스트에서 공통 사용)

export const SIZES = ['소형', '중형', '대형'];
export const ENERGY = ['느긋', '보통', '활발'];
export const TIME_SLOTS = ['이른 아침', '점심', '저녁', '밤'];

const toRad = (deg) => (deg * Math.PI) / 180;

// 두 좌표 사이 거리(km) — 하버사인 공식
export function distanceKm(a, b) {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function ageFromBirthYear(birthYear, now = new Date()) {
  return now.getFullYear() - birthYear;
}

// 산책 궁합 점수(0~100)와 그 이유
// 사람 취향보다 "같이 산책이 잘 될까"를 우선으로 본다.
export function compatibility(me, other) {
  const reasons = [];
  let score = 0;

  // 1) 거리 (최대 30점): 가까울수록 산책 약속 잡기가 쉽다
  const km = distanceKm(me.location, other.location);
  const distScore = Math.max(0, 30 - km * 6);
  score += distScore;
  if (km <= 1.5) reasons.push('걸어서 갈 수 있는 거리');

  // 2) 강아지 크기 (최대 20점): 크기 차이가 크면 함께 걷기 어렵다
  const sizeGap = Math.abs(SIZES.indexOf(me.dog.size) - SIZES.indexOf(other.dog.size));
  score += [20, 10, 0][sizeGap];
  if (sizeGap === 0) reasons.push(`둘 다 ${me.dog.size}견`);

  // 3) 에너지 레벨 (최대 20점): 산책 페이스
  const energyGap = Math.abs(ENERGY.indexOf(me.dog.energy) - ENERGY.indexOf(other.dog.energy));
  score += [20, 10, 0][energyGap];
  if (energyGap === 0) reasons.push(`산책 페이스가 비슷해요 (${me.dog.energy})`);

  // 4) 선호 산책 시간대 (최대 20점)
  const commonTimes = me.walkTimes.filter((t) => other.walkTimes.includes(t));
  score += Math.min(20, commonTimes.length * 10);
  if (commonTimes.length) reasons.push(`${commonTimes.join('·')} 산책 선호`);

  // 5) 공통 관심사 (최대 10점)
  const commonInterests = (me.interests || []).filter((i) => (other.interests || []).includes(i));
  score += Math.min(10, commonInterests.length * 5);
  if (commonInterests.length) reasons.push(`관심사: ${commonInterests.join(', ')}`);

  // 강아지 사회성: 다른 강아지를 무서워하면 감점
  if (me.dog.friendly === false || other.dog.friendly === false) {
    score -= 15;
    reasons.push('천천히 친해지는 아이가 있어요');
  }

  return {
    score: Math.round(Math.max(0, Math.min(100, score))),
    distanceKm: Math.round(km * 10) / 10,
    reasons,
  };
}

// 사용자가 받아볼 후보 목록: 필터 → 이미 본 사람 제외 → 궁합순 정렬
export function rankCandidates(me, people, { maxKm = 5, sizes = SIZES, seen = [] } = {}) {
  const seenSet = new Set(seen);
  return people
    .filter((p) => p.id !== me.id && !seenSet.has(p.id))
    .filter((p) => !me.lookingFor || me.lookingFor === '모두' || p.gender === me.lookingFor)
    .filter((p) => sizes.includes(p.dog.size))
    .map((p) => ({ person: p, ...compatibility(me, p) }))
    .filter((c) => c.distanceKm <= maxKm)
    .sort((a, b) => b.score - a.score);
}

// ---------- 산책 코스 안전도 ----------
// 여성 이용자가 많은 만큼 "으슥한 곳"을 피하는 게 핵심.
// 시간대별 유동인구 · 조명 · CCTV · 트인 시야 · 도움 요청 가능 거리로 판단한다.
export const NIGHT_SLOTS = ['저녁', '밤'];
export const CROWD_LABELS = ['인적이 드물어요', '사람이 적당히 다녀요', '사람이 많이 다녀요'];

export function courseSafety(course, slot) {
  const s = course.safety;
  const night = NIGHT_SLOTS.includes(slot);
  const crowd = s.crowd[slot] ?? 0;
  const light = night ? s.lighting : 2;
  const helpM = Math.min(s.storeM, s.policeM);
  const checks = [
    { key: 'crowd', ok: crowd >= 1, label: `${slot}에 ${CROWD_LABELS[crowd]}` },
    { key: 'light', ok: light >= 1, label: night ? ['가로등이 부족한 구간이 있어요', '조명이 보통이에요', '가로등이 밝아요'][s.lighting] : '해가 떠 있는 시간대예요' },
    { key: 'cctv', ok: s.cctv, label: s.cctv ? '방범 CCTV 설치 구간' : 'CCTV가 없는 구간이 있어요' },
    { key: 'view', ok: s.openView, label: s.openView ? '시야가 트여 있어요' : '숲길·골목처럼 가려진 구간이 있어요' },
    { key: 'help', ok: helpM <= 300, label: `가장 가까운 편의점·지구대 ${helpM}m` },
  ];
  let score = [0, 20, 35][crowd] + [0, 15, 25][light] + (s.cctv ? 15 : 0) + (s.openView ? 15 : 0) + (helpM <= 300 ? 10 : helpM <= 700 ? 5 : 0);
  // 어두운 시간에 인적까지 드물면 점수와 무관하게 '주의'
  const secluded = crowd === 0 && (night || !s.openView);
  const level = secluded || score < 50 ? '주의' : score >= 75 ? '안심' : '보통';
  return { score, level, checks, secluded };
}

// 두 사람 중간 지점 근처 코스를 안전도 우선으로 추천
export function midpoint(a, b) {
  return { lat: (a.location.lat + b.location.lat) / 2, lng: (a.location.lng + b.location.lng) / 2 };
}

export function recommendCourses(me, other, courses, { slot, safeOnly = true, limit = 4 } = {}) {
  const mid = midpoint(me, other);
  const all = courses.map((c) => ({
    ...c,
    distanceKm: Math.round(distanceKm(mid, c) * 10) / 10,
    safety: courseSafety(c, slot),
  }));
  const shown = all
    .filter((c) => !safeOnly || c.safety.level !== '주의')
    .sort((a, b) => (b.safety.score - b.distanceKm * 15) - (a.safety.score - a.distanceKm * 15))
    .slice(0, limit);
  return { courses: shown, hiddenCount: safeOnly ? all.filter((c) => c.safety.level === '주의').length : 0 };
}

// 상대가 나를 이미 좋아요 했다면 매칭 성사
export function isMutualMatch(myId, otherPerson) {
  return Array.isArray(otherPerson.likes) && otherPerson.likes.includes(myId);
}

// 산책 후 매너 평가 평균 (소수 첫째 자리)
export function averageRating(reviews) {
  if (!reviews.length) return null;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

// 산책 약속 상태: 예정 / 진행중(시작 후 90분) / 완료
export function walkStatus(walk, now = Date.now()) {
  const start = new Date(walk.datetime).getTime();
  if (now < start) return 'upcoming';
  if (now < start + 90 * 60 * 1000) return 'ongoing';
  return 'done';
}

// ---------- 지도 / 경로 ----------
const M_PER_DEG_LAT = 110540;

// 위경도 → 기준점에서의 미터 좌표 (x: 동쪽, y: 남쪽 — SVG 좌표계와 같은 방향)
export function toMeters(origin, pt) {
  return {
    x: (pt.lng - origin.lng) * 111320 * Math.cos(toRad(origin.lat)),
    y: -(pt.lat - origin.lat) * M_PER_DEG_LAT,
  };
}

// 기준점에서 bearing(도, 북=0 시계방향) 방향으로 meters 떨어진 위경도
export function offsetLatLng(origin, meters, bearing) {
  const b = toRad(bearing);
  return {
    lat: origin.lat + (meters * Math.cos(b)) / M_PER_DEG_LAT,
    lng: origin.lng + (meters * Math.sin(b)) / (111320 * Math.cos(toRad(origin.lat))),
  };
}

export function pathLengthKm(path) {
  let km = 0;
  for (let i = 1; i < path.length; i++) km += distanceKm(path[i - 1], path[i]);
  return km;
}

// 반려견과 걷는 속도 약 3.5km/h 기준
export function courseStats(course) {
  const km = pathLengthKm(course.path) * (course.roundTrip ? 2 : 1);
  return { lengthKm: Math.round(km * 10) / 10, minutes: Math.max(5, Math.round((km / 3.5) * 60 / 5) * 5) };
}

// 경로 위의 주의 구간 목록. runs는 연속된 path 인덱스 구간 [from, to] 목록
// (왕복 경로처럼 같은 위험 구간을 두 번 지나면 run이 둘)
// when: 'night'(저녁·밤에만 주의) | 'always'(항상 주의)
export function hazardSegments(course, slot) {
  const night = NIGHT_SLOTS.includes(slot);
  return (course.hazards || []).map((h, i) => {
    const runs = [];
    course.path.forEach((p, j) => {
      if (p.h !== i) return;
      const last = runs[runs.length - 1];
      if (last && last[1] === j - 1) last[1] = j;
      else runs.push([j, j]);
    });
    return { ...h, no: i + 1, runs, active: h.when === 'always' || night };
  });
}

// ---------- 산책 당일 안심 기능 ----------
// 경로의 fraction(0~1) 지점 좌표 — 거리 기준으로 보간
export function positionAlongPath(path, fraction) {
  const f = Math.min(1, Math.max(0, fraction));
  const total = pathLengthKm(path);
  if (!total) return { lat: path[0].lat, lng: path[0].lng };
  let target = total * f;
  for (let i = 1; i < path.length; i++) {
    const seg = distanceKm(path[i - 1], path[i]);
    if (target <= seg || i === path.length - 1) {
      const t = seg ? Math.min(1, target / seg) : 0;
      return {
        lat: path[i - 1].lat + (path[i].lat - path[i - 1].lat) * t,
        lng: path[i - 1].lng + (path[i].lng - path[i - 1].lng) * t,
      };
    }
    target -= seg;
  }
  return { lat: path[path.length - 1].lat, lng: path[path.length - 1].lng };
}

// 안심 산책 세션 상태. session.offsetMs는 데모에서 시간을 앞당길 때 쓴다
export function sessionStatus(session, now, { graceMin = 15, checkinMin = 20 } = {}) {
  const t = now + (session.offsetMs || 0);
  const elapsedMin = Math.max(0, (t - session.startedAt) / 60000);
  const overdueMin = Math.max(0, (t - session.expectedEnd) / 60000);
  const lastCheck = Math.max(session.startedAt, ...(session.checkins || []));
  const sinceCheckMin = (t - lastCheck) / 60000;
  const ended = Boolean(session.endedAt);
  return {
    now: t,
    elapsedMin,
    remainingMin: Math.max(0, (session.expectedEnd - t) / 60000),
    overdueMin,
    overdue: !ended && overdueMin > 0,
    // 예정 시간 + 유예 시간이 지나도 종료하지 않으면 지인에게 자동 알림
    shouldAlert: !ended && overdueMin >= graceMin && !session.alertedAt,
    alertInMin: Math.max(0, graceMin - overdueMin),
    needCheckin: !ended && sinceCheckMin >= checkinMin,
    progress: Math.min(1, elapsedMin / Math.max(1, session.plannedMin)),
    ended,
  };
}

// 휴대폰 번호 형식 (010-1234-5678, 01012345678 등)
export function normalizePhone(input) {
  const d = String(input || '').replace(/\D/g, '');
  if (!/^01[016789]\d{7,8}$/.test(d)) return null;
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

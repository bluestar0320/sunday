// 매칭/거리/일정 계산 등 순수 로직 (브라우저와 Node 테스트에서 공통 사용)

export const SIZES = ['소형', '중형', '대형'];
export const ENERGY = ['느긋', '보통', '활발'];
export const TIME_SLOTS = ['이른 아침', '점심', '저녁', '밤'];

// 안전·매너 규칙 (값을 바꾸면 앱 전체 동작과 안내 문구가 함께 바뀐다)
export const RULES = {
  alertGraceMin: 15,         // 예정 종료 시간이 이만큼 지나면 안심 연락처에 자동 알림 (기본값, MY에서 변경 가능)
  checkinMin: 20,            // 안심 산책 중 체크인 간격 (기본값, MY에서 변경 가능)
  extendMin: 15,             // '연장' 버튼 한 번에 늘어나는 시간
  noShowLimit: 2,            // 노쇼가 이만큼 쌓이면 추천·제안 제한
  lateCancelHours: 3,        // 약속 이 시간 전 이내 취소는 늦은 취소
  dayReminderSkipHours: 3,   // 약속이 이 시간도 안 남았으면 전날 알림 생략
  contactWarnBeforeFirstWalk: true, // 첫 산책 전 연락처 공유 시 확인
};

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
  const cautions = []; // 만나기 전에 알아둘 점
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
    cautions.push('천천히 친해지는 아이가 있어요');
  }

  // 건강·안전: 입질 이력, 예방접종
  const mh = me.dog.health || {};
  const oh = other.dog.health || {};
  if (mh.bite || oh.bite) {
    score -= 20;
    cautions.push(oh.bite ? `${other.dog.name}는 입질 이력이 있어요` : '우리 아이의 입질 이력이 상대에게 표시돼요');
  }
  if (oh.vaccinated === false) {
    score -= 10;
    cautions.push(`${other.dog.name}는 예방접종이 아직 끝나지 않았어요`);
  }
  const allergies = [oh.allergies && `${other.dog.name}: ${oh.allergies}`, mh.allergies && `${me.dog.name}: ${mh.allergies}`].filter(Boolean);
  if (allergies.length) cautions.push(`간식 알러지 — ${allergies.join(', ')}`);

  return {
    score: Math.round(Math.max(0, Math.min(100, score))),
    distanceKm: Math.round(km * 10) / 10,
    reasons,
    cautions,
  };
}

// 사용자가 받아볼 후보 목록: 필터 → 이미 본 사람 제외 → 궁합순 정렬
export function rankCandidates(me, people, { maxKm = 5, sizes = SIZES, seen = [], vaccinatedOnly = false, verifiedOnly = false } = {}) {
  const seenSet = new Set(seen);
  return people
    .filter((p) => p.id !== me.id && !seenSet.has(p.id))
    .filter((p) => !mannerSummary(p.manner).restricted) // 노쇼가 반복된 사람은 추천하지 않음
    .filter((p) => !vaccinatedOnly || p.dog.health?.vaccinated)
    .filter((p) => !verifiedOnly || isVerified(p))
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

// ---------- 강아지 건강 · 인증 ----------
export const isVerified = (p) => Boolean(p.verified?.phone && p.verified?.registry);

// 동물등록번호: 15자리 숫자 (예: 410 1000 1234 5678)
export const validRegistryNo = (no) => /^\d{15}$/.test(String(no || '').replace(/\s|-/g, ''));

export function healthFlags(dog) {
  const h = dog.health || {};
  return [
    { key: 'vaccine', ok: Boolean(h.vaccinated), label: h.vaccinated ? '예방접종 완료' : '예방접종 진행 중' },
    { key: 'neuter', ok: null, label: h.neutered ? '중성화 했어요' : '중성화 안 했어요' },
    { key: 'bite', ok: !h.bite, label: h.bite ? '입질 이력 있음' : '입질 이력 없음' },
    { key: 'allergy', ok: null, label: h.allergies ? `알러지: ${h.allergies}` : '알러지 없음' },
  ];
}

// ---------- 일정 조율 ----------
const dayOfYear = (d) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(d.getFullYear(), 0, 0)) / 86400000);

// 데모용 날씨 예보: 날짜마다 항상 같은 값 (나흘에 한 번 비). 실서비스에서는 기상청 단기예보 API
export function forecastFor(date) {
  const doy = dayOfYear(new Date(date));
  const rainyDay = doy % 4 === 2;
  const rainProb = rainyDay ? 60 + ((doy * 7) % 31) : (doy * 13) % 35;
  return {
    rainProb,
    rainy: rainProb >= 60,
    sky: rainProb >= 60 ? '비' : rainProb >= 25 ? '흐림' : '맑음',
    tempC: 8 + ((doy * 5) % 10),
  };
}

// 상대방(데모)의 답: 비 예보 → 다른 날, 선호하지 않는 시간대 → 선호 시간, 주의 코스 → 더 안전한 코스
export function respondToProposal(p, { slot, date, courseLevel }) {
  const f = forecastFor(date);
  if (f.rainy) {
    let shift = 1;
    while (shift < 7 && forecastFor(new Date(new Date(date).getTime() + shift * 86400000)).rainy) shift++;
    return { action: 'counter', dayShift: shift, slot: p.walkTimes.includes(slot) ? slot : p.walkTimes[0], reason: `그날 비 예보(${f.rainProb}%)가 있어서` };
  }
  if (!p.walkTimes.includes(slot)) {
    return { action: 'counter', dayShift: 0, slot: p.walkTimes[0], reason: `${slot}에는 시간이 안 돼서` };
  }
  if (courseLevel === '주의') {
    return { action: 'counter', dayShift: 0, slot, saferCourse: true, reason: '그 길은 그 시간에 좀 어두워서' };
  }
  return { action: 'accept' };
}

// 산책 전날·1시간 전 알림
export function reminderTimes(walk) {
  const t = new Date(walk.datetime).getTime();
  return [
    { key: `${walk.id}:day`, at: t - 24 * 3600000, kind: 'day' },
    { key: `${walk.id}:hour`, at: t - 3600000, kind: 'hour' },
  ];
}

export function dueReminders(walks, fired, now) {
  const done = new Set(fired);
  return walks
    .filter((w) => w.status === 'confirmed' && !w.completedAt && now < new Date(w.datetime).getTime())
    .flatMap((w) => reminderTimes(w).map((r) => ({ ...r, walk: w })))
    .filter((r) => r.at <= now && !done.has(r.key))
    // 약속이 얼마 안 남았으면 '전날 알림'은 건너뛴다 (1시간 전 알림만)
    .filter((r) => r.kind !== 'day' || new Date(r.walk.datetime).getTime() - now > RULES.dayReminderSkipHours * 3600000);
}

// 알림 문구용: 오늘 / 내일 / 10월 25일
export function relativeDay(date, now = new Date()) {
  const d = new Date(date);
  const diff = Math.round((new Date(d.toDateString()) - new Date(new Date(now).toDateString())) / 86400000);
  return diff === 0 ? '오늘' : diff === 1 ? '내일' : `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

// ---------- 받은 좋아요 ----------
// 나를 좋아요 했지만 아직 매칭되지 않았고, 내가 넘기지도 않은 사람
export function receivedLikes(me, people, { matched = [], passed = [], blocked = [] } = {}) {
  const skip = new Set([...matched, ...passed, ...blocked]);
  return people.filter((p) => isMutualMatch(me.id, p) && !skip.has(p.id));
}

// 내가 보낸 좋아요에 상대가 답할 차례인지 (데모: likesBack인 사람은 delayMs 뒤 좋아요)
export function dueLikeBacks(likesSent, people, now, delayMs = 8000) {
  return likesSent
    .filter((l) => !l.answered && now - l.at >= delayMs)
    .map((l) => people.find((p) => p.id === l.id))
    .filter((p) => p?.likesBack);
}

// ---------- 동네 산책 모임 ----------
// members: 참여자 id 목록 (나는 'me')
export function groupFit(group, me, members, now = Date.now()) {
  if (members.includes(me.id)) return { ok: false, joined: true, reason: '참여 중' };
  if (new Date(group.datetime).getTime() < now) return { ok: false, reason: '이미 지난 모임이에요' };
  if (members.length >= group.capacity) return { ok: false, reason: '자리가 다 찼어요' };
  if (group.sizeRule !== '모두' && group.sizeRule !== me.dog.size) return { ok: false, reason: `${group.sizeRule}견만 참여할 수 있어요` };
  return { ok: true, reason: `${group.capacity - members.length}자리 남았어요` };
}

// ---------- 산책 기록 ----------
// 안심 산책 세션이 있으면 실제 걸은 시간으로, 없으면 코스 예상치로 기록
export function recordFromWalk(walk, course, now = Date.now()) {
  const s = walk.session;
  const minutes = s?.endedAt ? Math.max(1, Math.round((s.endedAt - s.startedAt) / 60000)) : course.minutes;
  const ratio = s?.endedAt ? Math.min(1, minutes / Math.max(1, course.minutes)) : 1;
  return {
    walkId: walk.id,
    personId: walk.personId || null,
    groupId: walk.groupId || null,
    courseId: course.id,
    slot: walk.slot,
    date: walk.completedAt || now,
    km: Math.round(course.lengthKm * ratio * 10) / 10,
    minutes,
    photos: [],
    memo: '',
  };
}

export function recordStats(records) {
  const km = records.reduce((a, r) => a + r.km, 0);
  return {
    count: records.length,
    km: Math.round(km * 10) / 10,
    minutes: records.reduce((a, r) => a + r.minutes, 0),
    friends: new Set(records.map((r) => r.personId).filter(Boolean)).size,
  };
}

// ---------- 매너 평가 ----------
// m: { count, avg, tags: { 태그: 횟수 }, noShows, lateCancels }
export function mannerSummary(m = {}) {
  const count = m.count || 0;
  const noShows = m.noShows || 0;
  const lateCancels = m.lateCancels || 0;
  const avg = count ? Math.round(m.avg * 10) / 10 : null;
  const topTags = Object.entries(m.tags || {}).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([tag, n]) => ({ tag, n }));
  return {
    count, avg, topTags, noShows, lateCancels,
    badge: avg !== null && avg >= 4.5 && count >= 5 && noShows === 0 ? '매너 우수' : null,
    warning: noShows ? `노쇼 ${noShows}회` : lateCancels >= 2 ? `늦은 취소 ${lateCancels}회` : null,
    restricted: noShows >= RULES.noShowLimit, // 노쇼가 반복되면 추천·제안 제한
  };
}

// 받은 평가 목록 → 요약 입력값
export function mannerFromReviews(reviews, penalties = {}) {
  const tags = {};
  reviews.forEach((r) => r.tags.forEach((t) => { tags[t] = (tags[t] || 0) + 1; }));
  return {
    count: reviews.length,
    avg: reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0,
    tags, noShows: penalties.noShows || 0, lateCancels: penalties.lateCancels || 0,
  };
}

// 확정된 약속을 시작 RULES.lateCancelHours 이내에 취소하면 늦은 취소
export const isLateCancel = (walk, now = Date.now()) => walk.status === 'confirmed'
  && new Date(walk.datetime).getTime() - now < RULES.lateCancelHours * 3600000;

// ---------- 채팅 안전 ----------
// 첫 산책 전 연락처·SNS 교환, 외부 링크, 금전 요청을 찾아낸다
const CONTACT_RE = /(01[016789][-.\s]?\d{3,4}[-.\s]?\d{4})|(카톡|카카오톡|오픈채팅|kakao|인스타|insta|라인\s?아이디|텔레그램|telegram)|(@[a-z0-9_.]{3,})/i;
const LINK_RE = /(https?:\/\/|www\.)\S+/i;
const MONEY_RE = /(송금|계좌|입금|이체|빌려\s?(줘|주|줄)|돈\s?(좀|을|이)?\s?(보내|빌려)|투자|코인|상품권|기프티콘\s?보내|현금)/;

export function detectSensitive(text) {
  const t = String(text || '');
  const kinds = [];
  if (CONTACT_RE.test(t)) kinds.push('contact');
  if (LINK_RE.test(t)) kinds.push('link');
  if (MONEY_RE.test(t)) kinds.push('money');
  return { kinds, contact: kinds.includes('contact'), link: kinds.includes('link'), money: kinds.includes('money') };
}

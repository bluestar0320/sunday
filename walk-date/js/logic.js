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

// 두 사람의 중간 지점에서 가장 가까운 산책 장소를 추천
export function suggestSpots(me, other, spots, limit = 3) {
  const mid = {
    lat: (me.location.lat + other.location.lat) / 2,
    lng: (me.location.lng + other.location.lng) / 2,
  };
  return spots
    .map((s) => ({ ...s, distanceKm: Math.round(distanceKm(mid, s) * 10) / 10 }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
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

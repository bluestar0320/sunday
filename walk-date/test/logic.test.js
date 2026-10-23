import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  distanceKm, compatibility, rankCandidates, recommendCourses, courseSafety,
  isMutualMatch, averageRating, walkStatus,
  toMeters, offsetLatLng, pathLengthKm, courseStats, hazardSegments,
  positionAlongPath, sessionStatus, normalizePhone,
} from '../js/logic.js';
import { PEOPLE, COURSES, DEFAULT_ME } from '../js/data.js';

const me = {
  ...structuredClone(DEFAULT_ME),
  name: '테스트', walkTimes: ['저녁'], interests: ['카페'],
  dog: { ...DEFAULT_ME.dog, name: '초코', size: '중형', energy: '활발' },
};

test('distanceKm: 같은 지점은 0, 망원~연남은 약 1.5km', () => {
  assert.equal(distanceKm(me.location, me.location), 0);
  const d = distanceKm({ lat: 37.5560, lng: 126.9060 }, { lat: 37.5605, lng: 126.9235 });
  assert.ok(d > 1.3 && d < 1.8, `got ${d}`);
});

test('compatibility: 크기·에너지·시간대가 같은 사람이 더 높은 점수', () => {
  const good = PEOPLE.find((p) => p.id === 'p1'); // 중형·활발·저녁
  const bad = PEOPLE.find((p) => p.id === 'p6');  // 느긋·밤·천천히 친해짐
  const a = compatibility(me, good);
  const b = compatibility(me, bad);
  assert.ok(a.score > b.score);
  assert.ok(a.score >= 0 && a.score <= 100);
  assert.ok(a.reasons.some((r) => r.includes('중형')));
});

test('rankCandidates: 성별·이미 본 사람·거리·크기 필터와 점수 정렬', () => {
  const list = rankCandidates({ ...me, lookingFor: '여성' }, PEOPLE, { seen: ['p1'], maxKm: 5 });
  assert.ok(list.every((c) => c.person.gender === '여성'));
  assert.ok(!list.some((c) => c.person.id === 'p1'));
  for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].score >= list[i].score);

  const small = rankCandidates({ ...me, lookingFor: '모두' }, PEOPLE, { sizes: ['소형'] });
  assert.ok(small.length > 0 && small.every((c) => c.person.dog.size === '소형'));

  assert.equal(rankCandidates({ ...me, lookingFor: '모두' }, PEOPLE, { maxKm: 0.1 }).length, 0);
});

const byId = (id) => COURSES.find((c) => c.id === id);

test('courseSafety: 밝고 붐비는 길은 안심, 밤의 어두운 숲길·골목은 주의', () => {
  assert.equal(courseSafety(byId('c2'), '밤').level, '안심'); // 경의선숲길: 밤에도 붐빔
  const forest = courseSafety(byId('c8'), '밤');            // 성미산 숲길
  assert.equal(forest.level, '주의');
  assert.ok(forest.secluded);
  assert.ok(forest.checks.some((k) => k.key === 'crowd' && !k.ok));
  assert.equal(courseSafety(byId('c7'), '저녁').level, '주의'); // 조명·CCTV 없는 골목
});

test('courseSafety: 같은 코스도 시간대에 따라 달라진다', () => {
  const park = byId('c3'); // 평화의공원: 낮엔 붐비고 밤엔 한산
  assert.notEqual(courseSafety(park, '점심').level, '주의');
  assert.equal(courseSafety(park, '밤').level, '주의');
});

test('recommendCourses: 안심 모드는 주의 코스를 숨기고, 끄면 보여준다', () => {
  const other = PEOPLE[0];
  const safe = recommendCourses(me, other, COURSES, { slot: '밤', safeOnly: true, limit: 10 });
  assert.ok(safe.courses.length > 0);
  assert.ok(safe.courses.every((c) => c.safety.level !== '주의'));
  assert.ok(safe.hiddenCount > 0);

  const all = recommendCourses(me, other, COURSES, { slot: '밤', safeOnly: false, limit: 10 });
  assert.equal(all.courses.length, COURSES.length);
  assert.equal(all.hiddenCount, 0);
  // 안전한 코스가 위에 온다
  assert.notEqual(all.courses[0].safety.level, '주의');
});

test('isMutualMatch / averageRating', () => {
  assert.equal(isMutualMatch('me', { likes: ['me'] }), true);
  assert.equal(isMutualMatch('me', { likes: [] }), false);
  assert.equal(averageRating([]), null);
  assert.equal(averageRating([{ rating: 5 }, { rating: 4 }]), 4.5);
});

test('walkStatus: 시작 전/90분 이내/이후', () => {
  const start = new Date('2026-10-14T18:00:00').getTime();
  const walk = { datetime: new Date(start).toISOString() };
  assert.equal(walkStatus(walk, start - 1), 'upcoming');
  assert.equal(walkStatus(walk, start + 30 * 60 * 1000), 'ongoing');
  assert.equal(walkStatus(walk, start + 2 * 60 * 60 * 1000), 'done');
});

test('toMeters / offsetLatLng: 북쪽 100m는 y=-100, 되돌리면 거리 100m', () => {
  const o = { lat: 37.556, lng: 126.906 };
  const p = offsetLatLng(o, 100, 0);
  const m = toMeters(o, p);
  assert.ok(Math.abs(m.x) < 0.5 && Math.abs(m.y + 100) < 0.5);
  const e = offsetLatLng(o, 250, 90);
  assert.ok(Math.abs(distanceKm(o, e) * 1000 - 250) < 2);
});

test('courseStats: 경로 길이로 거리·시간 계산, 왕복은 2배', () => {
  const path = [{ lat: 37.556, lng: 126.906 }, offsetLatLng({ lat: 37.556, lng: 126.906 }, 700, 0)];
  assert.ok(Math.abs(pathLengthKm(path) - 0.7) < 0.01);
  assert.deepEqual(courseStats({ path }), { lengthKm: 0.7, minutes: 10 });
  assert.equal(courseStats({ path, roundTrip: true }).lengthKm, 1.4);
});

test('hazardSegments: 연속 구간으로 묶고, 야간 구간은 낮에 비활성', () => {
  const c = { path: [{}, { h: 0 }, { h: 0 }, {}, { h: 0 }, {}, { h: 1 }], hazards: [{ note: 'a', when: 'night' }, { note: 'b', when: 'always' }] };
  const day = hazardSegments(c, '점심');
  assert.deepEqual(day[0].runs, [[1, 2], [4, 4]]);
  assert.equal(day[0].active, false);
  assert.equal(day[1].active, true);
  assert.equal(hazardSegments(c, '밤')[0].active, true);
});

test('코스 데이터: 경로·주의 구간·시설 정보가 안전 정보와 일치', () => {
  for (const c of COURSES) {
    assert.ok(c.path.length >= 2, c.id);
    assert.ok(c.lengthKm >= 0.8 && c.lengthKm <= 4, `${c.id} ${c.lengthKm}km`);
    hazardSegments(c, '밤').forEach((h) => assert.ok(h.runs.length > 0, `${c.id} 주의 구간 경로 없음`));
    const store = c.pois.find((p) => p.type === 'store');
    assert.ok(Math.abs(distanceKm(c.path[0], store) * 1000 - c.safety.storeM) < 5, c.id);
    assert.equal(c.pois.some((p) => p.type === 'cctv'), c.safety.cctv, c.id);
    // 어둡고 가려진 코스에는 항상 주의 구간이 표시돼야 한다
    if (!c.safety.openView) assert.ok(c.hazards.some((h) => h.when === 'always'), c.id);
  }
});

test('positionAlongPath: 0이면 출발점, 1이면 도착점, 0.5면 거리상 중간', () => {
  const a = { lat: 37.556, lng: 126.906 };
  const b = offsetLatLng(a, 1000, 90);
  const path = [a, b];
  assert.deepEqual(positionAlongPath(path, 0), { lat: a.lat, lng: a.lng });
  assert.ok(distanceKm(positionAlongPath(path, 1), b) < 0.001);
  assert.ok(Math.abs(distanceKm(a, positionAlongPath(path, 0.5)) - 0.5) < 0.01);
  assert.deepEqual(positionAlongPath(path, 2), positionAlongPath(path, 1));
});

test('sessionStatus: 체크인 시점, 예정 시간 초과, 자동 알림', () => {
  const start = 1_000_000_000_000;
  const min = 60000;
  const s = { startedAt: start, plannedMin: 60, expectedEnd: start + 60 * min, checkins: [], alertedAt: null };
  const opts = { graceMin: 15, checkinMin: 20 };
  assert.equal(sessionStatus(s, start + 10 * min, opts).needCheckin, false);
  assert.equal(sessionStatus(s, start + 21 * min, opts).needCheckin, true);
  assert.equal(sessionStatus({ ...s, checkins: [start + 20 * min] }, start + 25 * min, opts).needCheckin, false);
  const late = sessionStatus(s, start + 70 * min, opts);
  assert.equal(late.overdue, true);
  assert.equal(late.shouldAlert, false);
  assert.equal(Math.round(late.alertInMin), 5);
  assert.equal(sessionStatus(s, start + 76 * min, opts).shouldAlert, true);
  assert.equal(sessionStatus({ ...s, alertedAt: start + 76 * min }, start + 80 * min, opts).shouldAlert, false);
  assert.equal(sessionStatus({ ...s, endedAt: start + 50 * min }, start + 90 * min, opts).overdue, false);
  // 데모용 시간 앞당기기
  assert.equal(sessionStatus({ ...s, offsetMs: 30 * min }, start, opts).progress, 0.5);
});

test('normalizePhone: 휴대폰 번호만 허용하고 하이픈 형식으로', () => {
  assert.equal(normalizePhone('01012345678'), '010-1234-5678');
  assert.equal(normalizePhone('010-1234-5678'), '010-1234-5678');
  assert.equal(normalizePhone('011-123-4567'), '011-123-4567');
  assert.equal(normalizePhone('02-123-4567'), null);
  assert.equal(normalizePhone('abc'), null);
});

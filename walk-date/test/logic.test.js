import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  distanceKm, compatibility, rankCandidates, recommendCourses, courseSafety,
  isMutualMatch, averageRating, walkStatus,
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

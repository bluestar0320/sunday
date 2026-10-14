import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  distanceKm, compatibility, rankCandidates, suggestSpots,
  isMutualMatch, averageRating, walkStatus,
} from '../js/logic.js';
import { PEOPLE, SPOTS, DEFAULT_ME } from '../js/data.js';

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

test('suggestSpots: 중간 지점에서 가까운 순서로 limit개', () => {
  const spots = suggestSpots(me, PEOPLE[0], SPOTS, 3);
  assert.equal(spots.length, 3);
  assert.ok(spots[0].distanceKm <= spots[1].distanceKm && spots[1].distanceKm <= spots[2].distanceKm);
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

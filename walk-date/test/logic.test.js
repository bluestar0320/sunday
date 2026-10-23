import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  distanceKm, compatibility, rankCandidates, recommendCourses, courseSafety,
  isMutualMatch, averageRating, walkStatus,
  toMeters, offsetLatLng, pathLengthKm, courseStats, hazardSegments,
  positionAlongPath, sessionStatus, normalizePhone,
  healthFlags, isVerified, validRegistryNo,
  forecastFor, respondToProposal, reminderTimes, dueReminders,
  receivedLikes, dueLikeBacks, groupFit, recordFromWalk, recordStats,
  mannerSummary, mannerFromReviews, isLateCancel, relativeDay,
} from '../js/logic.js';
import { PEOPLE, COURSES, DEFAULT_ME, GROUPS } from '../js/data.js';

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

test('compatibility: 입질 이력·미접종은 감점하고 주의사항으로 알려준다', () => {
  const base = PEOPLE.find((p) => p.id === 'p1');
  const biter = { ...base, dog: { ...base.dog, health: { ...base.dog.health, bite: true } } };
  const unvacc = { ...base, dog: { ...base.dog, health: { ...base.dog.health, vaccinated: false, allergies: '닭고기' } } };
  const a = compatibility(me, base);
  const b = compatibility(me, biter);
  const c = compatibility(me, unvacc);
  assert.equal(a.score - b.score, 20);
  assert.ok(b.cautions.some((x) => x.includes('입질')));
  assert.equal(a.score - c.score, 10);
  assert.ok(c.cautions.some((x) => x.includes('예방접종')));
  assert.ok(c.cautions.some((x) => x.includes('닭고기')));
  // 주의사항은 '잘 맞는 이유'에 섞이지 않는다
  assert.ok(!b.reasons.some((x) => x.includes('입질')));
});

test('rankCandidates: 접종 완료 / 인증 회원만 필터', () => {
  const all = rankCandidates({ ...me, lookingFor: '모두' }, PEOPLE, { maxKm: 10 });
  const vacc = rankCandidates({ ...me, lookingFor: '모두' }, PEOPLE, { maxKm: 10, vaccinatedOnly: true });
  const ver = rankCandidates({ ...me, lookingFor: '모두' }, PEOPLE, { maxKm: 10, verifiedOnly: true });
  assert.ok(vacc.length < all.length && vacc.every((c) => c.person.dog.health.vaccinated));
  assert.ok(ver.length < all.length && ver.every((c) => isVerified(c.person)));
});

test('validRegistryNo / healthFlags', () => {
  assert.equal(validRegistryNo('410100012345678'), true);
  assert.equal(validRegistryNo('410 1000 1234 5678'), true);
  assert.equal(validRegistryNo('4101000123456789'), false); // 16자리
  assert.equal(validRegistryNo('1234'), false);
  const flags = healthFlags({ health: { vaccinated: true, neutered: false, bite: true, allergies: '' } });
  assert.equal(flags.find((f) => f.key === 'bite').ok, false);
  assert.equal(flags.find((f) => f.key === 'vaccine').ok, true);
});

test('forecastFor: 같은 날짜는 항상 같은 예보, 7일 안에 비 오는 날이 있다', () => {
  const d = new Date('2026-10-25T18:00:00');
  assert.deepEqual(forecastFor(d), forecastFor(new Date('2026-10-25T07:00:00')));
  const week = Array.from({ length: 7 }, (_, i) => forecastFor(new Date(2026, 9, 24 + i)));
  assert.ok(week.some((f) => f.rainy) && week.some((f) => !f.rainy));
  week.forEach((f) => assert.ok(f.rainProb >= 0 && f.rainProb <= 100));
});

test('respondToProposal: 비 예보·안 맞는 시간대·주의 코스면 다른 제안, 아니면 수락', () => {
  const p = PEOPLE.find((x) => x.id === 'p8'); // 저녁·점심 선호
  const rainy = [...Array(7)].map((_, i) => new Date(2026, 9, 24 + i)).find((d) => forecastFor(d).rainy);
  const dry = [...Array(7)].map((_, i) => new Date(2026, 9, 24 + i)).find((d) => !forecastFor(d).rainy);
  const r1 = respondToProposal(p, { slot: '저녁', date: rainy, courseLevel: '안심' });
  assert.equal(r1.action, 'counter');
  assert.ok(r1.dayShift >= 1 && !forecastFor(new Date(rainy.getTime() + r1.dayShift * 86400000)).rainy);
  const r2 = respondToProposal(p, { slot: '밤', date: dry, courseLevel: '안심' });
  assert.deepEqual([r2.action, r2.slot, r2.dayShift], ['counter', '저녁', 0]);
  assert.equal(respondToProposal(p, { slot: '저녁', date: dry, courseLevel: '주의' }).saferCourse, true);
  assert.equal(respondToProposal(p, { slot: '점심', date: dry, courseLevel: '보통' }).action, 'accept');
});

test('dueReminders: 확정된 약속의 전날·1시간 전 알림을 한 번씩만', () => {
  const start = new Date('2026-10-25T18:00:00').getTime();
  const w = { id: 'w1', status: 'confirmed', datetime: new Date(start).toISOString() };
  assert.equal(reminderTimes(w)[0].at, start - 24 * 3600000);
  assert.equal(dueReminders([w], [], start - 25 * 3600000).length, 0);
  assert.deepEqual(dueReminders([w], [], start - 23 * 3600000).map((r) => r.kind), ['day']);
  assert.deepEqual(dueReminders([w], ['w1:day'], start - 30 * 60000).map((r) => r.kind), ['hour']);
  assert.equal(dueReminders([w], [], start + 60000).length, 0); // 약속 시간이 지나면 보내지 않음
  assert.equal(dueReminders([w], [], start - 2 * 3600000).length, 0); // 2시간 남았으면 전날 알림은 건너뜀
  assert.equal(relativeDay(new Date(start), new Date(start - 3600000)), '오늘');
  assert.equal(relativeDay(new Date(start), new Date(start - 24 * 3600000)), '내일');
  assert.equal(dueReminders([{ ...w, status: 'pending' }], [], start - 30 * 60000).length, 0);
});

test('receivedLikes: 나를 좋아한 사람 중 매칭·넘김·차단 제외', () => {
  const all = receivedLikes(me, PEOPLE).map((p) => p.id);
  assert.deepEqual(all, PEOPLE.filter((p) => p.likes.includes('me')).map((p) => p.id));
  const left = receivedLikes(me, PEOPLE, { matched: ['p1'], passed: ['p3'], blocked: ['p4'] }).map((p) => p.id);
  assert.ok(!left.includes('p1') && !left.includes('p3') && !left.includes('p4'));
  assert.ok(left.includes('p8'));
});

test('dueLikeBacks: likesBack인 사람만, 시간이 지난 뒤 한 번', () => {
  const sent = [{ id: 'p2', at: 0 }, { id: 'p7', at: 0 }, { id: 'p5', at: 0, answered: true }];
  assert.deepEqual(dueLikeBacks(sent, PEOPLE, 5000).map((p) => p.id), []);
  assert.deepEqual(dueLikeBacks(sent, PEOPLE, 9000).map((p) => p.id), ['p2']);
});

test('groupFit: 정원·크기 제한·지난 모임·이미 참여', () => {
  const g = { capacity: 3, sizeRule: '소형', datetime: new Date(Date.now() + 86400000).toISOString() };
  const small = { ...me, dog: { ...me.dog, size: '소형' } };
  assert.equal(groupFit(g, small, ['a', 'b']).ok, true);
  assert.equal(groupFit(g, small, ['a', 'b', 'c']).reason, '자리가 다 찼어요');
  assert.equal(groupFit(g, me, ['a']).ok, false); // 중형견
  assert.equal(groupFit({ ...g, sizeRule: '모두' }, me, ['a']).ok, true);
  assert.equal(groupFit(g, small, ['a', 'me']).joined, true);
  assert.equal(groupFit({ ...g, datetime: new Date(Date.now() - 1000).toISOString() }, small, []).ok, false);
});

test('샘플 모임: 모두 안심·보통 코스에서 열린다', () => {
  for (const g of GROUPS) {
    const c = COURSES.find((x) => x.id === g.courseId);
    assert.notEqual(courseSafety(c, g.slot).level, '주의', g.id);
    assert.ok(g.members.length < g.capacity, g.id);
  }
});

test('recordFromWalk: 안심 산책 시간으로 거리 계산, 없으면 코스 예상치', () => {
  const c = COURSES.find((x) => x.id === 'c6'); // 1.2km, 20분
  const plain = recordFromWalk({ id: 'w1', personId: 'p1', slot: '저녁', completedAt: 5 }, c);
  assert.deepEqual([plain.km, plain.minutes, plain.date, plain.personId], [c.lengthKm, c.minutes, 5, 'p1']);
  const half = recordFromWalk({ id: 'w2', groupId: 'g1', slot: '점심', session: { startedAt: 0, endedAt: 10 * 60000 } }, c);
  assert.equal(half.minutes, 10);
  assert.equal(half.km, Math.round(c.lengthKm * 0.5 * 10) / 10);
  assert.equal(half.groupId, 'g1');
});

test('recordStats: 횟수·거리·시간·친구 수', () => {
  const st = recordStats([
    { km: 1.2, minutes: 20, personId: 'p1' },
    { km: 2.35, minutes: 40, personId: 'p1' },
    { km: 3, minutes: 50, personId: null },
  ]);
  assert.deepEqual(st, { count: 3, km: 6.6, minutes: 110, friends: 1 });
});

test('mannerSummary: 평균·상위 태그·매너 우수·노쇼 제한', () => {
  const good = mannerSummary({ count: 12, avg: 4.86, tags: { a: 3, b: 10, c: 5, d: 1 }, noShows: 0 });
  assert.equal(good.avg, 4.9);
  assert.deepEqual(good.topTags.map((t) => t.tag), ['b', 'c', 'a']);
  assert.equal(good.badge, '매너 우수');
  assert.equal(mannerSummary({ count: 3, avg: 5, tags: {} }).badge, null); // 평가 수 부족
  const one = mannerSummary({ count: 9, avg: 4.8, tags: {}, noShows: 1 });
  assert.deepEqual([one.badge, one.warning, one.restricted], [null, '노쇼 1회', false]);
  assert.equal(mannerSummary({ noShows: 2 }).restricted, true);
  assert.equal(mannerSummary({ lateCancels: 2 }).warning, '늦은 취소 2회');
  assert.equal(mannerSummary().avg, null);
});

test('rankCandidates: 노쇼가 반복된 사람은 추천하지 않는다', () => {
  const ids = rankCandidates({ ...me, lookingFor: '모두' }, PEOPLE, { maxKm: 10 }).map((c) => c.person.id);
  assert.ok(!ids.includes('p9'));
  assert.ok(ids.includes('p6')); // 노쇼 1회는 경고만
});

test('mannerFromReviews / isLateCancel', () => {
  const m = mannerFromReviews([{ rating: 5, tags: ['a', 'b'] }, { rating: 4, tags: ['a'] }], { lateCancels: 1 });
  assert.deepEqual([m.count, m.avg, m.tags.a, m.lateCancels], [2, 4.5, 2, 1]);
  const now = Date.now();
  const at = (h) => ({ status: 'confirmed', datetime: new Date(now + h * 3600000).toISOString() });
  assert.equal(isLateCancel(at(2), now), true);
  assert.equal(isLateCancel(at(5), now), false);
  assert.equal(isLateCancel({ ...at(1), status: 'pending' }, now), false);
});

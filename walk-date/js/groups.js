// 동네 산책 모임: 1:1보다 부담이 적은 3~6명 그룹 산책
import { PEOPLE, COURSES, GROUPS } from './data.js';
import { TIME_SLOTS, SIZES, courseSafety, groupFit, mannerSummary } from './logic.js';
import { weatherFor } from './services.js';
import {
  $, state, save, esc, person, course, media, toast, openModal, closeModal, fmtDate, safeBadge, uid,
  segHtml, bindToggles, segVal, groupById, notify, onTick, DAYS,
} from './core.js';
import { icon } from './ui.js';
import { openCourseMap, renderWalks } from './app.js';

const SLOT_HOUR = { '이른 아침': 7, '점심': 12, '저녁': 18, '밤': 21 };

export const allGroups = () => [...state.groups, ...GROUPS];
export const membersOf = (g) => (g.hostId === 'me' ? g.members : [...g.members, ...(state.joinedGroups.includes(g.id) ? ['me'] : [])]);
const walkOfGroup = (gid) => state.walks.find((w) => w.groupId === gid && w.status !== 'cancelled');

function avatarsHtml(ids, max = 5) {
  const shown = ids.slice(0, max);
  return `<span class="avatars">${shown.map((id) => `<span class="av">${media(person(id))}</span>`).join('')}${ids.length > max ? `<span class="av more">+${ids.length - max}</span>` : ''}</span>`;
}

function groupCard(g) {
  const members = membersOf(g);
  const c = course(g.courseId);
  const s = courseSafety(c, g.slot);
  const fit = groupFit(g, state.me, members);
  const f = weatherFor(g.datetime);
  return `<div class="group ${fit.joined ? 'joined' : ''}" data-group="${g.id}" role="button" tabindex="0">
    <div class="g-top"><span class="g-title">${esc(g.title)}</span>${g.hostId === 'me' ? '<span class="tag" style="height:24px;font-size:12px">내 모임</span>' : ''}</div>
    <div class="g-meta">${icon('clock', 14)}${fmtDate(g.datetime)} <span class="wx ${f.rainy ? 'rainy' : ''}">${f.sky}</span></div>
    <div class="g-meta">${icon('pin', 14)}${esc(c.name)} ${safeBadge(s.level)}</div>
    <div class="g-foot">${avatarsHtml(members)}<span class="g-count">${members.length}/${g.capacity}명 · ${g.sizeRule === '모두' ? '모든 크기' : `${g.sizeRule}견`}</span>
      <span class="g-state ${fit.ok ? 'ok' : ''}">${fit.joined ? '참여 중' : fit.reason}</span></div>
  </div>`;
}

export function renderGroups(root) {
  const list = allGroups().filter((g) => new Date(g.datetime).getTime() > Date.now() - 2 * 3600000)
    .sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  root.insertAdjacentHTML('beforeend', `
    <div class="notice" style="margin-bottom:14px">${icon('users', 18)}<span>여럿이 함께 걸으면 첫 만남이 덜 어색하고 더 안전해요. 모임도 안심 코스로만 열 수 있어요.</span></div>
    <button class="btn accent" id="newGroup" style="margin-bottom:16px">${icon('plus', 18)}모임 만들기</button>
    <div class="stack" id="groupList">${list.map(groupCard).join('')}</div>`);
  $('#newGroup', root).onclick = openCreateGroup;
  $('#groupList', root).onclick = (e) => {
    const card = e.target.closest('[data-group]');
    if (card) openGroup(card.dataset.group);
  };
}

export function openGroup(id) {
  const g = groupById(id);
  const members = membersOf(g);
  const c = course(g.courseId);
  const s = courseSafety(c, g.slot);
  const fit = groupFit(g, state.me, members);
  const host = person(g.hostId);
  const f = weatherFor(g.datetime);
  openModal(`
    <h3>${esc(g.title)}</h3>
    <p class="desc">${g.hostId === 'me' ? '내가 만든 모임' : `모임장 ${esc(host.name)} · ${esc(host.dog.name)}`}</p>
    <div class="walk-info">
      <div>${icon('clock', 16)}${fmtDate(g.datetime)} · ${g.slot}</div>
      <div>${icon('pin', 16)}${esc(c.name)} · ${c.lengthKm}km · 약 ${c.minutes}분 ${safeBadge(s.level)}</div>
      <div>${icon(f.rainy ? 'rain' : f.sky === '흐림' ? 'cloud' : 'sunny', 16)}예보 ${f.sky} ${f.tempC ?? '-'}° · 강수 ${f.rainProb}%</div>
      <div>${icon('paw', 16)}${g.sizeRule === '모두' ? '모든 크기의 강아지' : `${g.sizeRule}견만`} · 최대 ${g.capacity}명</div>
    </div>
    ${g.note ? `<p class="bio" style="margin:12px 2px">${esc(g.note)}</p>` : ''}
    <div class="label">참여자 ${members.length}/${g.capacity}</div>
    <div class="stack">${members.map((pid) => {
      const p = person(pid);
      return `<div class="menu-item"><span class="avatar">${media(p)}</span><span class="grow"><b>${pid === 'me' ? '나' : esc(p.name)}</b> <span class="muted small">${esc(p.dog.name)} · ${esc(p.dog.breed)} · ${p.dog.size}견</span></span>${pid === g.hostId ? '<span class="tag" style="height:24px;font-size:12px">모임장</span>' : ''}</div>`;
    }).join('')}</div>
    <button class="btn soft" id="gMap" style="margin-top:14px">${icon('route', 18)}코스 지도 보기</button>
    <div class="sheet-foot">
      ${fit.joined
        ? `<button class="btn outline" id="gLeave">${g.hostId === 'me' ? '모임 취소하기' : '모임 나가기'}</button>`
        : `<button class="btn accent" id="gJoin" ${fit.ok ? '' : 'disabled'}>${fit.ok ? '참여하기' : esc(fit.reason)}</button>`}
    </div>`, (root) => {
    $('#gMap', root).onclick = () => openCourseMap(g.courseId, g.slot);
    $('#gJoin', root)?.addEventListener('click', () => joinGroup(g));
    $('#gLeave', root)?.addEventListener('click', () => leaveGroup(g));
  });
}

function addGroupWalk(g) {
  state.walks.push({ id: uid('w'), groupId: g.id, courseId: g.courseId, datetime: g.datetime, slot: g.slot, status: 'confirmed', from: 'me', review: null });
}

function joinGroup(g) {
  state.joinedGroups.push(g.id);
  addGroupWalk(g);
  save();
  closeModal();
  notify(`'${g.title}' 모임에 참여했어요`, { kind: 'group', to: { name: 'walks' }, device: false });
  renderWalks();
}

function leaveGroup(g) {
  if (!confirm(g.hostId === 'me' ? '모임을 취소할까요? 참여자들에게 알림이 가요.' : '모임에서 나갈까요?')) return;
  state.joinedGroups = state.joinedGroups.filter((id) => id !== g.id);
  if (g.hostId === 'me') state.groups = state.groups.filter((x) => x.id !== g.id);
  const w = walkOfGroup(g.id);
  if (w) w.status = 'cancelled';
  save();
  closeModal();
  toast(g.hostId === 'me' ? '모임을 취소했어요' : '모임에서 나왔어요');
  renderWalks();
}

function openCreateGroup() {
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i + 1); return d; });
  const ui = { day: 0, slot: state.me.walkTimes[0] || '저녁', capacity: 4, sizeRule: '모두', courseId: null };
  openModal('', (root) => {
    const draw = () => {
      // 모임은 안심/보통 코스만 (주의 코스는 열 수 없음)
      const courses = COURSES.map((c) => ({ ...c, s: courseSafety(c, ui.slot) }))
        .filter((c) => c.s.level !== '주의')
        .sort((a, b) => b.s.score - a.s.score);
      if (!courses.some((c) => c.id === ui.courseId)) ui.courseId = courses[0]?.id;
      const title = $('#cg-title', root)?.value ?? '';
      const note = $('#cg-note', root)?.value ?? '';
      root.innerHTML = `
        <h3>산책 모임 만들기</h3>
        <p class="desc">동네 이웃과 함께 걸을 모임을 열어요. 사람이 다니는 안심 코스만 고를 수 있어요.</p>
        <div class="field"><label for="cg-title">모임 이름</label><input class="input" id="cg-title" maxlength="24" value="${esc(title)}" placeholder="예: 망원 저녁 산책 모임" /></div>
        <div class="field"><label>날짜</label><div class="chips" data-seg="day">${days.map((d, i) => `<button type="button" class="tag ${i === ui.day ? 'on' : ''}" data-v="${i}">${d.getMonth() + 1}/${d.getDate()} ${DAYS[d.getDay()]}</button>`).join('')}</div></div>
        <div class="field"><label>시간대</label>${segHtml('slot', TIME_SLOTS, ui.slot)}</div>
        <div class="field"><label>코스</label><div class="stack" id="cg-courses">${courses.map((c) => `
          <button type="button" class="menu-item ${c.id === ui.courseId ? 'on' : ''}" data-c="${c.id}">${icon('route', 18)}<span class="grow" style="text-align:left">${esc(c.name)} <span class="muted small">${c.lengthKm}km</span></span>${safeBadge(c.s.level)}</button>`).join('')}</div></div>
        <div class="field"><label>인원 (나 포함)</label>${segHtml('capacity', ['3', '4', '5', '6'], String(ui.capacity))}</div>
        <div class="field"><label>강아지 크기</label>${segHtml('sizeRule', ['모두', ...SIZES], ui.sizeRule)}</div>
        <div class="field"><label for="cg-note">소개</label><textarea class="input" id="cg-note" maxlength="100" placeholder="예: 천천히 걷고 카페에서 쉬어가요">${esc(note)}</textarea></div>
        <div class="sheet-foot"><button class="btn accent" id="cg-ok">모임 열기</button></div>`;
      bindToggles(root, (name, v) => {
        if (name === 'day') ui.day = Number(v);
        if (name === 'slot') { ui.slot = v; draw(); }
        if (name === 'capacity') ui.capacity = Number(v);
        if (name === 'sizeRule') ui.sizeRule = v;
      });
      $('#cg-courses', root).onclick = (e) => {
        const b = e.target.closest('[data-c]'); if (!b) return;
        ui.courseId = b.dataset.c; draw();
      };
      $('#cg-ok', root).onclick = () => {
        const name = $('#cg-title', root).value.trim();
        if (!name) { toast('모임 이름을 입력해 주세요'); return; }
        if (ui.sizeRule !== '모두' && ui.sizeRule !== state.me.dog.size) { toast(`우리 아이는 ${state.me.dog.size}견이라 ${ui.sizeRule}견 모임은 열 수 없어요`); return; }
        const d = new Date(days[ui.day]);
        d.setHours(SLOT_HOUR[ui.slot], 0, 0, 0);
        const g = {
          id: uid('g'), title: name, hostId: 'me', courseId: ui.courseId, slot: ui.slot, datetime: d.toISOString(),
          capacity: ui.capacity, sizeRule: ui.sizeRule, members: ['me'], note: $('#cg-note', root).value.trim(), createdAt: Date.now(),
        };
        state.groups.unshift(g);
        addGroupWalk(g);
        save();
        closeModal();
        notify(`'${name}' 모임을 열었어요. 이웃들에게 소개할게요`, { kind: 'group', to: { name: 'walks', tab: 'groups' }, device: false });
        renderWalks();
      };
    };
    draw();
  });
}

// 데모: 내가 연 모임에 이웃이 하나둘 참여한다 (최대 2명, 10초 간격)
onTick((now) => {
  for (const g of state.groups) {
    const joined = g.members.filter((id) => id !== 'me');
    if (joined.length >= 2 || g.members.length >= g.capacity) continue;
    if (now - (g.lastJoinAt || g.createdAt) < 10000) continue;
    const next = PEOPLE.find((p) => !g.members.includes(p.id) && !state.blocked.includes(p.id) && !mannerSummary(p.manner).restricted && (g.sizeRule === '모두' || p.dog.size === g.sizeRule));
    if (!next) continue;
    g.members.push(next.id);
    g.lastJoinAt = now;
    save();
    notify(`${next.name}님(${next.dog.name})이 '${g.title}' 모임에 참여했어요`, { kind: 'group', to: { name: 'walks', tab: 'groups' } });
  }
});

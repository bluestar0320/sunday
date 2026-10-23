// 앱 전체가 함께 쓰는 상태·저장·화면 전환·공통 UI
import { PEOPLE, COURSES, DEFAULT_ME } from './data.js';
import { SIZES } from './logic.js';
import { icon, dogArt } from './ui.js';

const STORAGE_KEY = 'walkdate:v2';
export const $ = (sel, root = document) => root.querySelector(sel);
export const view = $('#view');

// ---------- 상태 ----------
export function freshState() {
  return {
    onboarded: false,
    me: structuredClone(DEFAULT_ME),
    seen: [],
    likesSent: [],    // 내가 좋아요를 보낸 사람 (아직 매칭 전)
    matches: [],      // { personId, matchedAt, messages: [{from, text, at, kind, walkId, read}], unread }
    walks: [],        // { id, personId | groupId, courseId, datetime, slot, status, from, review, session }
    blocked: [],
    reports: [],
    filters: { maxKm: 5, sizes: [...SIZES], vaccinatedOnly: false, verifiedOnly: false },
    notices: [],      // 알림 센터 { id, at, text, kind, read, to }
    fired: [],        // 이미 보낸 예약 알림 id
    guardians: [],    // 안심 연락처 { id, name, phone }
    settings: { graceMin: 15, checkinMin: 20, deviceNotify: false },
    verify: { phone: false, registry: false },
    groups: [],       // 내가 만든 모임
    joinedGroups: [], // 참여한 모임 id
    records: [],      // 산책 기록 { id, walkId, personId | groupId, courseId, date, km, minutes, photos, memo }
    received: [],     // 내가 받은 매너 평가 { from, rating, tags, at }
    penalties: { lateCancels: 0, noShows: 0 },
    noShowReports: {}, // 내가 신고한 노쇼 { personId: count }
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const base = freshState();
      return {
        ...base, ...saved,
        filters: { ...base.filters, ...saved.filters },
        settings: { ...base.settings, ...saved.settings },
        verify: { ...base.verify, ...saved.verify },
        penalties: { ...base.penalties, ...saved.penalties },
        me: { ...base.me, ...saved.me, dog: { ...base.me.dog, ...saved.me?.dog, health: { ...base.me.dog.health, ...saved.me?.dog?.health } } },
      };
    }
  } catch { /* 저장소 사용 불가 시 새 상태로 시작 */ }
  return freshState();
}

export let state = load();
export let route = { name: state.onboarded ? 'discover' : 'onboarding', step: 0 };

export function resetState() {
  state = freshState();
  save();
}

export function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    toast('저장 공간이 부족해요. 사진 수를 줄여주세요.');
    return false;
  }
}

export const uid = (prefix) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const person = (id) => (id === 'me' ? state.me : PEOPLE.find((p) => p.id === id));
export const course = (id) => COURSES.find((c) => c.id === id);
export const matchOf = (id) => state.matches.find((m) => m.personId === id);
export const photosOf = (p) => p.dog.photos || [];

// 사진이 있으면 사진, 없으면 캐릭터 이미지(못 불러오면 일러스트)
export function media(p, i = 0) {
  const src = photosOf(p)[i];
  if (src) return `<img class="photo" src="${src}" alt="${esc(p.dog.name)} 사진" />`;
  return characterArt(p);
}

export function characterArt(p) {
  if (!p.img) return dogArt(p.art);
  return `<div class="art-wrap">${dogArt(p.art)}<img class="photo" src="${p.img}" alt="${esc(p.dog.name)} 캐릭터" loading="lazy" onerror="this.remove()" /></div>`;
}

export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2600);
}

export function openModal(html, onMount) {
  $('#modalBody').innerHTML = html;
  $('#modal').hidden = false;
  $('#modalBody').scrollTop = 0;
  onMount?.($('#modalBody'));
}
export function closeModal() { $('#modal').hidden = true; }
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

export const DAYS = '일월화수목금토';
const pad = (n) => String(n).padStart(2, '0');
export function fmtDate(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${DAYS[d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function fmtTime(t) {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function fmtAgo(t, now = Date.now()) {
  const min = Math.round((now - t) / 60000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  if (min < 60 * 24) return `${Math.round(min / 60)}시간 전`;
  return `${Math.round(min / 1440)}일 전`;
}

export function safeBadge(level) {
  return `<span class="safe-badge lv-${level}">${icon(level === '주의' ? 'alert' : 'shield', 13)}${level}</span>`;
}

// ---------- 폼 토글 ----------
export function segHtml(name, options, value) {
  return `<div class="seg" data-seg="${name}">${options.map((o) => `<button type="button" data-v="${esc(o)}" class="${o === value ? 'on' : ''}">${esc(o)}</button>`).join('')}</div>`;
}
export function chipsHtml(name, options, values) {
  return `<div class="chips" data-chips="${name}">${options.map((o) => `<button type="button" class="tag ${values.includes(o) ? 'on' : ''}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
}
export function bindToggles(root, onChange) {
  root.querySelectorAll('[data-seg]').forEach((seg) => seg.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    onChange?.(seg.dataset.seg, b.dataset.v);
  }));
  root.querySelectorAll('[data-chips]').forEach((c) => c.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    b.classList.toggle('on');
    onChange?.(c.dataset.chips);
  }));
}
export const segVal = (name, root = document) => root.querySelector(`[data-seg="${name}"] .on`)?.dataset.v;
export const chipVals = (name, root = document) => [...root.querySelectorAll(`[data-chips="${name}"] .on`)].map((b) => b.dataset.v);

export function switchHtml(id, checked) {
  return `<span class="switch"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''} /><span></span></span>`;
}

// ---------- 화면 전환 ----------
const views = {};
const afterRender = [];
const FLUSH = new Set(['discover', 'chat']);

export function registerView(name, fn) { views[name] = fn; }
export function onAfterRender(fn) { afterRender.push(fn); }

export function go(name, params = {}) {
  route = { name, ...params };
  render();
}

export function setTop(title, { back = false, actions = '', bell = true } = {}) {
  $('#title').textContent = title;
  $('#backBtn').hidden = !back;
  $('#topbar').classList.toggle('has-back', back);
  const bellBtn = bell ? `<button class="icon-btn" data-act="bell" aria-label="알림">${bellInner()}</button>` : '';
  $('#topActions').innerHTML = bellBtn + actions;
}

export function render() {
  $('#tabbar').hidden = route.name === 'onboarding' || route.name === 'live';
  document.querySelectorAll('#tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === route.name));
  view.classList.toggle('flush', FLUSH.has(route.name));
  view.scrollTop = 0;
  updateBadge();
  views[route.name]();
  afterRender.forEach((fn) => fn(route));
}

export function updateBadge() {
  const btn = $('#tabbar [data-tab="matches"]');
  btn.querySelector('.badge')?.remove();
  const unread = state.matches.filter((m) => m.unread && !state.blocked.includes(m.personId)).length;
  if (unread) btn.insertAdjacentHTML('beforeend', `<i class="badge">${unread}</i>`);
}

// ---------- 알림 센터 ----------
// to: 알림을 눌렀을 때 이동할 화면 { name, ...params }
export function notify(text, { kind = 'info', to = null, device = true } = {}) {
  state.notices.unshift({ id: uid('n'), at: Date.now(), text, kind, read: false, to });
  state.notices = state.notices.slice(0, 50);
  save();
  toast(text);
  if (device && state.settings.deviceNotify && 'Notification' in window && Notification.permission === 'granted') {
    try { new Notification('같이걸을개', { body: text }); } catch { /* 일부 브라우저는 페이지에서 직접 생성 불가 */ }
  }
  refreshBell();
}

function bellInner() {
  const unread = state.notices.filter((n) => !n.read).length;
  return `${icon('bell', 22)}${unread ? `<i class="badge dot-badge">${unread > 9 ? '9+' : unread}</i>` : ''}`;
}

// 벨 버튼의 안 읽은 알림 수만 다시 그린다 (다른 버튼의 이벤트는 그대로)
export function refreshBell() {
  const b = $('[data-act="bell"]');
  if (b) b.innerHTML = bellInner();
}

const NOTICE_ICON = { reminder: 'clock', like: 'heart', match: 'heart', safety: 'shield', alert: 'alert', group: 'users', weather: 'cloud', info: 'bell', manner: 'star' };

function openNotices() {
  const list = state.notices;
  openModal(`
    <h3>알림</h3>
    <p class="desc">산책 일정 알림, 받은 좋아요, 안심 산책 기록을 모아 보여드려요.</p>
    ${list.length ? `<div class="notice-list">${list.map((n) => `
      <button class="notice-item ${n.read ? '' : 'unread'} k-${n.kind}" data-id="${n.id}">
        <span class="ni">${icon(NOTICE_ICON[n.kind] || 'bell', 18)}</span>
        <span class="grow"><span class="t">${esc(n.text)}</span><span class="w">${fmtAgo(n.at)}</span></span>
      </button>`).join('')}</div>`
      : `<div class="empty" style="padding:32px 0"><div class="ic-wrap">${icon('bell', 30)}</div><strong>새 알림이 없어요</strong></div>`}
  `, (root) => {
    root.querySelector('.notice-list')?.addEventListener('click', (e) => {
      const b = e.target.closest('[data-id]'); if (!b) return;
      const n = state.notices.find((x) => x.id === b.dataset.id);
      closeModal();
      if (n?.to) go(n.to.name, n.to);
    });
    state.notices.forEach((n) => { n.read = true; });
    save();
    refreshBell();
  });
}

$('#topActions').addEventListener('click', (e) => {
  if (e.target.closest('[data-act="bell"]')) openNotices();
});

// ---------- 주기 작업 (예약 알림, 안심 산책 감시 등) ----------
const tickers = [];
export function onTick(fn) { tickers.push(fn); }
export function startTicker(ms = 5000) {
  const run = () => tickers.forEach((fn) => { try { fn(Date.now()); } catch (err) { console.error(err); } });
  run();
  return setInterval(run, ms);
}

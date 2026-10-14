import { PEOPLE, SPOTS, DEFAULT_ME, INTERESTS, AUTO_REPLIES } from './data.js';
import {
  SIZES, ENERGY, TIME_SLOTS,
  rankCandidates, compatibility, suggestSpots, isMutualMatch,
  averageRating, walkStatus, ageFromBirthYear,
} from './logic.js';

const STORAGE_KEY = 'walkdate:v1';
const $ = (sel, root = document) => root.querySelector(sel);
const view = $('#view');

// ---------- 상태 ----------
function freshState() {
  return {
    onboarded: false,
    me: structuredClone(DEFAULT_ME),
    seen: [],
    matches: [], // { personId, matchedAt, messages: [{from, text, at, kind}], unread }
    walks: [],   // { id, personId, spotId, datetime, slot, status: 'pending'|'confirmed'|'cancelled', review }
    blocked: [],
    filters: { maxKm: 5, sizes: [...SIZES] },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...freshState(), ...JSON.parse(raw) };
  } catch { /* 저장소 사용 불가 시 새 상태로 시작 */ }
  return freshState();
}

let state = load();
let route = { name: state.onboarded ? 'discover' : 'onboarding', step: 0 };

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* 무시 */ }
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const person = (id) => PEOPLE.find((p) => p.id === id);
const spot = (id) => SPOTS.find((s) => s.id === id);
const matchOf = (id) => state.matches.find((m) => m.personId === id);

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove('show'), 2200);
}

function openModal(html, onMount) {
  $('#modalBody').innerHTML = html;
  $('#modal').hidden = false;
  onMount?.($('#modalBody'));
}
function closeModal() { $('#modal').hidden = true; }
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

function fmtDate(iso) {
  const d = new Date(iso);
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]}) ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ---------- 라우팅 ----------
function go(name, params = {}) {
  route = { name, ...params };
  render();
}

function render() {
  const tabs = ['discover', 'matches', 'walks', 'profile'];
  const inTab = tabs.includes(route.name);
  $('#tabbar').hidden = route.name === 'onboarding';
  $('#backBtn').hidden = inTab || route.name === 'onboarding';
  $('#filterBtn').hidden = route.name !== 'discover';
  document.querySelectorAll('#tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === route.name));
  updateBadge();

  const views = { onboarding: renderOnboarding, discover: renderDiscover, matches: renderMatches, chat: renderChat, walks: renderWalks, profile: renderProfile };
  views[route.name]();
}

function updateBadge() {
  const btn = $('#tabbar [data-tab="matches"]');
  btn.querySelector('.badge')?.remove();
  const unread = state.matches.filter((m) => m.unread && !state.blocked.includes(m.personId)).length;
  if (unread) btn.insertAdjacentHTML('beforeend', `<i class="badge">${unread}</i>`);
}

$('#tabbar').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (b) go(b.dataset.tab);
});
$('#backBtn').addEventListener('click', () => go(route.back || 'matches'));
$('#filterBtn').addEventListener('click', openFilters);

// ---------- 온보딩 ----------
function renderOnboarding() {
  $('#title').textContent = '같이걸을개';
  const step = route.step || 0;
  const me = state.me;

  if (step === 0) {
    view.innerHTML = `
      <div class="onboard-hero">
        <div class="big">🐕‍🦺💛🐩</div>
        <h2>산책하다 만나는 인연</h2>
        <p>어색한 카페 소개팅 대신,<br/>강아지와 함께 걷는 편안한 첫 만남.</p>
      </div>
      <div class="steps">
        <div><b>🐾</b><span>우리 동네 <strong>산책 궁합</strong>이 맞는 보호자를 추천해요</span></div>
        <div><b>💬</b><span>서로 좋아요를 누르면 <strong>매칭</strong>되어 대화할 수 있어요</span></div>
        <div><b>📍</b><span>두 사람 중간 지점의 <strong>산책 코스</strong>로 데이트를 잡아요</span></div>
        <div><b>⭐</b><span>산책 후 <strong>매너 평가</strong>로 안전한 커뮤니티를 만들어요</span></div>
      </div>
      <button class="btn" id="start">시작하기</button>`;
    $('#start').onclick = () => go('onboarding', { step: 1 });
    return;
  }

  if (step === 1) {
    view.innerHTML = `
      <div class="progress"><i style="width:50%"></i></div>
      <h2 style="margin:0 0 4px">보호자님을 소개해 주세요</h2>
      <p class="muted small" style="margin:0 0 18px">상대방에게 보여질 정보예요.</p>
      ${personFields(me)}
      <button class="btn" id="next">다음</button>`;
    bindPersonFields();
    $('#next').onclick = () => {
      if (!readPersonFields()) return;
      go('onboarding', { step: 2 });
    };
    return;
  }

  view.innerHTML = `
    <div class="progress"><i style="width:100%"></i></div>
    <h2 style="margin:0 0 4px">우리 아이를 소개해 주세요</h2>
    <p class="muted small" style="margin:0 0 18px">산책 궁합 계산에 사용돼요.</p>
    ${dogFields(me.dog)}
    <div class="row">
      <button class="btn secondary" id="prev" style="flex:1">이전</button>
      <button class="btn" id="done" style="flex:2">산책 메이트 찾기</button>
    </div>`;
  bindDogFields();
  $('#prev').onclick = () => { readDogFields(true); go('onboarding', { step: 1 }); };
  $('#done').onclick = () => {
    if (!readDogFields()) return;
    state.onboarded = true;
    save();
    go('discover');
    toast(`${me.dog.name}와(과) 산책할 친구를 찾아볼게요!`);
  };
}

function segHtml(name, options, value) {
  return `<div class="seg" data-seg="${name}">${options.map((o) => `<button type="button" data-v="${esc(o)}" class="${o === value ? 'on' : ''}">${esc(o)}</button>`).join('')}</div>`;
}
function chipsHtml(name, options, values) {
  return `<div class="chips" data-chips="${name}">${options.map((o) => `<button type="button" class="chip ${values.includes(o) ? 'on' : ''}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
}
function bindToggles(root = view) {
  root.querySelectorAll('[data-seg]').forEach((seg) => seg.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
  }));
  root.querySelectorAll('[data-chips]').forEach((c) => c.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (b) b.classList.toggle('on');
  }));
}
const segVal = (name, root = document) => root.querySelector(`[data-seg="${name}"] .on`)?.dataset.v;
const chipVals = (name, root = document) => [...root.querySelectorAll(`[data-chips="${name}"] .on`)].map((b) => b.dataset.v);

function personFields(me) {
  return `
    <div class="field"><label for="f-name">이름 (닉네임)</label><input id="f-name" maxlength="10" value="${esc(me.name)}" placeholder="예: 하늘" /></div>
    <div class="row">
      <div class="field" style="flex:1"><label for="f-year">출생연도</label><input id="f-year" type="number" min="1950" max="2008" value="${esc(me.birthYear)}" /></div>
      <div class="field" style="flex:1"><label for="f-job">직업</label><input id="f-job" maxlength="16" value="${esc(me.job)}" placeholder="예: 회사원" /></div>
    </div>
    <div class="field"><label>성별</label>${segHtml('gender', ['여성', '남성'], me.gender)}</div>
    <div class="field"><label>만나고 싶은 사람</label>${segHtml('lookingFor', ['남성', '여성', '모두'], me.lookingFor)}</div>
    <div class="field"><label>선호 산책 시간</label>${chipsHtml('walkTimes', TIME_SLOTS, me.walkTimes)}</div>
    <div class="field"><label>관심사</label>${chipsHtml('interests', INTERESTS, me.interests)}</div>
    <div class="field"><label for="f-bio">한 줄 소개</label><textarea id="f-bio" maxlength="120" placeholder="예: 주말마다 한강 산책해요!">${esc(me.bio)}</textarea></div>`;
}
const bindPersonFields = () => bindToggles();
function readPersonFields() {
  const me = state.me;
  const name = $('#f-name').value.trim();
  const year = Number($('#f-year').value);
  const walkTimes = chipVals('walkTimes');
  if (!name) { toast('이름을 입력해 주세요'); return false; }
  if (!(year >= 1950 && year <= 2008)) { toast('출생연도를 확인해 주세요 (만 18세 이상)'); return false; }
  if (!walkTimes.length) { toast('산책 시간을 하나 이상 골라주세요'); return false; }
  Object.assign(me, {
    name, birthYear: year, job: $('#f-job').value.trim(), bio: $('#f-bio').value.trim(),
    gender: segVal('gender'), lookingFor: segVal('lookingFor'), walkTimes, interests: chipVals('interests'),
  });
  save();
  return true;
}

const DOG_EMOJIS = ['🐶', '🐕', '🐩', '🦮', '🐕‍🦺', '🐺'];
function dogFields(dog) {
  return `
    <div class="field"><label>프로필 아이콘</label>
      <div class="emoji-pick" data-seg="emoji">${DOG_EMOJIS.map((e) => `<button type="button" data-v="${e}" class="${e === dog.emoji ? 'on' : ''}">${e}</button>`).join('')}</div>
    </div>
    <div class="row">
      <div class="field" style="flex:1"><label for="d-name">이름</label><input id="d-name" maxlength="10" value="${esc(dog.name)}" placeholder="예: 초코" /></div>
      <div class="field" style="flex:1"><label for="d-age">나이</label><input id="d-age" type="number" min="0" max="25" value="${esc(dog.age)}" /></div>
    </div>
    <div class="field"><label for="d-breed">견종</label><input id="d-breed" maxlength="16" value="${esc(dog.breed)}" placeholder="예: 포메라니안" /></div>
    <div class="field"><label>크기</label>${segHtml('size', SIZES, dog.size)}</div>
    <div class="field"><label>산책 에너지</label>${segHtml('energy', ENERGY, dog.energy)}</div>
    <div class="field"><label>다른 강아지와는?</label>${segHtml('friendly', ['금방 친해져요', '천천히 친해져요'], dog.friendly ? '금방 친해져요' : '천천히 친해져요')}</div>
    <div class="field"><label for="d-traits">성격 키워드 (쉼표로 구분)</label><input id="d-traits" value="${esc(dog.traits.join(', '))}" placeholder="예: 애교쟁이, 간식 좋아함" /></div>`;
}
const bindDogFields = () => bindToggles();
function readDogFields(lenient = false) {
  const dog = state.me.dog;
  const name = $('#d-name').value.trim();
  if (!name && !lenient) { toast('강아지 이름을 입력해 주세요'); return false; }
  Object.assign(dog, {
    name, age: Number($('#d-age').value) || 0, breed: $('#d-breed').value.trim() || '믹스견',
    size: segVal('size'), energy: segVal('energy'), friendly: segVal('friendly') === '금방 친해져요',
    emoji: segVal('emoji') || dog.emoji,
    traits: $('#d-traits').value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 4),
  });
  save();
  return true;
}

// ---------- 탐색 ----------
function candidates() {
  return rankCandidates(state.me, PEOPLE.filter((p) => !state.blocked.includes(p.id)), {
    ...state.filters, seen: state.seen,
  });
}

function renderDiscover() {
  $('#title').textContent = '오늘의 산책 메이트';
  const list = candidates();
  if (!list.length) {
    view.innerHTML = `
      <div class="empty"><span class="big">🌙</span>
        근처의 산책 메이트를 모두 확인했어요.<br/>필터를 넓히거나 내일 다시 찾아봐요!
        <div style="margin-top:20px" class="row">
          <button class="btn secondary" id="openFilter">필터 변경</button>
          <button class="btn secondary" id="resetSeen">다시 보기</button>
        </div>
      </div>`;
    $('#openFilter').onclick = openFilters;
    $('#resetSeen').onclick = () => {
      const matched = new Set(state.matches.map((m) => m.personId));
      state.seen = state.seen.filter((id) => matched.has(id));
      save(); render();
    };
    return;
  }

  const c = list[0];
  const p = c.person;
  view.innerHTML = `
    <div class="card profile-card card-enter" id="pcard">
      <div class="profile-hero" style="background:linear-gradient(160deg, ${p.color}, ${p.color}88)">
        <span class="dist-pill">📍 ${c.distanceKm}km</span>
        <span class="score-pill">산책 궁합 ${c.score}%</span>
        <span class="dog-emoji">${p.dog.emoji}</span>
        <span class="owner-avatar" style="color:var(--primary-dark)">${esc(p.name[0])}</span>
      </div>
      <div class="profile-body">
        <h2>${esc(p.name)} <small>${ageFromBirthYear(p.birthYear)} · ${esc(p.job)}</small></h2>
        <div class="dog-line">${esc(p.dog.name)} · ${esc(p.dog.breed)} ${p.dog.age}살 · ${p.dog.size}견 · ${p.dog.energy}</div>
        <p class="bio">${esc(p.bio)}</p>
        <div class="chips">
          ${p.dog.traits.map((t) => `<span class="chip">🐾 ${esc(t)}</span>`).join('')}
          ${p.walkTimes.map((t) => `<span class="chip">🕒 ${t}</span>`).join('')}
        </div>
        ${c.reasons.length ? `<ul class="reasons">${c.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
      </div>
    </div>
    <div class="swipe-actions">
      <button class="round" id="pass" aria-label="다음에">✕</button>
      <button class="round like" id="like" aria-label="좋아요">🐾</button>
    </div>
    <p class="muted small" style="text-align:center">남은 추천 ${list.length}명</p>`;

  $('#pass').onclick = () => swipe(p, false);
  $('#like').onclick = () => swipe(p, true);
}

function swipe(p, liked) {
  const card = $('#pcard');
  card.classList.add(liked ? 'card-out-right' : 'card-out-left');
  state.seen.push(p.id);
  save();
  setTimeout(() => {
    if (liked && isMutualMatch(state.me.id, p)) {
      createMatch(p);
      render();
      showMatchModal(p);
    } else {
      render();
      if (liked) toast(`${p.name}님에게 좋아요를 보냈어요 🐾`);
    }
  }, 260);
}

function createMatch(p) {
  if (matchOf(p.id)) return;
  const c = compatibility(state.me, p);
  state.matches.unshift({
    personId: p.id,
    matchedAt: new Date().toISOString(),
    unread: true,
    messages: [
      { from: 'system', text: `산책 궁합 ${c.score}% 매칭! ${c.reasons[0] ? `(${c.reasons[0]})` : ''}`, at: Date.now() },
      { from: p.id, text: `안녕하세요! ${p.dog.name} 보호자 ${p.name}이에요 😊 ${state.me.dog.name || '아이'} 너무 귀여워요!`, at: Date.now() },
    ],
  });
  save();
}

function showMatchModal(p) {
  openModal(`
    <div class="match-pop">
      <div class="pair">${state.me.dog.emoji} 💛 ${p.dog.emoji}</div>
      <h3>산책 매칭 성공!</h3>
      <p class="muted">${esc(p.name)}님도 ${esc(state.me.name)}님에게 좋아요를 보냈어요.<br/>${esc(p.dog.name)}와(과) 첫 산책을 계획해 보세요.</p>
      <button class="btn" id="m-chat">대화 시작하기</button>
      <button class="btn ghost" id="m-later">계속 둘러보기</button>
    </div>`, (root) => {
    $('#m-chat', root).onclick = () => { closeModal(); go('chat', { id: p.id, back: 'matches' }); };
    $('#m-later', root).onclick = closeModal;
  });
}

function openFilters() {
  const f = state.filters;
  openModal(`
    <h3>추천 필터</h3>
    <p class="muted small" style="margin:0 0 16px">조건에 맞는 산책 메이트만 보여드려요.</p>
    <div class="field"><label for="km">최대 거리: <b id="kmv">${f.maxKm}</b>km</label>
      <input id="km" type="range" min="1" max="10" step="1" value="${f.maxKm}" /></div>
    <div class="field"><label>강아지 크기</label>${chipsHtml('sizes', SIZES, f.sizes)}</div>
    <div class="field"><label>만나고 싶은 사람</label>${segHtml('lookingFor', ['남성', '여성', '모두'], state.me.lookingFor)}</div>
    <button class="btn" id="apply">적용하기</button>`, (root) => {
    bindToggles(root);
    $('#km', root).oninput = (e) => { $('#kmv', root).textContent = e.target.value; };
    $('#apply', root).onclick = () => {
      const sizes = chipVals('sizes', root);
      state.filters = { maxKm: Number($('#km', root).value), sizes: sizes.length ? sizes : [...SIZES] };
      state.me.lookingFor = segVal('lookingFor', root);
      save(); closeModal(); render();
    };
  });
}

// ---------- 매칭 목록 ----------
function renderMatches() {
  $('#title').textContent = '매칭';
  const active = state.matches.filter((m) => !state.blocked.includes(m.personId));
  if (!active.length) {
    view.innerHTML = `<div class="empty"><span class="big">💌</span>아직 매칭이 없어요.<br/>탐색 탭에서 마음에 드는 산책 메이트에게<br/>좋아요를 눌러보세요!</div>`;
    return;
  }
  const fresh = active.filter((m) => m.messages.every((x) => x.from !== 'me'));
  const talking = active.filter((m) => !fresh.includes(m));

  view.innerHTML = `
    ${fresh.length ? `<div class="section-title" style="margin-top:0">새로운 매칭</div>
      <div class="new-matches">${fresh.map((m) => {
        const p = person(m.personId);
        return `<button data-open="${p.id}"><span class="avatar" style="background:${p.color}">${p.dog.emoji}</span>${esc(p.name)}</button>`;
      }).join('')}</div>` : ''}
    <div class="section-title">대화</div>
    <div class="list">
      ${active.map((m) => {
        const p = person(m.personId);
        const last = m.messages[m.messages.length - 1];
        return `<button class="list-item" data-open="${p.id}">
          <span class="avatar" style="background:${p.color}">${p.dog.emoji}<span class="mini">${esc(p.name[0])}</span></span>
          <span class="grow"><div class="name">${esc(p.name)} <span class="muted small">& ${esc(p.dog.name)}</span></div>
          <div class="sub">${last.from === 'me' ? '나: ' : ''}${esc(last.text)}</div></span>
          ${m.unread ? '<span class="dot"></span>' : ''}
        </button>`;
      }).join('')}
    </div>
    ${talking.length === 0 ? '<p class="muted small" style="text-align:center;margin-top:16px">먼저 인사를 건네보세요 👋</p>' : ''}`;

  view.querySelectorAll('[data-open]').forEach((b) => { b.onclick = () => go('chat', { id: b.dataset.open, back: 'matches' }); });
}

// ---------- 채팅 ----------
function renderChat() {
  const p = person(route.id);
  const m = matchOf(p.id);
  m.unread = false;
  save();
  updateBadge();
  $('#title').textContent = `${p.name} & ${p.dog.name}`;

  const c = compatibility(state.me, p);
  const nextWalk = state.walks.find((w) => w.personId === p.id && w.status !== 'cancelled' && walkStatus(w) !== 'done');

  view.innerHTML = `
    <div class="chat-wrap">
      <div class="chat-header-info">
        <span>📍 ${c.distanceKm}km · 궁합 ${c.score}%</span>
        <button class="btn secondary" id="more" aria-label="안전 메뉴">🛡️</button>
        <button class="btn" id="propose">${nextWalk ? '산책 일정 보기' : '🐾 산책 제안'}</button>
      </div>
      <div class="messages" id="msgs">${m.messages.map(msgHtml).join('')}</div>
      <form class="composer" id="composer">
        <input id="msgInput" placeholder="메시지 보내기" autocomplete="off" maxlength="300" />
        <button type="submit">전송</button>
      </form>
    </div>`;
  scrollChat();

  $('#composer').onsubmit = (e) => {
    e.preventDefault();
    const text = $('#msgInput').value.trim();
    if (!text) return;
    pushMsg(p.id, { from: 'me', text });
    $('#msgInput').value = '';
    fakeReply(p);
  };
  $('#propose').onclick = () => (nextWalk ? go('walks') : openProposal(p));
  $('#more').onclick = () => openSafetyMenu(p);
}

function msgHtml(msg) {
  if (msg.from === 'system') return `<div class="msg system">${esc(msg.text)}</div>`;
  if (msg.kind === 'walk') return `<div class="msg walk-card">${msg.text.split('\n').map(esc).join('<br/>')}</div>`;
  return `<div class="msg ${msg.from === 'me' ? 'me' : 'them'}">${esc(msg.text)}</div>`;
}

function pushMsg(personId, msg) {
  const m = matchOf(personId);
  m.messages.push({ at: Date.now(), ...msg });
  save();
  if (route.name === 'chat' && route.id === personId) {
    $('#msgs').insertAdjacentHTML('beforeend', msgHtml(msg));
    scrollChat();
  } else if (msg.from !== 'me') {
    m.unread = true;
    save();
    updateBadge();
  }
}

function scrollChat() { const el = $('#msgs'); if (el) el.scrollTop = el.scrollHeight; }

function fakeReply(p, text) {
  const reply = text || AUTO_REPLIES[Math.floor(Math.random() * AUTO_REPLIES.length)]
    .replace('{dog}', p.dog.name).replace('{myDog}', state.me.dog.name || '아이');
  setTimeout(() => {
    if (route.name === 'chat' && route.id === p.id) {
      $('#msgs').insertAdjacentHTML('beforeend', '<div class="typing" id="typing">입력 중…</div>');
      scrollChat();
    }
    setTimeout(() => { $('#typing')?.remove(); pushMsg(p.id, { from: p.id, text: reply }); }, 1100);
  }, 600);
}

// ---------- 산책 제안 ----------
function openProposal(p) {
  const spots = suggestSpots(state.me, p, SPOTS, 4);
  const commonTimes = state.me.walkTimes.filter((t) => p.walkTimes.includes(t));
  const slot = commonTimes[0] || p.walkTimes[0];
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i + 1); return d; });
  const dayLabel = (d, i) => (i === 0 ? '내일' : `${d.getMonth() + 1}/${d.getDate()} (${'일월화수목금토'[d.getDay()]})`);

  openModal(`
    <h3>🐾 첫 산책 제안하기</h3>
    <p class="muted small" style="margin:0 0 14px">두 분의 중간 지점에서 가까운 산책 코스예요.</p>
    <div id="spots">${spots.map((s, i) => `
      <button class="spot ${i === 0 ? 'on' : ''}" data-id="${s.id}">
        <div class="t">${esc(s.name)} <span class="chip" style="float:right">${s.type}</span></div>
        <div class="d">중간 지점에서 ${s.distanceKm}km · ${esc(s.note)}</div>
      </button>`).join('')}</div>
    <div class="field" style="margin-top:8px"><label>날짜</label>
      <div class="chips" data-seg="day">${days.map((d, i) => `<button type="button" class="chip ${i === 0 ? 'on' : ''}" data-v="${i}">${dayLabel(d, i)}</button>`).join('')}</div></div>
    <div class="field"><label>시간대 ${commonTimes.length ? '<span class="chip">✓ 둘 다 선호</span>' : ''}</label>${segHtml('slot', TIME_SLOTS, slot)}</div>
    <div class="safety">🛡️ 첫 만남은 사람이 많은 공공장소에서, 밝은 시간대를 추천해요. 리드줄과 배변봉투도 꼭 챙겨주세요!</div>
    <button class="btn" id="send">산책 제안 보내기</button>`, (root) => {
    bindToggles(root);
    $('#spots', root).onclick = (e) => {
      const b = e.target.closest('.spot'); if (!b) return;
      root.querySelectorAll('.spot').forEach((x) => x.classList.toggle('on', x === b));
    };
    $('#send', root).onclick = () => {
      const spotId = root.querySelector('.spot.on').dataset.id;
      const dayIdx = Number(segVal('day', root));
      const s = segVal('slot', root);
      const hours = { '이른 아침': 7, '점심': 12, '저녁': 18, '밤': 21 }[s];
      const d = days[dayIdx];
      d.setHours(hours, 0, 0, 0);
      const walk = { id: `w${Date.now()}`, personId: p.id, spotId, datetime: d.toISOString(), slot: s, status: 'pending', review: null };
      state.walks.push(walk);
      save();
      closeModal();
      pushMsg(p.id, { from: 'me', kind: 'walk', text: `📅 산책 제안\n${fmtDate(walk.datetime)}\n📍 ${spot(spotId).name}` });
      toast('산책 제안을 보냈어요!');
      // 데모: 상대방이 잠시 후 수락
      setTimeout(() => {
        walk.status = 'confirmed';
        save();
        pushMsg(p.id, { from: 'system', text: `${p.name}님이 산책 약속을 수락했어요! 🎉` });
        fakeReply(p, `좋아요! ${spot(spotId).name}에서 봬요. ${p.dog.name}도 신났어요 🐾`);
        if (route.name === 'chat') renderChat();
        if (route.name === 'walks') renderWalks();
      }, 2500);
      renderChat();
    };
  });
}

function openSafetyMenu(p) {
  openModal(`
    <h3>${esc(p.name)}님</h3>
    <p class="muted small">안전한 만남을 위해 불편한 점이 있다면 알려주세요.</p>
    <div class="safety">✔️ 휴대폰 번호 인증 회원 · 매너 평가 기반 추천<br/>✔️ 약속 장소/시간을 지인에게 공유하는 걸 권장해요.</div>
    <button class="btn secondary" id="share" style="margin-bottom:8px">📤 약속 정보 지인에게 공유</button>
    <button class="btn secondary" id="report" style="margin-bottom:8px">🚩 신고하기</button>
    <button class="btn" id="block" style="background:var(--danger)">차단하기</button>`, (root) => {
    $('#share', root).onclick = async () => {
      const w = state.walks.find((x) => x.personId === p.id && x.status !== 'cancelled');
      const text = w ? `[같이걸을개] ${fmtDate(w.datetime)} ${spot(w.spotId).name}에서 ${p.name}님과 산책 예정` : `[같이걸을개] ${p.name}님과 산책 약속 조율 중`;
      try { await navigator.clipboard.writeText(text); toast('약속 정보를 복사했어요'); } catch { toast(text); }
      closeModal();
    };
    $('#report', root).onclick = () => { closeModal(); toast('신고가 접수됐어요. 24시간 내 검토할게요.'); };
    $('#block', root).onclick = () => {
      if (!confirm(`${p.name}님을 차단할까요? 대화와 일정이 숨겨져요.`)) return;
      state.blocked.push(p.id);
      state.walks.forEach((w) => { if (w.personId === p.id && w.status !== 'cancelled') w.status = 'cancelled'; });
      save(); closeModal(); go('matches'); toast('차단했어요.');
    };
  });
}

// ---------- 산책 일정 ----------
function renderWalks() {
  $('#title').textContent = '산책 일정';
  const walks = state.walks.filter((w) => !state.blocked.includes(w.personId) && w.status !== 'cancelled');
  if (!walks.length) {
    view.innerHTML = `<div class="empty"><span class="big">📅</span>아직 잡힌 산책이 없어요.<br/>매칭된 분과 대화하다가<br/><b>🐾 산책 제안</b>을 눌러보세요.</div>`;
    return;
  }
  const sorted = [...walks].sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  const label = (w) => {
    if (w.status === 'pending') return ['pending', '수락 대기'];
    const s = walkStatus(w);
    return { upcoming: ['upcoming', '예정'], ongoing: ['ongoing', '산책 중'], done: ['done', '완료'] }[s];
  };

  view.innerHTML = `<div class="list">${sorted.map((w) => {
    const p = person(w.personId);
    const s = spot(w.spotId);
    const [cls, txt] = label(w);
    const done = w.status === 'confirmed' && walkStatus(w) === 'done';
    return `<div class="walk-item">
      <div class="row" style="align-items:center;justify-content:space-between">
        <span class="when">${fmtDate(w.datetime)}</span><span class="status ${cls}">${txt}</span>
      </div>
      <div class="where">📍 ${esc(s.name)} · ${esc(p.name)} & ${esc(p.dog.name)} ${p.dog.emoji}</div>
      <div class="row">
        <button class="btn secondary" data-chat="${p.id}">대화</button>
        ${done
          ? (w.review ? `<button class="btn ghost" disabled>⭐ ${w.review.rating}점 평가 완료</button>` : `<button class="btn" data-review="${w.id}">매너 평가</button>`)
          : `<button class="btn ghost" data-cancel="${w.id}">취소</button>
             <button class="btn ghost" data-finish="${w.id}" title="데모: 산책을 완료 처리">완료 처리</button>`}
      </div>
    </div>`;
  }).join('')}</div>
  <p class="muted small" style="text-align:center;margin-top:14px">산책이 끝나면 매너 평가를 남겨주세요. 평가는 상대방에게 익명으로 반영돼요.</p>`;

  view.querySelectorAll('[data-chat]').forEach((b) => { b.onclick = () => go('chat', { id: b.dataset.chat, back: 'walks' }); });
  view.querySelectorAll('[data-cancel]').forEach((b) => {
    b.onclick = () => {
      const w = state.walks.find((x) => x.id === b.dataset.cancel);
      if (!confirm('산책 약속을 취소할까요?')) return;
      w.status = 'cancelled';
      save();
      pushMsg(w.personId, { from: 'system', text: '산책 약속이 취소됐어요.' });
      renderWalks();
    };
  });
  // 데모용: 시간이 지난 것처럼 처리해 평가 흐름을 확인할 수 있게 함
  view.querySelectorAll('[data-finish]').forEach((b) => {
    b.onclick = () => {
      const w = state.walks.find((x) => x.id === b.dataset.finish);
      w.status = 'confirmed';
      w.datetime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      save();
      renderWalks();
      openReview(w);
    };
  });
  view.querySelectorAll('[data-review]').forEach((b) => { b.onclick = () => openReview(state.walks.find((x) => x.id === b.dataset.review)); });
}

const REVIEW_TAGS = ['시간 약속을 잘 지켜요', '대화가 즐거워요', '강아지를 잘 케어해요', '매너가 좋아요', '또 산책하고 싶어요'];
function openReview(w) {
  const p = person(w.personId);
  let rating = 5;
  openModal(`
    <h3>${esc(p.name)}님과의 산책은 어땠나요?</h3>
    <p class="muted small" style="margin:0">${esc(spot(w.spotId).name)} · ${fmtDate(w.datetime)}</p>
    <div class="stars" id="stars">${[1, 2, 3, 4, 5].map((n) => `<button data-n="${n}" class="on" aria-label="${n}점">★</button>`).join('')}</div>
    <div class="field"><label>좋았던 점</label>${chipsHtml('tags', REVIEW_TAGS, [])}</div>
    <div class="field"><label>다시 만나고 싶나요?</label>${segHtml('again', ['네, 또 만나고 싶어요', '친구로 지낼래요'], '네, 또 만나고 싶어요')}</div>
    <button class="btn" id="submit">평가 남기기</button>`, (root) => {
    bindToggles(root);
    $('#stars', root).onclick = (e) => {
      const b = e.target.closest('button'); if (!b) return;
      rating = Number(b.dataset.n);
      root.querySelectorAll('#stars button').forEach((x) => x.classList.toggle('on', Number(x.dataset.n) <= rating));
    };
    $('#submit', root).onclick = () => {
      w.review = { rating, tags: chipVals('tags', root), again: segVal('again', root) };
      save();
      closeModal();
      renderWalks();
      toast('소중한 평가 감사합니다 💛');
    };
  });
}

// ---------- 내 프로필 ----------
function renderProfile() {
  $('#title').textContent = '내 프로필';
  const me = state.me;
  const reviews = state.walks.filter((w) => w.review).map((w) => w.review);
  const avg = averageRating(reviews);
  const walksDone = state.walks.filter((w) => w.status === 'confirmed' && walkStatus(w) === 'done').length;

  view.innerHTML = `
    <div class="card">
      <div class="profile-hero" style="height:150px;background:linear-gradient(160deg, ${me.color}, ${me.color}88)">
        <span class="dog-emoji" style="font-size:80px">${me.dog.emoji}</span>
        <span class="owner-avatar" style="color:var(--primary-dark)">${esc(me.name[0] || '?')}</span>
      </div>
      <div class="profile-body">
        <h2>${esc(me.name)} <small>${ageFromBirthYear(me.birthYear)}${me.job ? ` · ${esc(me.job)}` : ''}</small></h2>
        <div class="dog-line">${esc(me.dog.name)} · ${esc(me.dog.breed)} ${me.dog.age}살 · ${me.dog.size}견 · ${me.dog.energy}</div>
        ${me.bio ? `<p class="bio">${esc(me.bio)}</p>` : ''}
        <div class="chips">
          ${me.dog.traits.map((t) => `<span class="chip">🐾 ${esc(t)}</span>`).join('')}
          ${me.walkTimes.map((t) => `<span class="chip">🕒 ${t}</span>`).join('')}
          ${me.interests.map((t) => `<span class="chip">♡ ${esc(t)}</span>`).join('')}
        </div>
      </div>
    </div>
    <div class="stat-row">
      <div class="stat"><b>${state.matches.length}</b><span>매칭</span></div>
      <div class="stat"><b>${walksDone}</b><span>함께한 산책</span></div>
      <div class="stat"><b>${avg ?? '-'}</b><span>내가 준 평균 별점</span></div>
    </div>
    <button class="btn secondary" id="editMe" style="margin-bottom:8px">보호자 정보 수정</button>
    <button class="btn secondary" id="editDog" style="margin-bottom:8px">강아지 정보 수정</button>
    <button class="btn ghost" id="reset">데모 데이터 초기화</button>`;

  $('#editMe').onclick = () => openModal(`<h3>보호자 정보</h3><div style="height:12px"></div>${personFields(me)}<button class="btn" id="save">저장</button>`, (root) => {
    bindToggles(root);
    $('#save', root).onclick = () => { if (readPersonFields()) { closeModal(); render(); toast('저장했어요'); } };
  });
  $('#editDog').onclick = () => openModal(`<h3>강아지 정보</h3><div style="height:12px"></div>${dogFields(me.dog)}<button class="btn" id="save">저장</button>`, (root) => {
    bindToggles(root);
    $('#save', root).onclick = () => { if (readDogFields()) { closeModal(); render(); toast('저장했어요'); } };
  });
  $('#reset').onclick = () => {
    if (!confirm('모든 데이터를 지우고 처음부터 시작할까요?')) return;
    state = freshState();
    save();
    go('onboarding', { step: 0 });
  };
}

render();

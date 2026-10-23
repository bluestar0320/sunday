import { PEOPLE, COURSES, DEFAULT_ME, INTERESTS, AUTO_REPLIES } from './data.js';
import {
  SIZES, ENERGY, TIME_SLOTS,
  rankCandidates, compatibility, recommendCourses, courseSafety, isMutualMatch,
  averageRating, walkStatus, ageFromBirthYear, midpoint, hazardSegments,
  healthFlags, isVerified, validRegistryNo, normalizePhone,
  forecastFor, respondToProposal, reminderTimes, dueReminders, dueLikeBacks,
} from './logic.js';
import { icon, dogArt, resizeImage, SAFETY_ICON, walkScene } from './ui.js';
import { mountMap } from './map.js';

import {
  $, view, state, route, save, resetState, esc, person, course, matchOf, photosOf, media, characterArt,
  toast, openModal, closeModal, DAYS, fmtDate, safeBadge, segHtml, chipsHtml, bindToggles, segVal, chipVals,
  go, setTop, render, updateBadge, registerView, startTicker, isWalkDone, switchHtml, notify, uid, onTick, walkWho, likesForMe, groupById,
} from './core.js';
import { startWalk, openGuardians, onWalkEnded, activeSession } from './safety.js';
import { renderGroups, openGroup, membersOf } from './groups.js';

const MAX_PHOTOS = 5;

document.querySelectorAll('#tabbar button').forEach((b) => b.insertAdjacentHTML('afterbegin', icon(b.dataset.icon, 24)));
$('#backBtn').innerHTML = icon('back', 24);
$('#tabbar').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (b) go(b.dataset.tab);
});
$('#backBtn').addEventListener('click', () => {
  if (route.name === 'onboarding') go('onboarding', { step: route.step - 1 });
  else go(route.back || 'matches');
});


// ---------- 사진 업로드 ----------
function pickFiles() {
  return new Promise((resolve) => {
    const input = $('#fileInput');
    input.value = '';
    input.onchange = () => resolve([...input.files]);
    input.click();
  });
}

async function addPhotos(files) {
  const photos = state.me.dog.photos;
  for (const f of files) {
    if (photos.length >= MAX_PHOTOS) { toast(`사진은 최대 ${MAX_PHOTOS}장까지 올릴 수 있어요`); break; }
    if (!f.type.startsWith('image/')) continue;
    try {
      photos.push(await resizeImage(f));
      if (!save()) { photos.pop(); break; }
    } catch {
      toast('이미지를 읽지 못했어요');
    }
  }
}

function photoGridHtml() {
  const photos = state.me.dog.photos;
  return `<div class="photo-grid" id="photoGrid">
    ${photos.map((src, i) => `<div class="photo-slot">
      <img class="photo" src="${src}" alt="강아지 사진 ${i + 1}" />
      <button class="rm" data-rm="${i}" aria-label="사진 삭제">${icon('x', 14)}</button>
      ${i === 0 ? '<span class="main-badge">대표</span>' : `<button class="set-main" data-main="${i}">대표로</button>`}
    </div>`).join('')}
    ${photos.length < MAX_PHOTOS ? `<button class="photo-slot add" id="addPhoto">${icon('plus', 22)}<span>${photos.length}/${MAX_PHOTOS}</span></button>` : ''}
  </div>`;
}

// 그리드를 다시 그리고 이벤트 연결. onChange는 사진 변경 후 호출
function bindPhotoGrid(root, onChange) {
  const grid = $('#photoGrid', root);
  const rerender = () => { grid.outerHTML = photoGridHtml(); bindPhotoGrid(root, onChange); onChange?.(); };
  grid.onclick = async (e) => {
    const photos = state.me.dog.photos;
    const rm = e.target.closest('[data-rm]');
    const main = e.target.closest('[data-main]');
    if (rm) { photos.splice(Number(rm.dataset.rm), 1); save(); rerender(); }
    else if (main) { photos.unshift(...photos.splice(Number(main.dataset.main), 1)); save(); rerender(); }
    else if (e.target.closest('#addPhoto')) { await addPhotos(await pickFiles()); rerender(); }
  };
}

// ---------- 온보딩 ----------
function progress(step) {
  return `<div class="progress">${[1, 2, 3].map((n) => `<i class="${n <= step ? 'on' : ''}"></i>`).join('')}</div>`;
}

function renderOnboarding() {
  const step = route.step || 0;
  const me = state.me;
  setTop(step === 0 ? '' : `${step} / 3`, { back: step > 0 });

  if (step === 0) {
    const [a, b] = [PEOPLE[0], PEOPLE[2]];
    view.innerHTML = `<div class="welcome">
      <div class="scene">${walkScene()}<div class="cards"><div>${characterArt(a)}</div><div>${characterArt(b)}</div></div></div>
      <div class="eyebrow">${icon('leaf', 16)}같이걸을개</div>
      <h2 class="h-title">어색한 소개팅 대신,<br/>같이 걸으며 알아가요</h2>
      <p class="h-sub" style="margin-bottom:16px">강아지 산책으로 시작하는 편안한 첫 만남</p>
      <div class="feature"><div class="fi">${icon('heart')}</div><div><b>산책 궁합 추천</b><span>사는 곳, 산책 시간, 아이 성향이 맞는 사람</span></div></div>
      <div class="feature"><div class="fi">${icon('shield')}</div><div><b>안심 산책 코스</b><span>밝고 사람 많은 길로만 추천해요</span></div></div>
      <div class="feature"><div class="fi">${icon('star')}</div><div><b>매너 평가</b><span>산책 후 서로 남기는 후기로 안전하게</span></div></div>
      <div class="bottom-cta"><button class="btn accent" id="start">시작하기</button></div>
    </div>`;
    $('#start').onclick = () => go('onboarding', { step: 1 });
    return;
  }

  if (step === 1) {
    view.innerHTML = `${progress(1)}
      <h2 class="h-title">보호자님을 소개해 주세요</h2>
      <p class="h-sub">매칭된 상대에게 보여지는 정보예요.</p>
      ${personFields(me)}
      <button class="btn" id="next">다음</button>`;
    bindToggles(view);
    $('#next').onclick = () => { if (readPersonFields()) go('onboarding', { step: 2 }); };
    return;
  }

  if (step === 2) {
    view.innerHTML = `${progress(2)}
      <h2 class="h-title">우리 아이는 어떤 친구인가요?</h2>
      <p class="h-sub">산책 궁합을 계산하는 데 쓰여요.</p>
      ${dogFields(me.dog)}
      <button class="btn" id="next">다음</button>`;
    bindToggles(view);
    $('#next').onclick = () => { if (readDogFields()) go('onboarding', { step: 3 }); };
    return;
  }

  view.innerHTML = `${progress(3)}
    <h2 class="h-title">${esc(me.dog.name)}의 사진을 올려주세요</h2>
    <p class="h-sub">얼굴이 잘 보이는 사진일수록 매칭이 잘 돼요.<br/>첫 번째 사진이 대표 사진이 돼요. (최대 ${MAX_PHOTOS}장)</p>
    ${photoGridHtml()}
    <div class="notice" style="margin-top:20px">${icon('shield', 18)}<span>사람 얼굴이 크게 나온 사진, 연락처가 담긴 사진은 노출이 제한될 수 있어요.</span></div>
    <div style="margin-top:28px"><button class="btn accent" id="done">산책 메이트 찾기</button></div>`;
  const syncDone = () => { $('#done').disabled = state.me.dog.photos.length === 0; };
  bindPhotoGrid(view, syncDone);
  syncDone();
  $('#done').onclick = () => {
    state.onboarded = true;
    save();
    go('discover');
    toast(`${me.dog.name}와(과) 산책할 친구를 찾아볼게요`);
    const n = likesForMe().length;
    if (n) setTimeout(() => notify(`${n}명이 ${me.dog.name}에게 좋아요를 보냈어요`, { kind: 'like', to: { name: 'matches' } }), 2600);
  };
}

function personFields(me) {
  return `
    <div class="field"><label for="f-name">이름 (닉네임)</label><input class="input" id="f-name" maxlength="10" value="${esc(me.name)}" placeholder="예: 하늘" /></div>
    <div class="two">
      <div class="field"><label for="f-year">출생연도</label><input class="input" id="f-year" type="number" inputmode="numeric" min="1950" max="2008" value="${esc(me.birthYear)}" /></div>
      <div class="field"><label for="f-job">직업</label><input class="input" id="f-job" maxlength="16" value="${esc(me.job)}" placeholder="예: 회사원" /></div>
    </div>
    <div class="field"><label>성별</label>${segHtml('gender', ['여성', '남성'], me.gender)}</div>
    <div class="field"><label>만나고 싶은 사람</label>${segHtml('lookingFor', ['남성', '여성', '모두'], me.lookingFor)}</div>
    <div class="field"><label>주로 산책하는 시간</label>${chipsHtml('walkTimes', TIME_SLOTS, me.walkTimes)}</div>
    <div class="field"><label>관심사</label>${chipsHtml('interests', INTERESTS, me.interests)}</div>
    <div class="field"><label for="f-bio">소개</label><textarea class="input" id="f-bio" maxlength="120" placeholder="예: 주말마다 한강 산책해요">${esc(me.bio)}</textarea></div>`;
}
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

function dogFields(dog) {
  const h = dog.health || {};
  return `
    <div class="two">
      <div class="field"><label for="d-name">이름</label><input class="input" id="d-name" maxlength="10" value="${esc(dog.name)}" placeholder="예: 초코" /></div>
      <div class="field"><label for="d-age">나이</label><input class="input" id="d-age" type="number" inputmode="numeric" min="0" max="25" value="${esc(dog.age)}" /></div>
    </div>
    <div class="field"><label for="d-breed">견종</label><input class="input" id="d-breed" maxlength="16" value="${esc(dog.breed)}" placeholder="예: 포메라니안" /></div>
    <div class="field"><label>크기</label>${segHtml('size', SIZES, dog.size)}</div>
    <div class="field"><label>산책 에너지</label>${segHtml('energy', ENERGY, dog.energy)}</div>
    <div class="field"><label>다른 강아지와는</label>${segHtml('friendly', ['금방 친해져요', '천천히 친해져요'], dog.friendly ? '금방 친해져요' : '천천히 친해져요')}</div>
    <div class="field"><label for="d-traits">성격 (쉼표로 구분)</label><input class="input" id="d-traits" value="${esc(dog.traits.join(', '))}" placeholder="예: 애교쟁이, 간식 좋아함" /></div>
    <div class="label">${icon('syringe', 16)}건강 · 안전 정보 <span class="muted small" style="font-weight:400">만나기 전에 상대에게 보여져요</span></div>
    <div class="field"><label>예방접종 (종합백신 · 광견병)</label>${segHtml('vaccinated', ['완료했어요', '진행 중이에요'], h.vaccinated ? '완료했어요' : '진행 중이에요')}</div>
    <div class="field"><label>중성화</label>${segHtml('neutered', ['했어요', '안 했어요'], h.neutered ? '했어요' : '안 했어요')}</div>
    <div class="field"><label>사람이나 강아지를 문 적이 있나요?</label>${segHtml('bite', ['없어요', '있어요'], h.bite ? '있어요' : '없어요')}</div>
    <div class="field"><label for="d-allergy">간식 · 음식 알러지</label><input class="input" id="d-allergy" maxlength="20" value="${esc(h.allergies)}" placeholder="없으면 비워두세요 (예: 닭고기)" /></div>`;
}
function readDogFields() {
  const dog = state.me.dog;
  const name = $('#d-name').value.trim();
  if (!name) { toast('강아지 이름을 입력해 주세요'); return false; }
  Object.assign(dog, {
    name, age: Number($('#d-age').value) || 0, breed: $('#d-breed').value.trim() || '믹스견',
    size: segVal('size'), energy: segVal('energy'), friendly: segVal('friendly') === '금방 친해져요',
    traits: $('#d-traits').value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 4),
    health: {
      vaccinated: segVal('vaccinated') === '완료했어요',
      neutered: segVal('neutered') === '했어요',
      bite: segVal('bite') === '있어요',
      allergies: $('#d-allergy').value.trim(),
    },
  });
  save();
  return true;
}

// ---------- 건강 · 인증 표시 ----------
function badgesHtml(p) {
  const v = p.verified || {};
  return `${v.phone ? `<span class="vbadge">${icon('verified', 13)}본인 인증</span>` : ''}${v.registry ? `<span class="vbadge">${icon('verified', 13)}동물등록</span>` : ''}`;
}

const HEALTH_ICON = { vaccine: 'syringe', neuter: 'heart', bite: 'shield', allergy: 'alert' };
function healthHtml(dog) {
  return `<div class="health">${healthFlags(dog).map((f) => `<span class="hflag ${f.ok === false ? 'bad' : f.ok ? 'ok' : ''}">${icon(HEALTH_ICON[f.key], 14)}${esc(f.label)}</span>`).join('')}</div>`;
}

function cautionsHtml(list) {
  if (!list.length) return '';
  return `<div class="cautions"><h4>${icon('alert', 16)}만나기 전에 알아두세요</h4><ul>${list.map((c) => `<li>${esc(c)}</li>`).join('')}</ul></div>`;
}

// 프로필 카드 (탐색 카드와 받은 좋아요 상세에서 함께 씀)
function profileHtml(p, c) {
  const count = Math.max(1, photosOf(p).length);
  const likedMe = isMutualMatch(state.me.id, p);
  return `
    <div class="pcard-photo">
      ${count > 1 ? `<div class="bars">${Array.from({ length: count }, (_, i) => `<i class="${i === 0 ? 'on' : ''}"></i>`).join('')}</div>` : ''}
      <div id="slide" style="height:100%">${media(p, 0)}</div>
      <button class="tap l" aria-label="이전 사진"></button><button class="tap r" aria-label="다음 사진"></button>
      <span class="match-chip">산책 궁합 <b>${c.score}%</b></span>
      ${likedMe ? `<span class="liked-me">${icon('heart', 13, 'filled')}나에게 좋아요를 보냈어요</span>` : ''}
      <div class="shade"></div>
      <div class="cap">
        <div class="name">${esc(p.dog.name)}<small>${p.dog.age}살</small></div>
        <div class="meta">${esc(p.dog.breed)} · ${p.dog.size}견 · ${icon('pin', 14)} ${c.distanceKm}km</div>
      </div>
    </div>
    <div class="pcard-info">
      <div class="owner">
        <div class="avatar">${esc(p.name[0])}</div>
        <div><div class="n">보호자 ${esc(p.name)}</div><div class="s">${ageFromBirthYear(p.birthYear)}세 · ${esc(p.job)}</div></div>
      </div>
      <div class="badges">${badgesHtml(p)}</div>
      <p class="bio">${esc(p.bio)}</p>
      <div class="chips">
        ${p.dog.traits.map((t) => `<span class="tag">${esc(t)}</span>`).join('')}
        <span class="tag">${p.dog.energy} 산책</span>
        ${p.walkTimes.map((t) => `<span class="tag">${icon('clock', 13)}${t}</span>`).join('')}
      </div>
      <div class="label" style="margin-top:20px">${icon('syringe', 16)}${esc(p.dog.name)}의 건강 · 안전</div>
      ${healthHtml(p.dog)}
      ${c.reasons.length ? `<div class="why"><h4>우리가 잘 맞는 이유</h4><ul>${c.reasons.map((r) => `<li>${icon('check', 16)}${esc(r)}</li>`).join('')}</ul></div>` : ''}
      ${cautionsHtml(c.cautions)}
    </div>`;
}

// 사진 넘기기
function bindSlides(root, p) {
  const count = Math.max(1, photosOf(p).length);
  if (count < 2) return;
  let slide = 0;
  const show = (i) => {
    slide = (i + count) % count;
    $('#slide', root).innerHTML = media(p, slide);
    root.querySelectorAll('.bars i').forEach((b, j) => b.classList.toggle('on', j === slide));
  };
  root.querySelector('.tap.l').onclick = () => show(slide - 1);
  root.querySelector('.tap.r').onclick = () => show(slide + 1);
}

// ---------- 탐색 ----------
function candidates() {
  return rankCandidates(state.me, PEOPLE.filter((p) => !state.blocked.includes(p.id)), {
    ...state.filters, seen: state.seen,
  });
}

function renderDiscover() {
  setTop('탐색', { actions: `<button class="icon-btn" id="filterBtn" aria-label="필터">${icon('sliders', 22)}</button>` });
  $('#filterBtn').onclick = openFilters;
  const list = candidates();

  if (!list.length) {
    view.innerHTML = `<div class="empty">
      <div class="ic-wrap">${icon('leaf', 32)}</div>
      <strong>오늘의 추천을 모두 확인했어요</strong>
      필터를 넓히거나 내일 다시 찾아봐요.
      <div class="stack" style="max-width:260px;margin:20px auto 0">
        <button class="btn" id="openFilter">필터 변경</button>
        <button class="btn soft" id="resetSeen">지나친 사람 다시 보기</button>
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
    <div class="deck" id="deck">
      <article class="card-enter" id="pcard">
        ${profileHtml(p, c)}
      </article>
    </div>
    <div class="actions">
      <button class="round" id="pass" aria-label="다음에">${icon('x', 28)}</button>
      <button class="round like" id="like" aria-label="좋아요">${icon('heart', 28)}</button>
    </div>`;

  bindSlides(view, p);
  $('#pass').onclick = () => swipe(p, false);
  $('#like').onclick = () => swipe(p, true);
}

// 좋아요를 누르면 하트가 바람에 날리듯 떠오른다
function heartBurst(btn) {
  const phone = document.querySelector('.phone');
  const b = btn.getBoundingClientRect();
  const r = phone.getBoundingClientRect();
  for (let i = 0; i < 6; i++) {
    const h = document.createElement('span');
    h.style.left = `${b.left - r.left + b.width / 2}px`;
    h.style.top = `${b.top - r.top + b.height / 2}px`;
    h.className = 'heart-pop';
    h.style.setProperty('--dx', `${Math.round((Math.random() - 0.5) * 120)}px`);
    h.style.setProperty('--rot', `${Math.round((Math.random() - 0.5) * 60)}deg`);
    h.style.animationDelay = `${i * 60}ms`;
    h.innerHTML = icon('heart', 14 + Math.round(Math.random() * 10), 'filled');
    phone.appendChild(h);
    setTimeout(() => h.remove(), 1400);
  }
}

function swipe(p, liked) {
  if (liked) heartBurst($('#like'));
  $('#pcard').classList.add(liked ? 'card-out-right' : 'card-out-left');
  state.seen.push(p.id);
  if (!liked) state.passed.push(p.id);
  else if (!isMutualMatch(state.me.id, p)) state.likesSent.push({ id: p.id, at: Date.now() });
  save();
  setTimeout(() => {
    if (liked && isMutualMatch(state.me.id, p)) {
      createMatch(p);
      render();
      showMatchModal(p);
    } else {
      render();
      if (liked) toast(`${p.name}님에게 좋아요를 보냈어요`);
    }
  }, 430);
}

function createMatch(p) {
  if (matchOf(p.id)) return;
  const c = compatibility(state.me, p);
  state.matches.unshift({
    personId: p.id,
    matchedAt: new Date().toISOString(),
    unread: true,
    messages: [
      { from: 'system', text: `산책 궁합 ${c.score}%로 매칭됐어요`, at: Date.now() },
      { from: p.id, text: `안녕하세요! ${p.dog.name} 보호자 ${p.name}이에요 😊 ${state.me.dog.name || '아이'} 너무 귀여워요!`, at: Date.now() },
    ],
  });
  save();
}

function showMatchModal(p) {
  openModal(`
    <div class="match-pop">
      <div class="pair"><div>${media(state.me)}</div><div>${media(p)}</div></div>
      <h3>산책 친구가 생겼어요</h3>
      <p class="desc">${esc(p.name)}님도 ${esc(state.me.dog.name)}에게 좋아요를 보냈어요.<br/>인사를 나누고 첫 산책을 계획해 보세요.</p>
      <div class="stack">
        <button class="btn accent" id="m-chat">대화 시작하기</button>
        <button class="btn text" id="m-later">계속 둘러보기</button>
      </div>
    </div>`, (root) => {
    $('#m-chat', root).onclick = () => { closeModal(); go('chat', { id: p.id, back: 'matches' }); };
    $('#m-later', root).onclick = closeModal;
  });
}

function openFilters() {
  const f = state.filters;
  openModal(`
    <h3>필터</h3>
    <p class="desc">조건에 맞는 산책 메이트만 보여드려요.</p>
    <div class="field"><label for="km">거리 · <b id="kmv" style="color:var(--text)">${f.maxKm}km 이내</b></label>
      <input id="km" type="range" min="1" max="10" step="1" value="${f.maxKm}" /></div>
    <div class="field"><label>강아지 크기</label>${chipsHtml('sizes', SIZES, f.sizes)}</div>
    <div class="field"><label>만나고 싶은 사람</label>${segHtml('lookingFor', ['남성', '여성', '모두'], state.me.lookingFor)}</div>
    <div class="stack" style="margin-bottom:20px">
      <label class="switch-row">${icon('syringe', 22)}<div class="grow"><div class="t">예방접종 완료한 친구만</div><div class="d">접종이 끝나지 않은 아이는 숨겨요</div></div>${switchHtml('fVacc', f.vaccinatedOnly)}</label>
      <label class="switch-row">${icon('verified', 22)}<div class="grow"><div class="t">인증 회원만</div><div class="d">본인 인증과 동물등록 인증을 모두 마친 보호자만</div></div>${switchHtml('fVerified', f.verifiedOnly)}</label>
    </div>
    <button class="btn" id="apply">적용하기</button>`, (root) => {
    bindToggles(root);
    $('#km', root).oninput = (e) => { $('#kmv', root).textContent = `${e.target.value}km 이내`; };
    $('#apply', root).onclick = () => {
      const sizes = chipVals('sizes', root);
      state.filters = {
        maxKm: Number($('#km', root).value), sizes: sizes.length ? sizes : [...SIZES],
        vaccinatedOnly: $('#fVacc', root).checked, verifiedOnly: $('#fVerified', root).checked,
      };
      state.me.lookingFor = segVal('lookingFor', root);
      save(); closeModal(); render();
    };
  });
}

// ---------- 대화 목록 ----------
function renderMatches() {
  setTop('대화');
  const active = state.matches.filter((m) => !state.blocked.includes(m.personId));
  const liked = likesForMe();
  const waiting = state.likesSent.filter((l) => !l.answered && !matchOf(l.id) && !state.blocked.includes(l.id));
  const likedHtml = liked.length ? `<div class="likes-card">
      <div class="lk-head">${icon('heart', 18, 'filled')}<b>${liked.length}명이 ${esc(state.me.dog.name)}에게 좋아요를 보냈어요</b></div>
      <div class="new-matches">${liked.map((p) => `<button data-liked="${p.id}"><div class="thumb">${media(p)}</div>${esc(p.dog.name)}</button>`).join('')}</div>
      <p class="muted small" style="margin:4px 0 0">프로필을 보고 좋아요를 누르면 바로 매칭돼요</p>
    </div>` : '';
  const waitingHtml = waiting.length ? `<p class="muted small sent-likes">${icon('send', 14)}내가 좋아요를 보낸 ${waiting.length}명이 아직 답하지 않았어요</p>` : '';
  if (!active.length && liked.length) {
    view.innerHTML = likedHtml + waitingHtml + `<div class="empty" style="padding-top:32px">아직 대화 중인 친구가 없어요.<br/>나를 좋아한 친구부터 만나보세요!</div>`;
    bindLiked();
    return;
  }
  if (!active.length) {
    view.innerHTML = `<div class="empty"><div class="ic-wrap">${icon('chat', 28)}</div>
      <strong>아직 매칭이 없어요</strong>탐색에서 마음에 드는 친구에게<br/>좋아요를 눌러보세요.${waitingHtml}
      <div style="max-width:200px;margin:0 auto"><button class="btn" id="goDiscover">둘러보기</button></div></div>`;
    $('#goDiscover').onclick = () => go('discover');
    return;
  }
  const fresh = active.filter((m) => m.messages.every((x) => x.from !== 'me'));

  view.innerHTML = `${likedHtml}${waitingHtml}
    ${fresh.length ? `<div class="label">새로운 매칭</div>
      <div class="new-matches">${fresh.map((m) => {
        const p = person(m.personId);
        return `<button data-open="${p.id}"><div class="thumb">${media(p)}</div>${esc(p.dog.name)}</button>`;
      }).join('')}</div>` : ''}
    <div class="label">메시지</div>
    <div class="list">
      ${active.map((m) => {
        const p = person(m.personId);
        const last = m.messages[m.messages.length - 1];
        const lastText = last.kind === 'walk' ? '산책을 제안했어요' : last.text;
        return `<button class="list-item" data-open="${p.id}">
          <div class="avatar lg">${media(p)}</div>
          <div class="grow"><div class="name">${esc(p.name)} <span>· ${esc(p.dog.name)}</span></div>
          <div class="sub">${last.from === 'me' ? '나: ' : ''}${esc(lastText)}</div></div>
          ${m.unread ? '<span class="dot"></span>' : ''}
        </button>`;
      }).join('')}
    </div>`;

  view.querySelectorAll('[data-open]').forEach((b) => { b.onclick = () => go('chat', { id: b.dataset.open, back: 'matches' }); });
  bindLiked();
}

function bindLiked() {
  view.querySelectorAll('[data-liked]').forEach((b) => { b.onclick = () => openLikedProfile(person(b.dataset.liked)); });
}

// 나를 좋아한 사람의 프로필: 좋아요 → 바로 매칭
function openLikedProfile(p) {
  openModal(`<div class="sheet-profile">${profileHtml(p, compatibility(state.me, p))}</div>
    <div class="sheet-foot row">
      <button class="btn soft grow" id="lpPass">${icon('x', 18)}넘기기</button>
      <button class="btn accent grow" id="lpLike">${icon('heart', 18, 'filled')}좋아요 · 매칭</button>
    </div>`, (root) => {
    bindSlides(root, p);
    $('#lpPass', root).onclick = () => {
      state.passed.push(p.id);
      if (!state.seen.includes(p.id)) state.seen.push(p.id);
      save(); closeModal(); render();
    };
    $('#lpLike', root).onclick = () => {
      if (!state.seen.includes(p.id)) state.seen.push(p.id);
      createMatch(p);
      render();
      showMatchModal(p);
    };
  });
}

// ---------- 채팅 ----------
function activeWalk(personId) {
  return state.walks.find((w) => w.personId === personId && !['cancelled', 'declined', 'replaced'].includes(w.status) && !isWalkDone(w));
}

function renderChat() {
  const p = person(route.id);
  const m = matchOf(p.id);
  m.unread = false;
  save();
  updateBadge();
  setTop(`${p.name} · ${p.dog.name}`, { back: true, actions: `<button class="icon-btn" id="more" aria-label="안전 메뉴">${icon('more', 22)}</button>` });

  const w = activeWalk(p.id);
  const waitingMe = w && w.status === 'pending' && (w.from || 'me') !== 'me';
  const plan = w
    ? `<div class="grow"><b>${fmtDate(w.datetime)}</b><span>${esc(course(w.courseId).name)} · ${waitingMe ? '내 답을 기다려요' : w.status === 'pending' ? '답을 기다리는 중' : '약속 확정'}</span></div>
       <button class="btn sm outline" id="planBtn">일정 보기</button>`
    : `<div class="grow"><b>첫 산책을 제안해 보세요</b><span>안심 코스로 추천해 드려요</span></div>
       <button class="btn sm accent" id="planBtn">${icon('route', 16)}코스 추천</button>`;

  view.innerHTML = `
    <div class="chat">
      <div class="plan-bar">${plan}</div>
      <div class="messages" id="msgs">${m.messages.map(msgHtml).join('')}</div>
      <form class="composer" id="composer">
        <input id="msgInput" placeholder="메시지 보내기" autocomplete="off" maxlength="300" />
        <button type="submit" aria-label="전송">${icon('send', 18)}</button>
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
  $('#planBtn').onclick = () => (w ? go('walks') : openProposal(p));
  $('#msgs').onclick = (e) => {
    if (handleWalkAction(e)) return;
    const card = e.target.closest('[data-map]');
    const walk = card && state.walks.find((x) => x.id === card.dataset.map);
    if (walk) openCourseMap(walk.courseId, walk.slot, p.id);
  };
  $('#more').onclick = () => openSafetyMenu(p);
}

const WALK_STATE = { pending: '답을 기다리는 중', confirmed: '약속 확정', declined: '거절됨', replaced: '다른 시간으로 바뀌었어요', cancelled: '취소됨' };
const SKY_ICON = { '맑음': 'sunny', '흐림': 'cloud', '비': 'rain' };

function weatherHtml(iso, { full = false } = {}) {
  const f = forecastFor(iso);
  return `<span class="wx ${f.rainy ? 'rainy' : ''}">${icon(SKY_ICON[f.sky], 14)}${f.sky}${full ? ` ${f.tempC}° · 강수 ${f.rainProb}%` : ''}</span>`;
}

function msgHtml(msg) {
  if (msg.from === 'system') return `<div class="msg system">${esc(msg.text)}</div>`;
  if (msg.kind === 'walk') {
    const w = state.walks.find((x) => x.id === msg.walkId);
    if (!w) return '';
    const c = course(w.courseId);
    const s = courseSafety(c, w.slot);
    const mine = (w.from || 'me') === 'me';
    const waitingMe = w.status === 'pending' && !mine;
    return `<div class="walk-card ${mine ? '' : 'them'} st-${w.status}" role="button" tabindex="0" data-map="${w.id}">
      <div class="wc-head">${icon('route', 18)}<span class="grow">${mine ? '내 산책 제안' : `${esc(person(w.personId).name)}님의 산책 제안`}</span>${safeBadge(s.level)}</div>
      <div class="wc-body">
        <div>${icon('clock', 16)}${fmtDate(w.datetime)} ${weatherHtml(w.datetime)}</div>
        <div>${icon('pin', 16)}${esc(c.name)} · 약 ${c.minutes}분</div>
        <div class="wc-state">${waitingMe ? '내 답을 기다리고 있어요' : WALK_STATE[w.status] || ''}</div>
      </div>
      ${waitingMe ? `<div class="wc-act">
        <button class="btn sm accent" data-w-accept="${w.id}">수락</button>
        <button class="btn sm soft" data-w-counter="${w.id}">다른 시간</button>
        <button class="btn sm text" data-w-decline="${w.id}">거절</button>
      </div>` : `<div class="wc-foot">${icon('route', 16)}코스 지도 보기</div>`}
    </div>`;
  }
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
      $('#msgs').insertAdjacentHTML('beforeend', '<div class="typing" id="typing"><i></i><i></i><i></i></div>');
      scrollChat();
    }
    setTimeout(() => { $('#typing')?.remove(); pushMsg(p.id, { from: p.id, text: reply }); }, 1100);
  }, 600);
}

// ---------- 산책 제안 (안심 코스) ----------
const SLOT_HOUR = { '이른 아침': 7, '점심': 12, '저녁': 18, '밤': 21 };

function courseHtml(c, selected, tag = '') {
  const s = c.safety;
  return `<div class="course ${selected ? 'on' : ''}" data-id="${c.id}" role="button" tabindex="0" aria-pressed="${selected}">
    <div class="top"><span class="t">${esc(c.name)}</span>${tag ? `<span class="tag" style="height:24px;font-size:12px">${esc(tag)}</span>` : ''}${safeBadge(s.level)}</div>
    <div class="m">${c.type} · ${c.roundTrip ? '왕복 ' : ''}${c.lengthKm}km · 약 ${c.minutes}분 · 중간 지점에서 ${c.distanceKm}km</div>
    <div class="sig">${s.checks.map((k) => `<span class="${k.ok ? '' : 'bad'}" title="${esc(k.label)}">${icon(SAFETY_ICON[k.key], 16)}</span>`).join('')}</div>
    ${selected ? `<div class="mini-map" id="miniMap"></div>
    <button type="button" class="btn sm outline map-open" data-open-map="${c.id}">${icon('route', 16)}지도 크게 보기</button>
    <ul class="checklist">
      ${s.checks.map((k) => `<li class="${k.ok ? '' : 'bad'}">${icon(k.ok ? 'check' : 'alert', 16)}${esc(k.label)}</li>`).join('')}
      <li>${icon('pin', 16)}${esc(c.note)}</li>
    </ul>` : ''}
  </div>`;
}

// replace: 바꾸려는 기존 약속(다른 시간 제안), courseId: 미리 고른 코스(또 걸어요)
function openProposal(p, { replace = null, courseId = null } = {}) {
  const common = state.me.walkTimes.filter((t) => p.walkTimes.includes(t));
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i + 1); return d; });
  const dayLabel = (d, i) => (i === 0 ? '내일' : `${d.getMonth() + 1}/${d.getDate()} ${DAYS[d.getDay()]}`);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  const startDay = replace ? Math.max(0, days.findIndex((d) => sameDay(d, new Date(replace.datetime)))) : 0;
  const ui = {
    slot: replace?.slot || common[0] || p.walkTimes[0], day: startDay,
    safeOnly: state.me.safeMode !== false, courseId: replace?.courseId || courseId,
  };
  const pinned = ui.courseId;
  const { cautions } = compatibility(state.me, p);
  const title = replace ? '다른 시간 제안하기' : courseId ? '또 같이 걸어요' : '첫 산책 제안하기';

  openModal('', (root) => {
    const draw = () => {
      const { courses: all, hiddenCount } = recommendCourses(state.me, p, COURSES, { slot: ui.slot, safeOnly: ui.safeOnly, limit: 99 });
      const courses = all.slice(0, 4);
      const pin = all.find((c) => c.id === pinned);
      if (pin && !courses.includes(pin)) courses.unshift(pin);
      if (!courses.some((c) => c.id === ui.courseId)) ui.courseId = courses[0]?.id ?? null;
      const f = forecastFor(days[ui.day]);
      const scroll = root.scrollTop;
      root.innerHTML = `
        <h3>${title}</h3>
        <p class="desc">두 분 사이 중간 지점 근처에서, 선택한 시간대에 안전한 코스를 추천해요.</p>
        <div class="label">날짜 <span class="muted small" style="font-weight:400">데모 예보</span></div>
        <div class="chips" data-seg="day">${days.map((d, i) => {
          const fd = forecastFor(d);
          return `<button type="button" class="tag ${i === ui.day ? 'on' : ''} ${fd.rainy ? 'rainy' : ''}" data-v="${i}">${dayLabel(d, i)} ${icon(SKY_ICON[fd.sky], 14)}</button>`;
        }).join('')}</div>
        ${f.rainy ? `<div class="notice warn" style="margin-top:10px">${icon('rain', 18)}<span>이날은 비 예보(강수확률 ${f.rainProb}%)가 있어요. 다른 날을 추천해요.</span></div>` : ''}
        <div class="label">시간대 ${common.includes(ui.slot) ? '<span class="tag" style="height:24px;font-size:12px">둘 다 선호</span>' : ''}</div>
        ${segHtml('slot', TIME_SLOTS, ui.slot)}
        <div class="label">추천 코스</div>
        <label class="switch-row" style="margin-bottom:12px">
          ${icon('shield', 22)}
          <div class="grow"><div class="t">안심 코스만 보기</div><div class="d">인적 드문 길, 어두운 길, 숲길·골목은 빼고 추천해요</div></div>
          <span class="switch"><input type="checkbox" id="safeOnly" ${ui.safeOnly ? 'checked' : ''} /><span></span></span>
        </label>
        ${ui.safeOnly && hiddenCount ? `<div class="hidden-note">${icon('eye', 16)}<span>${ui.slot}에 으슥한 코스 ${hiddenCount}곳을 숨겼어요</span><button id="showAll">모두 보기</button></div>` : ''}
        <div id="courses">${courses.length ? courses.map((c) => courseHtml(c, c.id === ui.courseId, c.id === pinned && courseId ? '지난번 코스' : '')).join('') : '<p class="muted small">이 시간대에 추천할 만한 안심 코스가 없어요. 다른 시간대를 골라보세요.</p>'}</div>
        ${cautions.length ? `<div class="notice warn" style="margin-bottom:10px">${icon('alert', 18)}<span>${cautions.map(esc).join('<br/>')}</span></div>` : ''}
        <div class="notice">${icon('shield', 18)}<span>첫 만남은 밝은 시간, 사람이 많은 곳을 추천해요. 약속 정보를 지인에게 공유해 두면 더 안심이에요.</span></div>
        <div class="sheet-foot"><button class="btn accent" id="send" ${ui.courseId ? '' : 'disabled'}>${replace ? '이 시간으로 다시 제안하기' : '산책 제안 보내기'}</button></div>`;
      root.scrollTop = scroll;

      bindToggles(root, (name, v) => {
        if (name === 'slot') { ui.slot = v; draw(); }
        if (name === 'day') { ui.day = Number(v); draw(); }
      });
      $('#safeOnly', root).onchange = (e) => { ui.safeOnly = e.target.checked; draw(); };
      $('#showAll', root)?.addEventListener('click', () => { ui.safeOnly = false; draw(); });
      $('#courses', root).onclick = (e) => {
        const open = e.target.closest('[data-open-map]');
        if (open) { openCourseMap(open.dataset.openMap, ui.slot, p.id); return; }
        const b = e.target.closest('.course'); if (!b || b.dataset.id === ui.courseId) return;
        ui.courseId = b.dataset.id; draw();
      };
      const mini = $('#miniMap', root);
      if (mini) mountMap(mini, { course: course(ui.courseId), slot: ui.slot, mid: midpoint(state.me, p), interactive: false });
      $('#send', root).onclick = () => sendProposal(p, ui, days, replace);
    };
    draw();
  });
}

function sendProposal(p, ui, days, replace) {
  const c = course(ui.courseId);
  const safety = courseSafety(c, ui.slot);
  if (safety.level === '주의' && !confirm(`${c.name}은(는) ${ui.slot}에 인적이 드물거나 어두운 구간이 있어요.\n그래도 이 코스로 제안할까요?`)) return;

  const d = new Date(days[ui.day]);
  d.setHours(SLOT_HOUR[ui.slot], 0, 0, 0);
  const walk = { id: uid('w'), personId: p.id, courseId: c.id, datetime: d.toISOString(), slot: ui.slot, status: 'pending', from: 'me', review: null };
  if (replace) { replace.status = 'replaced'; walk.replaces = replace.id; }
  state.walks.push(walk);
  save();
  closeModal();
  pushMsg(p.id, { from: 'me', kind: 'walk', walkId: walk.id, text: '' });
  toast(replace ? '다른 시간을 제안했어요' : '산책 제안을 보냈어요');
  refreshWalkViews(p.id);
  setTimeout(() => partnerResponds(p, walk), 2500); // 데모: 상대방이 잠시 후 답한다
}

// 데모: 상대방의 답 (수락하거나, 비·시간대·안전 때문에 다른 시간을 제안)
function partnerResponds(p, walk) {
  if (walk.status !== 'pending') return;
  const c = course(walk.courseId);
  const r = respondToProposal(p, { slot: walk.slot, date: walk.datetime, courseLevel: courseSafety(c, walk.slot).level });
  if (r.action === 'accept') {
    confirmWalk(walk, p, false);
    fakeReply(p, `좋아요! ${c.name}에서 봬요. ${p.dog.name}도 벌써 신났어요 🐾`);
    return;
  }
  walk.status = 'replaced';
  const d = new Date(walk.datetime);
  d.setDate(d.getDate() + r.dayShift);
  d.setHours(SLOT_HOUR[r.slot], 0, 0, 0);
  let courseId = walk.courseId;
  if (r.saferCourse || courseSafety(c, r.slot).level === '주의') {
    courseId = recommendCourses(state.me, p, COURSES, { slot: r.slot, safeOnly: true, limit: 1 }).courses[0]?.id || courseId;
  }
  const counter = { id: uid('w'), personId: p.id, courseId, datetime: d.toISOString(), slot: r.slot, status: 'pending', from: p.id, replaces: walk.id, review: null };
  state.walks.push(counter);
  save();
  pushMsg(p.id, { from: p.id, text: `${r.reason} 이 시간은 어떠세요?` });
  pushMsg(p.id, { from: p.id, kind: 'walk', walkId: counter.id, text: '' });
  notify(`${p.name}님이 다른 시간을 제안했어요`, { kind: 'reminder', to: { name: 'chat', id: p.id, back: 'matches' } });
  refreshWalkViews(p.id);
}

function confirmWalk(walk, p, byMe) {
  walk.status = 'confirmed';
  save();
  pushMsg(p.id, { from: 'system', text: byMe ? `산책 약속이 확정됐어요 · ${fmtDate(walk.datetime)}` : `${p.name}님이 산책 약속을 수락했어요` });
  if (!byMe) notify(`${p.name}님과 ${fmtDate(walk.datetime)} 산책이 확정됐어요`, { kind: 'reminder', to: { name: 'walks' } });
  refreshWalkViews(p.id);
}

function declineWalk(walk, p) {
  walk.status = 'declined';
  save();
  pushMsg(p.id, { from: 'system', text: '산책 제안을 거절했어요' });
  refreshWalkViews(p.id);
}

// 제안 카드·일정 버튼 공통 처리 (채팅과 산책 일정 화면에서 함께 씀)
function handleWalkAction(e) {
  const t = e.target.closest('[data-w-accept],[data-w-decline],[data-w-counter],[data-w-change]');
  if (!t) return false;
  e.stopPropagation();
  const id = t.dataset.wAccept || t.dataset.wDecline || t.dataset.wCounter || t.dataset.wChange;
  const w = state.walks.find((x) => x.id === id);
  const p = person(w.personId);
  if (t.dataset.wAccept) confirmWalk(w, p, true);
  else if (t.dataset.wDecline) { if (confirm('이 산책 제안을 거절할까요?')) declineWalk(w, p); }
  else openProposal(p, { replace: w });
  return true;
}

function refreshWalkViews(personId) {
  if (route.name === 'chat' && route.id === personId) renderChat();
  if (route.name === 'walks') renderWalks();
}

// 코스 지도 전체 화면 (모달 위에 겹쳐 열림)
export function openCourseMap(courseId, slot, personId) {
  const c = course(courseId);
  const other = personId && person(personId);
  const mid = other ? midpoint(state.me, other) : null;
  let map = null;
  const el = document.createElement('div');
  el.className = 'mapview';
  document.querySelector('.phone').appendChild(el);
  const close = () => { map?.destroy(); el.remove(); };

  const draw = () => {
    const s = courseSafety(c, slot);
    const hz = hazardSegments(c, slot);
    const far = c.pois.filter((x) => x.type !== 'cctv' && (x.type === 'store' ? c.safety.storeM : c.safety.policeM) > 900);
    el.innerHTML = `
      <header class="topbar has-back">
        <button class="icon-btn" id="mvClose" aria-label="닫기">${icon('back', 24)}</button>
        <h1>${esc(c.name)}</h1>${safeBadge(s.level)}<span style="width:12px"></span>
      </header>
      <div class="mv-map" id="mvMap"></div>
      <div class="mv-sheet">
        ${segHtml('mvSlot', TIME_SLOTS, slot)}
        <div class="mv-stats">
          <div><b>${c.lengthKm}km</b><span>${c.roundTrip ? '왕복 거리' : '순환 거리'}</span></div>
          <div><b>약 ${c.minutes}분</b><span>반려견 걸음 기준</span></div>
          <div><b>${c.safety.storeM}m</b><span>가까운 편의점</span></div>
        </div>
        <div class="legend">
          <span><i class="lg-route"></i>산책 경로</span>
          <span><i class="lg-haz"></i>지금 주의 구간</span>
          <span><i class="lg-poi cctv">${icon('cctv', 11)}</i>CCTV</span>
          <span><i class="lg-poi store">${icon('store', 11)}</i>편의점</span>
          <span><i class="lg-poi police">${icon('shield', 11)}</i>지구대</span>
          ${mid ? `<span><i class="lg-poi mid">${icon('users', 11)}</i>중간 지점</span>` : ''}
        </div>
        <div class="label">${slot} 기준 주의 구간</div>
        ${hz.length ? `<ul class="hz-list">${hz.map((h) => `<li class="${h.active ? '' : 'off'}">
            <span class="no">${h.no}</span>
            <div class="grow"><b>${esc(h.note)}</b><span>${h.active ? (h.when === 'always' ? '시간대와 관계없이 주의하세요' : `${slot}에는 어둡고 한산해요`) : '낮에는 괜찮아요 · 저녁·밤에만 주의'}</span></div>
          </li>`).join('')}</ul>`
          : `<div class="hidden-note" style="margin:0">${icon('shield', 16)}<span>경로 전체가 밝고 사람이 다니는 길이에요</span></div>`}
        <div class="label">안전 체크</div>
        <ul class="checklist" style="border:0;padding:0;margin:0">
          ${s.checks.map((k) => `<li class="${k.ok ? '' : 'bad'}">${icon(k.ok ? 'check' : 'alert', 16)}${esc(k.label)}</li>`).join('')}
        </ul>
        ${far.length ? `<p class="muted small" style="margin:14px 0 0">${far.map((x) => `${x.label} ${x.type === 'store' ? c.safety.storeM : c.safety.policeM}m`).join(', ')} — 지도 범위 밖에 있어요.</p>` : ''}
        <p class="muted small" style="margin:14px 0 0">상대방의 정확한 위치는 표시하지 않고, 두 분의 중간 지점만 보여드려요. 지도는 간략화한 데모 지도예요.</p>
      </div>`;
    map?.destroy();
    map = mountMap($('#mvMap', el), { course: c, slot, mid });
    $('#mvClose', el).onclick = close;
    bindToggles(el, (name, v) => { if (name === 'mvSlot') { slot = v; draw(); } });
  };
  draw();
}

function openSafetyMenu(p) {
  openModal(`
    <h3>${esc(p.name)}님</h3>
    <p class="desc">불편한 점이 있다면 언제든 알려주세요. 신고 내용은 상대에게 알려지지 않아요.</p>
    <button class="menu-item" id="share">${icon('share', 20)}약속 정보 지인에게 공유</button>
    <button class="menu-item" id="report">${icon('flag', 20)}신고하기</button>
    <button class="menu-item danger" id="block">${icon('ban', 20)}차단하기</button>`, (root) => {
    $('#share', root).onclick = async () => {
      const w = state.walks.find((x) => x.personId === p.id && x.status !== 'cancelled');
      const text = w
        ? `[같이걸을개] ${fmtDate(w.datetime)} ${course(w.courseId).name}에서 ${p.name}님과 산책 예정`
        : `[같이걸을개] ${p.name}님과 산책 약속 조율 중`;
      try { await navigator.clipboard.writeText(text); toast('약속 정보를 복사했어요'); } catch { toast(text); }
      closeModal();
    };
    $('#report', root).onclick = () => { closeModal(); toast('신고가 접수됐어요. 24시간 내 검토할게요.'); };
    $('#block', root).onclick = () => {
      if (!confirm(`${p.name}님을 차단할까요? 대화와 일정이 숨겨져요.`)) return;
      state.blocked.push(p.id);
      state.walks.forEach((w) => { if (w.personId === p.id && w.status !== 'cancelled') w.status = 'cancelled'; });
      save(); closeModal(); go('matches'); toast('차단했어요');
    };
  });
}

// ---------- 산책 일정 ----------
const HIDDEN_WALK = ['cancelled', 'declined', 'replaced'];

const WALK_TABS = { mine: '내 일정', groups: '동네 모임' };

export function renderWalks() {
  if (route.name !== 'walks') return;
  setTop('산책');
  const tab = WALK_TABS[route.tab] ? route.tab : 'mine';
  const tabsHtml = `<div class="walk-tabs">${segHtml('walkTab', Object.values(WALK_TABS), WALK_TABS[tab])}</div>`;
  const bindTabs = () => bindToggles(view.querySelector('.walk-tabs'), (name, v) => {
    go('walks', { tab: Object.keys(WALK_TABS).find((k) => WALK_TABS[k] === v) });
  });
  if (tab === 'groups') {
    view.innerHTML = tabsHtml;
    bindTabs();
    renderGroups(view);
    return;
  }
  const walks = state.walks.filter((w) => !state.blocked.includes(w.personId) && !HIDDEN_WALK.includes(w.status));
  if (!walks.length) {
    view.innerHTML = `${tabsHtml}<div class="empty"><div class="ic-wrap">${icon('calendar', 28)}</div>
      <strong>예정된 산책이 없어요</strong>대화방에서 <b>코스 추천</b>을 눌러 첫 산책을 제안하거나,<br/><b>동네 모임</b>에 참여해 보세요.</div>`;
    bindTabs();
    return;
  }
  const sorted = [...walks].sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
  const label = (w) => {
    if (w.status === 'pending') return (w.from || 'me') === 'me' ? ['pending', '답 기다리는 중'] : ['pending', '내 답이 필요해요'];
    if (w.session && !w.session.endedAt) return ['ongoing', '안심 산책 중'];
    if (isWalkDone(w)) return ['done', '완료'];
    return { upcoming: ['upcoming', '예정'], ongoing: ['ongoing', '산책 시간'], done: ['done', '완료'] }[walkStatus(w)];
  };

  view.innerHTML = tabsHtml + sorted.map((w) => {
    if (w.groupId) return groupWalkHtml(w, label(w));
    const p = person(w.personId);
    const c = course(w.courseId);
    const s = courseSafety(c, w.slot);
    const f = forecastFor(w.datetime);
    const [cls, txt] = label(w);
    const done = isWalkDone(w);
    const live = w.session && !w.session.endedAt;
    const theirTurn = w.status === 'pending' && (w.from || 'me') !== 'me';
    const reminders = reminderTimes(w).filter((r) => r.at > Date.now());
    let actions;
    if (done) {
      actions = w.review
        ? `<button class="btn soft sm grow" disabled>평가 완료 · ${w.review.rating}점</button>`
        : `<button class="btn sm grow" data-review="${w.id}">매너 평가</button>`;
    } else if (theirTurn) {
      actions = `<button class="btn sm accent grow" data-w-accept="${w.id}">수락</button>
        <button class="btn soft sm grow" data-w-counter="${w.id}">다른 시간</button>
        <button class="btn soft sm grow" data-w-decline="${w.id}">거절</button>`;
    } else {
      actions = `${w.status === 'confirmed' && !live ? `<button class="btn soft sm grow" data-w-change="${w.id}">일정 변경</button>` : ''}
        <button class="btn soft sm grow" data-cancel="${w.id}">취소</button>
        ${w.status === 'confirmed' ? `<button class="btn outline sm grow" data-finish="${w.id}" title="데모: 산책을 완료 처리">완료 처리</button>` : ''}`;
    }
    return `<div class="walk">
      <div class="head"><span class="when">${fmtDate(w.datetime)}</span><span class="status ${cls}">${txt}</span></div>
      <div class="info">
        <div>${icon('pin', 16)}${esc(c.name)} · ${c.lengthKm}km</div>
        <div>${icon('user', 16)}${esc(p.name)} · ${esc(p.dog.name)}</div>
        <div>${icon('shield', 16)}${w.slot} 기준 안전도 ${safeBadge(s.level)}</div>
        <div>${icon(SKY_ICON[f.sky], 16)}예보 ${weatherHtml(w.datetime, { full: true })}</div>
        ${w.status === 'confirmed' && !done && reminders.length ? `<div class="muted small">${icon('bell', 14)}알림 예정 · ${reminders.map((r) => `${r.kind === 'day' ? '전날' : '1시간 전'} ${fmtDate(new Date(r.at).toISOString())}`).join(' · ')}</div>` : ''}
      </div>
      ${f.rainy && !done && w.status === 'confirmed' ? `<div class="notice warn" style="margin:-4px 0 12px">${icon('rain', 18)}<span>비 예보가 있어요. 일정 변경을 제안해 보세요.</span></div>` : ''}
      <div class="row">
        <button class="btn soft sm grow" data-chat="${p.id}">대화</button>
        <button class="btn soft sm grow" data-course="${w.id}">${icon('route', 16)}지도</button>
        ${actions}
      </div>
      ${!done && w.status === 'confirmed' ? `<button class="btn ${live ? 'sos' : 'accent'} start-walk" data-start="${w.id}">${icon(live ? 'shield' : 'play', 18)}${live ? '안심 산책 화면 열기' : '안심 산책 시작'}</button>` : ''}
    </div>`;
  }).join('') + '<p class="muted small" style="text-align:center;margin-top:8px">산책이 끝나면 매너 평가를 남겨주세요. 평가는 익명으로 반영돼요.</p>';

  bindTabs();
  view.onclick = (e) => { if (route.name === 'walks') handleWalkAction(e); };
  view.querySelectorAll('[data-g-open]').forEach((b) => { b.onclick = () => openGroup(b.dataset.gOpen); });
  view.querySelectorAll('[data-chat]').forEach((b) => { b.onclick = () => go('chat', { id: b.dataset.chat, back: 'walks' }); });
  view.querySelectorAll('[data-course]').forEach((b) => {
    b.onclick = () => { const w = state.walks.find((x) => x.id === b.dataset.course); openCourseMap(w.courseId, w.slot, w.personId); };
  });
  view.querySelectorAll('[data-cancel]').forEach((b) => {
    b.onclick = () => {
      const w = state.walks.find((x) => x.id === b.dataset.cancel);
      if (!confirm(w.status === 'pending' ? '산책 제안을 취소할까요?' : '산책 약속을 취소할까요?')) return;
      w.status = 'cancelled';
      save();
      pushMsg(w.personId, { from: 'system', text: '산책 약속이 취소됐어요' });
      renderWalks();
    };
  });
  // 데모용: 시간이 지난 것처럼 처리해 평가 흐름을 확인할 수 있게 함
  view.querySelectorAll('[data-finish]').forEach((b) => {
    b.onclick = () => {
      const w = state.walks.find((x) => x.id === b.dataset.finish);
      w.datetime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      w.completedAt = Date.now();
      save();
      renderWalks();
      if (w.personId) openReview(w);
      else toast('모임 산책을 마쳤어요');
    };
  });
  view.querySelectorAll('[data-start]').forEach((b) => { b.onclick = () => startWalk(b.dataset.start); });
  view.querySelectorAll('[data-review]').forEach((b) => { b.onclick = () => openReview(state.walks.find((x) => x.id === b.dataset.review)); });
}

// 내 일정 속 모임 산책 카드
function groupWalkHtml(w, [cls, txt]) {
  const g = groupById(w.groupId);
  const c = course(w.courseId);
  const s = courseSafety(c, w.slot);
  const done = isWalkDone(w);
  const live = w.session && !w.session.endedAt;
  const members = g ? membersOf(g) : [];
  return `<div class="walk group-walk">
    <div class="head"><span class="when">${fmtDate(w.datetime)}</span><span class="status ${cls}">${txt}</span></div>
    <div class="info">
      <div>${icon('users', 16)}<b>${esc(g?.title || '동네 산책 모임')}</b> · ${members.length}명</div>
      <div>${icon('pin', 16)}${esc(c.name)} · ${c.lengthKm}km</div>
      <div>${icon('shield', 16)}${w.slot} 기준 안전도 ${safeBadge(s.level)}</div>
      <div>${icon('sunny', 16)}예보 ${weatherHtml(w.datetime, { full: true })}</div>
    </div>
    <div class="row">
      ${g ? `<button class="btn soft sm grow" data-g-open="${g.id}">모임 정보</button>` : ''}
      <button class="btn soft sm grow" data-course="${w.id}">${icon('route', 16)}지도</button>
      ${!done ? `<button class="btn outline sm grow" data-finish="${w.id}" title="데모: 산책을 완료 처리">완료 처리</button>` : ''}
    </div>
    ${!done ? `<button class="btn ${live ? 'sos' : 'accent'} start-walk" data-start="${w.id}">${icon(live ? 'shield' : 'play', 18)}${live ? '안심 산책 화면 열기' : '안심 산책 시작'}</button>` : ''}
  </div>`;
}

const REVIEW_TAGS = ['시간 약속을 잘 지켜요', '대화가 즐거워요', '강아지를 잘 케어해요', '매너가 좋아요', '또 산책하고 싶어요'];
function openReview(w) {
  const p = person(w.personId);
  let rating = 5;
  openModal(`
    <h3>${esc(p.name)}님과의 산책은 어땠나요?</h3>
    <p class="desc">${esc(course(w.courseId).name)} · ${fmtDate(w.datetime)}</p>
    <div class="stars" id="stars">${[1, 2, 3, 4, 5].map((n) => `<button data-n="${n}" class="on" aria-label="${n}점">${icon('star', 36)}</button>`).join('')}</div>
    <div class="field"><label>좋았던 점</label>${chipsHtml('tags', REVIEW_TAGS, [])}</div>
    <div class="field"><label>다시 만나고 싶나요?</label>${segHtml('again', ['또 만나고 싶어요', '친구로 지낼래요'], '또 만나고 싶어요')}</div>
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
      toast('평가를 남겼어요. 감사합니다!');
    };
  });
}

// ---------- 인증 (데모) ----------
// 실서비스에서는 통신사 본인확인(PASS 등)과 국가동물보호정보시스템 조회로 대체
function openPhoneVerify() {
  const me = state.me;
  openModal(`
    <h3>본인 인증</h3>
    <p class="desc">휴대폰 번호로 본인 인증을 해요. 번호는 상대에게 보이지 않아요.</p>
    <div class="field"><label for="v-phone">휴대폰 번호</label><input class="input" id="v-phone" inputmode="tel" value="${esc(me.phone)}" placeholder="010-1234-5678" /></div>
    <button class="btn outline" id="v-send">인증번호 받기</button>
    <div id="v-code-wrap" hidden style="margin-top:16px">
      <div class="field"><label for="v-code">인증번호 6자리</label><input class="input" id="v-code" inputmode="numeric" maxlength="6" /></div>
      <p class="muted small" style="margin:-8px 0 16px">데모라서 실제 문자는 가지 않아요. 인증번호는 <b>123456</b>이에요.</p>
      <button class="btn accent" id="v-ok">인증 완료</button>
    </div>`, (root) => {
    $('#v-send', root).onclick = () => {
      const phone = normalizePhone($('#v-phone', root).value);
      if (!phone) { toast('휴대폰 번호를 확인해 주세요'); return; }
      me.phone = phone;
      $('#v-code-wrap', root).hidden = false;
      toast('인증번호를 보냈어요 (데모: 123456)');
    };
    $('#v-ok', root).onclick = () => {
      if ($('#v-code', root).value !== '123456') { toast('인증번호가 맞지 않아요'); return; }
      me.verified.phone = true;
      save(); closeModal(); render();
      notify('본인 인증을 완료했어요', { kind: 'info', device: false });
    };
  });
}

function openRegistryVerify() {
  const me = state.me;
  openModal(`
    <h3>동물등록 인증</h3>
    <p class="desc">${esc(me.dog.name)}의 동물등록번호(15자리)를 입력해 주세요. 등록증이나 내장칩 정보에서 확인할 수 있어요.</p>
    <div class="field"><label for="v-reg">동물등록번호</label><input class="input" id="v-reg" inputmode="numeric" maxlength="19" value="${esc(me.dog.registryNo)}" placeholder="410 1000 1234 5678" /></div>
    <p class="muted small" style="margin:-8px 0 16px">데모에서는 15자리 숫자면 인증돼요. 실제 서비스에서는 국가동물보호정보시스템에서 조회해요.</p>
    <button class="btn accent" id="v-ok">인증하기</button>`, (root) => {
    $('#v-ok', root).onclick = () => {
      const no = $('#v-reg', root).value.replace(/\s|-/g, '');
      if (!validRegistryNo(no)) { toast('15자리 숫자를 입력해 주세요'); return; }
      me.dog.registryNo = no;
      me.verified.registry = true;
      save(); closeModal(); render();
      notify('동물등록 인증을 완료했어요', { kind: 'info', device: false });
    };
  });
}

// ---------- 내 프로필 ----------
function renderProfile() {
  setTop('MY');
  const me = state.me;
  const reviews = state.walks.filter((w) => w.review).map((w) => w.review);
  const avg = averageRating(reviews);
  const walksDone = state.walks.filter((w) => isWalkDone(w)).length;

  view.innerHTML = `
    <div class="me-head">
      <div class="thumb">${media(me)}</div>
      <div>
        <div class="n">${esc(me.dog.name)} <span class="muted" style="font-weight:500;font-size:16px">${me.dog.age}살</span></div>
        <div class="s">${esc(me.dog.breed)} · ${me.dog.size}견 · ${me.dog.energy}</div>
        <div class="s">보호자 ${esc(me.name)} · ${ageFromBirthYear(me.birthYear)}세${me.job ? ` · ${esc(me.job)}` : ''}</div>
        <div class="badges" style="margin-top:8px">${badgesHtml(me) || '<span class="muted small">아직 인증 전이에요</span>'}</div>
      </div>
    </div>
    <div class="stats">
      <div><b>${state.matches.length}</b><span>매칭</span></div>
      <div><b>${walksDone}</b><span>함께한 산책</span></div>
      <div><b>${avg ?? '-'}</b><span>내가 준 평균 별점</span></div>
    </div>

    <div class="label">사진 <span class="muted small" style="font-weight:400">첫 번째 사진이 대표 사진이에요</span></div>
    ${photoGridHtml()}

    <div class="label">${icon('syringe', 16)}${esc(me.dog.name)}의 건강 · 안전</div>
    ${healthHtml(me.dog)}

    <div class="label">${icon('verified', 16)}인증 <span class="muted small" style="font-weight:400">인증하면 배지가 붙고 '인증 회원만' 필터에도 보여요</span></div>
    <button class="menu-item" id="vPhone">${icon('phone', 20)}<span class="grow" style="text-align:left">본인 인증 (휴대폰)</span>${me.verified.phone ? '<span class="vbadge">완료</span>' : '<span class="muted small">인증하기 ›</span>'}</button>
    <button class="menu-item" id="vRegistry">${icon('paw', 20)}<span class="grow" style="text-align:left">동물등록 인증</span>${me.verified.registry ? '<span class="vbadge">완료</span>' : '<span class="muted small">인증하기 ›</span>'}</button>

    <div class="label">안전</div>
    <label class="switch-row">
      ${icon('shield', 22)}
      <div class="grow"><div class="t">안심 코스 우선 추천</div><div class="d">산책 제안 시 인적 드물거나 어두운 코스를 숨겨요</div></div>
      <span class="switch"><input type="checkbox" id="safeMode" ${me.safeMode !== false ? 'checked' : ''} /><span></span></span>
    </label>
    <label class="switch-row" style="margin-top:8px;background:var(--accent-soft)">${icon('bell', 22)}<div class="grow"><div class="t">기기 알림 받기</div><div class="d">산책 전날 · 1시간 전 알림, 안심 산책 알림을 휴대폰 알림으로도 보내요</div></div>${switchHtml('deviceNotify', state.settings.deviceNotify)}</label>
    <button class="menu-item" id="guardians" style="margin-top:8px">${icon('users', 20)}<span class="grow" style="text-align:left">안심 연락처 · 자동 알림 설정</span><span class="muted small">${state.guardians.length}명</span></button>

    <div class="label">프로필</div>
    <button class="menu-item" id="editMe">${icon('user', 20)}<span class="grow" style="text-align:left">보호자 정보 수정</span></button>
    <button class="menu-item" id="editDog">${icon('edit', 20)}<span class="grow" style="text-align:left">강아지 정보 수정</span></button>
    <button class="menu-item danger" id="reset">${icon('trash', 20)}<span class="grow" style="text-align:left">데모 데이터 초기화</span></button>`;

  bindPhotoGrid(view, () => { $('.me-head .thumb').innerHTML = media(me); });
  $('#safeMode').onchange = (e) => { me.safeMode = e.target.checked; save(); toast(e.target.checked ? '안심 코스만 추천할게요' : '모든 코스를 추천할게요'); };
  $('#guardians').onclick = () => openGuardians(() => render());
  $('#deviceNotify').onchange = async (e) => {
    if (e.target.checked && 'Notification' in window && Notification.permission !== 'granted') {
      const perm = await Notification.requestPermission().catch(() => 'denied');
      if (perm !== 'granted') { e.target.checked = false; toast('브라우저에서 알림이 허용되지 않았어요'); return; }
    }
    if (e.target.checked && !('Notification' in window)) { e.target.checked = false; toast('이 브라우저는 알림을 지원하지 않아요'); return; }
    state.settings.deviceNotify = e.target.checked;
    save();
    toast(e.target.checked ? '기기 알림을 켰어요' : '기기 알림을 껐어요');
  };
  $('#vPhone').onclick = openPhoneVerify;
  $('#vRegistry').onclick = openRegistryVerify;
  $('#editMe').onclick = () => openModal(`<h3>보호자 정보</h3><div style="height:16px"></div>${personFields(me)}<div class="sheet-foot"><button class="btn" id="save">저장</button></div>`, (root) => {
    bindToggles(root);
    $('#save', root).onclick = () => { if (readPersonFields()) { closeModal(); render(); toast('저장했어요'); } };
  });
  $('#editDog').onclick = () => openModal(`<h3>강아지 정보</h3><div style="height:16px"></div>${dogFields(me.dog)}<div class="sheet-foot"><button class="btn" id="save">저장</button></div>`, (root) => {
    bindToggles(root);
    $('#save', root).onclick = () => { if (readDogFields()) { closeModal(); render(); toast('저장했어요'); } };
  });
  $('#reset').onclick = () => {
    if (!confirm('모든 데이터를 지우고 처음부터 시작할까요?')) return;
    resetState();
    go('onboarding', { step: 0 });
  };
}

// 데모: 내가 좋아요를 보낸 사람 중 일부가 잠시 뒤 좋아요로 답함
onTick((now) => {
  const back = dueLikeBacks(state.likesSent, PEOPLE, now);
  back.forEach((p) => {
    state.likesSent.find((l) => l.id === p.id).answered = true;
    if (state.blocked.includes(p.id) || matchOf(p.id)) return;
    createMatch(p);
    notify(`${p.name}님도 ${state.me.dog.name}에게 좋아요를 눌렀어요! 매칭됐어요`, { kind: 'match', to: { name: 'chat', id: p.id, back: 'matches' } });
    updateBadge();
    if (route.name === 'matches') renderMatches();
  });
  if (back.length) save();
});

// 산책 전날 · 1시간 전 알림
onTick((now) => {
  const due = dueReminders(state.walks.filter((w) => !state.blocked.includes(w.personId)), state.fired, now);
  due.forEach((r) => {
    state.fired.push(r.key);
    const w = r.walk;
    const who = walkWho(w).title;
    const f = forecastFor(w.datetime);
    const rain = f.rainy ? ` · 비 예보 ${f.rainProb}%` : '';
    notify(r.kind === 'day'
      ? `내일 ${fmtDate(w.datetime).replace(/^.*\) /, '')} ${w.groupId ? `'${who}' 모임 산책이 있어요` : `${who}님과 산책 약속이 있어요`}${rain}`
      : `1시간 뒤 ${course(w.courseId).name}에서 산책이에요. 출발할 때 안심 산책을 켜 주세요`, { kind: 'reminder', to: { name: 'walks' } });
  });
  if (due.length) save();
});

onWalkEnded((w) => {
  setTimeout(() => {
    go('walks');
    if (w.personId && !w.review) openReview(w);
  }, 600);
});

registerView('onboarding', renderOnboarding);
registerView('discover', renderDiscover);
registerView('matches', renderMatches);
registerView('chat', renderChat);
registerView('walks', renderWalks);
registerView('profile', renderProfile);

render();
startTicker();

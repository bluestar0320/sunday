// 산책 당일 안심 기능: 안심 연락처, 실시간 위치 공유, 중간 체크인, 예정 시간 초과 시 자동 알림, 긴급 SOS
import {
  $, view, state, route, save, esc, course, toast, openModal, closeModal, fmtTime, uid,
  go, setTop, notify, registerView, onAfterRender, onTick, switchHtml, walkWho, isDemo,
} from './core.js';
import { RULES, sessionStatus, positionAlongPath, normalizePhone, distanceKm } from './logic.js';
import { icon } from './ui.js';
import { mountMap } from './map.js';
import { sendSms, services } from './services.js';


export const activeSession = () => state.walks.find((w) => w.session && !w.session.endedAt);
const statusOf = (w, now = Date.now()) => sessionStatus(w.session, now, state.settings);
const guardianNames = (ids) => state.guardians.filter((g) => ids.includes(g.id)).map((g) => g.name);

const mapLink = (p, name = '현재 위치') => `https://map.kakao.com/link/map/${encodeURIComponent(name)},${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;

// 위치를 공유한 안심 연락처에게 문자. 서버에 문자 서비스가 연결돼 있으면 실제로 보내고, 아니면 데모로 기록만 남긴다
async function textGuardians(w, text, logText, kind = 'share') {
  const phones = state.guardians.filter((g) => w.session.sharedWith.includes(g.id)).map((g) => g.phone);
  if (!phones.length) return false;
  const real = await sendSms(phones, text);
  logEvent(w, `${logText}${real ? '' : ' (데모: 실제 문자는 가지 않았어요)'}`, kind);
  return real;
}

function logEvent(w, text, kind = 'info') {
  w.session.events.unshift({ at: Date.now() + (w.session.offsetMs || 0), text, kind });
  save();
}

// ---------- 안심 연락처 ----------
export function openGuardians(onDone) {
  openModal('', (root) => {
    const draw = () => {
      root.innerHTML = `
        <h3>안심 연락처</h3>
        <p class="desc">산책을 시작하면 이 분들에게 실시간 위치 링크가 가고, 예정 시간이 지나도 산책이 끝나지 않으면 자동으로 알림이 가요. (최대 3명)</p>
        <div class="stack" id="gList">
          ${state.guardians.map((g) => `<div class="menu-item">${icon('user', 20)}<span class="grow"><b>${esc(g.name)}</b> <span class="muted small">${esc(g.phone)}</span></span>
            <button class="icon-btn" data-rm="${g.id}" aria-label="${esc(g.name)} 삭제">${icon('trash', 18)}</button></div>`).join('')
            || '<p class="muted small" style="margin:0 0 8px">아직 등록된 연락처가 없어요.</p>'}
        </div>
        ${state.guardians.length < 3 ? `
          <div class="two" style="margin-top:12px">
            <div class="field"><label for="g-name">이름</label><input class="input" id="g-name" maxlength="10" placeholder="예: 언니" /></div>
            <div class="field"><label for="g-phone">휴대폰 번호</label><input class="input" id="g-phone" inputmode="tel" placeholder="010-1234-5678" /></div>
          </div>
          <button class="btn outline" id="gAdd">${icon('plus', 18)}연락처 추가</button>` : ''}
        <div class="label">알림 설정</div>
        <div class="field"><label>예정 시간이 지나고 몇 분 뒤에 지인에게 알릴까요?</label>${segPicker('graceMin', [10, 15, 30], state.settings.graceMin, '분')}</div>
        <div class="field"><label>산책 중 체크인 간격</label>${segPicker('checkinMin', [15, 20, 30], state.settings.checkinMin, '분마다')}</div>
        <div class="sheet-foot"><button class="btn accent" id="gDone">완료</button></div>`;
      $('#gList', root).onclick = (e) => {
        const b = e.target.closest('[data-rm]'); if (!b) return;
        state.guardians = state.guardians.filter((g) => g.id !== b.dataset.rm);
        save(); draw();
      };
      $('#gAdd', root)?.addEventListener('click', () => {
        const name = $('#g-name', root).value.trim();
        const phone = normalizePhone($('#g-phone', root).value);
        if (!name) { toast('이름을 입력해 주세요'); return; }
        if (!phone) { toast('휴대폰 번호를 확인해 주세요'); return; }
        state.guardians.push({ id: uid('g'), name, phone });
        save(); draw();
      });
      root.querySelectorAll('[data-pick]').forEach((seg) => seg.addEventListener('click', (e) => {
        const b = e.target.closest('button'); if (!b) return;
        state.settings[seg.dataset.pick] = Number(b.dataset.v);
        save(); draw();
      }));
      $('#gDone', root).onclick = () => { closeModal(); onDone?.(); };
    };
    draw();
  });
}

function segPicker(key, values, current, unit) {
  return `<div class="seg" data-pick="${key}">${values.map((v) => `<button type="button" data-v="${v}" class="${v === current ? 'on' : ''}">${v}${unit}</button>`).join('')}</div>`;
}

// ---------- 산책 시작 ----------
export function startWalk(walkId) {
  const w = state.walks.find((x) => x.id === walkId);
  if (activeSession() && activeSession().id !== walkId) { toast('이미 진행 중인 안심 산책이 있어요'); return; }
  if (w.session && !w.session.endedAt) { go('live', { id: w.id }); return; }
  if (!state.guardians.length) {
    openModal(`
      <h3>안심 연락처를 먼저 등록할까요?</h3>
      <p class="desc">산책 중 위치를 공유하고, 예정 시간이 지나면 자동으로 알려줄 사람이 필요해요.</p>
      <div class="stack">
        <button class="btn accent" id="addG">${icon('user', 18)}안심 연락처 등록하기</button>
        <button class="btn text" id="skipG">연락처 없이 시작하기</button>
      </div>`, (root) => {
      $('#addG', root).onclick = () => openGuardians(() => confirmStart(w));
      $('#skipG', root).onclick = () => confirmStart(w);
    });
    return;
  }
  confirmStart(w);
}

function confirmStart(w) {
  const c = course(w.courseId);
  const who = walkWho(w);
  openModal(`
    <h3>안심 산책을 시작할게요</h3>
    <p class="desc">${esc(who.title)} · ${esc(c.name)} · 약 ${c.minutes}분</p>
    ${state.guardians.length ? `<div class="label">위치를 공유할 사람</div>
      <div class="stack" id="shareList">${state.guardians.map((g) => `
        <label class="menu-item" style="cursor:pointer">${icon('user', 20)}<span class="grow"><b>${esc(g.name)}</b> <span class="muted small">${esc(g.phone)}</span></span>${switchHtml(`sh-${g.id}`, true)}</label>`).join('')}
      </div>` : '<div class="notice">' + icon('alert', 18) + '<span>안심 연락처가 없어서 위치 공유와 자동 알림 없이 진행돼요. 긴급 SOS는 사용할 수 있어요.</span></div>'}
    <div class="notice" style="margin-top:14px">${icon('shield', 18)}<span>예정 종료 시간은 <b>${fmtTime(Date.now() + (c.minutes + 30) * 60000)}</b>이에요. ${state.settings.checkinMin}분마다 체크인을 물어보고, 예정 시간이 ${state.settings.graceMin}분 넘게 지나도 끝나지 않으면 공유한 분들에게 자동으로 알려요.</span></div>
    <div class="sheet-foot"><button class="btn accent" id="go">${icon('play', 18)}산책 시작</button></div>`, (root) => {
    $('#go', root).onclick = () => {
      const shared = state.guardians.filter((g) => $(`#sh-${g.id}`, root)?.checked).map((g) => g.id);
      const now = Date.now();
      const plannedMin = c.minutes + 30; // 인사·쉬는 시간 여유
      w.session = {
        startedAt: now, plannedMin, expectedEnd: now + plannedMin * 60000, offsetMs: 0,
        sharedWith: shared, checkins: [], events: [], alertedAt: null, endedAt: null,
      };
      logEvent(w, '안심 산책을 시작했어요', 'start');
      if (shared.length) {
        textGuardians(w, `${state.me.name}님이 ${who.title}와(과) ${c.name}에서 산책을 시작했어요. 예정 종료 ${fmtTime(w.session.expectedEnd)}. 코스: ${mapLink(c.path[0], c.name)}`,
          `${guardianNames(shared).join(', ')}님에게 산책 시작을 알렸어요`);
      }
      closeModal();
      notify(`안심 산책을 시작했어요${shared.length ? ` · ${shared.length}명에게 위치 공유 중` : ''}`, { kind: 'safety', to: { name: 'live', id: w.id }, device: false });
      go('live', { id: w.id });
    };
  });
}

// ---------- 안심 산책 화면 ----------
let liveTimer = null;
let liveMap = null;

function renderLive() {
  const w = state.walks.find((x) => x.id === route.id);
  if (!w?.session) { go('walks'); return; }
  const c = course(w.courseId);
  const who = walkWho(w);
  setTop(w.session.endedAt ? '산책 기록' : '안심 산책 중', { back: true, bell: false });
  route.back = 'walks';

  view.innerHTML = `
    <div class="live">
      <div class="live-card" id="liveCard"></div>
      <div class="mini-map live-map" id="liveMap"></div>
      <div id="livePrompt"></div>
      <div class="live-actions" id="liveActions"></div>
      <div class="label">공유 중</div>
      <div id="liveShare"></div>
      <div class="label">기록</div>
      <ul class="timeline" id="liveEvents"></ul>
    </div>`;

  liveMap?.destroy();
  const s0 = statusOf(w);
  liveMap = mountMap($('#liveMap'), { course: c, slot: w.slot, me: positionAlongPath(c.path, s0.progress), interactive: true });

  const draw = () => {
    if (route.name !== 'live') return;
    const s = statusOf(w);
    const mm = Math.floor(s.elapsedMin);
    const ss = Math.floor((s.elapsedMin * 60) % 60);
    $('#liveCard').innerHTML = `
      <div class="lc-top"><span class="pulse ${s.ended ? 'off' : ''}"></span>${s.ended ? '산책을 마쳤어요' : s.overdue ? '예정 시간을 지났어요' : '안전하게 산책 중'}</div>
      <div class="lc-time">${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}</div>
      <div class="lc-sub">${esc(who.title)} · ${esc(c.name)}</div>
      <div class="lc-sub">예정 종료 ${fmtTime(w.session.expectedEnd)}${s.ended ? ` · 종료 ${fmtTime(w.session.endedAt)}` : ''}</div>`;
    liveMap.setMe(positionAlongPath(c.path, s.progress));

    let prompt = '';
    if (!s.ended && w.session.alertedAt) {
      prompt = `<div class="live-alert">${icon('alert', 20)}<div class="grow"><b>지인에게 알림을 보냈어요</b><span>괜찮다면 "괜찮아요"를 눌러 안심 메시지를 보내주세요.</span></div><button class="btn sm accent" data-act="ok">괜찮아요</button></div>`;
    } else if (s.overdue) {
      prompt = `<div class="live-alert">${icon('clock', 20)}<div class="grow"><b>예정 시간이 ${Math.ceil(s.overdueMin)}분 지났어요</b><span>${Math.ceil(s.alertInMin)}분 뒤 공유한 분들에게 자동으로 알려요.</span></div><button class="btn sm accent" data-act="extend">${RULES.extendMin}분 연장</button></div>`;
    } else if (s.needCheckin) {
      prompt = `<div class="live-check">${icon('shield', 20)}<div class="grow"><b>괜찮으신가요?</b><span>체크인하면 공유한 분들에게 안심 메시지가 가요.</span></div><button class="btn sm accent" data-act="checkin">괜찮아요</button></div>`;
    }
    $('#livePrompt').innerHTML = prompt;

    $('#liveActions').innerHTML = s.ended
      ? `<button class="btn accent" data-act="close">${icon('check', 18)}확인</button>`
      : `<button class="btn sos" data-act="sos">${icon('siren', 22)}긴급 SOS</button>
         <div class="two">
           <button class="btn soft" data-act="checkin">${icon('check', 18)}체크인</button>
           <button class="btn outline" data-act="end">${icon('stop', 16)}산책 종료</button>
         </div>
         ${isDemo() ? '<button class="btn text small" data-act="skip">데모: 10분 앞으로 감기</button>' : ''}`;

    const names = guardianNames(w.session.sharedWith);
    $('#liveShare').innerHTML = names.length
      ? `<div class="share-card">${icon('link', 18)}<div class="grow"><b>${names.join(', ')}님에게 산책 소식을 알려요</b><span>시작 · 체크인 · 예정 시간 초과 · 종료 때 문자가 가요. 현재 위치 지도 링크를 복사해 따로 보낼 수도 있어요.</span></div><button class="btn sm soft" data-act="copy">위치 복사</button></div>`
      : `<div class="hidden-note" style="margin:0">${icon('user', 16)}<span>공유 중인 사람이 없어요</span><button data-act="guardians">연락처 등록</button></div>`;

    $('#liveEvents').innerHTML = w.session.events.map((e) => `<li class="ev-${e.kind}"><span class="t">${fmtTime(e.at)}</span>${esc(e.text)}</li>`).join('');
  };

  view.querySelector('.live').onclick = (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const act = b.dataset.act;
    const now = Date.now() + (w.session.offsetMs || 0);
    if (act === 'checkin' || act === 'ok') {
      w.session.checkins.push(now);
      if (act === 'ok') w.session.alertedAt = null;
      logEvent(w, '체크인: 괜찮아요', 'check');
      textGuardians(w, `${state.me.name}님이 산책 중 '괜찮아요' 체크인을 했어요.`, '공유한 분들에게 안심 문자를 보냈어요', 'check');
      toast('체크인했어요');
    } else if (act === 'extend') {
      w.session.expectedEnd += RULES.extendMin * 60000;
      w.session.checkins.push(now);
      logEvent(w, `예정 종료를 ${RULES.extendMin}분 늦췄어요 (${fmtTime(w.session.expectedEnd)})`, 'check');
    } else if (act === 'end') {
      if (!confirm('산책을 종료할까요?')) return;
      endWalk(w);
      return;
    } else if (act === 'sos') {
      openSOS(w);
    } else if (act === 'skip') {
      w.session.offsetMs = (w.session.offsetMs || 0) + 10 * 60000;
      save();
      tickSessions(Date.now());
    } else if (act === 'copy') {
      const here = positionAlongPath(c.path, statusOf(w).progress);
      navigator.clipboard?.writeText(mapLink(here)).then(() => toast('현재 위치 지도 링크를 복사했어요'), () => toast('복사하지 못했어요'));
    } else if (act === 'guardians') {
      openGuardians(() => renderLive());
    } else if (act === 'close') {
      go('walks');
      return;
    }
    save();
    draw();
  };

  draw();
  clearInterval(liveTimer);
  liveTimer = setInterval(draw, 1000);
}

export function endWalk(w) {
  const now = Date.now() + (w.session.offsetMs || 0);
  w.session.endedAt = now;
  w.completedAt = now;
  logEvent(w, '산책을 마쳤어요', 'end');
  textGuardians(w, `${state.me.name}님이 산책을 안전하게 마쳤어요.`, '공유한 분들에게 안전 귀가 문자를 보냈어요', 'end');
  save();
  notify('안심 산책을 마쳤어요. 오늘 산책은 어땠나요?', { kind: 'safety', to: { name: 'walks' }, device: false });
  walkEndedHandlers.forEach((fn) => fn(w));
}

const walkEndedHandlers = [];
export function onWalkEnded(fn) { walkEndedHandlers.push(fn); }

// ---------- 긴급 SOS ----------
function openSOS(w) {
  const c = course(w.courseId);
  const s = statusOf(w);
  const here = positionAlongPath(c.path, s.progress);
  const phones = state.guardians.filter((g) => w.session.sharedWith.includes(g.id)).map((g) => g.phone.replace(/-/g, ''));
  const body = encodeURIComponent(`[같이걸을개 긴급] 도움이 필요해요. 현재 위치: ${c.name} 부근 ${mapLink(here)}`);
  const near = c.pois.filter((p) => p.type !== 'cctv')
    .map((p) => ({ ...p, m: Math.round(distanceKm(here, p) * 1000) }))
    .sort((a, b) => a.m - b.m);
  logEvent(w, '긴급 SOS 화면을 열었어요', 'sos');
  openModal(`
    <h3 class="sos-title">${icon('siren', 24)}긴급 도움 요청</h3>
    <p class="desc">위험하다고 느껴지면 망설이지 말고 바로 신고하세요.</p>
    <div class="stack">
      <a class="btn sos" href="tel:112" data-sos="112">${icon('phone', 20)}112 경찰에 전화하기</a>
      ${phones.length ? `<a class="btn danger" href="sms:${phones.join(',')}?body=${body}" data-sos="sms">${icon('send', 18)}안심 연락처에 긴급 문자 보내기</a>` : ''}
      <button class="btn outline" data-sos="loud">${icon('bell', 18)}큰 소리 경보 울리기</button>
    </div>
    <div class="label">가까운 도움 장소</div>
    <div class="stack">${near.map((p) => `<div class="menu-item">${icon(p.type === 'police' ? 'shield' : 'store', 20)}<span class="grow">${p.label}</span><b>${p.m}m</b></div>`).join('')}</div>
    <p class="muted small" style="margin-top:12px">현재 위치: ${esc(c.name)} 부근 · 위도 ${here.lat.toFixed(5)}, 경도 ${here.lng.toFixed(5)}</p>
  `, (root) => {
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-sos]'); if (!b) return;
      const kind = b.dataset.sos;
      if (kind === '112') logEvent(w, '112에 전화를 걸었어요', 'sos');
      if (kind === 'sms' && services().sms) {
        // 서버로 바로 보낸다 (실패하면 휴대폰 문자 앱으로)
        e.preventDefault();
        textGuardians(w, `[긴급] ${state.me.name}님이 도움을 요청했어요. 위치: ${c.name} 부근 ${mapLink(here)}`, '안심 연락처에 긴급 문자를 보냈어요', 'sos')
          .then((ok) => { if (!ok) location.href = b.href; });
      } else if (kind === 'sms') logEvent(w, '휴대폰 문자 앱으로 긴급 문자를 열었어요', 'sos');
      if (kind === 'loud') { playAlarm(); logEvent(w, '경보음을 울렸어요', 'sos'); }
      notify(kind === 'loud' ? '경보음을 울렸어요' : '긴급 요청을 보냈어요', { kind: 'alert', device: false });
    });
  });
}

// 경보음 (Web Audio, 3초)
function playAlarm() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    gain.gain.value = 0.25;
    osc.connect(gain).connect(ctx.destination);
    const t = ctx.currentTime;
    for (let i = 0; i < 12; i++) osc.frequency.setValueAtTime(i % 2 ? 1400 : 900, t + i * 0.25);
    osc.start(t);
    osc.stop(t + 3);
  } catch { toast('이 기기에서는 경보음을 낼 수 없어요'); }
}

// ---------- 주기 감시 ----------
function tickSessions(nowReal) {
  const w = activeSession();
  if (!w) return;
  const s = statusOf(w, nowReal);
  if (s.shouldAlert) {
    w.session.alertedAt = s.now;
    const names = guardianNames(w.session.sharedWith);
    if (names.length) {
      const c = course(w.courseId);
      textGuardians(w, `${state.me.name}님의 산책이 예정 시간(${fmtTime(w.session.expectedEnd)})보다 ${Math.round(s.overdueMin)}분 길어지고 있어요. 연락해 보세요. 마지막 위치: ${mapLink(positionAlongPath(c.path, s.progress), c.name)}`,
        `예정 시간이 지나 ${names.join(', ')}님에게 자동으로 알렸어요`, 'alert');
    } else logEvent(w, '예정 시간이 지났어요 (공유한 연락처 없음)', 'alert');
    notify(names.length ? `산책이 예정보다 길어져 ${names.join(', ')}님에게 알렸어요` : '산책 예정 시간이 지났어요. 괜찮으신가요?', { kind: 'alert', to: { name: 'live', id: w.id } });
  } else if (s.needCheckin && w.session.checkinAskedAt !== Math.floor(s.elapsedMin / state.settings.checkinMin)) {
    w.session.checkinAskedAt = Math.floor(s.elapsedMin / state.settings.checkinMin);
    save();
    if (route.name !== 'live') notify('안심 산책 중이에요. 괜찮으신가요? 체크인해 주세요', { kind: 'safety', to: { name: 'live', id: w.id } });
  }
}

// 다른 화면에 있어도 안심 산책 중임을 알려주는 띠
function liveBanner(r) {
  let el = $('#liveBanner');
  const w = activeSession();
  if (r.name !== 'live') clearInterval(liveTimer);
  if (!w || r.name === 'live' || r.name === 'onboarding') { el?.remove(); return; }
  if (!el) {
    el = document.createElement('button');
    el.id = 'liveBanner';
    el.className = 'live-banner';
    el.onclick = () => go('live', { id: activeSession()?.id });
    $('#topbar').after(el);
  }
  el.innerHTML = `<span class="pulse"></span>안심 산책 중 · ${esc(walkWho(w).title)}<span class="grow"></span>돌아가기 ›`;
}

registerView('live', renderLive);
onAfterRender(liveBanner);
onTick(tickSessions);

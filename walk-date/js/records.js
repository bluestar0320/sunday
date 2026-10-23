// 산책 기록: 함께 걸은 코스·거리·시간·사진·메모, 그리고 "또 같이 걸어요"
import { recordFromWalk, recordStats } from './logic.js';
import {
  $, state, save, esc, person, course, media, toast, openModal, closeModal, fmtDate, uid, groupById, notify,
} from './core.js';
import { icon, resizeImage } from './ui.js';
import { routeThumb } from './map.js';
import { openProposal, renderWalks } from './app.js';
import { openGroup } from './groups.js';

const MAX_RECORD_PHOTOS = 4;

export function createRecord(walk) {
  if (state.records.some((r) => r.walkId === walk.id)) return null;
  const rec = { id: uid('r'), ...recordFromWalk(walk, course(walk.courseId)) };
  state.records.unshift(rec);
  save();
  return rec;
}

export const recordsWith = (personId) => state.records.filter((r) => r.personId === personId);

function whoHtml(r) {
  if (r.groupId) {
    const g = groupById(r.groupId);
    return `${icon('users', 15)}${esc(g?.title || '동네 산책 모임')}`;
  }
  const p = person(r.personId);
  return `<span class="avatar xs">${media(p)}</span>${esc(p.name)} · ${esc(p.dog.name)}`;
}

function recordCard(r) {
  const c = course(r.courseId);
  return `<div class="record" data-rec="${r.id}">
    <div class="rec-top">
      <div class="rec-thumb">${routeThumb(c)}</div>
      <div class="grow">
        <div class="rec-date">${fmtDate(new Date(r.date).toISOString())}</div>
        <div class="rec-course">${esc(c.name)}</div>
        <div class="rec-who">${whoHtml(r)}</div>
      </div>
    </div>
    <div class="rec-nums"><span><b>${r.km}</b>km</span><span><b>${r.minutes}</b>분</span><span>${r.slot}</span></div>
    ${r.photos.length ? `<div class="rec-photos">${r.photos.map((src) => `<img src="${src}" alt="산책 사진" />`).join('')}</div>` : ''}
    ${r.memo ? `<p class="rec-memo">${esc(r.memo)}</p>` : ''}
    <div class="row">
      <button class="btn soft sm grow" data-rec-edit="${r.id}">${icon('camera', 16)}사진 · 메모</button>
      ${r.personId && !state.blocked.includes(r.personId)
        ? `<button class="btn accent sm grow" data-rec-again="${r.id}">${icon('heart', 16, 'filled')}또 같이 걸어요</button>`
        : r.groupId ? `<button class="btn soft sm grow" data-rec-group="${r.groupId}">${icon('users', 16)}모임 보기</button>` : ''}
    </div>
  </div>`;
}

export function renderRecords(root) {
  const list = state.records;
  const st = recordStats(list);
  root.insertAdjacentHTML('beforeend', `
    <div class="rec-stats">
      <div><b>${st.count}</b><span>산책</span></div>
      <div><b>${st.km}</b><span>km</span></div>
      <div><b>${st.minutes >= 60 ? `${Math.floor(st.minutes / 60)}<small>시간</small> ` : ''}${st.minutes % 60}<small>분</small></b><span>함께 걸은 시간</span></div>
      <div><b>${st.friends}</b><span>산책 친구</span></div>
    </div>
    ${list.length ? `<div class="stack" id="recList">${list.map(recordCard).join('')}</div>`
      : `<div class="empty" style="padding-top:32px"><div class="ic-wrap">${icon('history', 30)}</div><strong>아직 산책 기록이 없어요</strong>산책을 마치면 코스와 거리, 사진이 여기에 남아요.</div>`}`);
  $('#recList', root)?.addEventListener('click', (e) => {
    const edit = e.target.closest('[data-rec-edit]');
    const again = e.target.closest('[data-rec-again]');
    const grp = e.target.closest('[data-rec-group]');
    if (edit) openRecordEdit(edit.dataset.recEdit);
    if (again) walkAgain(state.records.find((r) => r.id === again.dataset.recAgain));
    if (grp) openGroup(grp.dataset.recGroup);
  });
}

export function walkAgain(r) {
  openProposal(person(r.personId), { courseId: r.courseId });
}

function pickImages() {
  return new Promise((resolve) => {
    const input = $('#fileInput');
    input.value = '';
    input.onchange = () => resolve([...input.files]);
    input.click();
  });
}

export function openRecordEdit(id) {
  const r = state.records.find((x) => x.id === id);
  openModal('', (root) => {
    const draw = () => {
      const memo = $('#rec-memo', root)?.value ?? r.memo;
      root.innerHTML = `
        <h3>산책 기록 남기기</h3>
        <p class="desc">${esc(course(r.courseId).name)} · ${fmtDate(new Date(r.date).toISOString())}</p>
        <div class="label">사진 <span class="muted small" style="font-weight:400">최대 ${MAX_RECORD_PHOTOS}장</span></div>
        <div class="photo-grid" id="recPhotos">
          ${r.photos.map((src, i) => `<div class="photo-slot"><img class="photo" src="${src}" alt="산책 사진 ${i + 1}" /><button class="rm" data-rm="${i}" aria-label="사진 삭제">${icon('x', 14)}</button></div>`).join('')}
          ${r.photos.length < MAX_RECORD_PHOTOS ? `<button class="photo-slot add" id="recAdd">${icon('camera', 22)}<span>${r.photos.length}/${MAX_RECORD_PHOTOS}</span></button>` : ''}
        </div>
        <div class="field" style="margin-top:18px"><label for="rec-memo">메모</label><textarea class="input" id="rec-memo" maxlength="200" placeholder="예: 보리랑 초코가 금방 친해졌어요. 다음엔 카페도 가기로!">${esc(memo)}</textarea></div>
        <div class="sheet-foot"><button class="btn accent" id="recSave">저장</button></div>`;
      $('#recPhotos', root).onclick = async (e) => {
        const rm = e.target.closest('[data-rm]');
        if (rm) { r.photos.splice(Number(rm.dataset.rm), 1); save(); draw(); return; }
        if (!e.target.closest('#recAdd')) return;
        r.memo = $('#rec-memo', root).value;
        for (const f of await pickImages()) {
          if (r.photos.length >= MAX_RECORD_PHOTOS) break;
          if (!f.type.startsWith('image/')) continue;
          try {
            r.photos.push(await resizeImage(f, 600, 0.75));
            if (!save()) { r.photos.pop(); break; }
          } catch { toast('이미지를 읽지 못했어요'); }
        }
        draw();
      };
      $('#recSave', root).onclick = () => {
        r.memo = $('#rec-memo', root).value.trim();
        save();
        closeModal();
        toast('산책 기록을 저장했어요');
        renderWalks();
      };
    };
    draw();
  });
}

// 평가에서 "또 만나고 싶어요"를 골랐고 상대도 같은 마음일 때 (데모: 별점 4점 이상이면 상대도 원함)
export function offerSecondWalk(walk, review) {
  const p = person(walk.personId);
  if (review.again !== '또 만나고 싶어요' || review.rating < 4) return false;
  notify(`${p.name}님도 또 만나고 싶어해요! 두 번째 산책을 제안해 보세요`, { kind: 'match', to: { name: 'walks', tab: 'records' } });
  openModal(`
    <div class="match-pop">
      <div class="pair"><div>${media(state.me)}</div><div>${media(p)}</div></div>
      <h3>두 분 모두 또 걷고 싶어해요</h3>
      <p class="desc">${esc(p.name)}님도 ${esc(state.me.dog.name)}와(과)의 산책이 즐거웠대요.<br/>같은 코스로 두 번째 산책을 제안해 볼까요?</p>
      <div class="stack">
        <button class="btn accent" id="again">${icon('heart', 18, 'filled')}두 번째 산책 제안하기</button>
        <button class="btn text" id="later">나중에</button>
      </div>
    </div>`, (root) => {
    $('#again', root).onclick = () => openProposal(p, { courseId: walk.courseId });
    $('#later', root).onclick = closeModal;
  });
  return true;
}

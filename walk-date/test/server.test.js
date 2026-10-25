import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { toGrid, baseDateTime, parseForecast, forecastUrl } from '../server/kma.js';
import { solapiAuthHeader, isMobile } from '../server/sms.js';
import { createServer, config } from '../server/server.js';

test('toGrid: 서울시청 좌표는 기상청 격자 (60, 127)', () => {
  assert.deepEqual(toGrid(37.5665, 126.978), { nx: 60, ny: 127 });
});

test('baseDateTime: 발표 후 10분부터, 새벽 2시 10분 전에는 전날 23시 발표', () => {
  assert.deepEqual(baseDateTime(new Date('2026-10-25T00:05:00Z')), { base_date: '20261025', base_time: '0800' }); // KST 09:05
  assert.deepEqual(baseDateTime(new Date('2026-10-24T23:15:00Z')), { base_date: '20261025', base_time: '0800' }); // KST 08:15
  assert.deepEqual(baseDateTime(new Date('2026-10-24T23:05:00Z')), { base_date: '20261025', base_time: '0500' }); // KST 08:05
  assert.deepEqual(baseDateTime(new Date('2026-10-24T17:05:00Z')), { base_date: '20261024', base_time: '2300' }); // KST 02:05
});

test('parseForecast: 시각별로 강수확률·하늘·강수·기온을 묶는다', () => {
  const items = [
    { category: 'POP', fcstDate: '20261025', fcstTime: '1800', fcstValue: '70' },
    { category: 'SKY', fcstDate: '20261025', fcstTime: '1800', fcstValue: '4' },
    { category: 'PTY', fcstDate: '20261025', fcstTime: '1800', fcstValue: '1' },
    { category: 'TMP', fcstDate: '20261025', fcstTime: '1800', fcstValue: '14' },
    { category: 'POP', fcstDate: '20261025', fcstTime: '0700', fcstValue: '10' },
    { category: 'SKY', fcstDate: '20261025', fcstTime: '0700', fcstValue: '1' },
    { category: 'WSD', fcstDate: '20261025', fcstTime: '0700', fcstValue: '2' },
  ];
  assert.deepEqual(parseForecast(items), [
    { date: '2026-10-25', hour: 7, pop: 10, sky: '맑음' },
    { date: '2026-10-25', hour: 18, pop: 70, sky: '흐림', rain: true, tmp: 14 },
  ]);
  const url = forecastUrl('KEY%2B', 37.5665, 126.978, new Date('2026-10-25T00:05:00Z'));
  assert.ok(url.includes('serviceKey=KEY%2B&') && url.includes('nx=60') && url.includes('ny=127') && url.includes('base_time=0800'));
});

test('solapiAuthHeader: date+salt를 비밀키로 HMAC-SHA256 서명', () => {
  const h = solapiAuthHeader('KEY', 'SECRET', '2026-10-25T00:00:00.000Z', 'abc');
  const sig = crypto.createHmac('sha256', 'SECRET').update('2026-10-25T00:00:00.000Zabc').digest('hex');
  assert.equal(h, `HMAC-SHA256 apiKey=KEY, date=2026-10-25T00:00:00.000Z, salt=abc, signature=${sig}`);
  assert.equal(isMobile('010-1234-5678'), true);
  assert.equal(isMobile('02-123-4567'), false);
});

async function withServer(cfg, opts, fn) {
  const server = createServer(cfg, opts);
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try { await fn(base); } finally { server.close(); }
}
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('서버: 키가 없으면 서비스는 503, 앱 파일은 제공, 비밀 파일은 막는다', async () => {
  await withServer(config({}), {}, async (base) => {
    assert.deepEqual(await (await fetch(`${base}/api/health`)).json(), { weather: false, sms: false, verify: false });
    assert.equal((await fetch(`${base}/api/weather?lat=37.55&lng=126.9`)).status, 503);
    assert.equal((await post(`${base}/api/sms`, { to: ['01012345678'], text: 'hi' })).status, 503);
    const index = await fetch(`${base}/`);
    assert.equal(index.status, 200);
    assert.ok((await index.text()).includes('같이걸을개'));
    assert.equal((await fetch(`${base}/.env.example`)).status, 403);
    assert.equal((await fetch(`${base}/server/server.js`)).status, 403);
    assert.equal((await fetch(`${base}/../../etc/passwd`)).status, 404);
  });
});

test('서버: 날씨 중계와 문자·인증 흐름 (외부 호출은 가짜로 대체)', async () => {
  const sent = [];
  const fetchImpl = async () => ({ json: async () => ({ response: { body: { items: { item: [
    { category: 'POP', fcstDate: '20261025', fcstTime: '1800', fcstValue: '30' },
    { category: 'SKY', fcstDate: '20261025', fcstTime: '1800', fcstValue: '3' },
  ] } } } }) });
  const smsImpl = async (_cfg, to, text) => { sent.push({ to, text }); };
  const cfg = config({ KMA_SERVICE_KEY: 'k', SOLAPI_API_KEY: 'a', SOLAPI_API_SECRET: 'b', SOLAPI_SENDER: '01000000000' });
  await withServer(cfg, { fetchImpl, smsImpl }, async (base) => {
    assert.deepEqual(await (await fetch(`${base}/api/health`)).json(), { weather: true, sms: true, verify: true });
    const w = await (await fetch(`${base}/api/weather?lat=37.55&lng=126.9`)).json();
    assert.deepEqual(w.forecasts, [{ date: '2026-10-25', hour: 18, pop: 30, sky: '구름많음' }]);
    assert.equal((await fetch(`${base}/api/weather?lat=10&lng=10`)).status, 400);

    assert.equal((await post(`${base}/api/sms`, { to: ['02-123-4567'], text: 'hi' })).status, 400);
    const ok = await post(`${base}/api/sms`, { to: ['010-1111-2222', '01033334444'], text: '산책 시작' });
    assert.equal(ok.status, 200);
    assert.deepEqual(sent[0], { to: ['010-1111-2222', '01033334444'], text: '[같이걸을개] 산책 시작' });

    assert.equal((await post(`${base}/api/verify/send`, { phone: '010-5555-6666' })).status, 200);
    const code = sent.at(-1).text.match(/\d{6}/)[0];
    assert.equal((await post(`${base}/api/verify/check`, { phone: '01055556666', code: code === '000000' ? '111111' : '000000' })).status, 400);
    const good = await (await post(`${base}/api/verify/check`, { phone: '01055556666', code })).json();
    assert.equal(good.ok, true);
    // 한 번 쓴 인증번호는 다시 쓸 수 없다
    assert.equal((await post(`${base}/api/verify/check`, { phone: '01055556666', code })).status, 400);
  });
});

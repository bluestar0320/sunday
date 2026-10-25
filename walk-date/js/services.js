// 실제 서비스(서버 /api) 연결. 서버나 키가 없으면 null을 돌려주고, 호출한 쪽은 데모로 동작한다.
import { CONFIG } from './config.js';
import { forecastFor } from './logic.js';

let health = { weather: false, sms: false, verify: false };
const weatherCache = new Map(); // 'YYYY-MM-DD' → [{ hour, pop, sky, rain, tmp }]
const listeners = [];

async function call(path, { method = 'GET', body } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`${CONFIG.apiBase}${path}`, {
      method, signal: ctrl.signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: {} };
  } finally {
    clearTimeout(timer);
  }
}

export const services = () => health;
export function onServicesChange(fn) { listeners.push(fn); }

// 앱 시작 시 한 번: 서버가 어떤 서비스를 연결했는지 확인하고, 날씨를 받아 둔다
export async function initServices(location) {
  const r = await call('/api/health');
  if (r.ok) health = { weather: Boolean(r.data.weather), sms: Boolean(r.data.sms), verify: Boolean(r.data.verify) };
  if (health.weather && location) await refreshWeather(location);
  listeners.forEach((fn) => fn(health));
  return health;
}

export async function refreshWeather({ lat, lng }) {
  const r = await call(`/api/weather?lat=${lat}&lng=${lng}`);
  if (!r.ok || !Array.isArray(r.data.forecasts)) return false;
  weatherCache.clear();
  for (const f of r.data.forecasts) {
    if (!weatherCache.has(f.date)) weatherCache.set(f.date, []);
    weatherCache.get(f.date).push(f);
  }
  return true;
}

const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// 화면에서 쓰는 예보: 기상청 예보가 있으면 그 날·그 시간에 가장 가까운 값, 없으면 데모 예보
export function weatherFor(date) {
  const d = new Date(date);
  const list = weatherCache.get(dateKey(d));
  if (!list?.length) return { ...forecastFor(d), real: false };
  const hour = d.getHours() || 12;
  const f = list.reduce((a, b) => (Math.abs(b.hour - hour) < Math.abs(a.hour - hour) ? b : a));
  const rainy = f.rain || f.pop >= 60;
  return {
    rainProb: f.pop, rainy, tempC: f.tmp ?? null, real: true,
    sky: rainy ? '비' : f.sky === '맑음' ? '맑음' : '흐림',
  };
}
export const hasRealWeather = () => weatherCache.size > 0;

// 문자 보내기. 실제로 보냈으면 true, 데모면 false
export async function sendSms(to, text) {
  if (!health.sms || !to.length) return false;
  const r = await call('/api/sms', { method: 'POST', body: { to, text } });
  return r.ok;
}

// 휴대폰 인증번호 받기 / 확인. 서버가 없으면 { demo: true } (데모 인증번호 123456)
export async function requestCode(phone) {
  if (!health.verify) return { demo: true };
  const r = await call('/api/verify/send', { method: 'POST', body: { phone } });
  return r.ok ? { ok: true } : { ok: false, error: r.data.error || '인증번호를 보내지 못했어요' };
}

export async function checkCode(phone, code) {
  if (!health.verify) return { ok: code === '123456', demo: true, error: '인증번호가 맞지 않아요' };
  const r = await call('/api/verify/check', { method: 'POST', body: { phone, code } });
  return { ok: Boolean(r.data.ok), error: r.data.error };
}

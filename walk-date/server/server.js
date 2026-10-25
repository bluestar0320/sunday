// 같이걸을개 서버: 앱 파일 제공 + 실제 서비스 중계 (기상청 날씨, 문자 발송, 휴대폰 인증)
// 외부 패키지 없이 Node 18+ 만으로 실행: node server/server.js
// 키는 walk-date/.env 또는 환경변수로 넣는다 (.env.example 참고). 키가 없는 기능은 503을 돌려주고, 앱은 데모로 동작한다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { forecastUrl, parseForecast } from './kma.js';
import { sendSms, isMobile, normalizeTo } from './sms.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// .env 읽기 (KEY=VALUE, # 주석)
function loadEnv(file = path.join(ROOT, '.env')) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

export function config(env = process.env) {
  return {
    port: Number(env.PORT || 8080),
    kmaKey: env.KMA_SERVICE_KEY || '',
    sms: env.SOLAPI_API_KEY && env.SOLAPI_API_SECRET && env.SOLAPI_SENDER
      ? { apiKey: env.SOLAPI_API_KEY, apiSecret: env.SOLAPI_API_SECRET, from: env.SOLAPI_SENDER } : null,
  };
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
};

const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

function readJson(req, limit = 10_000) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > limit) { reject(new Error('too large')); req.destroy(); } });
    req.on('end', () => { try { resolve(data ? JSON.parse(data) : {}); } catch { reject(new Error('bad json')); } });
    req.on('error', reject);
  });
}

// 아주 단순한 IP별 요청 제한 (문자 남용 방지). 실서비스에서는 로그인 사용자 기준으로 제한할 것
function rateLimiter(max, windowMs) {
  const hits = new Map();
  return (key, now = Date.now()) => {
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) return false;
    list.push(now);
    hits.set(key, list);
    return true;
  };
}

export function createServer(cfg = config(), { fetchImpl = fetch, smsImpl = sendSms } = {}) {
  const smsLimit = rateLimiter(10, 60_000);
  const codes = new Map(); // 휴대폰 인증번호 { phone: { code, exp, tries } }
  let weatherCache = new Map();

  async function api(req, res, url) {
    const ip = req.socket.remoteAddress || 'local';

    if (url.pathname === '/api/health') {
      return send(res, 200, { weather: Boolean(cfg.kmaKey), sms: Boolean(cfg.sms), verify: Boolean(cfg.sms) });
    }

    if (url.pathname === '/api/weather' && req.method === 'GET') {
      if (!cfg.kmaKey) return send(res, 503, { error: 'KMA_SERVICE_KEY가 없어요' });
      const lat = Number(url.searchParams.get('lat'));
      const lng = Number(url.searchParams.get('lng'));
      if (!(lat > 33 && lat < 39 && lng > 124 && lng < 132)) return send(res, 400, { error: '한국 안의 좌표가 아니에요' });
      const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
      const cached = weatherCache.get(key);
      if (cached && Date.now() - cached.at < 30 * 60_000) return send(res, 200, cached.body);
      try {
        const r = await fetchImpl(forecastUrl(cfg.kmaKey, lat, lng));
        const json = await r.json();
        const items = json?.response?.body?.items?.item;
        if (!Array.isArray(items)) return send(res, 502, { error: json?.response?.header?.resultMsg || '기상청 응답 오류' });
        const body = { source: '기상청 단기예보', forecasts: parseForecast(items) };
        weatherCache.set(key, { at: Date.now(), body });
        return send(res, 200, body);
      } catch (err) {
        return send(res, 502, { error: String(err.message || err) });
      }
    }

    if (url.pathname === '/api/sms' && req.method === 'POST') {
      if (!cfg.sms) return send(res, 503, { error: '문자 발송 키가 없어요' });
      if (!smsLimit(ip)) return send(res, 429, { error: '잠시 후 다시 시도해 주세요' });
      const { to, text } = await readJson(req).catch(() => ({}));
      const list = Array.isArray(to) ? to.filter(isMobile).slice(0, 3) : [];
      if (!list.length || typeof text !== 'string' || !text.trim() || text.length > 300) return send(res, 400, { error: '받는 사람이나 내용이 올바르지 않아요' });
      try {
        await smsImpl(cfg.sms, list, `[같이걸을개] ${text.trim()}`);
        return send(res, 200, { ok: true, sent: list.length });
      } catch (err) {
        return send(res, 502, { error: String(err.message || err) });
      }
    }

    if (url.pathname === '/api/verify/send' && req.method === 'POST') {
      if (!cfg.sms) return send(res, 503, { error: '문자 발송 키가 없어요' });
      if (!smsLimit(ip)) return send(res, 429, { error: '잠시 후 다시 시도해 주세요' });
      const { phone } = await readJson(req).catch(() => ({}));
      if (!isMobile(phone)) return send(res, 400, { error: '휴대폰 번호를 확인해 주세요' });
      const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
      codes.set(normalizeTo(phone), { code, exp: Date.now() + 3 * 60_000, tries: 0 });
      try {
        await smsImpl(cfg.sms, [phone], `[같이걸을개] 인증번호 ${code} (3분 안에 입력해 주세요)`);
        return send(res, 200, { ok: true });
      } catch (err) {
        return send(res, 502, { error: String(err.message || err) });
      }
    }

    if (url.pathname === '/api/verify/check' && req.method === 'POST') {
      const { phone, code } = await readJson(req).catch(() => ({}));
      const entry = codes.get(normalizeTo(phone));
      if (!entry || Date.now() > entry.exp) return send(res, 400, { ok: false, error: '인증번호가 만료됐어요. 다시 받아주세요' });
      entry.tries += 1;
      if (entry.tries > 5) { codes.delete(normalizeTo(phone)); return send(res, 429, { ok: false, error: '시도 횟수를 넘었어요. 다시 받아주세요' }); }
      if (String(code) !== entry.code) return send(res, 400, { ok: false, error: '인증번호가 맞지 않아요' });
      codes.delete(normalizeTo(phone));
      return send(res, 200, { ok: true });
    }

    return send(res, 404, { error: 'not found' });
  }

  function serveStatic(req, res, url) {
    let file = path.normalize(path.join(ROOT, decodeURIComponent(url.pathname)));
    if (!file.startsWith(ROOT) || file.includes(`${path.sep}server${path.sep}`) || path.basename(file).startsWith('.')) {
      res.writeHead(403); res.end(); return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  }

  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      api(req, res, url).catch((err) => send(res, 500, { error: String(err.message || err) }));
    } else {
      serveStatic(req, res, url);
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  loadEnv();
  const cfg = config();
  createServer(cfg).listen(cfg.port, () => {
    console.log(`같이걸을개 http://localhost:${cfg.port}`);
    console.log(`  기상청 날씨: ${cfg.kmaKey ? '연결됨' : '키 없음 → 데모 예보'}`);
    console.log(`  문자 발송·휴대폰 인증: ${cfg.sms ? '연결됨' : '키 없음 → 데모'}`);
  });
}

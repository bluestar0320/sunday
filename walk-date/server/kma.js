// 기상청 단기예보(동네예보) API 도우미
// https://www.data.go.kr/data/15084084/openapi.do (VilageFcstInfoService_2.0/getVilageFcst)

// 위경도 → 기상청 격자(nx, ny) 변환 (LCC 투영, 기상청 공식 변환식)
export function toGrid(lat, lng) {
  const RE = 6371.00877; const GRID = 5.0; const SLAT1 = 30.0; const SLAT2 = 60.0;
  const OLON = 126.0; const OLAT = 38.0; const XO = 43; const YO = 136;
  const DEG = Math.PI / 180;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEG; const slat2 = SLAT2 * DEG; const olon = OLON * DEG; const olat = OLAT * DEG;
  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);
  let ra = Math.tan(Math.PI * 0.25 + lat * DEG * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = lng * DEG - olon;
  if (theta > Math.PI) theta -= 2 * Math.PI;
  if (theta < -Math.PI) theta += 2 * Math.PI;
  theta *= sn;
  return { nx: Math.floor(ra * Math.sin(theta) + XO + 0.5), ny: Math.floor(ro - ra * Math.cos(theta) + YO + 0.5) };
}

const pad = (n) => String(n).padStart(2, '0');

// 가장 최근 발표 시각 (02·05·08·11·14·17·20·23시, 발표 후 10분부터 조회 가능). now는 UTC 기준 Date
export function baseDateTime(now = new Date()) {
  const kst = new Date(now.getTime() + 9 * 3600000);
  const minutes = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  const bases = [2, 5, 8, 11, 14, 17, 20, 23];
  let hour = bases.filter((h) => minutes >= h * 60 + 10).pop();
  if (hour === undefined) {
    kst.setUTCDate(kst.getUTCDate() - 1);
    hour = 23;
  }
  return {
    base_date: `${kst.getUTCFullYear()}${pad(kst.getUTCMonth() + 1)}${pad(kst.getUTCDate())}`,
    base_time: `${pad(hour)}00`,
  };
}

const SKY = { 1: '맑음', 3: '구름많음', 4: '흐림' };

// API 응답 item 목록 → 시각별 예보 [{ date: 'YYYY-MM-DD', hour, pop, sky, rain, tmp }]
export function parseForecast(items) {
  const byTime = new Map();
  for (const it of items) {
    const key = `${it.fcstDate}${it.fcstTime}`;
    if (!byTime.has(key)) {
      byTime.set(key, {
        date: `${it.fcstDate.slice(0, 4)}-${it.fcstDate.slice(4, 6)}-${it.fcstDate.slice(6, 8)}`,
        hour: Number(it.fcstTime.slice(0, 2)),
      });
    }
    const f = byTime.get(key);
    if (it.category === 'POP') f.pop = Number(it.fcstValue);
    if (it.category === 'SKY') f.sky = SKY[it.fcstValue] || '흐림';
    if (it.category === 'PTY') f.rain = Number(it.fcstValue) > 0; // 강수형태: 0 없음, 1 비, 2 비/눈, 3 눈, 4 소나기
    if (it.category === 'TMP') f.tmp = Number(it.fcstValue);
  }
  return [...byTime.values()].filter((f) => f.pop !== undefined).sort((a, b) => (a.date + pad(a.hour)).localeCompare(b.date + pad(b.hour)));
}

export function forecastUrl(serviceKey, lat, lng, now = new Date()) {
  const { nx, ny } = toGrid(lat, lng);
  const q = new URLSearchParams({ pageNo: '1', numOfRows: '1000', dataType: 'JSON', ...baseDateTime(now), nx: String(nx), ny: String(ny) });
  // serviceKey는 공공데이터포털에서 받은 '인코딩' 키를 그대로 붙인다 (다시 인코딩하면 인증 오류)
  return `https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${serviceKey}&${q}`;
}

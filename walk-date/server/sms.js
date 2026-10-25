// 문자 발송 (솔라피 Solapi). https://developers.solapi.com
import crypto from 'node:crypto';

// 솔라피 인증 헤더: HMAC-SHA256(date + salt, apiSecret)
export function solapiAuthHeader(apiKey, apiSecret, date = new Date().toISOString(), salt = crypto.randomBytes(16).toString('hex')) {
  const signature = crypto.createHmac('sha256', apiSecret).update(date + salt).digest('hex');
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

export const normalizeTo = (phone) => String(phone || '').replace(/\D/g, '');
export const isMobile = (phone) => /^01[016789]\d{7,8}$/.test(normalizeTo(phone));

export async function sendSms({ apiKey, apiSecret, from }, to, text) {
  const messages = to.map((t) => ({ to: normalizeTo(t), from: normalizeTo(from), text }));
  const res = await fetch('https://api.solapi.com/messages/v4/send-many/detail', {
    method: 'POST',
    headers: { Authorization: solapiAuthHeader(apiKey, apiSecret), 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  if (!res.ok) throw new Error(`Solapi ${res.status}: ${await res.text()}`);
  return res.json();
}

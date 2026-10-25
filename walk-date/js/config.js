// 실제 서비스 연결 설정
// - 날씨·문자·휴대폰 인증 키는 보안상 브라우저가 아니라 서버(.env)에 넣는다. (server/server.js)
// - 카카오 지도는 브라우저에서 쓰는 'JavaScript 키'라 여기에 넣는다.
//   카카오 개발자 사이트 > 내 애플리케이션 > 플랫폼 > Web 에 이 앱의 주소(도메인)를 등록해야 지도가 보인다.
// 비워 두면 해당 기능은 데모로 동작한다.
export const CONFIG = {
  apiBase: '',     // 서버 주소. 같은 서버에서 앱을 열면 '' 그대로
  kakaoMapKey: '', // 카카오 지도 JavaScript 키
  ...(typeof window !== 'undefined' ? window.WALKDATE_CONFIG : {}),
};

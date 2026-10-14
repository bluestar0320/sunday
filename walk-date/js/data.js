// 데모용 샘플 데이터 (마포구 일대)

// 산책 코스 + 안전 정보
// crowd: 시간대별 유동인구 (0 드묾, 1 보통, 2 많음) / lighting: 야간 조명 (0 어두움, 1 보통, 2 밝음)
// storeM / policeM: 가장 가까운 편의점 / 지구대(안심지킴이집) 거리(m)
export const COURSES = [
  {
    id: 'c1', name: '망원한강공원 잔디길', type: '한강공원', lat: 37.5550, lng: 126.8950, lengthKm: 2.4, minutes: 40,
    note: '넓은 잔디, 반려견 놀이터 인근',
    safety: { crowd: { '이른 아침': 1, '점심': 1, '저녁': 2, '밤': 1 }, lighting: 2, cctv: true, openView: true, storeM: 150, policeM: 600 },
  },
  {
    id: 'c2', name: '경의선숲길 연남구간', type: '공원길', lat: 37.5605, lng: 126.9235, lengthKm: 1.8, minutes: 30,
    note: '카페 많고 저녁에도 북적여요',
    safety: { crowd: { '이른 아침': 1, '점심': 2, '저녁': 2, '밤': 2 }, lighting: 2, cctv: true, openView: true, storeM: 50, policeM: 400 },
  },
  {
    id: 'c3', name: '평화의공원 호수 둘레길', type: '공원', lat: 37.5640, lng: 126.8960, lengthKm: 2.1, minutes: 35,
    note: '호수 둘레길, 주차 가능',
    safety: { crowd: { '이른 아침': 1, '점심': 2, '저녁': 1, '밤': 0 }, lighting: 1, cctv: true, openView: true, storeM: 400, policeM: 900 },
  },
  {
    id: 'c4', name: '하늘공원 억새길', type: '공원', lat: 37.5680, lng: 126.8850, lengthKm: 3.2, minutes: 60,
    note: '억새가 키보다 높고 계단이 많아요',
    safety: { crowd: { '이른 아침': 1, '점심': 1, '저녁': 0, '밤': 0 }, lighting: 0, cctv: false, openView: false, storeM: 1200, policeM: 1500 },
  },
  {
    id: 'c5', name: '절두산 한강 산책로', type: '한강공원', lat: 37.5450, lng: 126.9100, lengthKm: 2.0, minutes: 35,
    note: '노을 명소, 자전거 도로 인접',
    safety: { crowd: { '이른 아침': 1, '점심': 1, '저녁': 1, '밤': 0 }, lighting: 1, cctv: true, openView: true, storeM: 350, policeM: 800 },
  },
  {
    id: 'c6', name: '서교동 카페거리 루프', type: '도심', lat: 37.5530, lng: 126.9180, lengthKm: 1.5, minutes: 25,
    note: '반려견 동반 카페, 산책 후 쉬기 좋아요',
    safety: { crowd: { '이른 아침': 0, '점심': 2, '저녁': 2, '밤': 2 }, lighting: 2, cctv: true, openView: true, storeM: 30, policeM: 300 },
  },
  {
    id: 'c7', name: '망원동 주택가 골목길', type: '골목', lat: 37.5585, lng: 126.9050, lengthKm: 1.2, minutes: 20,
    note: '조용한 주택가, 차량 통행 적음',
    safety: { crowd: { '이른 아침': 0, '점심': 1, '저녁': 1, '밤': 0 }, lighting: 0, cctv: false, openView: false, storeM: 200, policeM: 700 },
  },
  {
    id: 'c8', name: '성미산 숲길', type: '숲길', lat: 37.5660, lng: 126.9110, lengthKm: 1.9, minutes: 40,
    note: '숲 그늘 오르막, 흙길',
    safety: { crowd: { '이른 아침': 1, '점심': 1, '저녁': 0, '밤': 0 }, lighting: 0, cctv: false, openView: false, storeM: 600, policeM: 1100 },
  },
];

export const PEOPLE = [
  {
    id: 'p1', name: '지수', gender: '여성', birthYear: 1995, job: 'UX 디자이너',
    bio: '퇴근 후 망원한강에서 노을 보며 걷는 게 낙이에요. 커피 좋아해요 ☕',
    location: { lat: 37.5565, lng: 126.9010 }, walkTimes: ['저녁', '밤'],
    interests: ['카페', '사진', '전시'], art: { fur: '#E0A061', muzzle: '#FFF3E4', ear: 'pointy', bg: '#F6E7D8', collar: '#3B82F6' },
    dog: { name: '보리', breed: '웰시코기', size: '중형', age: 3, energy: '활발', friendly: true, traits: ['사람 좋아함', '공놀이 광'] },
    likes: ['me'],
  },
  {
    id: 'p2', name: '민준', gender: '남성', birthYear: 1993, job: '개발자',
    bio: '재택근무라 점심 산책 자주 나가요. 같이 걸을 산책 메이트 구해요!',
    location: { lat: 37.5600, lng: 126.9100 }, walkTimes: ['점심', '저녁'],
    interests: ['러닝', '캠핑', '보드게임'], art: { fur: '#D98E4E', muzzle: '#FBEBD9', ear: 'pointy', bg: '#EAF0E6', collar: '#DC2626' },
    dog: { name: '콩이', breed: '시바견', size: '중형', age: 4, energy: '보통', friendly: true, traits: ['독립적', '간식에 진심'] },
    likes: [],
  },
  {
    id: 'p3', name: '서연', gender: '여성', birthYear: 1997, job: '초등교사',
    bio: '주말 아침 일찍 공원 한 바퀴 돌아요. 소형견 친구 환영해요 🌸',
    location: { lat: 37.5640, lng: 126.8990 }, walkTimes: ['이른 아침', '저녁'],
    interests: ['독서', '베이킹', '요가'], art: { fur: '#FFFFFF', muzzle: '#FFFFFF', ear: 'floppy', earColor: '#F1E6DA', bg: '#F7E6EA', collar: '#EC4899' },
    dog: { name: '몽이', breed: '말티즈', size: '소형', age: 2, energy: '보통', friendly: true, traits: ['애교쟁이', '겁 조금 많음'] },
    likes: ['me'],
  },
  {
    id: 'p4', name: '도현', gender: '남성', birthYear: 1991, job: '셰프',
    bio: '대형견이랑 살아요. 하늘공원 억새길 걷는 거 좋아합니다.',
    location: { lat: 37.5700, lng: 126.8880 }, walkTimes: ['이른 아침', '밤'],
    interests: ['요리', '캠핑', '등산'], art: { fur: '#E7B56E', muzzle: '#F6D9A8', ear: 'floppy', earColor: '#D69E52', bg: '#E4EBF5', collar: '#15803D' },
    dog: { name: '하루', breed: '골든 리트리버', size: '대형', age: 5, energy: '활발', friendly: true, traits: ['순둥이', '수영 좋아함'] },
    likes: ['me'],
  },
  {
    id: 'p5', name: '하은', gender: '여성', birthYear: 1994, job: '마케터',
    bio: '연남동 숲길 산책하고 카페 가는 루트 추천해 드릴게요!',
    location: { lat: 37.5620, lng: 126.9220 }, walkTimes: ['저녁'],
    interests: ['카페', '맛집', '사진'], art: { fur: '#FFFDF9', muzzle: '#FFFFFF', ear: 'floppy', earColor: '#F3ECE4', bg: '#ECE6F6', collar: '#8B5CF6' },
    dog: { name: '두부', breed: '비숑 프리제', size: '소형', age: 1, energy: '활발', friendly: true, traits: ['솜사탕', '에너지 폭발'] },
    likes: [],
  },
  {
    id: 'p6', name: '준호', gender: '남성', birthYear: 1996, job: '대학원생',
    bio: '조용히 걷는 산책 좋아해요. 아이가 낯을 가려서 천천히 친해져요.',
    location: { lat: 37.5480, lng: 126.9130 }, walkTimes: ['밤'],
    interests: ['독서', '음악', '전시'], art: { fur: '#C9A27A', muzzle: '#EFE2D2', ear: 'pointy', bg: '#E5EFEC', collar: '#0F766E' },
    dog: { name: '단비', breed: '진돗개 믹스', size: '중형', age: 6, energy: '느긋', friendly: false, traits: ['의젓함', '낯가림'] },
    likes: ['me'],
  },
  {
    id: 'p7', name: '유나', gender: '여성', birthYear: 1992, job: '간호사',
    bio: '교대 근무라 평일 낮 산책 가능해요. 대형견 친구 대환영!',
    location: { lat: 37.5580, lng: 126.8970 }, walkTimes: ['점심', '이른 아침'],
    interests: ['등산', '러닝', '맛집'], art: { fur: '#2E2A28', muzzle: '#FFFFFF', ear: 'floppy', earColor: '#2E2A28', bg: '#F5EEDC', collar: '#F59E0B', spot: '#FFFFFF' },
    dog: { name: '태풍', breed: '보더 콜리', size: '대형', age: 3, energy: '활발', friendly: true, traits: ['천재견', '원반 마스터'] },
    likes: [],
  },
  {
    id: 'p8', name: '태윤', gender: '남성', birthYear: 1995, job: '사진작가',
    bio: '산책하면서 강아지 사진 찍어드려요 📷 망원 근처 살아요.',
    location: { lat: 37.5540, lng: 126.9040 }, walkTimes: ['저녁', '점심'],
    interests: ['사진', '카페', '여행'], art: { fur: '#9B6B4A', muzzle: '#B98563', ear: 'floppy', earColor: '#7E5236', bg: '#F4E9E1', collar: '#0EA5E9' },
    dog: { name: '쿠키', breed: '푸들', size: '소형', age: 4, energy: '보통', friendly: true, traits: ['모델견', '얌전함'] },
    likes: ['me'],
  },
];

export const DEFAULT_ME = {
  id: 'me', name: '', gender: '여성', lookingFor: '남성', birthYear: 1995, job: '',
  bio: '', location: { lat: 37.5560, lng: 126.9060 }, walkTimes: ['저녁'],
  interests: [], safeMode: true,
  art: { fur: '#E8C9A0', muzzle: '#FFF6EA', ear: 'floppy', earColor: '#D7AE7C', bg: '#F3EEE8', collar: '#FF6B3D' },
  dog: { name: '', breed: '', size: '소형', age: 2, energy: '보통', friendly: true, traits: [], photos: [] },
};

export const INTERESTS = ['카페', '사진', '전시', '러닝', '캠핑', '보드게임', '독서', '베이킹', '요가', '요리', '등산', '맛집', '음악', '여행'];

// 상대방 자동 답장 (데모용)
export const AUTO_REPLIES = [
  '좋아요! {dog}도 {myDog} 만나면 엄청 좋아할 것 같아요 🐾',
  '저희 아이는 처음엔 조금 냄새 맡으면서 인사해요 ㅎㅎ',
  '산책 끝나고 근처 카페에서 커피 한잔 어때요?',
  '간식 챙겨갈게요! 혹시 알러지 있는 거 있나요?',
  '그 시간 괜찮아요. 도착하면 연락 주세요 😊',
];

// 데모용 샘플 데이터 (마포구 일대)

export const SPOTS = [
  { id: 'sp1', name: '망원한강공원', type: '한강공원', lat: 37.5550, lng: 126.8950, note: '넓은 잔디, 반려견 놀이터 인근' },
  { id: 'sp2', name: '경의선숲길 연남구간', type: '산책로', lat: 37.5605, lng: 126.9235, note: '카페 많음, 저녁 산책 추천' },
  { id: 'sp3', name: '월드컵공원 평화의공원', type: '공원', lat: 37.5640, lng: 126.8960, note: '호수 둘레길, 주차 가능' },
  { id: 'sp4', name: '상암 하늘공원 입구', type: '공원', lat: 37.5680, lng: 126.8850, note: '억새길, 대형견도 여유로움' },
  { id: 'sp5', name: '합정 절두산 한강길', type: '한강공원', lat: 37.5450, lng: 126.9100, note: '노을 명소, 자전거 주의' },
  { id: 'sp6', name: '서교동 반려견 동반 카페거리', type: '카페', lat: 37.5530, lng: 126.9180, note: '산책 후 쉬기 좋은 곳' },
];

export const PEOPLE = [
  {
    id: 'p1', name: '지수', gender: '여성', birthYear: 1995, job: 'UX 디자이너',
    bio: '퇴근 후 망원한강에서 노을 보며 걷는 게 낙이에요. 커피 좋아해요 ☕',
    location: { lat: 37.5565, lng: 126.9010 }, walkTimes: ['저녁', '밤'],
    interests: ['카페', '사진', '전시'], color: '#F6C59B',
    dog: { name: '보리', breed: '웰시코기', size: '중형', age: 3, energy: '활발', friendly: true, emoji: '🐕', traits: ['사람 좋아함', '공놀이 광'] },
    likes: ['me'],
  },
  {
    id: 'p2', name: '민준', gender: '남성', birthYear: 1993, job: '개발자',
    bio: '재택근무라 점심 산책 자주 나가요. 같이 걸을 산책 메이트 구해요!',
    location: { lat: 37.5600, lng: 126.9100 }, walkTimes: ['점심', '저녁'],
    interests: ['러닝', '캠핑', '보드게임'], color: '#A8D5BA',
    dog: { name: '콩이', breed: '시바견', size: '중형', age: 4, energy: '보통', friendly: true, emoji: '🐕', traits: ['독립적', '간식에 진심'] },
    likes: [],
  },
  {
    id: 'p3', name: '서연', gender: '여성', birthYear: 1997, job: '초등교사',
    bio: '주말 아침 일찍 공원 한 바퀴 돌아요. 소형견 친구 환영해요 🌸',
    location: { lat: 37.5640, lng: 126.8990 }, walkTimes: ['이른 아침', '저녁'],
    interests: ['독서', '베이킹', '요가'], color: '#F4B6C2',
    dog: { name: '몽이', breed: '말티즈', size: '소형', age: 2, energy: '보통', friendly: true, emoji: '🐩', traits: ['애교쟁이', '겁 조금 많음'] },
    likes: ['me'],
  },
  {
    id: 'p4', name: '도현', gender: '남성', birthYear: 1991, job: '셰프',
    bio: '대형견이랑 살아요. 하늘공원 억새길 걷는 거 좋아합니다.',
    location: { lat: 37.5700, lng: 126.8880 }, walkTimes: ['이른 아침', '밤'],
    interests: ['요리', '캠핑', '등산'], color: '#B5C7E8',
    dog: { name: '하루', breed: '골든 리트리버', size: '대형', age: 5, energy: '활발', friendly: true, emoji: '🦮', traits: ['순둥이', '수영 좋아함'] },
    likes: ['me'],
  },
  {
    id: 'p5', name: '하은', gender: '여성', birthYear: 1994, job: '마케터',
    bio: '연남동 숲길 산책하고 카페 가는 루트 추천해 드릴게요!',
    location: { lat: 37.5620, lng: 126.9220 }, walkTimes: ['저녁'],
    interests: ['카페', '맛집', '사진'], color: '#D9C2F0',
    dog: { name: '두부', breed: '비숑 프리제', size: '소형', age: 1, energy: '활발', friendly: true, emoji: '🐩', traits: ['솜사탕', '에너지 폭발'] },
    likes: [],
  },
  {
    id: 'p6', name: '준호', gender: '남성', birthYear: 1996, job: '대학원생',
    bio: '조용히 걷는 산책 좋아해요. 아이가 낯을 가려서 천천히 친해져요.',
    location: { lat: 37.5480, lng: 126.9130 }, walkTimes: ['밤'],
    interests: ['독서', '음악', '전시'], color: '#C9E4DE',
    dog: { name: '단비', breed: '진돗개 믹스', size: '중형', age: 6, energy: '느긋', friendly: false, emoji: '🐕', traits: ['의젓함', '낯가림'] },
    likes: ['me'],
  },
  {
    id: 'p7', name: '유나', gender: '여성', birthYear: 1992, job: '간호사',
    bio: '교대 근무라 평일 낮 산책 가능해요. 대형견 친구 대환영!',
    location: { lat: 37.5580, lng: 126.8970 }, walkTimes: ['점심', '이른 아침'],
    interests: ['등산', '러닝', '맛집'], color: '#FFE0A3',
    dog: { name: '태풍', breed: '보더 콜리', size: '대형', age: 3, energy: '활발', friendly: true, emoji: '🐕‍🦺', traits: ['천재견', '원반 마스터'] },
    likes: [],
  },
  {
    id: 'p8', name: '태윤', gender: '남성', birthYear: 1995, job: '사진작가',
    bio: '산책하면서 강아지 사진 찍어드려요 📷 망원 근처 살아요.',
    location: { lat: 37.5540, lng: 126.9040 }, walkTimes: ['저녁', '점심'],
    interests: ['사진', '카페', '여행'], color: '#F7D6BF',
    dog: { name: '쿠키', breed: '푸들', size: '소형', age: 4, energy: '보통', friendly: true, emoji: '🐩', traits: ['모델견', '얌전함'] },
    likes: ['me'],
  },
];

export const DEFAULT_ME = {
  id: 'me', name: '', gender: '여성', lookingFor: '남성', birthYear: 1995, job: '',
  bio: '', location: { lat: 37.5560, lng: 126.9060 }, walkTimes: ['저녁'],
  interests: [], color: '#FFD8A8',
  dog: { name: '', breed: '', size: '소형', age: 2, energy: '보통', friendly: true, emoji: '🐶', traits: [] },
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

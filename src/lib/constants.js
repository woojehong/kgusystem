// Static game data used to seed Firestore and as shared constants.
// Source of truth after seeding is Firestore (editable by the super admin).

export const ROLES = {
  tank: { id: 'tank', label: '탱커' },
  healer: { id: 'healer', label: '힐러' },
  dps: { id: 'dps', label: '딜러' },
};

export const DIFFICULTIES = {
  normal: {
    id: 'normal',
    label: '일반',
    color: '#1eff00',
    soft: 'rgba(30,255,0,0.08)',
    totalCap: 30,
    defaultHealers: 6,
  },
  heroic: {
    id: 'heroic',
    label: '영웅',
    color: '#a335ee',
    soft: 'rgba(163,53,238,0.10)',
    totalCap: 30,
    defaultHealers: 6,
  },
  mythic: {
    id: 'mythic',
    label: '신화',
    color: '#ff8000',
    soft: 'rgba(255,128,0,0.10)',
    totalCap: 20,
    defaultHealers: 4,
  },
};

export const TANK_CAP = 2;

export const UNION_LEADER_LABEL = '연합 길드 길드장';

export const SUPER_ADMIN_PATH = 'kga_adminnn';

// ── Classes & specializations (Midnight expansion) ──────────────────

export const CLASSES = [
  {
    id: 'deathknight',
    name: '죽음의 기사',
    color: '#C41E3A',
    specs: [
      { id: 'dk_blood', name: '혈기', role: 'tank', range: null },
      { id: 'dk_frost', name: '냉기', role: 'dps', range: 'melee' },
      { id: 'dk_unholy', name: '부정', role: 'dps', range: 'melee' },
    ],
  },
  {
    id: 'demonhunter',
    name: '악마사냥꾼',
    color: '#A330C9',
    specs: [
      { id: 'dh_havoc', name: '파멸', role: 'dps', range: 'melee' },
      { id: 'dh_vengeance', name: '복수', role: 'tank', range: null },
      { id: 'dh_devourer', name: '포식', role: 'dps', range: 'ranged' },
    ],
  },
  {
    id: 'druid',
    name: '드루이드',
    color: '#FF7C0A',
    specs: [
      { id: 'dr_balance', name: '조화', role: 'dps', range: 'ranged' },
      { id: 'dr_feral', name: '야성', role: 'dps', range: 'melee' },
      { id: 'dr_guardian', name: '수호', role: 'tank', range: null },
      { id: 'dr_resto', name: '회복', role: 'healer', range: null },
    ],
  },
  {
    id: 'evoker',
    name: '기원사',
    color: '#33937F',
    specs: [
      { id: 'ev_devastation', name: '파멸', role: 'dps', range: 'ranged' },
      { id: 'ev_preservation', name: '보존', role: 'healer', range: null },
      { id: 'ev_augmentation', name: '증강', role: 'dps', range: 'ranged' },
    ],
  },
  {
    id: 'hunter',
    name: '사냥꾼',
    color: '#AAD372',
    specs: [
      { id: 'hu_bm', name: '야수', role: 'dps', range: 'ranged' },
      { id: 'hu_mm', name: '사격', role: 'dps', range: 'ranged' },
      { id: 'hu_survival', name: '생존', role: 'dps', range: 'melee' },
    ],
  },
  {
    id: 'mage',
    name: '마법사',
    color: '#3FC7EB',
    specs: [
      { id: 'ma_arcane', name: '비전', role: 'dps', range: 'ranged' },
      { id: 'ma_fire', name: '화염', role: 'dps', range: 'ranged' },
      { id: 'ma_frost', name: '냉기', role: 'dps', range: 'ranged' },
    ],
  },
  {
    id: 'monk',
    name: '수도사',
    color: '#00FF98',
    specs: [
      { id: 'mo_brewmaster', name: '양조', role: 'tank', range: null },
      { id: 'mo_mistweaver', name: '운무', role: 'healer', range: null },
      { id: 'mo_windwalker', name: '풍운', role: 'dps', range: 'melee' },
    ],
  },
  {
    id: 'paladin',
    name: '성기사',
    color: '#F48CBA',
    specs: [
      { id: 'pa_holy', name: '신성', role: 'healer', range: null },
      { id: 'pa_protection', name: '보호', role: 'tank', range: null },
      { id: 'pa_retribution', name: '징벌', role: 'dps', range: 'melee' },
    ],
  },
  {
    id: 'priest',
    name: '사제',
    color: '#FFFFFF',
    specs: [
      { id: 'pr_discipline', name: '수양', role: 'healer', range: null },
      { id: 'pr_holy', name: '신성', role: 'healer', range: null },
      { id: 'pr_shadow', name: '암흑', role: 'dps', range: 'ranged' },
    ],
  },
  {
    id: 'rogue',
    name: '도적',
    color: '#FFF468',
    specs: [
      { id: 'ro_assassination', name: '암살', role: 'dps', range: 'melee' },
      { id: 'ro_outlaw', name: '무법', role: 'dps', range: 'melee' },
      { id: 'ro_subtlety', name: '잠행', role: 'dps', range: 'melee' },
    ],
  },
  {
    id: 'shaman',
    name: '주술사',
    color: '#0070DD',
    specs: [
      { id: 'sh_elemental', name: '정기', role: 'dps', range: 'ranged' },
      { id: 'sh_enhancement', name: '고양', role: 'dps', range: 'melee' },
      { id: 'sh_resto', name: '복원', role: 'healer', range: null },
    ],
  },
  {
    id: 'warlock',
    name: '흑마법사',
    color: '#8788EE',
    specs: [
      { id: 'wl_affliction', name: '고통', role: 'dps', range: 'ranged' },
      { id: 'wl_demonology', name: '악마', role: 'dps', range: 'ranged' },
      { id: 'wl_destruction', name: '파괴', role: 'dps', range: 'ranged' },
    ],
  },
  {
    id: 'warrior',
    name: '전사',
    color: '#C69B3A',
    specs: [
      { id: 'wa_arms', name: '무기', role: 'dps', range: 'melee' },
      { id: 'wa_fury', name: '분노', role: 'dps', range: 'melee' },
      { id: 'wa_protection', name: '방어', role: 'tank', range: null },
    ],
  },
];

// ── Raid-wide synergies (Midnight) ──────────────────────────────────

export const SYNERGIES = [
  { id: 'chaos_brand', name: '혼돈의 낙인', classId: 'demonhunter', effect: '마법 피해 +3%', type: 'buff' },
  { id: 'mark_of_the_wild', name: '야성의 징표', classId: 'druid', effect: '유연성 +3%', type: 'buff' },
  { id: 'blessing_of_the_bronze', name: '청동의 축복', classId: 'evoker', effect: '이동기 재사용 대기시간 -15%', type: 'buff' },
  { id: 'hunters_mark', name: '사냥꾼의 징표', classId: 'hunter', effect: '대상이 받는 피해 +3%', type: 'buff' },
  { id: 'arcane_intellect', name: '비전 지성', classId: 'mage', effect: '지능 +3%', type: 'buff' },
  { id: 'mystic_touch', name: '신비한 손길', classId: 'monk', effect: '물리 피해 +5%', type: 'buff' },
  { id: 'devotion_aura', name: '헌신의 오라', classId: 'paladin', effect: '받는 피해 -3%', type: 'buff' },
  { id: 'concentration_aura', name: '집중의 오라', classId: 'paladin', effect: '침묵/방해 효과 -30%', type: 'buff' },
  { id: 'power_word_fortitude', name: '신의 의지', classId: 'priest', effect: '체력 +5%', type: 'buff' },
  { id: 'atrophic_poison', name: '위축의 독', classId: 'rogue', effect: '적 피해 -3%', type: 'buff' },
  { id: 'skyfury', name: '하늘의 분노', classId: 'shaman', effect: '특화 +2%, 자동 공격 20% 즉시 재공격', type: 'buff' },
  { id: 'battle_shout', name: '전투의 함성', classId: 'warrior', effect: '공격력 +5%', type: 'buff' },
  { id: 'demonic_gateway', name: '악마의 관문', classId: 'warlock', effect: '공격대 이동 포탈', type: 'utility' },
  { id: 'deaths_grip', name: '죽음의 손아귀', classId: 'deathknight', effect: '광역 적 집결', type: 'utility' },
];

// ── Korean realms (WCL slug pairs) ──────────────────────────────────

export const SERVERS = [
  { ko: '아즈샤라', slug: 'azshara', isDefault: true },
  { ko: '하이잘', slug: 'hyjal', isDefault: false },
  { ko: '굴단', slug: 'guldan', isDefault: false },
  { ko: '데스윙', slug: 'deathwing', isDefault: false },
  { ko: '불타는 군단', slug: 'burning-legion', isDefault: false },
  { ko: '줄진', slug: 'zuljin', isDefault: false },
  { ko: '노르간논', slug: 'norgannon', isDefault: false },
  { ko: '가로나', slug: 'garona', isDefault: false },
  { ko: '윈드러너', slug: 'windrunner', isDefault: false },
  { ko: '알렉스트라자', slug: 'alexstrasza', isDefault: false },
  { ko: '헬스크림', slug: 'hellscream', isDefault: false },
  { ko: '달라란', slug: 'dalaran', isDefault: false },
  { ko: '듀로탄', slug: 'durotan', isDefault: false },
  { ko: '세나리우스', slug: 'cenarius', isDefault: false },
  { ko: '스톰레이지', slug: 'stormrage', isDefault: false },
  { ko: '와일드해머', slug: 'wildhammer', isDefault: false },
  { ko: '렉사르', slug: 'rexxar', isDefault: false },
  { ko: '말퓨리온', slug: 'malfurion', isDefault: false },
];

// ── Initial guilds ──────────────────────────────────────────────────

// 연합 레이드 전용 뱃지 문서 ID (슈퍼관리자만 편집).
// 주의: Firestore는 앞뒤 이중밑줄(__x__) 형식 ID를 예약어로 막으므로 사용 금지.
export const UNION_GUILD_ID = 'union-badge';

export const SEED_GUILDS = [
  { id: 'starfall-forest', name: 'Starfall Forest', color: '#7dd3fc', logoPath: '', isNone: false },
  { id: 'gyochaero', name: '교차로', color: '#f59e0b', logoPath: '', isNone: false },
  { id: 'wowfactory', name: '와우팩토리', color: '#34d399', logoPath: '', isNone: false },
  { id: 'ieyo', name: '이에요', color: '#f472b6', logoPath: '', isNone: false },
  { id: 'none', name: '소속 없음', color: '#64748b', logoPath: '', isNone: true },
  // 연합 레이드 뱃지. 일반 길드 목록/필터/깃발에는 노출하지 않음.
  { id: UNION_GUILD_ID, name: '연합', badgeName: '연합', color: '#a78bfa', logoPath: '', isUnion: true, isNone: false },
];

// ── Nickname policy ─────────────────────────────────────────────────

export const NICKNAME_RULE = {
  korean: /^[가-힣]{2,7}$/,
  english: /^[A-Za-z]{2,11}$/,
  hint: '한글만 2~7자 또는 영문만 2~11자 (혼용·숫자·특수문자 불가)',
};

export function validateNickname(nickname) {
  return NICKNAME_RULE.korean.test(nickname) || NICKNAME_RULE.english.test(nickname);
}

export const PIN_RULE = {
  pattern: /^\d{4}$/,
  hint: '숫자 4자리',
};

// Internal padding so a 4-digit PIN satisfies Firebase's 6+ char minimum.
export const PIN_PAD_SUFFIX = '#KGU';

export function padPin(pin) {
  return `${pin}${PIN_PAD_SUFFIX}`;
}

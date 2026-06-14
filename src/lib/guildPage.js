import { randomId } from './utils';

// ── Curated fonts for the guild page editor ─────────────────────────
// Korean web fonts are loaded via Google Fonts CDN in index.html.
export const FONT_OPTIONS = [
  { key: 'pretendard', label: '기본',    css: "'Pretendard Variable', Pretendard, -apple-system, sans-serif" },
  { key: 'myeongjo',   label: '명조',    css: "'Nanum Myeongjo', serif" },
  { key: 'jua',        label: '둥근',    css: "'Jua', sans-serif" },
  { key: 'blackhan',   label: '임팩트',  css: "'Black Han Sans', sans-serif" },
  { key: 'dohyeon',    label: '각진',    css: "'Do Hyeon', sans-serif" },
  { key: 'pen',        label: '손글씨',  css: "'Nanum Pen Script', cursive" },
  { key: 'gaegu',      label: '손글씨2', css: "'Gaegu', cursive" },
];

const FONT_MAP = Object.fromEntries(FONT_OPTIONS.map((f) => [f.key, f.css]));

export function fontCss(key) {
  return FONT_MAP[key] || FONT_MAP.pretendard;
}

export const SIZE_OPTIONS = [
  { key: 14, label: '작게' },
  { key: 16, label: '보통' },
  { key: 20, label: '크게' },
  { key: 24, label: '소제목' },
  { key: 32, label: '제목' },
  { key: 44, label: '대형' },
];

export const ALIGN_OPTIONS = [
  { key: 'left', label: '좌' },
  { key: 'center', label: '중' },
  { key: 'right', label: '우' },
];

export const IMG_WIDTH_OPTIONS = [
  { key: 'sm', label: '작게' },
  { key: 'md', label: '보통' },
  { key: 'full', label: '꽉' },
];

// ── Block factories ─────────────────────────────────────────────────
export function emptyTextBlock() {
  return {
    id: randomId('blk_'),
    type: 'text',
    text: '',
    size: 16,
    color: '#e2e8f0',
    font: 'pretendard',
    align: 'left',
    bold: false,
  };
}

export function emptyImageBlock() {
  return { id: randomId('blk_'), type: 'image', path: '', width: 'full' };
}

export function dividerBlock() {
  return { id: randomId('blk_'), type: 'divider' };
}

// ── Rendering helpers ───────────────────────────────────────────────
export function blockTextStyle(b) {
  return {
    fontSize: b.size,
    color: b.color,
    fontFamily: FONT_MAP[b.font] || FONT_MAP.pretendard,
    textAlign: b.align,
    fontWeight: b.bold ? 800 : 400,
    whiteSpace: 'pre-wrap',
    lineHeight: 1.6,
    wordBreak: 'keep-all',
  };
}

export function imgWidthValue(w) {
  if (w === 'sm') return '45%';
  if (w === 'md') return '70%';
  return '100%';
}

/** Resolve a public-folder relative path (e.g. 'guilds/foo/a.png') to a usable URL. */
export function publicUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  const base = import.meta.env.BASE_URL || '/';
  return `${base}${String(path).replace(/^\/+/, '')}`;
}

/** Guild flag image path derived from the guild's English slug. */
export function flagImageUrl(englishName) {
  if (!englishName) return '';
  const base = import.meta.env.BASE_URL || '/';
  return `${base}guildflag/${englishName}.png`;
}

/**
 * Resolve a guild-page image reference to a URL.
 * - Full URL or a path containing '/' → used as-is (super-admin power use).
 * - A bare file name → resolved under public/guilds/<englishName>/, and a
 *   '.png' extension is appended automatically when none is given.
 */
export function resolveImagePath(val, englishName) {
  if (!val) return '';
  const v = String(val).trim();
  if (/^https?:\/\//.test(v)) return v;
  if (v.includes('/')) return publicUrl(v);
  const name = /\.[a-z0-9]{2,4}$/i.test(v) ? v : `${v}.png`;
  const folder = englishName ? `guilds/${englishName}/` : 'guilds/';
  return publicUrl(`${folder}${name}`);
}

// ── English slug validation (filename + URL safe) ───────────────────
export const ENGLISH_NAME_RULE = /^[a-z0-9-]{2,30}$/;

export function validateEnglishName(name) {
  if (!name) return '영문명을 입력해주세요.';
  if (!ENGLISH_NAME_RULE.test(name)) {
    return '영문 소문자/숫자/하이픈(-)만, 2~30자, 띄어쓰기 불가입니다.';
  }
  return null;
}

// ── Hero (guild-page title box) ─────────────────────────────────────
export function defaultHero(color = '#64748b') {
  return {
    showBox: true,      // 타이틀 박스 자체
    showLogo: false,    // 로고(logoPath 재사용)
    showBanner: false,  // 배너(가로 커버, 슈퍼관리자만 경로 설정)
    showName: true,     // 길드명
    showTag: false,     // 추가 문구
    nameFont: 'pretendard',
    nameColor: '#ffffff',
    nameSize: 28,
    tagText: '',
    tagFont: 'pretendard',
    tagColor: '#cbd5e1',
    tagSize: 16,
    bannerPath: '',
    bgStyle: 'signature', // 'signature' | 'solid' | 'gradient' | 'none'
    bgColor1: color,
    bgColor2: color,
  };
}

export function heroBackground(hero, color = '#64748b') {
  const h = hero || {};
  const c1 = h.bgColor1 || color;
  const c2 = h.bgColor2 || color;
  switch (h.bgStyle) {
    case 'solid':    return c1;
    case 'gradient': return `linear-gradient(135deg, ${c1}, ${c2})`;
    case 'none':     return 'transparent';
    case 'signature':
    default:         return `radial-gradient(circle at 50% 0%, ${color}33 0%, transparent 70%)`;
  }
}

/** Normalize a page object to a safe { hero, blocks } shape. */
export function normalizePage(page, color = '#64748b') {
  const blocks = page && Array.isArray(page.blocks) ? page.blocks : [];
  const hero = { ...defaultHero(color), ...(page && page.hero ? page.hero : {}) };
  return { hero, blocks };
}

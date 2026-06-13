import { useApp } from '../context/AppContext';

// ── Shape clip-paths ────────────────────────────────────────────────
const CLIP_PATHS = {
  hexagon: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
  diamond: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  shield:  'polygon(0% 0%, 100% 0%, 100% 65%, 50% 100%, 0% 65%)',
  octagon: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)',
  star:    'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
  tag:     'polygon(0% 0%, 85% 0%, 100% 50%, 85% 100%, 0% 100%)',
};

const RADIUS_MAP = {
  pill:         '9999px',
  'rounded-sm': '4px',
  'rounded-md': '8px',
  'rounded-lg': '14px',
  square:       '2px',
  leaf:         '50% 0% 50% 0%',
};

// ── Background ──────────────────────────────────────────────────────
function computeBg(bgType, c1, c2, c3) {
  switch (bgType) {
    case 'gradient-h':         return `linear-gradient(90deg, ${c1}, ${c2})`;
    case 'gradient-v':         return `linear-gradient(180deg, ${c1}, ${c2})`;
    case 'gradient-diagonal':  return `linear-gradient(135deg, ${c1}, ${c2})`;
    case 'gradient-3':         return `linear-gradient(135deg, ${c1}, ${c2} 50%, ${c3})`;
    case 'radial':             return `radial-gradient(circle, ${c2}, ${c1})`;
    case 'conic':              return `conic-gradient(from 0deg, ${c1}, ${c2}, ${c3}, ${c1})`;
    case 'glass':              return `linear-gradient(135deg, ${c1}44, ${c1}bb)`;
    case 'mesh':               return [
      `radial-gradient(circle at 25% 60%, ${c2}77 0%, transparent 55%)`,
      `radial-gradient(circle at 75% 20%, ${c3}77 0%, transparent 55%)`,
      `${c1}33`,
    ].join(', ');
    case 'neon':               return `${c1}22`;
    case 'stripe':             return `repeating-linear-gradient(45deg, ${c1}, ${c1} 4px, ${c2} 4px, ${c2} 8px)`;
    case 'outline':            return 'transparent';
    default:                   return `${c1}1a`;
  }
}

// ── Core style builder (exported for preview use) ───────────────────
export function buildBadgeStyles(badgeCfg, signatureColor) {
  const b  = badgeCfg || {};
  const c1 = signatureColor || '#64748b';
  const c2 = b.color2      || c1;
  const c3 = b.color3      || c2;
  const bc = b.borderColor || c1;

  const bgType   = b.bgType    || 'solid';
  const shape    = b.shape     || 'pill';
  const bdrType  = b.border    || 'thin';
  const effect   = b.effect    || 'none';
  const txtMode  = b.textColor || 'auto';
  const txtStyle = b.textStyle || 'normal';

  // Background (shimmer overrides bgType)
  let background = computeBg(bgType, c1, c2, c3);
  let backgroundSize;
  if (effect === 'shimmer') {
    background     = `linear-gradient(90deg, ${c1}22 0%, ${c2}aa 35%, ${c1}ff 50%, ${c2}aa 65%, ${c1}22 100%)`;
    backgroundSize = '250% auto';
  }

  // Shape
  const clipPath    = CLIP_PATHS[shape];
  const borderRadius = !clipPath ? (RADIUS_MAP[shape] || '9999px') : undefined;

  // Border
  const shadows = [];
  let borderProp;
  switch (bdrType) {
    case 'none':         break;
    case 'thin':         borderProp = `1px solid ${bc}55`;   break;
    case 'medium':       borderProp = `1.5px solid ${bc}88`; break;
    case 'thick':        borderProp = `2.5px solid ${bc}`;   break;
    case 'dashed':       borderProp = `1.5px dashed ${bc}88`; break;
    case 'dotted':       borderProp = `2px dotted ${bc}99`;   break;
    case 'double':       borderProp = `3px double ${bc}99`;   break;
    case 'outline-only': borderProp = `2px solid ${bc}`;      break;
    case 'gradient':     borderProp = `1.5px solid ${bc}99`;  break;
    case 'glow':
      borderProp = `1px solid ${bc}88`;
      shadows.push(`0 0 0 2px ${bc}44`, `0 0 10px ${bc}77`);
      break;
    case 'neon-glow':
      borderProp = `1px solid ${bc}`;
      shadows.push(`0 0 5px ${bc}`, `0 0 16px ${bc}99`, `inset 0 0 5px ${bc}33`);
      break;
    case 'inner':
      shadows.push(`inset 0 0 0 1.5px ${bc}88`);
      break;
    default:
      borderProp = `1px solid ${bc}55`;
  }

  // Effects
  switch (effect) {
    case 'glow-sm':    shadows.push(`0 0 8px ${c1}77`);                          break;
    case 'glow-lg':    shadows.push(`0 0 14px ${c1}99`, `0 0 28px ${c1}55`);    break;
    case 'shadow':     shadows.push(`0 2px 8px rgba(0,0,0,0.55)`);               break;
    case 'emboss':     shadows.push(`inset 0 1.5px 0 ${c1}aa`, `inset 0 -1px 0 rgba(0,0,0,0.5)`); break;
    case 'inner-glow': shadows.push(`inset 0 0 12px ${c1}77`);                   break;
    case 'holo':       shadows.push(`0 0 10px ${c1}66`, `0 0 20px ${c2}44`);    break;
    default: break;
  }

  // clip-path kills box-shadow → use filter:drop-shadow
  let filter;
  if (clipPath) {
    if (effect === 'glow-sm')       filter = `drop-shadow(0 0 6px ${c1}cc)`;
    if (effect === 'glow-lg')       filter = `drop-shadow(0 0 12px ${c1}dd)`;
    if (effect === 'shadow')        filter = `drop-shadow(0 2px 4px rgba(0,0,0,0.7))`;
    if (effect === 'holo')          filter = `drop-shadow(0 0 8px ${c1}bb)`;
    if (bdrType === 'glow')         filter = `drop-shadow(0 0 8px ${bc}cc)`;
    if (bdrType === 'neon-glow')    filter = `drop-shadow(0 0 12px ${bc})`;
  }

  // Text color (auto = white for gradient/solid bg variants, signature otherwise)
  let textColor = c1;
  if (txtMode === 'white') textColor = '#fff';
  else if (txtMode === 'dark') textColor = '#1e1e2e';
  else if (['gradient-h','gradient-v','gradient-diagonal','gradient-3','radial','conic','glass','stripe'].includes(bgType)) {
    textColor = '#fff';
  }

  // Text style
  let textShadow = '0 0 1px rgba(0,0,0,0.6)';
  let fontWeight = '600';
  if (txtStyle === 'bold')     { fontWeight = '800'; }
  if (txtStyle === 'outlined') { textShadow = '-1px -1px 0 rgba(0,0,0,0.9), 1px -1px 0 rgba(0,0,0,0.9), -1px 1px 0 rgba(0,0,0,0.9), 1px 1px 0 rgba(0,0,0,0.9)'; }
  if (txtStyle === 'shadow')   { textShadow = '0 1px 4px rgba(0,0,0,0.9)'; }
  if (txtStyle === 'glow')     { textShadow = `0 0 8px ${c1}, 0 0 16px ${c1}88`; }

  const animClass = effect === 'shimmer' ? 'kwgu-badge-shimmer'
                  : effect === 'pulse'   ? 'kwgu-badge-pulse'
                  : '';

  return {
    style: {
      background,
      ...(backgroundSize ? { backgroundSize } : {}),
      ...(borderProp    ? { border: borderProp } : {}),
      ...(borderRadius  ? { borderRadius }       : {}),
      ...(clipPath      ? { clipPath }            : {}),
      ...(shadows.length ? { boxShadow: shadows.join(', ') } : {}),
      ...(filter        ? { filter }              : {}),
      color: textColor,
      fontWeight,
      textShadow,
    },
    animClass,
    isClipPath: !!clipPath,
  };
}

// ── Component ───────────────────────────────────────────────────────

export default function GuildBadge({ guildId, guildName, guildColor, size = 'sm', badgeConfig }) {
  const { guilds } = useApp();
  const guild    = guilds.find((g) => g.id === guildId);
  const name     = guildName  ?? guild?.name  ?? '소속 없음';
  const color    = guildColor ?? guild?.color ?? '#64748b';
  const logoPath = guild?.logoPath;

  // badgeConfig prop overrides guild.badge (used for live preview in admin panel)
  const effectiveBadge = badgeConfig ?? guild?.badge ?? {};
  const { style, animClass, isClipPath } = buildBadgeStyles(effectiveBadge, color);

  const sizeCls = size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';
  const clipSizeStyle = isClipPath
    ? { minWidth: size === 'xs' ? '2.4rem' : '2.8rem', minHeight: size === 'xs' ? '1.1rem' : '1.35rem' }
    : {};

  return (
    <span
      className={`inline-flex items-center gap-1 ${sizeCls} ${animClass}`}
      style={{ ...style, ...clipSizeStyle, ...(isClipPath ? { justifyContent: 'center' } : {}) }}
    >
      {logoPath && !isClipPath && (
        <img
          src={`${import.meta.env.BASE_URL}${logoPath.replace(/^\//, '')}`}
          alt=""
          className="w-3.5 h-3.5 rounded-full object-cover"
        />
      )}
      {name}
    </span>
  );
}

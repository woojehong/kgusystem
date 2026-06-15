import { useApp } from '../context/AppContext';

const CLIP_PATHS = {
  hexagon:       'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
  diamond:       'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  shield:        'polygon(0% 0%, 100% 0%, 100% 65%, 50% 100%, 0% 65%)',
  octagon:       'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)',
  star:          'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
  tag:           'polygon(0% 0%, 85% 0%, 100% 50%, 85% 100%, 0% 100%)',
  chevron:       'polygon(15% 0%, 100% 0%, 100% 100%, 15% 100%, 0% 50%)',
  ribbon:        'polygon(0% 0%, 100% 0%, 85% 50%, 100% 100%, 0% 100%, 15% 50%)',
  arrow:         'polygon(0% 20%, 65% 20%, 65% 0%, 100% 50%, 65% 100%, 65% 80%, 0% 80%)',
  parallelogram: 'polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)',
  pentagon:      'polygon(50% 0%, 100% 35%, 82% 100%, 18% 100%, 0% 35%)',
  trapezoid:     'polygon(8% 0%, 92% 0%, 100% 100%, 0% 100%)',
};

const RADIUS_MAP = {
  pill:          '9999px',
  'rounded-sm':  '4px',
  'rounded-md':  '8px',
  'rounded-lg':  '14px',
  square:        '2px',
  leaf:          '50% 0% 50% 0%',
  'rounded-xl':  '20px',
  circle:        '50%',
  blob:          '30% 70% 70% 30% / 30% 30% 70% 70%',
  'sharp-round': '12px 0px 12px 0px',
};

function computeBg(bgType, c1, c2, c3) {
  switch (bgType) {
    case 'gradient-h':        return `linear-gradient(90deg, ${c1}, ${c2})`;
    case 'gradient-v':        return `linear-gradient(180deg, ${c1}, ${c2})`;
    case 'gradient-diagonal': return `linear-gradient(135deg, ${c1}, ${c2})`;
    case 'gradient-3':        return `linear-gradient(135deg, ${c1}, ${c2} 50%, ${c3})`;
    case 'radial':            return `radial-gradient(circle, ${c2}, ${c1})`;
    case 'conic':             return `conic-gradient(from 0deg, ${c1}, ${c2}, ${c3}, ${c1})`;
    case 'glass':             return `linear-gradient(135deg, ${c1}44, ${c1}bb)`;
    case 'mesh':              return [
      `radial-gradient(circle at 25% 60%, ${c2}77 0%, transparent 55%)`,
      `radial-gradient(circle at 75% 20%, ${c3}77 0%, transparent 55%)`,
      `${c1}33`,
    ].join(', ');
    case 'neon':              return `${c1}22`;
    case 'stripe':            return `repeating-linear-gradient(45deg, ${c1}, ${c1} 4px, ${c2} 4px, ${c2} 8px)`;
    case 'outline':           return 'transparent';
    case 'aurora':            return `linear-gradient(120deg, ${c1}bb 0%, ${c2}66 40%, ${c1}22 70%, ${c3}99 100%)`;
    case 'holographic':       return `linear-gradient(135deg, ${c1} 0%, ${c2} 25%, ${c3} 50%, ${c1} 75%, ${c2} 100%)`;
    case 'metallic':          return `linear-gradient(135deg, ${c1}bb 0%, rgba(255,255,255,0.4) 30%, ${c1}88 50%, rgba(255,255,255,0.15) 70%, ${c1}cc 100%)`;
    case 'frosted':           return 'linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04))';
    case 'dots':              return `radial-gradient(circle, ${c1}cc 1.5px, ${c1}11 1.5px)`;
    case 'fire':              return `radial-gradient(ellipse at 50% 110%, ${c1} 0%, ${c2}99 40%, transparent 70%)`;
    case 'ocean':             return `linear-gradient(180deg, ${c1}55 0%, ${c2}99 55%, ${c3}44 100%)`;
    case 'sunset':            return `linear-gradient(135deg, ${c1} 0%, ${c2} 50%, ${c3} 100%)`;
    case 'mirror':            return `linear-gradient(90deg, ${c1}00 0%, ${c1}dd 25%, ${c1}ff 50%, ${c1}dd 75%, ${c1}00 100%)`;
    default:                  return `${c1}1a`;
  }
}

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

  let background = computeBg(bgType, c1, c2, c3);
  let backgroundSize;
  if (effect === 'shimmer') {
    background     = `linear-gradient(90deg, ${c1}22 0%, ${c2}aa 35%, ${c1}ff 50%, ${c2}aa 65%, ${c1}22 100%)`;
    backgroundSize = '250% auto';
  } else if (bgType === 'dots') {
    backgroundSize = '6px 6px';
  }

  const clipPath     = CLIP_PATHS[shape];
  const borderRadius = !clipPath ? (RADIUS_MAP[shape] || '9999px') : undefined;

  const shadows = [];
  let borderProp;
  switch (bdrType) {
    case 'none':         break;
    case 'thin':         borderProp = `1px solid ${bc}55`;    break;
    case 'medium':       borderProp = `1.5px solid ${bc}88`;  break;
    case 'thick':        borderProp = `2.5px solid ${bc}`;    break;
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
    case 'groove':
      borderProp = `1.5px solid ${bc}66`;
      shadows.push(`inset 1px 1px 2px rgba(0,0,0,0.4)`, `inset -1px -1px 2px ${bc}33`);
      break;
    case 'ridge':
      borderProp = `1.5px solid ${bc}66`;
      shadows.push(`inset -1px -1px 2px rgba(0,0,0,0.4)`, `inset 1px 1px 2px ${bc}33`);
      break;
    case 'inset-2':
      shadows.push(`inset 0 0 0 2.5px ${bc}99`);
      break;
    case 'multi-glow':
      borderProp = `1px solid ${bc}77`;
      shadows.push(`0 0 4px ${bc}aa`, `0 0 12px ${bc}77`, `0 0 24px ${bc}44`, `0 0 40px ${bc}22`);
      break;
    case 'thick-neon':
      borderProp = `2.5px solid ${bc}`;
      shadows.push(`0 0 6px ${bc}`, `0 0 16px ${bc}99`, `0 0 30px ${bc}66`, `inset 0 0 8px ${bc}22`);
      break;
    case 'top-accent':
      shadows.push(`inset 0 3px 0 ${bc}`);
      break;
    case 'bottom-accent':
      shadows.push(`inset 0 -3px 0 ${bc}`);
      break;
    case 'sharp-outer':
      shadows.push(`0 0 0 2px ${bc}`);
      break;
    default:
      borderProp = `1px solid ${bc}55`;
  }

  switch (effect) {
    case 'glow-sm':      shadows.push(`0 0 8px ${c1}77`);                                                                    break;
    case 'glow-lg':      shadows.push(`0 0 14px ${c1}99`, `0 0 28px ${c1}55`);                                              break;
    case 'shadow':       shadows.push('0 2px 8px rgba(0,0,0,0.55)');                                                         break;
    case 'emboss':       shadows.push(`inset 0 1.5px 0 ${c1}aa`, 'inset 0 -1px 0 rgba(0,0,0,0.5)');                        break;
    case 'inner-glow':   shadows.push(`inset 0 0 12px ${c1}77`);                                                             break;
    case 'holo':         shadows.push(`0 0 10px ${c1}66`, `0 0 20px ${c2}44`);                                              break;
    case 'float':        shadows.push('0 8px 20px rgba(0,0,0,0.5)', '0 4px 8px rgba(0,0,0,0.3)');                           break;
    case 'tilt':         shadows.push('-5px 5px 15px rgba(0,0,0,0.5)');                                                      break;
    case 'fire-glow':    shadows.push('0 0 8px #ff6b35', '0 0 20px #ff6b3566');                                              break;
    case 'ice-glow':     shadows.push('0 0 8px #48cae4', '0 0 20px #48cae466');                                              break;
    case 'deep':         shadows.push('0 1px 3px rgba(0,0,0,0.9)', '0 4px 10px rgba(0,0,0,0.6)', '0 10px 20px rgba(0,0,0,0.3)'); break;
    case 'rainbow-aura': shadows.push('-3px 0 10px #ff6b35', '3px 0 10px #48cae4', '0 -3px 10px #34d399', '0 3px 10px #f59e0b'); break;
    default: break;
  }

  let filter;
  if (effect === 'sepia') {
    filter = 'sepia(0.7)';
  } else if (effect === 'blur-out') {
    filter = `drop-shadow(0 0 6px ${c1}99) drop-shadow(0 0 12px ${c1}55)`;
  } else if (clipPath) {
    const ef = {
      'glow-sm':      `drop-shadow(0 0 6px ${c1}cc)`,
      'glow-lg':      `drop-shadow(0 0 12px ${c1}dd)`,
      'shadow':       'drop-shadow(0 2px 4px rgba(0,0,0,0.7))',
      'holo':         `drop-shadow(0 0 8px ${c1}bb)`,
      'float':        'drop-shadow(0 8px 12px rgba(0,0,0,0.6))',
      'tilt':         'drop-shadow(-4px 4px 8px rgba(0,0,0,0.6))',
      'fire-glow':    'drop-shadow(0 0 8px #ff6b35) drop-shadow(0 0 14px #ff6b3599)',
      'ice-glow':     'drop-shadow(0 0 8px #48cae4) drop-shadow(0 0 14px #48cae499)',
      'deep':         'drop-shadow(0 6px 8px rgba(0,0,0,0.7))',
      'rainbow-aura': 'drop-shadow(0 0 8px #f59e0b) drop-shadow(0 0 16px #48cae455)',
    };
    const bf = {
      'glow':       `drop-shadow(0 0 8px ${bc}cc)`,
      'neon-glow':  `drop-shadow(0 0 12px ${bc})`,
      'multi-glow': `drop-shadow(0 0 10px ${bc}dd)`,
      'thick-neon': `drop-shadow(0 0 12px ${bc})`,
    };
    filter = ef[effect] || bf[bdrType];
  }

  let textColor = c1;
  if (txtMode === 'white')       { textColor = '#fff'; }
  else if (txtMode === 'dark')   { textColor = '#1e1e2e'; }
  else if (txtMode === 'custom') { textColor = b.textCustomColor || '#ffffff'; }
  else if ([
    'gradient-h','gradient-v','gradient-diagonal','gradient-3',
    'radial','conic','glass','stripe','aurora','holographic',
    'metallic','fire','ocean','sunset','neon',
  ].includes(bgType)) {
    textColor = '#fff';
  }

  let textShadow = '0 0 1px rgba(0,0,0,0.6)';
  let fontWeight  = '600';
  if (txtStyle === 'bold')     { fontWeight  = '800'; }
  if (txtStyle === 'outlined') { textShadow = '-1px -1px 0 rgba(0,0,0,0.9), 1px -1px 0 rgba(0,0,0,0.9), -1px 1px 0 rgba(0,0,0,0.9), 1px 1px 0 rgba(0,0,0,0.9)'; }
  if (txtStyle === 'shadow')   { textShadow = '0 1px 4px rgba(0,0,0,0.9)'; }
  if (txtStyle === 'glow')     { textShadow = `0 0 8px ${c1}, 0 0 16px ${c1}88`; }

  const animClass = effect === 'shimmer' ? 'kwgu-badge-shimmer'
                  : effect === 'pulse'   ? 'kwgu-badge-pulse'
                  : effect === 'flicker' ? 'kwgu-badge-flicker'
                  : '';

  return {
    style: {
      background,
      ...(backgroundSize ? { backgroundSize }                 : {}),
      ...(borderProp     ? { border: borderProp }             : {}),
      ...(borderRadius   ? { borderRadius }                   : {}),
      ...(clipPath       ? { clipPath }                       : {}),
      ...(shadows.length ? { boxShadow: shadows.join(', ') } : {}),
      ...(filter         ? { filter }                         : {}),
      color: textColor,
      fontWeight,
      textShadow,
    },
    animClass,
    isClipPath: !!clipPath,
  };
}

export default function GuildBadge({ guildId, guildName, guildColor, size = 'sm', badgeConfig }) {
  const { guilds } = useApp();
  const guild    = guilds.find((g) => g.id === guildId);
  // Prefer the guild's dedicated badge name (emoji/abbreviation) when the
  // guild resolves; otherwise fall back to the passed-in name.
  const name     = guild ? (guild.badgeName || guild.name) : (guildName ?? '소속 없음');
  // 길드가 조회되면 현재(실시간) 색을 우선 사용 — 길드 색을 바꾸면 과거 신청 카드도 즉시 반영.
  const color    = guild ? (guild.color || guildColor || '#64748b') : (guildColor ?? '#64748b');
  const logoPath = guild?.logoPath;

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

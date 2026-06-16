import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { sortGuilds } from '../lib/utils';
import { flagImageUrl } from '../lib/guildPage';

// Bottom swallowtail notch (화환 깃발 느낌).
const TAIL_CLIP = 'polygon(0 0, 100% 0, 100% 88%, 50% 100%, 0 88%)';

function Flag({ guild, index, widthStyle }) {
  const [imgError, setImgError] = useState(false);
  const color = guild.color || '#64748b';
  const slug = guild.englishName;
  const src = slug ? flagImageUrl(slug) : '';
  const showImg = src && !imgError;
  const to = `/guild/${slug || guild.id}`;
  // Stagger the wave so flags don't move in unison.
  const delay = `${(index % 4) * 0.35}s`;

  return (
    <Link
      to={to}
      className="group flex flex-col items-center"
      style={widthStyle}
      title={guild.name}
    >
      {/* 가로 깃대 */}
      <div
        className="h-1.5 rounded-full shadow-sm"
        style={{ width: '78%', background: 'linear-gradient(90deg,#e2e8f0,#94a3b8,#64748b)' }}
      />
      {/* 매듭 줄 */}
      <div className="flex justify-between" style={{ width: '60%' }}>
        <span className="w-px h-2 bg-base-500" />
        <span className="w-px h-2 bg-base-500" />
      </div>

      {/* 천 — 바깥 레이어가 은색 테두리, 안쪽 레이어가 로고. (clip-path엔 border가
          안 먹으므로 같은 모양 레이어를 겹쳐 테두리를 만든다 → 확실하게 보임) */}
      <div
        className="kwgu-flag-cloth relative w-full transition-transform group-hover:scale-[1.05]"
        style={{
          aspectRatio: '4 / 5',
          clipPath: TAIL_CLIP,
          background: '#d7dde6',     // 은색 테두리 색
          padding: '3px',            // 테두리 두께
          animationDelay: delay,
          filter: `drop-shadow(0 0 7px rgba(215,221,230,0.55)) drop-shadow(0 6px 12px rgba(0,0,0,0.6))`,
        }}
      >
        <div
          className="relative w-full h-full overflow-hidden"
          style={{
            clipPath: TAIL_CLIP,
            // 로고가 있으면 어두운 배경(시그니처 초록 안 보이게), 없으면 시그니처 천.
            background: showImg
              ? '#0b0e13'
              : `linear-gradient(155deg, ${color} 0%, ${color}cc 45%, ${color}99 100%)`,
          }}
        >
          {/* 로고(꽉 차게) 또는 길드명 */}
          {showImg ? (
            <img
              src={src}
              alt={guild.name}
              onError={() => setImgError(true)}
              className="absolute inset-0 w-full h-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center px-1 text-center">
              <span
                className="font-black text-white leading-tight break-keep"
                style={{ fontSize: 'clamp(11px, 2.4vw, 18px)', textShadow: '0 1px 3px rgba(0,0,0,0.45)' }}
              >
                {guild.badgeName || guild.name}
              </span>
            </div>
          )}

          {/* 펄럭임 광택 */}
          <span
            className="kwgu-flag-sheen pointer-events-none absolute inset-y-0 -left-1/4 w-1/3"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)',
              animationDelay: delay,
            }}
          />
        </div>
      </div>

      <p className="mt-1.5 text-[11px] sm:text-xs font-bold text-base-300 group-hover:text-white transition text-center truncate w-full">
        {guild.name}
      </p>
    </Link>
  );
}

// 첫 줄은 4개, 둘째 줄부터는 6개씩 (각 줄 가운데 정렬, 왼쪽부터 채움).
// 모든 줄의 깃발 크기를 동일하게 유지 (maxWidth 통일). 첫 줄은 4개, 둘째 줄부터
// 6개로 '개수'만 다르고 각 깃발의 최대 크기는 같다.
const WIDTH_4 = { width: 'calc(25% - 24px)', maxWidth: 150, minWidth: 0 };
const WIDTH_6 = { width: 'calc(16.666% - 20px)', maxWidth: 150, minWidth: 0 };

export default function GuildFlags() {
  const { guilds } = useApp();
  // Default-true: a guild only disappears from the flag list when showFlag is
  // explicitly set to false in the super-admin guild editor.
  const list = sortGuilds(guilds.filter((g) => !g.isNone && g.showFlag !== false));
  if (list.length === 0) return null;

  const first = list.slice(0, 4);
  const rest = list.slice(4);

  return (
    <section className="mt-10">
      <div className="flex items-center gap-3 mb-4">
        <span className="flex-1 h-px bg-base-700/70" />
        <h2 className="text-sm font-bold text-base-400 tracking-wider">한국길드연합 소속 길드 소개</h2>
        <span className="flex-1 h-px bg-base-700/70" />
      </div>

      <div className="flex flex-wrap justify-center gap-6 sm:gap-8">
        {first.map((g, i) => (
          <Flag key={g.id} guild={g} index={i} widthStyle={WIDTH_4} />
        ))}
      </div>

      {rest.length > 0 && (
        <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mt-6">
          {rest.map((g, i) => (
            <Flag key={g.id} guild={g} index={i + 4} widthStyle={WIDTH_6} />
          ))}
        </div>
      )}
    </section>
  );
}

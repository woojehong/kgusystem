import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { sortGuilds } from '../lib/utils';
import { flagImageUrl } from '../lib/guildPage';

// Bottom swallowtail notch (화환 깃발 느낌).
const TAIL_CLIP = 'polygon(0 0, 100% 0, 100% 88%, 50% 100%, 0 88%)';

function Flag({ guild, index }) {
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
      style={{ width: 'calc(25% - 12px)', maxWidth: 150, minWidth: 64 }}
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

      {/* 천 */}
      <div
        className="kwgu-flag-cloth relative w-full overflow-hidden shadow-lg transition-transform group-hover:scale-[1.04]"
        style={{
          aspectRatio: '3 / 4',
          clipPath: TAIL_CLIP,
          background: `linear-gradient(155deg, ${color} 0%, ${color}cc 45%, ${color}99 100%)`,
          animationDelay: delay,
          border: `1px solid ${color}`,
        }}
      >
        {/* 로고 또는 길드명 */}
        {showImg ? (
          <img
            src={src}
            alt={guild.name}
            onError={() => setImgError(true)}
            className="absolute inset-0 w-full h-full object-contain p-2.5 drop-shadow"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-1 text-center">
            <span
              className="font-black text-white leading-tight break-keep"
              style={{ fontSize: 'clamp(11px, 2.4vw, 18px)', textShadow: '0 1px 3px rgba(0,0,0,0.45)' }}
            >
              {guild.name}
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

      <p className="mt-1.5 text-[11px] sm:text-xs font-bold text-base-300 group-hover:text-white transition text-center truncate w-full">
        {guild.name}
      </p>
    </Link>
  );
}

export default function GuildFlags() {
  const { guilds } = useApp();
  const list = sortGuilds(guilds.filter((g) => !g.isNone));
  if (list.length === 0) return null;

  return (
    <section className="mt-10">
      <div className="flex items-center gap-3 mb-4">
        <span className="flex-1 h-px bg-base-700/70" />
        <h2 className="text-sm font-bold text-base-400 tracking-wider">한길련 길드</h2>
        <span className="flex-1 h-px bg-base-700/70" />
      </div>
      <div className="flex flex-wrap justify-center gap-3 sm:gap-4">
        {list.map((g, i) => (
          <Flag key={g.id} guild={g} index={i} />
        ))}
      </div>
    </section>
  );
}

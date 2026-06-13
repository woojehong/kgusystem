import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import { buildBadgeStyles } from '../components/GuildBadge';
import {
  blockTextStyle,
  imgWidthValue,
  publicUrl,
  flagImageUrl,
  normalizePage,
} from '../lib/guildPage';

export default function GuildPage() {
  const { slug } = useParams();
  const { guilds, isSuper, profile } = useApp();

  const guild = useMemo(
    () => guilds.find((g) => g.englishName === slug || g.id === slug) || null,
    [guilds, slug]
  );

  if (!guild) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="text-center py-24 text-base-400">
          <p>존재하지 않는 길드입니다.</p>
          <Link to="/" className="text-indigo-400 hover:underline mt-2 inline-block">메인으로 돌아가기</Link>
        </div>
      </div>
    );
  }

  const isOwner = isSuper || (profile?.isGuildMaster && profile?.guildId === guild.id);
  const color = guild.color || '#64748b';
  const blocks = normalizePage(guild.page).blocks;
  const flag = guild.englishName ? flagImageUrl(guild.englishName) : '';

  const { style: badgeStyle, animClass, isClipPath } = buildBadgeStyles(guild.badge, color);

  return (
    <div className="min-h-screen pb-20">
      <Header />
      <main className="max-w-3xl mx-auto px-4 mt-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-base-400 hover:text-base-200 transition mb-4"
        >
          ← 메인으로
        </Link>

        {/* ── Hero ── */}
        <div
          className="card relative overflow-hidden p-7 flex flex-col items-center text-center"
          style={{ background: `radial-gradient(circle at 50% 0%, ${color}33 0%, transparent 70%)` }}
        >
          {flag && (
            <img
              src={flag}
              alt=""
              className="w-20 h-20 object-contain mb-3 drop-shadow"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          )}
          <span
            className={`inline-flex items-center justify-center text-lg font-bold px-7 py-3 ${animClass}`}
            style={{ ...badgeStyle, ...(isClipPath ? { minWidth: '9rem', minHeight: '3rem' } : {}) }}
          >
            {guild.name}
          </span>
          {guild.shortName && (
            <p className="mt-2 text-sm text-base-400">[{guild.shortName}]</p>
          )}
        </div>

        {/* ── 소개글 ── */}
        <div className="mt-5 space-y-4">
          {blocks.length === 0 ? (
            <div className="card p-10 text-center text-base-400">
              <p>아직 등록된 소개글이 없습니다.</p>
              {isOwner && (
                <p className="text-sm text-base-500 mt-2">
                  프로필 → 길드 정보 → 소개글에서 페이지를 꾸밀 수 있습니다.
                </p>
              )}
            </div>
          ) : (
            <div className="card p-5 sm:p-7 space-y-4">
              {blocks.map((b) => {
                if (b.type === 'text') {
                  return (
                    <p key={b.id} style={blockTextStyle(b)}>
                      {b.text}
                    </p>
                  );
                }
                if (b.type === 'image') {
                  if (!b.path) return null;
                  return (
                    <div key={b.id} className="flex justify-center">
                      <img
                        src={publicUrl(b.path)}
                        alt=""
                        className="rounded-xl border border-base-700"
                        style={{ width: imgWidthValue(b.width) }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    </div>
                  );
                }
                if (b.type === 'divider') {
                  return <hr key={b.id} className="border-base-700" />;
                }
                return null;
              })}
            </div>
          )}

          {isOwner && blocks.length > 0 && (
            <p className="text-center text-xs text-base-500">
              편집: 프로필 → 길드 정보 → 소개글
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

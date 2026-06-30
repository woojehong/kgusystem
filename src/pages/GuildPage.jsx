import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import Header from '../components/Header';
import { buildBadgeStyles } from '../components/GuildBadge';
import GuildMemberManager from '../components/GuildMemberManager';
import {
  blockTextStyle,
  imgWidthValue,
  resolveImagePath,
  normalizePage,
  heroBackground,
  fontCss,
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
  const { hero, blocks } = normalizePage(guild.page, color);

  const logoUrl = guild.logoPath ? resolveImagePath(guild.logoPath, guild.englishName) : '';
  const badgeLabel = guild.badgeName || guild.name;
  const { style: badgeStyle, animClass: badgeAnim, isClipPath: badgeClip } = buildBadgeStyles(guild.badge, color);

  const nameStyle = {
    fontFamily: fontCss(hero.nameFont),
    color: hero.nameColor,
    fontSize: hero.nameSize,
    fontWeight: 800,
    lineHeight: 1.2,
  };
  const tagStyle = {
    fontFamily: fontCss(hero.tagFont),
    color: hero.tagColor,
    fontSize: hero.tagSize,
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap',
  };

  const heroEmpty =
    !hero.showBadge &&
    !(hero.showLogo && logoUrl) &&
    !hero.showName &&
    !(hero.showTag && hero.tagText);

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

        {/* ── Hero (타이틀 박스) — 부품 조립식 ── */}
        {hero.showBox && !heroEmpty && (
          <div
            className="card relative overflow-hidden p-7 flex flex-col items-center text-center gap-3"
            style={{ background: heroBackground(hero, color) }}
          >
            {hero.showLogo && logoUrl && (
              <img
                src={logoUrl}
                alt=""
                className="w-24 h-24 object-contain drop-shadow"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
              />
            )}
            {hero.showBadge && (
              <span
                className={`inline-flex items-center justify-center text-lg font-bold px-7 py-3 ${badgeAnim}`}
                style={{ ...badgeStyle, ...(badgeClip ? { minWidth: '9rem', minHeight: '3rem' } : {}) }}
              >
                {badgeLabel}
              </span>
            )}
            {hero.showName && <p className="break-keep" style={nameStyle}>{guild.name}</p>}
            {hero.showTag && hero.tagText && <p className="break-keep" style={tagStyle}>{hero.tagText}</p>}
          </div>
        )}

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
                        src={resolveImagePath(b.path, guild.englishName)}
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

        {/* ── 길드원 관리 (길드 마스터 전용, 일반 길드만) ── */}
        {!guild.isUnion && !guild.isNone && <GuildMemberManager guild={guild} />}
      </main>
    </div>
  );
}

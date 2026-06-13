import { badgeTextStyle, wclUrl, raiderUrl, armoryUrl } from '../lib/utils';

/**
 * Compact applicant card — designed for half-width grid columns.
 * Layout:
 *   Row 1: [guild badge] [👑?] [char name] ··· [ilvl] [rank]
 *   Row 2: [spec · swap]
 *   Admin: [divider] [login ID center] [3 links center] [memo]
 */

function RankBadge({ rank }) {
  const m = String(rank).match(/^([A-Za-z]+)(\d+)$/);
  if (m) {
    return (
      <span className="inline-flex items-baseline px-1.5 h-[1.2rem] rounded-full bg-base-700 text-base-300 shrink-0">
        <span className="text-[8px] leading-none opacity-60">{m[1]}</span>
        <span className="text-[11px] font-black leading-none">{m[2]}</span>
      </span>
    );
  }
  return (
    <span className="text-[11px] px-1.5 h-[1.2rem] inline-flex items-center rounded-full bg-base-700 text-base-200 font-bold shrink-0">
      {rank}
    </span>
  );
}

export default function ApplicantCard({ app, rank, memo, adminView, onAdminClick, highlight }) {
  const specDisplay = app.isReservation && !app.classId
    ? null
    : (app.allSpecNames?.length ? app.allSpecNames : [app.specName]).filter(Boolean).join(' · ');

  const hasCharInfo = !app.isReservation && app.charName && app.server;

  return (
    <div
      className={`rounded-xl border p-2.5 bg-base-850 transition ${
        highlight ? 'border-indigo-400/60' : 'border-base-700'
      } ${adminView ? 'cursor-pointer hover:border-base-500' : ''}`}
      onClick={adminView ? () => onAdminClick(app) : undefined}
      role={adminView ? 'button' : undefined}
      tabIndex={adminView ? 0 : undefined}
      onKeyDown={adminView ? (e) => { if (e.key === 'Enter') onAdminClick(app); } : undefined}
    >
      {/* ── Row 1: guild badge · [crown] name · ilvl + rank ── */}
      <div className="flex items-center gap-1.5 min-w-0">
        {/* Guild badge (compact) */}
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 leading-none"
          style={{
            color: app.guildColor || '#94a3b8',
            backgroundColor: `${app.guildColor || '#94a3b8'}1a`,
            border: `1px solid ${app.guildColor || '#94a3b8'}55`,
          }}
        >
          {app.guildName || '無'}
        </span>

        {/* Crown for guild masters — to the left of the name */}
        {app.isGuildMaster && (
          <span className="text-xs leading-none shrink-0" title="길드장">👑</span>
        )}

        {/* Character name */}
        <span
          className="font-bold text-sm truncate min-w-0 flex-1"
          style={badgeTextStyle(app.classColor)}
        >
          {app.charName}
        </span>

        {/* Reservation tag */}
        {app.isReservation && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold shrink-0">
            예약
          </span>
        )}

        {/* ilvl + rank (right-aligned) */}
        <span className="flex items-center gap-1 shrink-0 ml-auto">
          {app.ilvl != null && (
            <span className="text-xs text-base-300 font-medium">{app.ilvl}</span>
          )}
          {rank != null && <RankBadge rank={rank} />}
        </span>
      </div>

      {/* ── Row 2: spec · swap ── */}
      <p className="mt-0.5 text-[11px] truncate leading-tight">
        {app.isReservation && !app.classId ? (
          <span className="text-base-500">클래스 미지정</span>
        ) : (
          <>
            <span style={badgeTextStyle(app.classColor)}>{specDisplay}</span>
            {app.swap && <span className="text-indigo-400"> · 스왑↔</span>}
          </>
        )}
      </p>

      {/* ── Admin section ── */}
      {adminView && (
        <div className="mt-2 pt-1.5 border-t border-base-700/60 text-center space-y-1">
          {app.nickname && (
            <p className="text-[11px] text-base-400">
              로그인ID{' '}
              <span className="font-semibold text-base-200">{app.nickname}</span>
            </p>
          )}
          {hasCharInfo && (
            <div className="flex justify-center gap-3 flex-wrap">
              <a
                href={wclUrl(app.server, app.charName)}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] text-sky-400 hover:text-sky-200 transition font-medium"
              >
                WCL
              </a>
              <a
                href={raiderUrl(app.server, app.charName)}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] text-emerald-400 hover:text-emerald-200 transition font-medium"
              >
                Raider.io
              </a>
              <a
                href={armoryUrl(app.server, app.charName)}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] text-amber-400 hover:text-amber-200 transition font-medium"
              >
                전투정보실
              </a>
            </div>
          )}
          {memo && <p className="text-[11px] text-base-300 break-words">📝 {memo}</p>}
        </div>
      )}
    </div>
  );
}

import { badgeTextStyle, wclUrl, raiderUrl, armoryUrl } from '../lib/utils';

/**
 * Applicant card — 3-column grid layout.
 *
 * Col 1 (auto, center) : guild badge
 * Col 2 (1fr, center)  : 👑? + char name + reservation tag
 * Col 3 (1fr)          : spec (left) ·· ilvl + rank (right)
 *
 * Admin section: full-width divider → login ID → 3 links (all centered)
 */

const ROLE_COLORS = { T: '#38bdf8', H: '#34d399', D: '#fb7185' };

function RankBadge({ rank }) {
  const m = String(rank).match(/^([A-Za-z]+)(\d+)$/);
  if (m) {
    const letterColor = ROLE_COLORS[m[1]] || '#94a3b8';
    return (
      <span className="inline-flex items-center gap-1 px-2 h-6 rounded-full bg-base-700 shrink-0">
        <span className="text-xs font-semibold" style={{ color: letterColor }}>{m[1]}</span>
        <span className="text-xs font-black text-white">{m[2]}</span>
      </span>
    );
  }
  return (
    <span className="text-xs px-2 h-6 inline-flex items-center rounded-full bg-base-700 text-white font-bold shrink-0">
      {rank}
    </span>
  );
}

export default function ApplicantCard({ app, rank, memo, adminView, onAdminClick, highlight }) {
  const specDisplay = app.isReservation && !app.classId
    ? '클래스 미지정'
    : (app.allSpecNames?.length ? app.allSpecNames : [app.specName]).filter(Boolean).join(' · ');

  const hasCharInfo = !app.isReservation && app.charName && app.server;

  return (
    <div
      className={`rounded-xl border p-3 bg-base-850 transition ${
        highlight ? 'border-indigo-400/60' : 'border-base-700'
      } ${adminView ? 'cursor-pointer hover:border-base-500' : ''}`}
      onClick={adminView ? () => onAdminClick(app) : undefined}
      role={adminView ? 'button' : undefined}
      tabIndex={adminView ? 0 : undefined}
      onKeyDown={adminView ? (e) => { if (e.key === 'Enter') onAdminClick(app); } : undefined}
    >
      {/* ── 3-column main row ── */}
      <div
        className="grid items-center gap-x-2 min-w-0"
        style={{ gridTemplateColumns: 'auto minmax(0,1fr) minmax(0,1.4fr)' }}
      >
        {/* Col 1: Guild badge (centered) */}
        <div className="flex justify-center">
          <span
            className="text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap"
            style={{
              color: app.guildColor || '#94a3b8',
              backgroundColor: `${app.guildColor || '#94a3b8'}1a`,
              border: `1px solid ${app.guildColor || '#94a3b8'}55`,
            }}
          >
            {app.guildName || '無'}
          </span>
        </div>

        {/* Col 2: 👑 + name + reservation tag (centered) */}
        <div className="flex items-center justify-center gap-1 min-w-0 px-1">
          {app.isGuildMaster && (
            <span className="text-sm leading-none shrink-0" title="길드장">👑</span>
          )}
          <span
            className="font-bold text-sm truncate"
            style={badgeTextStyle(app.classColor)}
          >
            {app.charName}
          </span>
          {app.isReservation && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold shrink-0">
              예약
            </span>
          )}
        </div>

        {/* Col 3: spec (left) + ilvl · rank (right) */}
        <div className="flex items-center justify-between gap-1 min-w-0">
          <span
            className="text-xs truncate"
            style={badgeTextStyle(app.classColor)}
          >
            {specDisplay}
          </span>
          <span className="flex items-center gap-1 shrink-0">
            {app.ilvl != null && (
              <span className="text-sm text-base-200 font-medium">{app.ilvl}</span>
            )}
            {rank != null && <RankBadge rank={rank} />}
          </span>
        </div>
      </div>

      {/* ── Admin section ── */}
      {adminView && (
        <div className="mt-2 pt-2 border-t border-base-700/60 text-center space-y-1">
          {app.nickname && (
            <p className="text-xs text-base-400">
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
                className="text-xs text-sky-400 hover:text-sky-200 transition font-medium"
              >
                WCL
              </a>
              <a
                href={raiderUrl(app.server, app.charName)}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-emerald-400 hover:text-emerald-200 transition font-medium"
              >
                Raider.io
              </a>
              <a
                href={armoryUrl(app.server, app.charName)}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-amber-400 hover:text-amber-200 transition font-medium"
              >
                전투정보실
              </a>
            </div>
          )}
          {memo && <p className="text-xs text-base-300 break-words">📝 {memo}</p>}
        </div>
      )}
    </div>
  );
}

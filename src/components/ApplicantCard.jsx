import { badgeTextStyle, wclUrl } from '../lib/utils';

/**
 * One applicant row.
 * - First line : guild badge · [crown] · char name · reservation tag · ilvl · rank
 * - Second line: all registered spec names (colour-tinted) · 스왑가능
 * - Admin section (adminView only): nickname · WCL link · memo
 */
export default function ApplicantCard({ app, rank, memo, adminView, onAdminClick, highlight }) {
  const specDisplay = app.isReservation && !app.classId
    ? null
    : (app.allSpecNames?.length ? app.allSpecNames : [app.specName]).filter(Boolean).join(' · ');

  return (
    <div
      className={`rounded-xl border p-4 bg-base-850 transition ${
        highlight ? 'border-indigo-400/60' : 'border-base-700'
      } ${adminView ? 'cursor-pointer hover:border-base-500' : ''}`}
      onClick={adminView ? () => onAdminClick(app) : undefined}
      role={adminView ? 'button' : undefined}
      tabIndex={adminView ? 0 : undefined}
      onKeyDown={
        adminView
          ? (e) => { if (e.key === 'Enter') onAdminClick(app); }
          : undefined
      }
    >
      {/* ── First line ── */}
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="text-[11px] px-2 py-0.5 rounded-full font-bold shrink-0"
          style={{
            color: app.guildColor || '#94a3b8',
            backgroundColor: `${app.guildColor || '#94a3b8'}1a`,
            border: `1px solid ${app.guildColor || '#94a3b8'}55`,
          }}
        >
          {app.guildName || '소속 없음'}
        </span>

        {app.isGuildMaster && <span className="text-base leading-none shrink-0">👑</span>}

        <span
          className="font-bold text-xl truncate"
          style={badgeTextStyle(app.classColor)}
        >
          {app.charName}
        </span>

        {app.isReservation && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold shrink-0">
            예약
          </span>
        )}

        <span className="ml-auto flex items-center gap-2 shrink-0">
          {app.ilvl != null && (
            <span className="text-lg font-semibold text-base-200">{app.ilvl}</span>
          )}
          {rank != null && (
            <span className="text-sm w-7 h-7 inline-flex items-center justify-center rounded-full bg-base-700 text-base-300 font-bold shrink-0">
              {rank}
            </span>
          )}
        </span>
      </div>

      {/* ── Second line ── */}
      <p className="mt-1.5 text-sm text-base-400 truncate">
        {app.isReservation && !app.classId ? (
          '클래스 미지정'
        ) : (
          <>
            <span style={badgeTextStyle(app.classColor)}>{specDisplay}</span>
            {app.swap && <span className="text-indigo-300"> · 스왑가능</span>}
          </>
        )}
      </p>

      {/* ── Admin section ── */}
      {adminView && (
        <div className="mt-2 pt-2 border-t border-base-700/60 space-y-1">
          {app.nickname && (
            <p className="text-xs text-base-400">
              닉네임 <span className="text-base-200 font-semibold">{app.nickname}</span>
            </p>
          )}
          {!app.isReservation && app.charName && app.server && (
            <a
              href={wclUrl(app.server, app.charName)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="block text-xs text-sky-400 hover:text-sky-300 truncate transition"
            >
              🔗 WCL 바로가기
            </a>
          )}
          {memo && <p className="text-xs text-base-300 break-words">📝 {memo}</p>}
        </div>
      )}
    </div>
  );
}

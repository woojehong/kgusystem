import { badgeTextStyle, wclUrl } from '../lib/utils';

/**
 * One applicant row. Admin-only extras (WCL link, memo) are rendered
 * when `adminView` is true. `rank` is the computed per-position order.
 */
export default function ApplicantCard({ app, rank, memo, adminView, onAdminClick, highlight }) {
  return (
    <div
      className={`rounded-xl border p-2.5 bg-base-850 transition ${
        highlight ? 'border-indigo-400/60' : 'border-base-700'
      } ${adminView ? 'cursor-pointer hover:border-base-500' : ''}`}
      onClick={adminView ? () => onAdminClick(app) : undefined}
      role={adminView ? 'button' : undefined}
      tabIndex={adminView ? 0 : undefined}
      onKeyDown={
        adminView
          ? (e) => {
              if (e.key === 'Enter') onAdminClick(app);
            }
          : undefined
      }
    >
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0"
          style={{
            color: app.guildColor || '#94a3b8',
            backgroundColor: `${app.guildColor || '#94a3b8'}1a`,
            border: `1px solid ${app.guildColor || '#94a3b8'}55`,
          }}
        >
          {app.guildName || '소속 없음'}
        </span>
        <span className="font-bold text-sm truncate" style={badgeTextStyle(app.classColor)}>
          {app.charName}
        </span>
        {app.isReservation && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold shrink-0">
            예약
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5 shrink-0">
          {app.ilvl != null && <span className="text-xs font-semibold text-base-200">{app.ilvl}</span>}
          {rank != null && (
            <span className="text-[10px] w-5 h-5 inline-flex items-center justify-center rounded-full bg-base-700 text-base-300 font-bold">
              {rank}
            </span>
          )}
        </span>
      </div>

      <p className="mt-1 text-xs text-base-400 truncate">
        {app.isReservation && !app.classId ? (
          '클래스 미지정'
        ) : (
          <>
            <span style={badgeTextStyle(app.classColor)}>{app.className}</span>
            {app.specName && <span> | {app.specName}</span>}
            {app.swap && <span className="text-indigo-300"> | 스왑가능</span>}
            {app.nickname && app.nickname !== app.charName && (
              <span className="text-base-400"> · {app.nickname}</span>
            )}
          </>
        )}
      </p>

      {adminView && (
        <div className="mt-1.5 pt-1.5 border-t border-base-700/60 space-y-0.5">
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

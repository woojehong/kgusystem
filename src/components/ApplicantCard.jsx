import { badgeTextStyle, wclUrl, raiderUrl, armoryUrl } from '../lib/utils';
import GuildBadge from './GuildBadge';
import FitText from './FitText';

/**
 * Applicant card.
 * Row 1 (center) : guild badge
 * Row 2 (center) : 👑? + char name (auto-fit) + reservation tag
 * Row 3          : desktop = spec(left) / ilvl(center) / rank(right)
 *                  mobile  = each stacked & centered
 * borderColor    : when set, the card is outlined in that colour (used to
 *                  outline confirmed/active members in their class colour).
 */

const ROLE_COLORS = { T: '#38bdf8', H: '#34d399', D: '#fb7185' };

function RankBadge({ rank }) {
  const m = String(rank).match(/^([A-Za-z]+)(\d+)$/);
  if (m) {
    const letterColor = ROLE_COLORS[m[1]] || '#94a3b8';
    return (
      <span className="inline-flex items-center gap-0.5 px-1.5 h-5 rounded-full bg-base-700 shrink-0">
        <span className="text-[10px] font-semibold" style={{ color: letterColor }}>{m[1]}</span>
        <span className="text-[10px] font-black text-white">{m[2]}</span>
      </span>
    );
  }
  return (
    <span className="text-[10px] px-1.5 h-5 inline-flex items-center rounded-full bg-base-700 text-white font-bold shrink-0">
      {rank}
    </span>
  );
}

export default function ApplicantCard({ app, rank, memo, adminView, onAdminClick, borderColor }) {
  const specDisplay = app.isReservation && !app.classId
    ? '클래스 미지정'
    : (app.allSpecNames?.length ? app.allSpecNames : [app.specName]).filter(Boolean).join('·');

  const hasCharInfo = !app.isReservation && app.charName && app.server;
  const guildColor = app.guildColor || '#94a3b8';

  return (
    <div
      className={`rounded-xl p-2 bg-base-850 transition ${
        borderColor ? 'border-2' : 'border border-base-700'
      } ${adminView ? 'cursor-pointer hover:brightness-110' : ''}`}
      style={borderColor ? { borderColor } : undefined}
      onClick={adminView ? () => onAdminClick(app) : undefined}
      role={adminView ? 'button' : undefined}
      tabIndex={adminView ? 0 : undefined}
      onKeyDown={adminView ? (e) => { if (e.key === 'Enter') onAdminClick(app); } : undefined}
    >
      {/* ── 줄 1: 길드 뱃지 (중앙) ── */}
      <div className="flex justify-center mb-1">
        <GuildBadge guildId={app.guildId} guildName={app.guildName || '無'} guildColor={guildColor} size="xs" />
      </div>

      {/* ── 줄 2: 👑+이름 (한 몸으로 가운데정렬, 자동 맞춤) ── */}
      <div className="flex items-center justify-center gap-1 min-w-0 mb-0.5">
        {app.isGuildMaster && (
          <span className="text-sm leading-none shrink-0" title="길드장">👑</span>
        )}
        <FitText max={24} min={11} className="font-extrabold" style={badgeTextStyle(app.classColor)}>
          {app.charName}
        </FitText>
        {app.isReservation && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold shrink-0">
            예약
          </span>
        )}
      </div>

      {/* ── 줄 3: 특성 / 템렙 / 순번 (데스크탑 1줄, 모바일 세로 가운데) ── */}
      <div
        className="flex flex-col items-center gap-0.5 sm:grid sm:gap-0 sm:items-center min-w-0"
        style={{ gridTemplateColumns: '1fr auto 1fr' }}
      >
        <span className="text-xs truncate max-w-full text-center sm:text-left" style={badgeTextStyle(app.classColor)}>
          {specDisplay}
        </span>
        <span className="text-sm font-bold text-base-100 text-center px-1">
          {app.ilvl != null ? app.ilvl : ''}
        </span>
        <div className="flex justify-center sm:justify-end">
          {rank != null && <RankBadge rank={rank} />}
        </div>
      </div>

      {/* ── 관리자 영역 ── */}
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
              <a href={wclUrl(app.server, app.charName)} target="_blank" rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-sky-400 hover:text-sky-200 transition font-medium">WCL</a>
              <a href={raiderUrl(app.server, app.charName)} target="_blank" rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-emerald-400 hover:text-emerald-200 transition font-medium">Raider.io</a>
              <a href={armoryUrl(app.server, app.charName)} target="_blank" rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-amber-400 hover:text-amber-200 transition font-medium">전투정보실</a>
            </div>
          )}
          {memo && <p className="text-xs text-base-300 break-words">📝 {memo}</p>}
        </div>
      )}
    </div>
  );
}

import { badgeTextStyle } from '../lib/utils';
import GuildBadge from './GuildBadge';

// 모바일 로스터 한 줄 (전체폭 리스트). 이름은 고정 크기로 통일(축소 없음),
// 오른쪽에 예약·길드뱃지·아이템레벨·순번을 이름과 겹치지 않게 배치.
const ROLE_COLORS = { T: '#38bdf8', H: '#34d399', D: '#fb7185' };

function Rank({ rank }) {
  const m = String(rank).match(/^([A-Za-z]+)(\d+)$/);
  const letter = m ? m[1] : String(rank);
  const num = m ? m[2] : '';
  const col = ROLE_COLORS[letter] || '#94a3b8';
  return (
    <span className="inline-flex items-center gap-0.5 px-1.5 h-5 rounded-full bg-base-700 shrink-0">
      <span className="text-[10px] font-semibold" style={{ color: col }}>{letter}</span>
      {num && <span className="text-[10px] font-black text-white">{num}</span>}
    </span>
  );
}

export default function MobileRosterRow({ app, rank, adminView, onAdminClick }) {
  const specDisplay = app.isReservation && !app.classId
    ? '클래스 미지정'
    : (app.allSpecNames?.length ? app.allSpecNames : [app.specName]).filter(Boolean).join('·');
  const classColor = app.classColor || '#cbd5e1';

  return (
    <div
      onClick={adminView ? () => onAdminClick(app) : undefined}
      role={adminView ? 'button' : undefined}
      tabIndex={adminView ? 0 : undefined}
      onKeyDown={adminView ? (e) => { if (e.key === 'Enter') onAdminClick(app); } : undefined}
      className={`flex items-center gap-2 rounded-lg bg-base-850 border border-base-700 py-1.5 pr-2 overflow-hidden ${
        adminView ? 'cursor-pointer hover:brightness-110' : ''
      }`}
      style={{ borderLeft: `3px solid ${classColor}` }}
    >
      {/* 왼쪽: 이름(고정 크기) + 특성 */}
      <div className="min-w-0 flex-1 flex items-baseline gap-1.5 pl-2">
        {app.isGuildMaster && <span className="text-sm leading-none shrink-0" title="길드장">👑</span>}
        <span className="font-extrabold text-[15px] truncate" style={badgeTextStyle(classColor)}>
          {app.charName}
        </span>
        <span className="text-[11px] text-base-400 shrink-0 truncate max-w-[40%]">{specDisplay}</span>
      </div>

      {/* 오른쪽: 예약 · 길드뱃지 · 템렙 · 순번 */}
      <div className="flex items-center gap-1.5 shrink-0">
        {app.isReservation && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">예약</span>
        )}
        <GuildBadge guildId={app.guildId} guildName={app.guildName || '無'} guildColor={app.guildColor || '#94a3b8'} size="xs" />
        {app.ilvl != null && <span className="text-sm font-bold text-base-100 tabular-nums">{app.ilvl}</span>}
        {rank != null && <Rank rank={rank} />}
      </div>
    </div>
  );
}

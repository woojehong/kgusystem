import { useApp } from '../context/AppContext';
import { badgeTextStyle, appSpecList, wclUrl, raiderUrl, armoryUrl } from '../lib/utils';
import GuildBadge from './GuildBadge';
import SpecIcon from './SpecIcon';

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

// 목록형 로스터 한 줄. 이름 칸을 고정폭으로 둬 특성이 항상 같은 위치에서 시작한다.
// 관리자뷰면 두 번째 줄에 WCL/Raider/전투정보실/메모가 추가된다.
export default function RosterListRow({ app, rank, memo, adminView, onAdminClick }) {
  const { gamedata } = useApp();
  const classColor = app.classColor || '#cbd5e1';
  const specs = appSpecList(gamedata.classes, app);
  const hasCharInfo = !app.isReservation && app.charName && app.server;

  return (
    <div
      onClick={adminView ? () => onAdminClick(app) : undefined}
      role={adminView ? 'button' : undefined}
      tabIndex={adminView ? 0 : undefined}
      onKeyDown={adminView ? (e) => { if (e.key === 'Enter') onAdminClick(app); } : undefined}
      className={`rounded-lg bg-base-850 border border-base-700 px-2 py-1.5 overflow-hidden ${
        adminView ? 'cursor-pointer hover:brightness-110' : ''
      }`}
      style={{ borderLeft: `3px solid ${classColor}` }}
    >
      {/* 1줄: 뱃지 · 이름(고정폭) · 특성 · 템렙 · 순번 */}
      <div className="grid items-center gap-2" style={{ gridTemplateColumns: '5rem 9.5rem 1fr auto auto' }}>
        <div className="flex items-center justify-center">
          <GuildBadge guildId={app.guildId} guildName={app.guildName || '無'} guildColor={app.guildColor || '#94a3b8'} size="xs" />
        </div>

        {/* 왕관(길마) → 1순위 특성 아이콘 → 아이디 */}
        <div className="min-w-0 flex items-center gap-1">
          {app.isGuildMaster && <span className="text-xs leading-none shrink-0" title="길드장">👑</span>}
          <SpecIcon specId={app.specId} size={16} className="shrink-0" />
          <span className="font-extrabold text-[15px] truncate" style={badgeTextStyle(classColor)}>
            {app.charName}
          </span>
        </div>

        <div className="min-w-0 flex items-center gap-2 overflow-hidden">
          {specs.length ? (
            specs.map((s, i) => (
              <SpecIcon key={s.id || s.name || i} specId={s.id} name={s.name} showName size={16} color={classColor} className="text-[12px] font-semibold shrink-0" />
            ))
          ) : (
            <span className="text-[12px] text-base-500">{app.isReservation ? '미지정' : ''}</span>
          )}
        </div>

        <span className="text-sm font-bold text-base-100 tabular-nums text-right px-1">
          {app.ilvl != null ? app.ilvl : ''}
        </span>

        <div className="flex justify-end">{rank != null && <Rank rank={rank} />}</div>
      </div>

      {/* 2줄(관리자뷰): 로그인ID · 외부링크 · 메모 */}
      {adminView && (
        <div className="mt-1.5 pt-1.5 border-t border-base-700/60 flex items-center flex-wrap gap-x-3 gap-y-0.5 pl-1">
          {app.nickname && (
            <span className="text-[11px] text-base-400">
              ID <span className="font-semibold text-base-200">{app.nickname}</span>
            </span>
          )}
          {hasCharInfo && (
            <>
              <a href={wclUrl(app.server, app.charName)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[11px] text-sky-400 hover:text-sky-200 font-medium">WCL</a>
              <a href={raiderUrl(app.server, app.charName)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[11px] text-emerald-400 hover:text-emerald-200 font-medium">Raider</a>
              <a href={armoryUrl(app.server, app.charName)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[11px] text-amber-400 hover:text-amber-200 font-medium">전투정보실</a>
            </>
          )}
          {memo && <span className="text-[11px] text-base-300 truncate">📝 {memo}</span>}
        </div>
      )}
    </div>
  );
}

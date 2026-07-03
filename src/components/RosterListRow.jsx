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

// ALT(스왑용 차선책) 박스 — 위에 'ALT' 라벨(지붕), 아래에 2·3순위 특성아이콘(작게).
function AltBox({ specs }) {
  if (!specs.length) return null;
  return (
    <div className="shrink-0 flex flex-col items-center" title="스왑 가능 특성">
      <span className="text-[7px] font-black leading-none text-base-300 bg-base-700 rounded px-1 py-px tracking-[0.15em]">ALT</span>
      <div className="flex items-center gap-0.5 mt-0.5">
        {specs.map((s) => <SpecIcon key={s.id} specId={s.id} size={12} />)}
      </div>
    </div>
  );
}

// 목록형 로스터 한 줄.
//   variant='flex' : 데스크탑 4열 카드용 (컴팩트, 우측 밀착)
//   variant='grid' : 모바일용 표 정렬 (뱃지·아이디·ALT·아이템레벨·순번이 모든 행에서 같은 열)
// 아이디는 박스 크기는 그대로 두고 길 때만 폰트만 축소. 관리자뷰 2번째 줄: (일반)ID / (예약)예약등록 관리자 · 링크 · 메모(…생략).
export default function RosterListRow({ app, rank, memo, adminView, onAdminClick, variant = 'flex' }) {
  const { gamedata } = useApp();
  const classColor = app.classColor || '#cbd5e1';
  const specs = appSpecList(gamedata.classes, app);
  const extraSpecs = specs.filter((s) => s.id && s.id !== app.specId).slice(0, 2);
  const hasCharInfo = app.charName && app.server;

  const nameLen = (app.charName || '').length;
  let nameSize = 14;
  if (nameLen >= 7) nameSize = 12;
  else if (nameLen === 6) nameSize = 13;
  const nameStyle = {
    ...badgeTextStyle(classColor),
    fontSize: `${nameSize}px`,
    ...(nameLen >= 6 ? { letterSpacing: '-0.02em' } : {}),
  };

  const badge = (
    <GuildBadge guildId={app.guildId} guildName={app.guildName || '無'} guildColor={app.guildColor || '#94a3b8'} size="xs" />
  );
  const crown = app.isGuildMaster ? (
    <span className="shrink-0 inline-flex items-center justify-center" style={{ width: 16, height: 16, fontSize: 13, lineHeight: 1, transform: 'translateY(1px)' }} title="길드장">👑</span>
  ) : null;
  const nameCluster = (
    <div className="flex items-center gap-0.5 min-w-0">
      {crown}
      <SpecIcon specId={app.specId} size={16} className="shrink-0" />
      <span className="font-extrabold truncate min-w-0 leading-tight" style={nameStyle}>{app.charName}</span>
    </div>
  );
  const ilvlEl = app.ilvl != null ? (
    <span className="text-[13px] font-bold text-base-100 tabular-nums">{app.ilvl}</span>
  ) : null;
  const rankEl = rank != null ? <Rank rank={rank} /> : null;

  return (
    <div
      onClick={adminView ? () => onAdminClick(app) : undefined}
      role={adminView ? 'button' : undefined}
      tabIndex={adminView ? 0 : undefined}
      onKeyDown={adminView ? (e) => { if (e.key === 'Enter') onAdminClick(app); } : undefined}
      className={`h-full rounded-lg bg-base-850 border border-base-700 px-2 py-1.5 ${
        adminView ? 'cursor-pointer hover:brightness-110' : ''
      }`}
      style={{ borderLeft: `3px solid ${classColor}` }}
    >
      {/* 1줄 */}
      {variant === 'grid' ? (
        <div className="grid items-center gap-1" style={{ gridTemplateColumns: '5rem 1fr 3rem 2.5rem 2.75rem' }}>
          <div className="flex justify-center min-w-0">{badge}</div>
          {nameCluster}
          <div className="flex justify-center">{<AltBox specs={extraSpecs} />}</div>
          <div className="text-right tabular-nums">{ilvlEl}</div>
          <div className="flex justify-end">{rankEl}</div>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          {badge}
          {nameCluster}
          <div className="ml-auto flex items-center gap-2 shrink-0 pl-1">
            <AltBox specs={extraSpecs} />
            {ilvlEl}
            {rankEl}
          </div>
        </div>
      )}

      {/* 2줄 (관리자뷰) */}
      {adminView && (
        <div className="mt-1 pt-1 border-t border-base-700/60 flex items-center gap-x-2.5 overflow-hidden pl-0.5">
          {app.isReservation ? (
            <span className="text-[11px] text-base-400 shrink-0">
              예약등록 <span className="font-semibold text-amber-300">{app.addedByMaster || '관리자'}</span>
            </span>
          ) : (
            app.nickname && (
              <span className="text-[11px] text-base-400 shrink-0">
                ID <span className="font-semibold text-base-200">{app.nickname}</span>
              </span>
            )
          )}
          {hasCharInfo && (
            <>
              <a href={wclUrl(app.server, app.charName)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[11px] text-sky-400 hover:text-sky-200 font-medium shrink-0">WCL</a>
              <a href={raiderUrl(app.server, app.charName)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[11px] text-emerald-400 hover:text-emerald-200 font-medium shrink-0">Raider</a>
              <a href={armoryUrl(app.server, app.charName)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[11px] text-amber-400 hover:text-amber-200 font-medium shrink-0">전투정보실</a>
            </>
          )}
          {memo && <span className="text-[11px] text-base-300 truncate min-w-0">📝 {memo}</span>}
        </div>
      )}
    </div>
  );
}

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

// 목록형 로스터 한 줄 (한 줄에 4명 배치용 카드).
//   왼쪽정렬: 길드뱃지 · 왕관(길마) · 1순위 특성아이콘 · 아이디 · 2·3순위 특성아이콘
//   오른쪽정렬: 아이템레벨 · 신청번호(가장 오른쪽)
// 아이디는 박스/다른 요소 크기는 그대로 두고, 길고 혼잡할 때만 폰트만 축소한다.
// 관리자뷰면 두 번째 줄에 ID/WCL/Raider/전투정보실/메모(…생략). 행 클릭 시 관리 모달.
export default function RosterListRow({ app, rank, memo, adminView, onAdminClick }) {
  const { gamedata } = useApp();
  const classColor = app.classColor || '#cbd5e1';
  const specs = appSpecList(gamedata.classes, app);
  const extraSpecs = specs.filter((s) => s.id && s.id !== app.specId).slice(0, 2);
  const hasCharInfo = !app.isReservation && app.charName && app.server;

  // 아이디 폰트만 동적 축소: 왕관+추가특성(extras)이 많고 이름이 길수록 작게.
  const nameLen = (app.charName || '').length;
  const extras = extraSpecs.length + (app.isGuildMaster ? 1 : 0); // 0~3 혼잡도
  let nameSize = 14;
  if (nameLen >= 7) nameSize = extras >= 2 ? 11 : 13;
  else if (nameLen === 6) nameSize = extras >= 2 ? 12.5 : 14;
  const nameStyle = {
    ...badgeTextStyle(classColor),
    fontSize: `${nameSize}px`,
    ...(nameLen >= 6 ? { letterSpacing: '-0.02em' } : {}),
  };

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
      <div className="flex items-center gap-1">
        <GuildBadge guildId={app.guildId} guildName={app.guildName || '無'} guildColor={app.guildColor || '#94a3b8'} size="xs" />

        {app.isGuildMaster && (
          <span
            className="shrink-0 inline-flex items-center justify-center"
            style={{ width: 16, height: 16, fontSize: 12, lineHeight: 1 }}
            title="길드장"
          >
            👑
          </span>
        )}

        <SpecIcon specId={app.specId} size={16} className="shrink-0" />

        <span className="font-extrabold truncate min-w-0 leading-tight" style={nameStyle}>
          {app.charName}
        </span>

        {extraSpecs.map((s) => (
          <SpecIcon key={s.id} specId={s.id} size={16} className="shrink-0" />
        ))}

        <div className="ml-auto flex items-center gap-1.5 shrink-0 pl-1">
          {app.ilvl != null && (
            <span className="text-[13px] font-bold text-base-100 tabular-nums">{app.ilvl}</span>
          )}
          {rank != null && <Rank rank={rank} />}
        </div>
      </div>

      {/* 2줄 (관리자뷰): ID · 외부링크 · 메모(…생략, 한 줄 유지) */}
      {adminView && (
        <div className="mt-1 pt-1 border-t border-base-700/60 flex items-center gap-x-2.5 overflow-hidden pl-0.5">
          {app.nickname && (
            <span className="text-[11px] text-base-400 shrink-0">
              ID <span className="font-semibold text-base-200">{app.nickname}</span>
            </span>
          )}
          {hasCharInfo && (
            <>
              <a href={wclUrl(app.server, app.charName)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-[11px] text-sky-400 hover:text-sky-200 font-medium shrink-0">WCL</a>
              <a href={ra
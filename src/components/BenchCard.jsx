import { useApp } from '../context/AppContext';
import { badgeTextStyle, getClass } from '../lib/utils';
import GuildBadge from './GuildBadge';
import SpecIcon from './SpecIcon';

/**
 * Bench (standby reserve) applicant card. A single person can list multiple
 * characters they can bring. Bench entries are display-only — they do NOT
 * count toward the active roster or the waitlist.
 */
export default function BenchCard({ app, memo, adminView, onAdminClick, highlight }) {
  const { gamedata } = useApp();
  const chars =
    app.benchChars && app.benchChars.length
      ? app.benchChars
      : app.charName
      ? [{ charName: app.charName, classColor: app.classColor, specNames: app.allSpecNames || (app.specName ? [app.specName] : []) }]
      : [];

  return (
    <div
      className={`rounded-xl border p-2 bg-base-850 transition ${
        highlight ? 'border-indigo-400/60' : 'border-base-700'
      } ${adminView ? 'cursor-pointer hover:border-base-500' : ''}`}
      onClick={adminView ? () => onAdminClick(app) : undefined}
      role={adminView ? 'button' : undefined}
      tabIndex={adminView ? 0 : undefined}
      onKeyDown={adminView ? (e) => { if (e.key === 'Enter') onAdminClick(app); } : undefined}
    >
      {/* 길드 뱃지 */}
      <div className="flex justify-center mb-1">
        <GuildBadge guildId={app.guildId} guildName={app.guildName || '無'} guildColor={app.guildColor || '#94a3b8'} size="xs" />
      </div>

      {/* 닉네임 */}
      <div className="flex items-center justify-center gap-1 mb-1.5 min-w-0">
        {app.isGuildMaster && <span className="text-sm leading-none shrink-0" title="길드장">👑</span>}
        <span className="font-extrabold text-lg truncate text-white text-outline">{app.nickname}</span>
      </div>

      {/* 복수 캐릭터 */}
      <div className="flex flex-wrap justify-center gap-x-2 gap-y-0.5">
        {chars.map((c, i) => {
          const cls = getClass(gamedata.classes, c.classId);
          return (
            <span key={i} className="text-xs inline-flex items-center gap-1">
              <span style={badgeTextStyle(c.classColor || '#cbd5e1')}>{c.charName}</span>
              {(c.specNames || []).map((nm, j) => {
                const s = cls ? cls.specs.find((x) => x.name === nm) : null;
                return <SpecIcon key={j} specId={s ? s.id : null} name={nm} showName size={13} color={c.classColor || '#cbd5e1'} className="text-base-300" />;
              })}
            </span>
          );
        })}
      </div>

      {/* 관리자 영역 */}
      {adminVie
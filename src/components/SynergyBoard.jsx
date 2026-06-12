import { useApp } from '../context/AppContext';

/**
 * Raid synergy board. A synergy lights up (class color + check) when at
 * least one confirmed applicant — or a reservation with a class — of
 * the providing class is present; otherwise it renders desaturated.
 */
export default function SynergyBoard({ apps }) {
  const { gamedata } = useApp();
  const { synergies, classes } = gamedata;

  const presentClasses = new Set(
    apps.filter((a) => a.status === 'active' && a.classId).map((a) => a.classId)
  );

  const buffs = synergies.filter((s) => s.type === 'buff');
  const utilities = synergies.filter((s) => s.type === 'utility');

  const renderRow = (synergy) => {
    const cls = classes.find((c) => c.id === synergy.classId);
    const has = presentClasses.has(synergy.classId);
    const color = cls?.color || '#888';
    return (
      <div
        key={synergy.id}
        className={`flex items-center gap-2 px-2 py-1 rounded-lg transition ${has ? '' : 'grayscale opacity-40'}`}
        title={`${synergy.effect} (${cls?.name || ''})`}
      >
        <span
          className="w-4 h-4 inline-flex items-center justify-center rounded text-[10px] font-black shrink-0"
          style={{ backgroundColor: has ? `${color}33` : '#33394a', color: has ? color : '#7a8398' }}
        >
          {has ? '✓' : ''}
        </span>
        <span
          className="text-xs font-semibold truncate"
          style={{ color: has ? color : undefined, textShadow: has ? '0 0 1px rgba(0,0,0,0.6)' : undefined }}
        >
          {synergy.name}
        </span>
        <span className="ml-auto text-[10px] text-base-400 hidden sm:block truncate">{synergy.effect}</span>
      </div>
    );
  };

  return (
    <div className="card p-3">
      <p className="text-xs font-bold text-base-400 mb-2 px-1">공격대 시너지</p>
      <div className="grid grid-cols-1 gap-0.5">{buffs.map(renderRow)}</div>
      <p className="text-xs font-bold text-base-400 mt-3 mb-1 px-1">유틸리티</p>
      <div className="grid grid-cols-1 gap-0.5">{utilities.map(renderRow)}</div>
    </div>
  );
}

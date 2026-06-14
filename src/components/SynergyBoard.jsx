import { useApp } from '../context/AppContext';

/**
 * Compact synergy board. Shows only the providing class names: a class
 * chip lights up in its class color when at least one confirmed
 * applicant (or a reservation with a class) is present; otherwise it
 * renders desaturated. Tooltips carry the underlying buff details.
 */
export default function SynergyBoard({ apps, totalCap = 0 }) {
  const { gamedata } = useApp();
  const { synergies, classes } = gamedata;

  const activeCount = apps.filter((a) => a.status === 'active').length;
  const presentClasses = new Set(
    apps.filter((a) => a.status === 'active' && a.classId).map((a) => a.classId)
  );

  const chipsFor = (type) => {
    const seen = new Set();
    return synergies
      .filter((s) => s.type === type)
      .filter((s) => (seen.has(s.classId) ? false : seen.add(s.classId)))
      .map((s) => {
        const cls = classes.find((c) => c.id === s.classId);
        const has = presentClasses.has(s.classId);
        const color = cls?.color || '#888';
        const tooltip = synergies
          .filter((x) => x.classId === s.classId && x.type === type)
          .map((x) => `${x.name}: ${x.effect}`)
          .join(' / ');
        return (
          <span
            key={s.classId}
            title={tooltip}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold border transition ${
              has ? '' : 'grayscale opacity-40'
            }`}
            style={{
              color: has ? color : '#7a8398',
              borderColor: has ? `${color}55` : '#2a3347',
              backgroundColor: has ? `${color}14` : 'transparent',
              textShadow: has ? '0 0 1px rgba(0,0,0,0.6)' : undefined,
            }}
          >
            {has ? '✓ ' : ''}
            {cls?.name || ''}
          </span>
        );
      });
  };

  return (
    <div className="card p-3">
      <p className="font-bold text-sm mb-2" style={{ color: '#e879f9' }}>
        공격대 시너지 <span className="text-white">현재 인원 {activeCount}/{totalCap}</span>
      </p>
      <div className="flex flex-wrap gap-1">{chipsFor('buff')}</div>
      <p className="text-[11px] font-bold text-base-400 mt-2 mb-1 px-0.5">유틸리티</p>
      <div className="flex flex-wrap gap-1">{chipsFor('utility')}</div>
    </div>
  );
}

import { useApp } from '../context/AppContext';

// 시너지 란에서만 쓰는 클래스 축약명 (한 줄에 들어가게).
const ABBR = {
  demonhunter: '악사', druid: '드루', evoker: '기원', hunter: '냥꾼', mage: '법사',
  monk: '수도', paladin: '기사', priest: '사제', rogue: '도적', shaman: '술사',
  warrior: '전사', warlock: '흑마', deathknight: '죽기',
};

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
            {ABBR[s.classId] || cls?.name || ''}
          </span>
        );
      });
  };

  return (
    <div className="card p-3">
      <p className="font-bold text-sm mb-2" style={{ color: '#e879f9' }}>
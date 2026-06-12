import { badgeTextStyle } from '../lib/utils';

/**
 * Swap candidates, derived from applicants who turned the swap toggle
 * on. Classified by the roles of their other registered specs.
 */
export default function SwapList({ apps }) {
  const candidates = apps.filter((a) => a.swap && !a.isReservation);

  const groups = [
    {
      key: 'dpsCapableHealers',
      label: '딜스왑 가능 힐러',
      list: candidates.filter((a) => a.role === 'healer' && (a.swapRoles || []).includes('dps')),
    },
    {
      key: 'healCapableDps',
      label: '힐스왑 가능 딜러',
      list: candidates.filter((a) => a.role === 'dps' && (a.swapRoles || []).includes('healer')),
    },
    {
      key: 'tankCapable',
      label: '탱스왑 가능자',
      list: candidates.filter((a) => a.role !== 'tank' && (a.swapRoles || []).includes('tank')),
    },
  ];

  return (
    <div className="card p-3">
      <p className="text-xs font-bold text-base-400 mb-2 px-1">스왑 가능자</p>
      <div className="space-y-2.5">
        {groups.map((g) => (
          <div key={g.key}>
            <p className="text-[11px] font-semibold text-base-300 px-1 mb-1">{g.label}</p>
            {g.list.length === 0 ? (
              <p className="text-[11px] text-base-400 px-1">없음</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {g.list.map((a) => (
                  <span
                    key={a.id}
                    className="text-xs font-semibold px-2 py-0.5 rounded-full bg-base-850 border border-base-700"
                    style={badgeTextStyle(a.classColor)}
                    title={`${a.className} | ${a.specName}`}
                  >
                    {a.charName}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

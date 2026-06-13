import { useApp } from '../context/AppContext';
import { badgeTextStyle } from '../lib/utils';

/**
 * Character form: in-game name / realm / class / spec priorities / current ilvl.
 * Spec priority follows click order (1 → 4); re-clicking removes the
 * spec and later priorities shift up automatically.
 */
export default function CharacterEditor({ value, onChange }) {
  const { gamedata } = useApp();
  const { classes, servers } = gamedata;
  const selectedClass = classes.find((c) => c.id === value.classId);

  const set = (patch) => onChange({ ...value, ...patch });

  const toggleSpec = (specId) => {
    const specs = value.specs || [];
    if (specs.includes(specId)) {
      set({ specs: specs.filter((s) => s !== specId) });
    } else if (specs.length < 4) {
      set({ specs: [...specs, specId] });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="label-sm">캐릭터명 (인게임)</label>
        <input
          className="input-base"
          value={value.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="인게임 캐릭터명"
          maxLength={24}
        />
      </div>

      <div>
        <label className="label-sm">서버</label>
        <select
          className="input-base"
          value={value.server}
          onChange={(e) => set({ server: e.target.value })}
        >
          {servers.map((s) => (
            <option key={s.slug} value={s.ko}>
              {s.ko}
            </option>
          ))}
        </select>
      </div>

      {/* 현재 아이템 레벨 */}
      <div>
        <label className="label-sm">
          현재 아이템 레벨{' '}
          <span className="text-base-400 font-normal text-xs">(레이드 신청 시 자동 입력)</span>
        </label>
        <input
          className="input-base"
          value={value.ilvl || ''}
          onChange={(e) => set({ ilvl: e.target.value.replace(/\D/g, '') })}
          placeholder="예: 639"
          inputMode="numeric"
          maxLength={5}
        />
      </div>

      <div>
        <label className="label-sm">클래스</label>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
          {classes.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => set({ classId: c.id, specs: [] })}
              className={`px-1 py-2 rounded-lg text-xs font-semibold border transition ${
                value.classId === c.id
                  ? 'border-indigo-400 bg-base-700'
                  : 'border-base-700 bg-base-800 hover:bg-base-700'
              }`}
              style={badgeTextStyle(c.color)}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {selectedClass && (
        <div>
          <label className="label-sm">
            특성{' '}
            <span className="text-base-400 font-normal text-xs">
              (클릭 순서대로 우선순위 부여, 최대 4개)
            </span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {selectedClass.specs.map((spec) => {
              const idx = (value.specs || []).indexOf(spec.id);
              const selected = idx >= 0;
              return (
                <button
                  key={spec.id}
                  type="button"
                  onClick={() => toggleSpec(spec.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                    selected
                      ? 'border-indigo-400 bg-indigo-500/15 text-base-100'
                      : 'border-base-700 bg-base-800 text-base-200 hover:bg-base-700'
                  }`}
                >
                  {selected && (
                    <span className="inline-block mr-1.5 px-1.5 rounded bg-indigo-500 text-white text-xs font-bold">
                      {idx + 1}순위
                    </span>
                  )}
                  {spec.name}
                  <span className="ml-1 text-xs text-base-400">
                    {spec.role === 'tank' ? '탱' : spec.role === 'healer' ? '힐' : '딜'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function emptyCharacter(servers) {
  const defaultServer = servers.find((s) => s.isDefault) || servers[0];
  return {
    id: `char_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    server: defaultServer ? defaultServer.ko : '아즈샤라',
    classId: '',
    specs: [],
    ilvl: '',
  };
}

export function validateCharacter(char) {
  if (!char.name.trim()) return '캐릭터명을 입력해주세요.';
  if (!char.classId) return '클래스를 선택해주세요.';
  if (!char.specs || char.specs.length === 0) return '특성을 1개 이상 선택해주세요.';
  return null;
}

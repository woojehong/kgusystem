import { useEffect, useState } from 'react';
import { updateRaid } from '../lib/db';
import { analyzeCoverage, splitWarnings } from '../lib/raidAbilities';
import SpecIcon from './SpecIcon';

const MONK_COLOR = '#00c8a0'; // 물리뎀증(수도사)
const DH_COLOR = '#a330c9'; // 마법뎀증(악마사냥꾼)
const PARTY_CAP = 5;

// 드래그 가능한 공대원 칩
function MemberChip({ m, onDragStart, compact }) {
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(m.id); }}
      className={`flex items-center gap-1.5 rounded-md bg-base-800 border border-base-700 px-2 cursor-grab active:cursor-grabbing hover:border-base-500 ${compact ? 'py-0.5' : 'py-1'}`}
      style={{ borderLeft: `3px solid ${m.classColor}` }}
      title={m.charName}
    >
      <SpecIcon specId={m.specId} size={15} className="shrink-0" />
      <span className="font-bold text-[13px] truncate" style={{ color: m.classColor }}>{m.charName}</span>
    </div>
  );
}

// 커버리지 코치 패널
function CoveragePanel({ title, members }) {
  const cov = analyzeCoverage(members);
  const Chip = ({ ok, color, label, owners }) => (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[12px] font-bold border"
      title={owners.join(', ')}
      style={{
        color: ok ? color : '#8b95a7',
        borderColor: ok ? `${color}66` : '#33415522',
        backgroundColor: ok ? `${color}18` : 'transparent',
      }}
    >
      {ok ? '✓' : '✕'} {label}{ok ? ` ${owners.length}` : ''}
    </span>
  );
  return (
    <div className="rounded-xl border border-base-700 bg-base-900/50 p-3 space-y-2">
      {title && <p className="font-bold text-sm text-base-100">{title}</p>}
      <div className="flex flex-wrap gap-1.5">
        <Chip ok={cov.physical.present} color={MONK_COLOR} label="물리뎀증" owners={cov.physical.owners} />
        <Chip ok={cov.magic.present} color={DH_COLOR} label="마법뎀증" owners={cov.magic.owners} />
      </div>
      <div>
        <p className="text-[11px] font-bold text-base-400 mb-1">공대 생존기</p>
        {cov.raidCds.length ? (
          <div className="flex flex-wrap gap-1">
            {cov.raidCds.map((c) => (
              <span key={c.name} className="text-[11px] px-1.5 py-0.5 rounded bg-base-800 border border-base-700 text-base-200" title={c.owners.join(', ')}>
                {c.name} <span className="text-base-500">{c.owners.join('·')}</span>
              </span>
            ))}
          </div>
        ) : <p className="text-[11px] text-base-600">없음</p>}
      </div>
      <div>
        <p className="text-[11px] font-bold text-base-400 mb-1">공대 이동기</p>
        {cov.movement.length ? (
          <div className="flex flex-wrap gap-1">
            {cov.movement.map((c) => (
              <span key={c.name} className="text-[11px] px-1.5 py-0.5 rounded bg-base-800 border border-base-700 text-base-200" title={c.owners.join(', ')}>
                {c.name} <span className="text-base-500">{c.owners.join('·')}</span>
              </span>
            ))}
          </div>
        ) : <p className="text-[11px] text-base-600">없음</p>}
      </div>
    </div>
  );
}

export default function SimulationModal({ open, onClose, raid, apps }) {
  const members = (apps || [])
    .filter((a) => a.status === 'active')
    .map((a) => ({
      id: a.id,
      charName: a.charName,
      classId: a.classId,
      specId: a.specId,
      classColor: a.classColor || '#cbd5e1',
      role: a.role,
    }));

  const numParties = members.length >= 26 ? 6 : members.length >= 21 ? 5 : 4;
  const parties = Array.from({ length: numParties }, (_, i) => i + 1);

  const [mode, setMode] = useState('1');
  const [assign, setAssign] = useState({});
  const [split, setSplit] = useState({});
  const [dragId, setDragId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!open) return;
    const sim = raid.simulation || {};
    setMode(sim.mode === '2' ? '2' : '1');
    setAssign(sim.assign || {});
    setSplit(sim.split || {});
    setDragId(null);
    setMsg(null);
  }, [open, raid.id, raid.simulation]);

  if (!open) return null;

  const partyMembers = (p) => members.filter((m) => assign[m.id] === p);
  const pool = members.filter((m) => assign[m.id] == null);

  const dropTo = (p) => {
    if (!dragId) return;
    if (p != null) {
      const cur = members.filter((m) => assign[m.id] === p && m.id !== dragId).length;
      if (cur >= PARTY_CAP) { setMsg(`파티 ${p}이(가) 가득 찼습니다 (최대 ${PARTY_CAP}명).`); setDragId(null); return; }
      setAssign((a) => ({ ...a, [dragId]: p }));
    } else {
      setAssign((a) => { const n = { ...a }; delete n[dragId]; return n; });
    }
    setDragId(null);
    setMsg(null);
  };

  const setPartyGroup = (p, g) => setSplit((s) => ({ ...s, [p]: s[p] === g ? null : g }));
  const groupMembers = (g) => members.filter((m) => assign[m.id] != null && split[assign[m.id]] === g);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await updateRaid(raid.id, { simulation: { mode, assign, split, savedAt: Date.now() } });
      setMsg({ ok: true, text: '저장되었습니다 ✓' });
    } catch {
      setMsg({ ok: false, text: '저장에 실패했습니다.' });
    } finally {
      setBusy(false);
    }
  };

  const warns = mode === '2' ? splitWarnings([groupMembers('A'), groupMembers('B')]) : [];

  const PartyBox = ({ p }) => {
    const mem = partyMembers(p);
    const grp = split[p];
    return (
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => dropTo(p)}
        className={`rounded-xl border p-2 min-h-[168px] transition ${
          grp === 'A' ? 'border-sky-500/60 bg-sky-500/5' : grp === 'B' ? 'border-amber-500/60 bg-amber-500/5' : 'border-base-700 bg-base-850/60'
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-bold text-base-300">
            파티 {p} <span className="text-base-500">{mem.length}/{PARTY_CAP}</span>
          </p>
          {mode === '2' && (
            <div className="flex gap-0.5">
              <button type="button" onClick={() => setPartyGroup(p, 'A')} className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${grp === 'A' ? 'bg-sky-600 text-white' : 'bg-base-700 text-base-400'}`}>1조</button>
              <button type="button" onClick={() => setPartyGroup(p, 'B')} className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${grp === 'B' ? 'bg-amber-600 text-white' : 'bg-base-700 text-base-400'}`}>2조</button>
            </div>
          )}
        </div>
        <div className="space-y-1">
          {mem.map((m) => <MemberChip key={m.id} m={m} onDragStart={setDragId} compact />)}
          {Array.from({ length: Math.max(0, PARTY_CAP - mem.length) }).map((_, i) => (
            <div key={i} className="h-6 rounded-md border border-dashed border-base-700/50" />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-base-900/95 backdrop-blur-sm overflow-y-auto">
      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-black text-white truncate">🧩 시뮬레이션 · {raid.title || '공격대'}</h2>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 p-0.5 rounded-xl bg-base-850 border border-base-700">
              <button type="button" onClick={() => setMode('1')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${mode === '1' ? 'bg-base-700 text-white' : 'text-base-400'}`}>1조</button>
              <button type="button" onClick={() => setMode('2')} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${mode === '2' ? 'bg-base-700 text-white' : 'text-base-400'}`}>2조</button>
            </div>
            <button type="button" onClick={save} disabled={busy} className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition disabled:opacity-50">
              {busy ? '저장 중…' : '저장'}
            </button>
            <button type="button" onClick={() => onClose()} className="px-3 py-1.5 rounded-lg bg-base-700 hover:bg-base-600 text-base-200 text-sm font-bold transition">닫기</button>
          </div>
        </div>

        {msg && (
          <p className={`text-sm text-center mb-3 ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>
        )}
        {mode === '2' && (
          <p className="text-xs text-base-400 mb-3">각 파티를 <b className="text-sky-300">1조</b> / <b className="text-amber-300">2조</b>로 지정하세요. (겹치지 않게)</p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_18rem] gap-4">
          {/* 파티 그리드 */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {parties.map((p) => <PartyBox key={p} p={p} />)}
          </div>

          {/* 파티없음 풀 */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => dropTo(null)}
            className="rounded-xl border border-base-700 bg-base-850/60 p-2 lg:max-h-[70vh] lg:overflow-y-auto"
          >
            <p className="text-xs font-bold text-base-300 mb-1.5">파티없음 <span className="text-base-500">{pool.length}</span></p>
            <div className="space-y-1">
              {pool.length ? pool.map((m) => <MemberChip key={m.id} m={m} onDragStart={setDragId} />) : (
                <p className="text-[11px] text-base-600 text-center py-3">모두 배치됨</p>
              )}
            </div>
          </div>
        </div>

        {/* 커버리지 코치 */}
        <div className="mt-4">
          {mode === '1' ? (
            <CoveragePanel title="공대 커버리지" members={members} />
          ) : (
            <>
              {warns.length > 0 && (
                <div className="mb-3 space-y-1">
                  {warns.map((w) => (
                    <p key={w.classId} className="text-sm font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">⚠ {w.msg}</p>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <CoveragePanel title="1조 (파랑)" members={groupMembers('A')} />
                <CoveragePanel title="2조 (노랑)" members={groupMembers('B')} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { updateRaid } from '../lib/db';
import { analyzeCoverage, splitWarnings } from '../lib/raidAbilities';
import SpecIcon from './SpecIcon';

const MONK_COLOR = '#00c8a0';
const DH_COLOR = '#a330c9';
const PARTY_CAP = 5;

// 조 정보 (A=1조 파랑, B=2조 노랑, C=3조 초록)
const GROUPS = {
  A: { color: '#38bdf8', label: '1조', dark: '#06283d' },
  B: { color: '#fbbf24', label: '2조', dark: '#3d2c06' },
  C: { color: '#34d399', label: '3조', dark: '#053824' },
};
const activeGroups = (mode) => (mode === '3' ? ['A', 'B', 'C'] : mode === '2' ? ['A', 'B'] : []);

function MemberChip({ m, onDragStart, onRemove, onDropHere, fontSize = 13 }) {
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(m.id); }}
      onDragOver={onDropHere ? (e) => e.preventDefault() : undefined}
      onDrop={onDropHere ? (e) => { e.preventDefault(); e.stopPropagation(); onDropHere(m.id); } : undefined}
      onContextMenu={onRemove ? (e) => { e.preventDefault(); onRemove(m.id); } : undefined}
      className="flex items-center gap-1 rounded-md bg-base-800 border border-base-700 px-1.5 py-0.5 cursor-grab active:cursor-grabbing hover:border-base-500"
      style={{ borderLeft: `3px solid ${m.classColor}` }}
      title={onRemove ? `${m.charName} · 우클릭 시 배정 전으로` : m.charName}
    >
      <SpecIcon specId={m.specId} size={14} className="shrink-0" />
      <span className="font-bold truncate min-w-0 leading-tight" style={{ color: m.classColor, fontSize: `${fontSize}px` }}>{m.charName}</span>
      {m.ilvl != null && (
        <span className="ml-auto shrink-0 pl-0.5 tabular-nums text-base-300" style={{ fontSize: `${Math.max(9, fontSize - 2)}px` }}>{m.ilvl}</span>
      )}
    </div>
  );
}

function CoveragePanel({ title, accent, members }) {
  const { gamedata } = useApp();
  const cov = analyzeCoverage(members);
  const classColorOf = (classId) => gamedata.classes.find((x) => x.id === classId)?.color || '#cbd5e1';

  const Owner = ({ o }) => (
    <span className="inline-flex items-center gap-0.5">
      <SpecIcon specId={o.specId} size={13} className="shrink-0" />
      <span className="font-bold" style={{ color: o.classColor }}>{o.charName}</span>
    </span>
  );
  const DebuffChip = ({ ok, color, label, owners }) => (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] font-bold border"
      style={{ color: ok ? color : '#8b95a7', borderColor: ok ? `${color}66` : '#2a3347', backgroundColor: ok ? `${color}18` : 'transparent' }}>
      {ok ? '✓' : '✕'} {label}
      {ok && <span className="inline-flex items-center gap-1.5">{owners.map((o) => <Owner key={o.id} o={o} />)}</span>}
    </span>
  );
  const AbilityList = ({ items }) =>
    items.length ? (
      <div className="flex flex-wrap gap-1.5">
        {items.map((c) => (
          <span key={c.name} className="inline-flex items-center gap-1.5 text-[12px] px-2 py-1 rounded-md bg-base-800 border border-base-700">
            <b style={{ color: classColorOf(c.classId) }}>{c.name}</b>
            <span className="inline-flex items-center gap-1.5">{c.owners.map((o) => <Owner key={o.id} o={o} />)}</span>
          </span>
        ))}
      </div>
    ) : <p className="text-[11px] text-base-600">없음</p>;

  return (
    <div className="rounded-xl border bg-base-900/50 p-3 space-y-2.5" style={{ borderColor: accent ? `${accent}88` : '#1d2433' }}>
      {title && <p className="font-black text-sm" style={{ color: accent || '#e2e8f4' }}>{title}</p>}
      <div className="flex flex-wrap gap-1.5">
        <DebuffChip ok={cov.physical.present} color={MONK_COLOR} label="물리뎀증" owners={cov.physical.owners} />
        <DebuffChip ok={cov.magic.present} color={DH_COLOR} label="마법뎀증" owners={cov.magic.owners} />
      </div>
      <div>
        <p className="text-[11px] font-bold text-base-400 mb-1">공대 생존기</p>
        <AbilityList items={cov.raidCds} />
      </div>
      <div>
        <p className="text-[11px] font-bold text-base-400 mb-1">공대 이동기</p>
        <AbilityList items={cov.movement} />
      </div>
    </div>
  );
}

const emptyParties = (n) => { const o = {}; for (let i = 1; i <= n; i++) o[i] = []; return o; };

export default function SimulationModal({ open, onClose, raid, apps }) {
  const members = (apps || [])
    .filter((a) => a.status === 'active')
    .map((a) => ({ id: a.id, charName: a.charName, classId: a.classId, specId: a.specId, classColor: a.classColor || '#cbd5e1', role: a.role, ilvl: a.ilvl }));
  const membersById = Object.fromEntries(members.map((m) => [m.id, m]));
  const autoParties = members.length >= 26 ? 6 : members.length >= 21 ? 5 : 4;

  const [mode, setMode] = useState('2');
  const [partyMode, setPartyMode] = useState(autoParties);
  const [parties, setParties] = useState(() => emptyParties(autoParties));
  const [split, setSplit] = useState({});
  const [dragId, setDragId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [presetOpen, setPresetOpen] = useState(false);
  const [viewMode, setViewMode] = useState('1'); // '1'=1열뷰, '2'=2열뷰
  const ready = useRef(false);

  const numParties = partyMode;
  const partyNums = Array.from({ length: numParties }, (_, i) => i + 1);
  const chipFont = numParties >= 6 ? 11 : numParties >= 5 ? 12 : 13;
  const groups = activeGroups(mode);
  const twoCol = viewMode === '2' && numParties % 2 === 0; // 홀수 파티는 2열뷰 불가
  const leftCols = twoCol ? numParties / 2 : numParties;

  useEffect(() => {
    if (!open) return;
    ready.current = false;
    const sim = raid.simulation || {};
    const validIds = new Set(members.map((m) => m.id));
    const orderedIds = members.map((m) => m.id);
    const savedCount = sim.partyMode || autoParties;
    const init = emptyParties(savedCount);
    if (sim.parties) {
      for (let i = 1; i <= savedCount; i++) init[i] = (sim.parties[i] || []).filter((id) => validIds.has(id));
    } else if (sim.assign) {
      orderedIds.forEach((id) => { const p = sim.assign[id]; if (p != null && init[p]) init[p].push(id); });
    }
    setPartyMode(savedCount);
    setParties(init);
    setSplit(sim.split || {});
    setMode(['1', '2', '3'].includes(sim.mode) ? sim.mode : '2');
    setDragId(null); setMsg(null); setPresetOpen(false);
    const t = setTimeout(() => { ready.current = true; }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, raid.id]);

  useEffect(() => {
    if (!open || !ready.current) return;
    const t = setTimeout(() => {
      updateRaid(raid.id, { simulation: { mode, parties, split, partyMode, updatedAt: Date.now() } }).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, parties, split, partyMode, open, raid.id]);

  if (!open) return null;

  const assignedIds = new Set(Object.values(parties).flat());
  const pool = members.filter((m) => !assignedIds.has(m.id));
  const partyMembers = (p) => (parties[p] || []).map((id) => membersById[id]).filter(Boolean);

  const removeToPool = (id) => setParties((prev) => {
    const next = {}; for (const k of Object.keys(prev)) next[k] = prev[k].filter((x) => x !== id); return next;
  });

  // targetP=null → 배정 전. beforeId 지정 시 그 앞에 삽입(순서변경/파티간 이동), 없으면 맨 뒤.
  const moveTo = (targetP, beforeId = null) => {
    if (!dragId) return;
    const id = dragId;
    setDragId(null);
    if (targetP != null) {
      const cur = parties[targetP] || [];
      if (!cur.includes(id) && cur.length >= PARTY_CAP) { setMsg({ ok: false, text: `파티 ${targetP}이(가) 가득 찼습니다 (최대 ${PARTY_CAP}명).` }); return; }
    }
    setParties((prev) => {
      const next = {}; for (const k of Object.keys(prev)) next[k] = prev[k].filter((x) => x !== id);
      if (targetP != null) {
        const arr = next[targetP] ? [...next[targetP]] : [];
        if (beforeId != null && beforeId !== id) {
          const idx = arr.indexOf(beforeId);
          if (idx >= 0) arr.splice(idx, 0, id); else arr.push(id);
        } else arr.push(id);
        next[targetP] = arr;
      }
      return next;
    });
    setMsg(null);
  };

  const changePartyMode = (n) => {
    if (n < numParties) {
      const occupied = [];
      for (let i = n + 1; i <= numParties; i++) if ((parties[i] || []).length) occupied.push(i);
      if (occupied.length) {
        setMsg({ ok: false, text: `파티 ${occupied.join('·')}에 배정된 인원을 먼저 해제(배정 전으로)한 뒤 모드를 변경하세요.` });
        return;
      }
    }
    setMsg(null);
    setPartyMode(n);
    setParties((prev) => { const next = {}; for (let i = 1; i <= n; i++) next[i] = prev[i] || []; return next; });
  };

  const setPartyGroup = (p, g) => setSplit((s) => ({ ...s, [p]: s[p] === g ? null : g }));
  const groupMembers = (g) => {
    const ids = [];
    for (let i = 1; i <= numParties; i++) if (split[i] === g) ids.push(...(parties[i] || []));
    return ids.map((id) => membersById[id]).filter(Boolean);
  };

  const savePreset = async () => {
    const list = raid.simPresets || [];
    const name = window.prompt('프리셋 이름을 입력하세요', `프리셋 ${list.length + 1}`);
    if (!name || !name.trim()) return;
    const preset = { id: String(Date.now()), name: name.trim(), mode, partyMode, parties, split, savedAt: Date.now() };
    try { await updateRaid(raid.id, { simPresets: [...list, preset] }); setMsg({ ok: true, text: `프리셋 "${preset.name}" 저장됨` }); }
    catch { setMsg({ ok: false, text: '프리셋 저장 실패' }); }
  };
  const loadPreset = (p) => {
    const validIds = new Set(members.map((m) => m.id));
    const cnt = p.partyMode || autoParties;
    const init = emptyParties(cnt);
    if (p.parties) for (let i = 1; i <= cnt; i++) init[i] = (p.parties[i] || []).filter((id) => validIds.has(id));
    else if (p.assign) members.forEach((m) => { const pn = p.assign[m.id]; if (pn != null && init[pn]) init[pn].push(m.id); });
    setPartyMode(cnt); setParties(init); setSplit(p.split || {});
    setMode(p.mode === '3' ? '3' : p.mode === '2' ? '2' : '1'); setPresetOpen(false);
    setMsg({ ok: true, text: `"${p.name}" 불러옴` });
  };
  const deletePreset = async (e, id) => {
    e.stopPropagation();
    try { await updateRaid(raid.id, { simPresets: (raid.simPresets || []).filter((p) => p.id !== id) }); } catch { /* noop */ }
  };

  const handleClose = () => {
    if (ready.current) updateRaid(raid.id, { simulation: { mode, parties, split, partyMode, updatedAt: Date.now() } }).catch(() => {});
    onClose();
  };

  const warns = mode !== '1' ? splitWarnings(groups.map((g) => groupMembers(g))) : [];
  const presets = raid.simPresets || [];

  const PartyBox = ({ p }) => {
    const mem = partyMembers(p);
    const grp = mode !== '1' ? split[p] : null;
    const gc = grp ? GROUPS[grp].color : null;
    return (
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => moveTo(p, null)}
        className="rounded-xl border p-1.5 min-h-[152px] transition"
        style={{ borderColor: gc ? `${gc}99` : '#1d2433', background: gc ? `${gc}0d` : 'rgba(16,20,28,0.6)' }}
      >
        <div className="flex items-center justify-between mb-1.5 gap-1">
          <p className="text-[11px] font-bold text-base-300 truncate">파티 {p} <span className="text-base-500">{mem.length}/{PARTY_CAP}</span></p>
          {groups.length > 0 && (
            <div className="flex gap-0.5 shrink-0">
              {groups.map((g) => (
                <button key={g} type="button" onClick={() => setPartyGroup(p, g)} className="text-[9px] px-1 py-0.5 rounded font-bold"
                  style={{ backgroundColor: grp === g ? GROUPS[g].color : '#1d2433', color: grp === g ? GROUPS[g].dark : '#7e93ad' }}>
                  {GROUPS[g].label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-1">
          {mem.map((m) => (
            <MemberChip key={m.id} m={m} onDragStart={setDragId} onRemove={removeToPool} onDropHere={(tid) => moveTo(p, tid)} fontSize={chipFont} />
          ))}
          {Array.from({ length: Math.max(0, PARTY_CAP - mem.length) }).map((_, i) => (
            <div key={i} className="h-5 rounded-md border border-dashed border-base-700/50" />
          ))}
        </div>
      </div>
    );
  };

  const modeBtn = (m, label, color) => (
    <button type="button" onClick={() => setMode(m)} className="w-full text-center px-2 py-1.5 rounded-lg text-sm font-black transition border whitespace-nowrap"
      style={mode === m ? { backgroundColor: color, color: '#06131f', borderColor: color } : { backgroundColor: 'transparent', color: '#7e93ad', borderColor: '#2a3347' }}>
      {label}
    </button>
  );
  const partyBtn = (n) => (
    <button key={n} type="button" onClick={() => changePartyMode(n)} className="w-full text-center px-2 py-1.5 rounded-lg text-xs font-bold border transition whitespace-nowrap"
      style={partyMode === n ? { backgroundColor: '#6366f1', color: '#fff', borderColor: '#6366f1' } : { backgroundColor: 'transparent', color: '#7e93ad', borderColor: '#2a3347' }}>
      {n}파티모드
    </button>
  );
  const viewBtn = (v, label, active, disabled) => (
    <button type="button" disabled={disabled} onClick={() => setViewMode(v)} title={disabled ? '홀수 파티모드에서는 2열뷰를 쓸 수 없습니다' : undefined}
      className="px-2 py-1 rounded-md text-[11px] font-bold border transition disabled:opacity-40 disabled:cursor-not-allowed"
      style={active ? { backgroundColor: '#334155', color: '#fff', borderColor: '#475569' } : { backgroundColor: 'transparent', color: '#7e93ad', borderColor: '#2a3347' }}>
      {label}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-base-900/95 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-lg font-black text-white truncate pt-1.5">시뮬레이션 · {raid.title || '공격대'}</h2>
          <div className="flex items-start gap-2 shrink-0">
            {/* 조 모드(위) + 파티 수 모드(아래) — 칸 맞춤 */}
            <div className="flex flex-col gap-1.5 w-64">
              <div className="grid grid-cols-3 gap-1.5">
                {modeBtn('1', '1조모드', GROUPS.A.color)}
                {modeBtn('2', '2조모드', GROUPS.B.color)}
                {modeBtn('3', '3조모드', GROUPS.C.color)}
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {partyBtn(4)}{partyBtn(5)}{partyBtn(6)}
              </div>
            </div>
            <span className="w-px self-stretch bg-base-700 mx-0.5" />
            {/* 프리셋 / 닫기 */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <button type="button" onClick={() => setPresetOpen((v) => !v)} className="px-3 py-1.5 rounded-lg bg-base-700 hover:bg-base-600 text-white text-sm font-bold transition">프리셋 불러오기 ▾</button>
                {presetOpen && (
                  <div className="absolute right-0 mt-1 w-56 max-h-72 overflow-y-auto rounded-xl border border-base-600 bg-base-850 shadow-xl z-20 p-1">
                    {presets.length === 0 ? (
                      <p className="text-xs text-base-500 text-center py-3">저장된 프리셋 없음</p>
                    ) : (
                      presets.map((p) => (
                        <div key={p.id} role="button" tabIndex={0} onClick={() => loadPreset(p)} onKeyDown={(e) => { if (e.key === 'Enter') loadPreset(p); }}
                          className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg hover:bg-base-700 cursor-pointer">
                          <span className="text-sm font-semibold text-base-100 truncate">{p.name} <span className="text-[10px] text-base-500">{p.mode === '3' ? '3조' : p.mode === '2' ? '2조' : '1조'}</span></span>
                          <button type="button" onClick={(e) => deletePreset(e, p.id)} className="shrink-0 text-base-500 hover:text-red-400 text-xs px-1" title="삭제">✕</button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              <button type="button" onClick={savePreset} className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition">프리셋 저장</button>
              <button type="button" onClick={handleClose} className="px-3 py-1.5 rounded-lg bg-base-700 hover:bg-base-600 text-base-200 text-sm font-bold transition">닫기</button>
            </div>
          </div>
        </div>

        {msg && <p className={`text-sm text-center mb-3 ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>}
        {mode !== '1' && (
          <p className="text-xs text-base-400 mb-3">
            각 파티를 {groups.map((g, i) => (<span key={g}><b style={{ color: GROUPS[g].color }}>{GROUPS[g].label}</b>{i < groups.length - 1 ? ' / ' : ''}</span>))}로 지정하세요. (겹치지 않게) · 같은 파티 안에서 위/아래로 끌어 순서 변경 가능
          </p>
        )}

        {/* 왼쪽: 파티 + 커버리지 | 오른쪽: 배정 전(세로로 길게) */}
        <div className="grid gap-2 items-stretch" style={{ gridTemplateColumns: `${leftCols}fr 1fr` }}>
          <div className="min-w-0 flex flex-col gap-2">
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${leftCols}, minmax(0, 1fr))` }}>
              {partyNums.map((p) => <PartyBox key={p} p={p} />)}
            </div>
            {/* 커버리지 — 파티 아래(배정 전 열 제외) */}
            {mode === '1' ? (
              <CoveragePanel title="공대 커버리지" members={members} />
            ) : (
              <>
                {warns.length > 0 && (
                  <div className="space-y-1">
                    {warns.map((w) => (
                      <p key={w.classId} className="text-sm font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">⚠ {w.msg}</p>
                    ))}
                  </div>
                )}
                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))` }}>
                  {groups.map((g) => (
                    <CoveragePanel key={g} title={`${GROUPS[g].label} 커버리지`} accent={GROUPS[g].color} members={groupMembers(g)} />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 오른쪽: 1열/2열 토글(배정 전 박스 밖 우측상단) + 배정 전(세로로 길게) */}
          <div className="min-w-0 flex flex-col gap-1">
            <div className="flex justify-end gap-1">
              {viewBtn('1', '1열뷰', !twoCol, false)}
              {viewBtn('2', '2열뷰', twoCol, numParties % 2 !== 0)}
            </div>
            <div onDragOver={(e) => e.preventDefault()} onDrop={() => moveTo(null)} className="rounded-xl border border-base-700 bg-base-850/60 p-1.5 flex flex-col flex-1 min-h-[152px]">
              <p className="text-[11px] font-bold text-base-300 mb-1.5 truncate shrink-0">배정 전 <span className="text-base-500">{pool.length}</span></p>
              <div className="space-y-1 flex-1">
                {pool.length ? pool.map((m) => (
                  <MemberChip key={m.id} m={m} onDragStart={setDragId} onDropHere={() => moveTo(null)} fontSize={chipFont} />
                )) : <p className="text-[10px] text-base-600 text-center py-2">모두 배치됨</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

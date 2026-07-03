import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { updateRaid } from '../lib/db';
import { analyzeCoverage, splitWarnings } from '../lib/raidAbilities';
import SpecIcon from './SpecIcon';

const MONK_COLOR = '#00c8a0'; // 물리뎀증(수도사)
const DH_COLOR = '#a330c9'; // 마법뎀증(악마사냥꾼)
const GROUP_A = '#38bdf8'; // 1조 파랑
const GROUP_B = '#fbbf24'; // 2조 노랑
const PARTY_CAP = 5;

// 드래그 가능한 공대원 칩. onRemove가 있으면 우클릭으로 파티없음 복귀.
function MemberChip({ m, onDragStart, onRemove, compact }) {
  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart(m.id); }}
      onContextMenu={onRemove ? (e) => { e.preventDefault(); onRemove(m.id); } : undefined}
      className={`flex items-center gap-1.5 rounded-md bg-base-800 border border-base-700 px-2 cursor-grab active:cursor-grabbing hover:border-base-500 ${compact ? 'py-0.5' : 'py-1'}`}
      style={{ borderLeft: `3px solid ${m.classColor}` }}
      title={onRemove ? `${m.charName} · 우클릭 시 파티없음으로` : m.charName}
    >
      <SpecIcon specId={m.specId} size={15} className="shrink-0" />
      <span className="font-bold text-[13px] truncate min-w-0" style={{ color: m.classColor }}>{m.charName}</span>
      {m.ilvl != null && <span className="ml-auto shrink-0 pl-1 text-[11px] font-bold text-base-300 tabular-nums">{m.ilvl}</span>}
    </div>
  );
}

// 커버리지 코치 패널. accent가 있으면 테두리/제목에 조 색상.
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
    <span
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[12px] font-bold border"
      style={{
        color: ok ? color : '#8b95a7',
        borderColor: ok ? `${color}66` : '#2a3347',
        backgroundColor: ok ? `${color}18` : 'transparent',
      }}
    >
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
    ) : (
      <p className="text-[11px] text-base-600">없음</p>
    );

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
      ilvl: a.ilvl,
    }));

  const numParties = members.length >= 26 ? 6 : members.length >= 21 ? 5 : 4;
  const parties = Array.from({ length: numParties }, (_, i) => i + 1);

  const [mode, setMode] = useState('1');
  const [assign, setAssign] = useState({});
  const [split, setSplit] = useState({});
  const [dragId, setDragId] = useState(null);
  const [msg, setMsg] = useState(null);
  const [presetOpen, setPresetOpen] = useState(false);
  const ready = useRef(false);

  // 열릴 때 마지막 작업 상태(raid.simulation) 복원. raid.simulation 자체는 deps에서 제외해 자동저장 루프 방지.
  useEffect(() => {
    if (!open) return;
    ready.current = false;
    const sim = raid.simulation || {};
    setMode(sim.mode === '2' ? '2' : '1');
    setAssign(sim.assign || {});
    setSplit(sim.split || {});
    setDragId(null);
    setMsg(null);
    setPresetOpen(false);
    const t = setTimeout(() => { ready.current = true; }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, raid.id]);

  // 자동 저장 (디바운스) — 저장 버튼 없이도 현재 편성이 유지됨.
  useEffect(() => {
    if (!open || !ready.current) return;
    const t = setTimeout(() => {
      updateRaid(raid.id, { simulation: { mode, assign, split, updatedAt: Date.now() } }).catch(() => {});
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, assign, split, open, raid.id]);

  if (!open) return null;

  const partyMembers = (p) => members.filter((m) => assign[m.id] === p);
  const pool = members.filter((m) => assign[m.id] == null);
  const removeToPool = (id) => { setAssign((a) => { const n = { ...a }; delete n[id]; return n; }); setMsg(null); };

  const dropTo = (p) => {
    if (!dragId) return;
    if (p != null) {
      const cur = members.filter((m) => assign[m.id] === p && m.id !== dragId).length;
      if (cur >= PARTY_CAP) { setMsg({ ok: false, text: `파티 ${p}이(가) 가득 찼습니다 (최대 ${PARTY_CAP}명).` }); setDragId(null); return; }
      setAssign((a) => ({ ...a, [dragId]: p }));
    } else {
      removeToPool(dragId);
    }
    setDragId(null);
    setMsg(null);
  };

  const setPartyGroup = (p, g) => setSplit((s) => ({ ...s, [p]: s[p] === g ? null : g }));
  const groupMembers = (g) => members.filter((m) => assign[m.id] != null && split[assign[m.id]] === g);

  // 현재 편성을 프리셋으로 저장.
  const savePreset = async () => {
    const list = raid.simPresets || [];
    const name = window.prompt('프리셋 이름을 입력하세요', `프리셋 ${list.length + 1}`);
    if (!name || !name.trim()) return;
    const preset = { id: String(Date.now()), name: name.trim(), mode, assign, split, savedAt: Date.now() };
    try {
      await updateRaid(raid.id, { simPresets: [...list, preset] });
      setMsg({ ok: true, text: `프리셋 "${preset.name}" 저장됨` });
    } catch {
      setMsg({ ok: false, text: '프리셋 저장 실패' });
    }
  };

  const loadPreset = (p) => {
    setMode(p.mode === '2' ? '2' : '1');
    setAssign(p.assign || {});
    setSplit(p.split || {});
    setPresetOpen(false);
    setMsg({ ok: true, text: `"${p.name}" 불러옴` });
  };

  const deletePreset = async (e, id) => {
    e.stopPropagation();
    try {
      await updateRaid(raid.id, { simPresets: (raid.simPresets || []).filter((p) => p.id !== id) });
    } catch { /* noop */ }
  };

  const handleClose = () => {
    if (ready.current) updateRaid(raid.id, { simulation: { mode, assign, split, updatedAt: Date.now() } }).catch(() => {});
    onClose();
  };

  const warns = mode === '2' ? splitWarnings([groupMembers('A'), groupMembers('B')]) : [];
  const presets = raid.simPresets || [];

  const PartyBox = ({ p }) => {
    const mem = partyMembers(p);
    const grp = mode === '2' ? split[p] : null;
    return (
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={() => dropTo(p)}
        className="rounded-xl border p-2 min-h-[168px] transition"
        style={{
          borderColor: grp === 'A' ? `${GROUP_A}99` : grp === 'B' ? `${GROUP_B}99` : '#1d2433',
          background: grp === 'A' ? `${GROUP_A}0d` : grp === 'B' ? `${GROUP_B}0d` : 'rgba(16,20,28,0.6)',
        }}
      >
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-bold text-base-300">
            파티 {p} <span className="text-base-500">{mem.length}/{PARTY_CAP}</span>
          </p>
          {mode === '2' && (
            <div className="flex gap-0.5">
              <button type="button" onClick={() => setPartyGroup(p, 'A')} className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ backgroundColor: grp === 'A' ? GROUP_A : '#1d2433', color: grp === 'A' ? '#06283d' : '#7e93ad' }}>1조</button>
              <button type="button" onClick={() => setPartyGroup(p, 'B')} className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ backgroundColor: grp === 'B' ? GROUP_B : '#1d2433', color: grp === 'B' ? '#3d2c06' : '#7e93ad' }}>2조</button>
            </div>
          )}
        </div>
        <div className="space-y-1">
          {mem.map((m) => <MemberChip key={m.id} m={m} onDragStart={setDragId} onRemove={removeToPool} compact />)}
          {Array.from({ length: Math.max(0, PARTY_CAP - mem.length) }).map((_, i) => (
            <div key={i} className="h-6 rounded-md border border-dashed border-base-700/50" />
          ))}
        </div>
      </div>
    );
  };

  const modeBtn = (m, label, color) => (
    <button
      type="button"
      onClick={() => setMode(m)}
      className="px-3 py-1.5 rounded-lg text-sm font-black transition border"
      style={
        mode === m
          ? { backgroundColor: color, color: '#06131f', borderColor: color }
          : { backgroundColor: 'transparent', color: '#7e93ad', borderColor: '#2a3347' }
      }
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 bg-base-900/95 backdrop-blur-sm overflow-y-auto">
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* 헤더 */}
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <h2 className="text-lg font-black text-white truncate">시뮬레이션 · {raid.title || '공격대'}</h2>
          <div className="flex items-center gap-2 s
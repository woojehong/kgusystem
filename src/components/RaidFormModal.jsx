import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { DIFFICULTIES, UNION_LEADER_LABEL, TANK_CAP } from '../lib/constants';
import { buildRaidTimes, toDateKey, sortGuilds } from '../lib/utils';
import { createRaid, updateRaid, softDeleteRaid } from '../lib/db';
import Modal from './Modal';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// ── 시/분 분리 입력 컴포넌트 ─────────────────────────────────────────

function TimeInput({ label, value, onChange, hint }) {
  const parts = (value || '').split(':');
  const hStr = parts[0] || '';
  const mStr = parts[1] || '';

  const update = (h, m) => onChange(`${h}:${m}`);

  const handleHour = (e) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 2);
    update(v, mStr);
  };

  const handleMin = (e) => {
    const v = e.target.value.replace(/\D/g, '').slice(0, 2);
    update(hStr, v);
  };

  const blurHour = () => {
    const h = Math.min(23, Math.max(0, parseInt(hStr, 10) || 0));
    update(String(h).padStart(2, '0'), mStr || '00');
  };

  const blurMin = () => {
    const m = Math.min(59, Math.max(0, parseInt(mStr, 10) || 0));
    update(hStr || '00', String(m).padStart(2, '0'));
  };

  return (
    <div>
      <label className="label-sm">{label}</label>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <input
            className="input-base text-center font-bold text-xl tabular-nums"
            value={hStr}
            onChange={handleHour}
            onBlur={blurHour}
            placeholder="21"
            inputMode="numeric"
            maxLength={2}
          />
          <p className="text-[10px] text-center text-base-400 mt-0.5">시</p>
        </div>
        <span className="text-2xl font-bold text-base-300 mb-4 select-none">:</span>
        <div className="flex-1">
          <input
            className="input-base text-center font-bold text-xl tabular-nums"
            value={mStr}
            onChange={handleMin}
            onBlur={blurMin}
            placeholder="00"
            inputMode="numeric"
            maxLength={2}
          />
          <p className="text-[10px] text-center text-base-400 mt-0.5">분</p>
        </div>
      </div>
      {hint && <p className="text-[11px] text-base-400 mt-1">{hint}</p>}
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────────────────

export default function RaidFormModal({ open, onClose, dateKey, raid, applicants = [] }) {
  const { guilds, profile } = useApp();
  const isEdit = !!raid;

  const sortedGuilds = useMemo(() => sortGuilds(guilds).filter((g) => !g.isNone), [guilds]);

  // ── Form state ──
  const [localDateKey, setLocalDateKey] = useState('');
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState('normal');
  const [startTime, setStartTime] = useState('20:00');
  const [endTime, setEndTime] = useState('23:00');
  const [healerCap, setHealerCap] = useState(DIFFICULTIES.normal.defaultHealers);
  const [leader, setLeader] = useState(UNION_LEADER_LABEL);
  const [noIlvlLimit, setNoIlvlLimit] = useState(true);
  const [minIlvl, setMinIlvl] = useState('');
  const [description, setDescription] = useState('');
  const [partyType, setPartyType] = useState('union');
  const [allowedGuilds, setAllowedGuilds] = useState('all');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const defaultDateKey = dateKey || toDateKey(new Date());

  useEffect(() => {
    if (!open) return;
    setError('');
    setConfirmDelete(false);

    if (isEdit) {
      setLocalDateKey(raid.dateKey);
      setTitle(raid.title || '');
      setDifficulty(raid.difficulty);
      const s = raid.startAt.toDate();
      const e = raid.endAt.toDate();
      const fmt = (d) =>
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      setStartTime(fmt(s));
      setEndTime(fmt(e));
      setHealerCap(raid.healerCap);
      setLeader(raid.leader);
      setNoIlvlLimit(raid.minIlvl == null);
      setMinIlvl(raid.minIlvl == null ? '' : String(raid.minIlvl));
      setDescription(raid.description || '');
      setPartyType(raid.partyType || 'union');
      setAllowedGuilds(raid.allowedGuilds ?? 'all');
    } else {
      setLocalDateKey(defaultDateKey);
      setTitle('');
      setDifficulty('normal');
      setStartTime('20:00');
      setEndTime('23:00');
      setHealerCap(DIFFICULTIES.normal.defaultHealers);
      setLeader(UNION_LEADER_LABEL);
      setNoIlvlLimit(true);
      setMinIlvl('');
      setDescription('');
      setPartyType('union');
      setAllowedGuilds('all');
    }
  }, [open, raid]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePartyTypeChange = (val) => {
    setPartyType(val);
    setAllowedGuilds(val === 'union' ? 'all' : [val]);
  };

  const toggleAllowedGuild = (guildId) => {
    if (allowedGuilds === 'all') { setAllowedGuilds([guildId]); return; }
    const current = Array.isArray(allowedGuilds) ? allowedGuilds : [];
    if (current.includes(guildId)) {
      const next = current.filter((id) => id !== guildId);
      setAllowedGuilds(next.length === 0 ? [partyType] : next);
    } else {
      setAllowedGuilds([...current, guildId]);
    }
  };

  const isAllAllowed = allowedGuilds === 'all';
  const allowedList = isAllAllowed ? [] : (Array.isArray(allowedGuilds) ? allowedGuilds : []);

  const leaderOptions = useMemo(() => {
    const guildLeaders = sortedGuilds.map((g) => `${g.name} 길드장`);
    const capable = applicants
      .filter((a) => a.leaderCapable && !a.isReservation)
      .map((a) => a.nickname);
    return [UNION_LEADER_LABEL, ...guildLeaders, ...capable.filter((n) => !guildLeaders.includes(n))];
  }, [sortedGuilds, applicants]);

  const effectiveDateKey = isEdit ? raid.dateKey : (localDateKey || defaultDateKey);
  const diff = DIFFICULTIES[difficulty];
  const dpsCap = diff.totalCap - TANK_CAP - healerCap;

  // Normalize "시:분" string before validation
  const normalizeTimeStr = (t) => {
    const [h, m] = (t || '').split(':');
    const hh = String(Math.min(23, Math.max(0, parseInt(h, 10) || 0))).padStart(2, '0');
    const mm = String(Math.min(59, Math.max(0, parseInt(m, 10) || 0))).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const submit = async () => {
    setError('');
    if (!isEdit && !DATE_PATTERN.test(localDateKey)) {
      setError('날짜를 올바르게 입력해주세요.');
      return;
    }
    if (!title.trim()) {
      setError('레이드 파티 제목을 입력해주세요.');
      return;
    }
    const normStart = normalizeTimeStr(startTime);
    const normEnd = normalizeTimeStr(endTime);
    if (!TIME_PATTERN.test(normStart) || !TIME_PATTERN.test(normEnd)) {
      setError('시간을 올바르게 입력해주세요. (0~23시, 0~59분)');
      return;
    }
    if (!noIlvlLimit && !/^\d+$/.test(minIlvl)) {
      setError('최소 아이템레벨은 정수로 입력해주세요.');
      return;
    }
    if (healerCap < 0 || dpsCap < 0) {
      setError('힐러 수가 정원을 초과합니다.');
      return;
    }
    setBusy(true);
    try {
      const { startAt, endAt } = buildRaidTimes(effectiveDateKey, normStart, normEnd);
      const finalAllowedGuilds = partyType === 'union' ? 'all' : allowedGuilds;
      const payload = {
        title: title.trim(),
        dateKey: effectiveDateKey,
        startAt,
        endAt,
        difficulty,
        healerCap,
        leader,
        minIlvl: noIlvlLimit ? null : Number(minIlvl),
        description: description.trim(),
        partyType,
        allowedGuilds: finalAllowedGuilds,
      };
      if (isEdit) {
        await updateRaid(raid.id, payload);
      } else {
        await createRaid(payload);
      }
      onClose(true);
    } catch {
      setError('저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await softDeleteRaid(raid.id);
      onClose(true);
    } catch {
      setError('삭제에 실패했습니다.');
      setBusy(false);
    }
  };

  const myGuild = useMemo(
    () => sortedGuilds.find((g) => g.id === profile?.guildId),
    [sortedGuilds, profile]
  );

  return (
    <Modal
      open={open}
      onClose={() => onClose(false)}
      title={`레이드 ${isEdit ? '수정' : '추가'}`}
    >
      <div className="space-y-4">

        {/* 날짜 (create mode only) */}
        {!isEdit && (
          <div>
            <label className="label-sm">날짜</label>
            <input
              type="date"
              className="input-base"
              value={localDateKey}
              onChange={(e) => setLocalDateKey(e.target.value)}
            />
          </div>
        )}

        {/* 제목 */}
        <div>
          <label className="label-sm">레이드 파티 제목</label>
          <input
            className="input-base"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 한길련 연합 길드 레이드 신화 학원파티"
            maxLength={30}
          />
        </div>

        {/* 파티 성격 */}
        <div>
          <label className="label-sm">파티 성격</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handlePartyTypeChange('union')}
              className={`py-2.5 rounded-xl font-semibold text-sm border transition ${
                partyType === 'union'
                  ? 'border-indigo-400 bg-indigo-500/15 text-indigo-200'
                  : 'border-base-700 text-base-400 hover:text-base-200'
              }`}
            >
              연합 길드 레이드
            </button>
            <button
              type="button"
              disabled={!myGuild}
              onClick={() => myGuild && handlePartyTypeChange(myGuild.id)}
              className={`py-2.5 rounded-xl font-semibold text-sm border transition ${
                partyType !== 'union'
                  ? 'border-indigo-400 bg-indigo-500/15 text-indigo-200'
                  : 'border-base-700 text-base-400 hover:text-base-200'
              } ${!myGuild ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {myGuild ? `${myGuild.name} 레이드` : '길드 레이드'}
            </button>
          </div>
        </div>

        {/* 신청 가능 길드 */}
        {partyType !== 'union' && (
          <div>
            <label className="label-sm">신청 가능 길드</label>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 p-2.5 rounded-xl bg-base-850 border border-base-700 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-indigo-500"
                  checked={isAllAllowed}
                  onChange={(e) => setAllowedGuilds(e.target.checked ? 'all' : [partyType])}
                />
                <span className="text-sm font-medium">모두 (연합 전체)</span>
              </label>
              {!isAllAllowed && sortedGuilds.map((g) => (
                <label
                  key={g.id}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-base-850 border border-base-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-indigo-500"
                    checked={allowedList.includes(g.id)}
                    onChange={() => toggleAllowedGuild(g.id)}
                  />
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                  <span className="text-sm font-medium" style={{ color: g.color }}>{g.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* 난이도 */}
        <div>
          <label className="label-sm">난이도</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.values(DIFFICULTIES).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => { setDifficulty(d.id); setHealerCap(d.defaultHealers); }}
                className={`py-2.5 rounded-xl font-bold text-sm border transition ${
                  difficulty === d.id ? 'border-current' : 'border-base-700 opacity-50 hover:opacity-80'
                }`}
                style={{ color: d.color, backgroundColor: difficulty === d.id ? `${d.color}1a` : undefined }}
              >
                {d.label}
                <span className="block text-[10px] font-medium opacity-70">{d.totalCap}인</span>
              </button>
            ))}
          </div>
        </div>

        {/* 시작/종료 시간 — 시·분 분리 입력 */}
        <div className="grid grid-cols-2 gap-3">
          <TimeInput
            label="시작 시간"
            value={startTime}
            onChange={setStartTime}
          />
          <TimeInput
            label="종료 시간"
            value={endTime}
            onChange={setEndTime}
            hint="시작보다 이르면 다음날 새벽으로 처리"
          />
        </div>

        {/* 힐러 수 */}
        <div>
          <label className="label-sm">힐러 수</label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="w-10 h-10 rounded-xl bg-base-700 hover:bg-base-600 font-bold text-lg transition"
              onClick={() => setHealerCap(Math.max(0, healerCap - 1))}
            >
              −
            </button>
            <span className="text-xl font-bold w-8 text-center">{healerCap}</span>
            <button
              type="button"
              className="w-10 h-10 rounded-xl bg-base-700 hover:bg-base-600 font-bold text-lg transition"
              onClick={() => setHealerCap(healerCap + 1)}
            >
              +
            </button>
            <span className="text-sm text-base-300 ml-2">
              탱 {TANK_CAP} · 힐 {healerCap} · 딜 {dpsCap} = 총 {diff.totalCap}인
            </span>
          </div>
        </div>

        {/* 공대장 */}
        <div>
          <label className="label-sm">공대장</label>
          <select className="input-base" value={leader} onChange={(e) => setLeader(e.target.value)}>
            {leaderOptions.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        {/* 최소 아이템레벨 */}
        <div>
          <label className="label-sm">최소 아이템레벨</label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
              <input
                type="checkbox"
                checked={noIlvlLimit}
                onChange={(e) => setNoIlvlLimit(e.target.checked)}
                className="w-4 h-4 accent-indigo-500"
              />
              제한없음
            </label>
            {!noIlvlLimit && (
              <input
                className="input-base flex-1"
                value={minIlvl}
                onChange={(e) => setMinIlvl(e.target.value.replace(/\D/g, ''))}
                placeholder="예: 280"
                inputMode="numeric"
              />
            )}
          </div>
        </div>

        {/* 레이드 설명 */}
        <div>
          <label className="label-sm">레이드 설명 (신청자 전체 공개)</label>
          <textarea
            className="input-base min-h-[88px] resize-y"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="공지사항을 입력해주세요"
          />
        </div>

        {error && <p className="text-sm text-red-400 text-center">{error}</p>}

        <div className="flex gap-2">
          {isEdit &&
            (confirmDelete ? (
              <button type="button" className="btn-danger flex-1" disabled={busy} onClick={handleDelete}>
                정말 삭제할까요?
              </button>
            ) : (
              <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(true)}>
                삭제
              </button>
            ))}
          <button type="button" className="btn-primary flex-1" disabled={busy} onClick={submit}>
            {busy ? '저장 중...' : isEdit ? '수정 완료' : '레이드 등록'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

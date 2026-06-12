import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { DIFFICULTIES, UNION_LEADER_LABEL, TANK_CAP } from '../lib/constants';
import { buildRaidTimes, formatDateLabel, toDateKey } from '../lib/utils';
import { createRaid, updateRaid, deleteRaid } from '../lib/db';
import Modal from './Modal';

const TIME_PATTERN = /^([01]?\d|2[0-3]):[0-5]\d$/;

function normalizeTime(value) {
  const compact = value.replace(/[^\d:]/g, '');
  if (/^\d{3,4}$/.test(compact)) {
    const h = compact.length === 3 ? compact.slice(0, 1) : compact.slice(0, 2);
    const m = compact.slice(-2);
    return `${h.padStart(2, '0')}:${m}`;
  }
  return compact;
}

/**
 * Raid create/edit form. `applicants` (optional) supplies leader-capable
 * applicant nicknames for the leader dropdown when editing.
 */
export default function RaidFormModal({ open, onClose, dateKey, raid, applicants = [] }) {
  const { guilds } = useApp();
  const isEdit = !!raid;

  const [difficulty, setDifficulty] = useState('normal');
  const [startTime, setStartTime] = useState('20:00');
  const [endTime, setEndTime] = useState('23:00');
  const [healerCap, setHealerCap] = useState(DIFFICULTIES.normal.defaultHealers);
  const [leader, setLeader] = useState(UNION_LEADER_LABEL);
  const [noIlvlLimit, setNoIlvlLimit] = useState(true);
  const [minIlvl, setMinIlvl] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError('');
    setConfirmDelete(false);
    if (raid) {
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
    } else {
      setDifficulty('normal');
      setStartTime('20:00');
      setEndTime('23:00');
      setHealerCap(DIFFICULTIES.normal.defaultHealers);
      setLeader(UNION_LEADER_LABEL);
      setNoIlvlLimit(true);
      setMinIlvl('');
      setDescription('');
    }
  }, [open, raid]);

  const leaderOptions = useMemo(() => {
    const guildLeaders = guilds.filter((g) => !g.isNone).map((g) => `${g.name} 길드장`);
    const capable = applicants
      .filter((a) => a.leaderCapable && !a.isReservation)
      .map((a) => a.nickname);
    return [UNION_LEADER_LABEL, ...guildLeaders, ...capable.filter((n) => !guildLeaders.includes(n))];
  }, [guilds, applicants]);

  const effectiveDateKey = raid ? raid.dateKey : dateKey || toDateKey(new Date());
  const diff = DIFFICULTIES[difficulty];
  const dpsCap = diff.totalCap - TANK_CAP - healerCap;

  const submit = async () => {
    setError('');
    if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) {
      setError('시간은 HH:MM 형식으로 입력해주세요. (예: 20:30)');
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
      const { startAt, endAt } = buildRaidTimes(effectiveDateKey, startTime, endTime);
      const payload = {
        dateKey: effectiveDateKey,
        startAt,
        endAt,
        difficulty,
        healerCap,
        leader,
        minIlvl: noIlvlLimit ? null : Number(minIlvl),
        description: description.trim(),
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
      await deleteRaid(raid.id);
      onClose(true);
    } catch {
      setError('삭제에 실패했습니다.');
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => onClose(false)}
      title={`레이드 ${isEdit ? '수정' : '추가'} · ${formatDateLabel(effectiveDateKey)}`}
    >
      <div className="space-y-4">
        <div>
          <label className="label-sm">난이도</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.values(DIFFICULTIES).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setDifficulty(d.id);
                  setHealerCap(d.defaultHealers);
                }}
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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label-sm">시작 시간</label>
            <input
              className="input-base"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              onBlur={(e) => setStartTime(normalizeTime(e.target.value))}
              placeholder="20:00"
              inputMode="numeric"
            />
          </div>
          <div>
            <label className="label-sm">종료 시간</label>
            <input
              className="input-base"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              onBlur={(e) => setEndTime(normalizeTime(e.target.value))}
              placeholder="23:00"
              inputMode="numeric"
            />
            <p className="text-[11px] text-base-400 mt-1">시작보다 이르면 다음날 새벽으로 처리</p>
          </div>
        </div>

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
            <span className="text-sm text-base-400 ml-2">
              탱 {TANK_CAP} · 힐 {healerCap} · 딜 {dpsCap} = 총 {diff.totalCap}인
            </span>
          </div>
        </div>

        <div>
          <label className="label-sm">공대장</label>
          <select className="input-base" value={leader} onChange={(e) => setLeader(e.target.value)}>
            {leaderOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

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
                placeholder="예: 480"
                inputMode="numeric"
              />
            )}
          </div>
        </div>

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

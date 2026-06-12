import { useEffect, useState } from 'react';
import { formatDateLabel } from '../lib/utils';
import { updateApplication, cancelApplication, fetchMemo, setUserNotice } from '../lib/db';
import Modal from './Modal';

const POSITION_OPTIONS = [
  { key: 'tank', label: '탱커', role: 'tank' },
  { key: 'healer', label: '힐러', role: 'healer' },
  { key: 'dps', label: '딜러', role: 'dps' },
];

function positionKey(app) {
  return app.role;
}

/**
 * Admin-side applicant management: item level / memo edits, active ↔
 * waitlist moves, forced position changes (allowed regardless of
 * capacity; the applicant re-enters the new column at the last seat),
 * and removal. Nickname and spec are intentionally not editable.
 */
export default function AdminAppEditModal({ open, onClose, raid, app }) {
  const [ilvl, setIlvl] = useState('');
  const [memoText, setMemoText] = useState('');
  const [position, setPosition] = useState('tank');
  const [status, setStatus] = useState('active');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  useEffect(() => {
    if (!open || !app) return;
    setIlvl(app.ilvl != null ? String(app.ilvl) : '');
    setPosition(positionKey(app));
    setStatus(app.status);
    setError('');
    setConfirmRemove(false);
    setMemoText('');
    fetchMemo(raid.id, app.id)
      .then(setMemoText)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, app?.id]);

  if (!app) return null;

  const raidTitle = `${formatDateLabel(raid.dateKey)} ${
    raid.difficulty === 'mythic' ? '신화' : raid.difficulty === 'heroic' ? '영웅' : '일반'
  }`;

  const save = async () => {
    setError('');
    if (ilvl && !/^\d+$/.test(ilvl)) {
      setError('아이템 레벨은 정수로 입력해주세요.');
      return;
    }
    setBusy(true);
    try {
      const opt = POSITION_OPTIONS.find((o) => o.key === position);
      const positionChanged = positionKey(app) !== position;
      const statusChanged = app.status !== status;
      const payload = {
        ilvl: ilvl ? Number(ilvl) : null,
        role: opt.role,
        range: opt.role === 'dps' ? app.range ?? null : null,
        status,
      };
      // A position or status change re-enters at the back of the queue.
      if (positionChanged || statusChanged) payload.seq = Date.now();

      await updateApplication(raid.id, app.id, payload, memoText);

      // Promotion / demotion popup for real members.
      if (statusChanged && app.userId) {
        const type = status === 'active' ? 'promoted' : 'demoted';
        await setUserNotice(app.userId, { type, raidTitle, raidId: raid.id, at: Date.now() }).catch(
          () => {}
        );
      }
      onClose(true);
    } catch {
      setError('저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await cancelApplication(raid.id, app.id);
      onClose(true);
    } catch {
      setError('삭제에 실패했습니다.');
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={() => onClose(false)} title={`신청자 관리 · ${app.charName}`}>
      <div className="space-y-4">
        <div className="p-3 rounded-xl bg-base-850 border border-base-700 text-sm space-y-0.5">
          <p>
            <span className="text-base-400">닉네임</span>{' '}
            <span className="font-semibold">{app.nickname}</span>
            {app.isReservation && <span className="ml-2 text-amber-300 text-xs font-bold">예약</span>}
          </p>
          <p>
            <span className="text-base-400">클래스/특성</span>{' '}
            <span className="font-semibold">
              {app.className || '미지정'}
              {app.specName ? ` | ${app.specName}` : ''}
            </span>
            <span className="ml-2 text-xs text-base-400">(수정 불가)</span>
          </p>
        </div>

        <div>
          <label className="label-sm">아이템 레벨</label>
          <input
            className="input-base"
            value={ilvl}
            onChange={(e) => setIlvl(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric"
            placeholder="미입력"
          />
        </div>

        <div>
          <label className="label-sm">포지션 (강제 변경 가능)</label>
          <div className="grid grid-cols-3 gap-1.5">
            {POSITION_OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => setPosition(o.key)}
                className={`py-2 rounded-lg text-sm font-medium border transition ${
                  position === o.key
                    ? 'border-indigo-400 bg-indigo-500/15'
                    : 'border-base-700 bg-base-850 hover:bg-base-700'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-base-400 mt-1">
            변경 시 기존 슬롯은 즉시 반환되고 새 포지션의 최후순위로 배정됩니다.
          </p>
        </div>

        <div>
          <label className="label-sm">상태</label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setStatus('active')}
              className={`py-2 rounded-lg text-sm font-semibold border transition ${
                status === 'active'
                  ? 'border-green-400 bg-green-500/10 text-green-300'
                  : 'border-base-700 bg-base-850 hover:bg-base-700'
              }`}
            >
              참가 확정
            </button>
            <button
              type="button"
              onClick={() => setStatus('wait')}
              className={`py-2 rounded-lg text-sm font-semibold border transition ${
                status === 'wait'
                  ? 'border-amber-400 bg-amber-500/10 text-amber-300'
                  : 'border-base-700 bg-base-850 hover:bg-base-700'
              }`}
            >
              대기
            </button>
          </div>
        </div>

        <div>
          <label className="label-sm">메모 (관리자 열람용)</label>
          <textarea
            className="input-base min-h-[56px] resize-y"
            value={memoText}
            onChange={(e) => setMemoText(e.target.value)}
            placeholder="메모 없음"
          />
        </div>

        {error && <p className="text-sm text-red-400 text-center">{error}</p>}

        <div className="flex gap-2">
          {confirmRemove ? (
            <button type="button" className="btn-danger flex-1" disabled={busy} onClick={remove}>
              정말 제외할까요?
            </button>
          ) : (
            <button type="button" className="btn-ghost" onClick={() => setConfirmRemove(true)}>
              명단 제외
            </button>
          )}
          <button type="button" className="btn-primary flex-1" disabled={busy} onClick={save}>
            {busy ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

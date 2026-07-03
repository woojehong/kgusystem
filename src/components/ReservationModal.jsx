import { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { badgeTextStyle } from '../lib/utils';
import { submitApplication } from '../lib/db';
import { randomId } from '../lib/utils';
import Modal from './Modal';
import SpecIcon from './SpecIcon';

/**
 * Admin reservation form. A reservation occupies a slot in the chosen
 * position. Class and spec are optional.
 */
export default function ReservationModal({ open, onClose, raid, role }) {
  const { gamedata } = useApp();
  const [nickname, setNickname] = useState('');
  const [server, setServer] = useState('');
  const [classId, setClassId] = useState('');
  const [specId, setSpecId] = useState('');
  const [ilvl, setIlvl] = useState('');
  const [memoText, setMemoText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setNickname('');
      setServer('');
      setClassId('');
      setSpecId('');
      setIlvl('');
      setMemoText('');
      setError('');
    }
  }, [open]);

  const cls = gamedata.classes.find((c) => c.id === classId);
  const roleSpecs = cls ? cls.specs.filter((s) => s.role === role) : [];
  const spec = roleSpecs.find((s) => s.id === specId);

  const roleLabel = role === 'tank' ? '탱커' : role === 'healer' ? '힐러' : '딜러';

  const submit = async () => {
    setError('');
    if (!nickname.trim()) {
      setError('닉네임을 입력해주세요.');
      return;
    }
    setBusy(true);
    try {
      const appId = randomId('rsv_');
      await submitApplication(
        raid.id,
        appId,
        {
          userId: null,
          nickname: nickname.trim(),
          guildId: null,
          guildName: '예약',
          guildColor: '#f59e0b',
          charId: null,
          charName: nickname.trim(),
          server: server || null,
          classId: classId || null,
          className: cls?.name || null,
          classColor: cls?.color || '#94a3b8',
          specId: spec?.id || null,
          specName: spec?.name || null,
          role,
          range: role === 'dps' ? (spec ? spec.range : null) : null,
          ilvl: ilvl ? Number(ilvl) : null,
          leaderCapable: false,
          swap: false,
          swapRoles: [],
          status: 'active',
          seq: Date.now(),
          isReservation: true,
        },
        memoText
      );
      onClose(true);
    } catch {
      setError('예약 등록에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={() => onClose(false)} title={`${roleLabel} 예약 추가`}>
      <div className="space-y-4">
        <div>
          <label className="label-sm">닉네임 (필수)</label>
          <input
            className="input-base"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="예약자 닉네임"
            maxLength={24}
          />
        </div>

        <div>
          <label className="label-sm">서버 <span className="text-base-400 font-normal">(선택)</span></label>
          <select className="input-base" value={server} onChange={(e) => setServer(e.target.value)}>
            <option value="">미지정</option>
            {(gamedata.servers || []).map((s) => (
              <option key={s.slug || s.ko} value={s.ko}>{s.ko}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label-sm">
            클래스 <span className="text-base-400 font-normal">(선택 — 시너지 현황판에 반영)</span>
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => { setClassId(''); setSpecId(''); }}
              className={`px-1 py-2 rounded-lg text-xs font-semibold border transition ${
                !classId ? 'border-indigo-400 bg-base-700' : 'border-base-700 bg-base-800 hover:bg-base-700'
              }`}
            >
              미지정
            </button>
            {gamedata.classes
              .filter((c) => c.specs.some((s) => s.role === role))
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setClassId(c.id); setSpecId(''); }}
                  className={`px-1 py-2 rounded-lg text-xs font-semibold border transition ${
                    classId === c.id ? 'border-indigo-400 bg-base-700' : 'border-base-700 bg-base-800 hover:bg-base-700'
                  }`}
                  style={badgeTextStyle(c.color)}
                >
                  {c.name}
                </button>
              ))}
          </div>
        </div>

        {cls && roleSpecs.length > 0 && (
          <div>
            <label className="label-sm">특성 <span className="text-base-400 font-normal">(선택)</span></label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSpecId('')}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                  !specId ? 'border-indigo-400 bg-indigo-500/15' : 'border-base-700 bg-base-850 hover:bg-base-700'
                }`}
              >
                미지정
              </button>
              {roleSpecs.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSpecId(s.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                    specId === s.id ? 'border-indigo-400 bg-indigo-500/15' : 'border-base-700 bg-base-850 hover:bg-base-700'
                  }`}
                >
                  <SpecIcon specId={s.id} size={16} className="mr-1 align-middle" />
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="label-sm">아이템 레벨 <span className="text-base-400 font-normal">(선택)</span></label>
          <input
            className="input-base"
            value={ilvl}
            onChange={(e) => setIlvl(e.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            placeholder="예: 639"
          />
        </div>

        <div>
          <label className="label-sm">관리자 메모 (선택)</label>
          <textarea
            className="input-base min-h-[56px] resize-y"
            value={memoText}
            onChange={(e) => setMemoText(e.target.value)}
            placeholder="관리자만 볼 수 있는 메모"
          />
        </div>

        {error && <p className="text-sm text-red-400 text-center">{error}</p>}

        <button type="button" className="btn-primary w-full" disabled={busy} on
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { getCaps, getClass, getSpec, badgeTextStyle } from '../lib/utils';
import { submitApplication, updateApplication, fetchMemo } from '../lib/db';
import { useToast } from './Toast';
import Modal from './Modal';
import SpecIcon from './SpecIcon';

function Toggle({ on, onChange, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative w-11 h-6 rounded-full transition shrink-0 ${
        on ? 'bg-indigo-500' : 'bg-base-600'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
          on ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

/**
 * Application create/edit form.
 * - Normal apply: one character + spec, auto active/waitlist by capacity.
 * - Bench apply (toggle): standby reserve, multiple characters allowed,
 *   no roster/waitlist counting, no webhook.
 */
export default function ApplyModal({ open, onClose, raid, apps, existingApp }) {
  const { userId, profile, gamedata, guilds } = useApp();
  const toast = useToast();
  const isEdit = !!existingApp;

  const characters = profile?.characters || [];
  const [bench, setBench] = useState(false);
  const [benchCharIds, setBenchCharIds] = useState([]);
  const [charIndex, setCharIndex] = useState(0);
  const [specId, setSpecId] = useState('');
  const [ilvl, setIlvl] = useState('');
  const [leaderCapable, setLeaderCapable] = useState(false);
  const [swap, setSwap] = useState(false);
  const [memoText, setMemoText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [waitConfirm, setWaitConfirm] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError('');
    setWaitConfirm(null);
    if (isEdit) {
      const isBench = existingApp.status === 'bench';
      setBench(isBench);
      setBenchCharIds(isBench ? (existingApp.benchChars || []).map((c) => c.charId).filter(Boolean) : []);
      const idx = characters.findIndex((c) => c.id === existingApp.charId);
      setCharIndex(idx >= 0 ? idx : 0);
      setSpecId(existingApp.specId || '');
      setIlvl(existingApp.ilvl != null ? String(existingApp.ilvl) : '');
      setLeaderCapable(!!existingApp.leaderCapable);
      setSwap(!!existingApp.swap);
      setMemoText('');
      fetchMemo(raid.id, existingApp.id)
        .then(setMemoText)
        .catch(() => {});
    } else {
      const main = profile?.mainCharIndex ?? 0;
      setBench(false);
      setBenchCharIds([]);
      setCharIndex(main < characters.length ? main : 0);
      const mainChar = characters[main < characters.length ? main : 0];
      setSpecId(mainChar?.specs?.[0] || '');
      setIlvl(mainChar?.ilvl ? String(mainChar.ilvl) : '');
      setLeaderCapable(!!profile?.leaderCapable);
      setSwap(false);
      setMemoText('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const character = characters[charIndex];
  const cls = character ? getClass(gamedata.classes, character.classId) : null;
  const spec = character ? getSpec(gamedata.classes, character.classId, specId) : null;

  const swapRoles = useMemo(() => {
    if (!character || !spec) return [];
    const roles = new Set(
      (character.specs || [])
        .map((sId) => getSpec(gamedata.classes, character.classId, sId)?.role)
        .filter(Boolean)
    );
    roles.delete(spec.role);
    return [...roles];
  }, [character, spec, gamedata.classes]);

  useEffect(() => {
    if (swapRoles.length === 0) setSwap(false);
  }, [swapRoles.length]);

  if (!profile) return null;

  const guildAllowed = (() => {
    const userGuildId = profile.guildId || '';
    const isNoGuild = userGuildId === 'none' || userGuildId === '';
    if (isNoGuild && raid.allowNoGuild === false) return false;
    if (!raid.allowedGuilds || raid.allowedGuilds === 'all') return true;
    if (Array.isArray(raid.allowedGuilds)) return raid.allowedGuilds.includes(userGuildId);
    return true;
  })();

  const selectCharacter = (idx) => {
    setCharIndex(idx);
    const c = characters[idx];
    setSpecId(c?.specs?.[0] || '');
    setIlvl(c?.ilvl ? String(c.ilvl) : '');
  };

  const toggleBenchChar = (id) => {
    setBenchCharIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const buildAppData = (status, resetSeq) => {
    const guild = guilds.find((g) => g.id === profile.guildId);
    const allSpecNames = (character.specs || [])
      .map((sId) => getSpec(gamedata.classes, character.classId, sId)?.name)
      .filter(Boolean);
    return {
      userId,
      nickname: profile.nickname,
      guildId: profile.guildId,
      guildName: guild?.name || '소속 없음',
      guildColor: guild?.color || '#64748b',
      charId: character.id,
      charName: character.name,
      server: character.server,
      classId: cls.id,
      className: cls.name,
      classColor: cls.color,
      specId: spec.id,
      specName: spec.name,
      allSpecNames,
      role: spec.role,
      range: spec.role === 'dps' ? spec.range : null,
      ilvl: Number(ilvl),
      leaderCapable,
      isGuildMaster: !!profile.isGuildMaster,
      swap: swapRoles.length > 0 ? swap : false,
      swapRoles,
      status,
      seq: resetSeq ? Date.now() : existingApp?.seq ?? Date.now(),
      isReservation: false,
      benchChars: [],
    };
  };

  const buildBenchData = () => {
    const guild = guilds.find((g) => g.id === profile.guildId);
    const benchChars = benchCharIds
      .map((id) => characters.find((c) => c.id === id))
      .filter(Boolean)
      .map((c) => {
        const cCls = getClass(gamedata.classes, c.classId);
        const specNames = (c.specs || [])
          .map((sId) => getSpec(gamedata.classes, c.classId, sId)?.name)
          .filter(Boolean);
        const roles = [
          ...new Set(
            (c.specs || []).map((sId) => getSpec(gamedata.classes, c.classId, sId)?.role).filter(Boolean)
          ),
        ];
        return {
          charId: c.id,
          charName: c.name,
          server: c.server,
          classId: c.classId,
          className: cCls?.name || null,
          classColor: cCls?.color || '#cbd5e1',
          specNames,
          roles,
        };
      });
    return {
      userId,
      nickname: profile.nickname,
      guildId: profile.guildId,
      guildName: guild?.name || '소속 없음',
      guildColor: guild?.color || '#64748b',
      isGuildMaster: !!profile.isGuildMaster,
      benchChars,
      charId: benchChars[0]?.charId || null,
      charName: benchChars[0]?.charName || null,
      server: benchChars[0]?.server || null,
      classId: benchChars[0]?.classId || null,
      className: benchChars[0]?.className || null,
      classColor: benchChars[0]?.classColor || '#cbd5e1',
      specId: null,
      specName: null,
      allSpecNames: [],
      role: null,
      range: null,
      ilvl: null,
      leaderCapable: false,
      swap: false,
      swapRoles: [],
      status: 'bench',
      seq: existingApp?.seq ?? Date.now(),
      isReservation: false,
    };
  };

  const persist = async (status, resetSeq) => {
    setBusy(true);
    try {
      const data = buildAppData(status, resetSeq);
      if (isEdit) {
        await updateApplication(raid.id, existingApp.id, data, memoText);
        toast('신청 정보가 수정되었습니다 ✓');
      } else {
        await submitApplication(raid.id, userId, data, memoText);
        toast(status === 'wait' ? '대기 목록에 등록되었습니다' : '파티 참가 신청이 완료되었습니다 ✓');
      }
      onClose(true);
    } catch {
      setError('저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
      setWaitConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  const persistBench = async () => {
    setBusy(true);
    try {
      const data = buildBenchData();
      if (isEdit) {
        await updateApplication(raid.id, existingApp.id, data, memoText);
      } else {
        await submitApplication(raid.id, userId, data, memoText);
      }
      toast('벤치(예비 인원)로 등록되었습니다');
      onClose(true);
    } catch {
      setError('저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    setError('');

    // ── 벤치 신청 ──
    if (bench) {
      if (benchCharIds.length === 0) {
        setError('벤치로 등록할 캐릭터를 1개 이상 선택해주세요.');
        return;
      }
      persistBench();
      return;
    }

    // ── 일반 신청 ──
    if (!character) {
      setError('참여할 캐릭터를 선택해주세요.');
      return;
    }
    if (!spec) {
      setError('참여 특성을 선택해주세요.');
      return;
    }
    if (!/^\d+$/.test(ilvl)) {
      setError('아이템 레벨을 정수로 입력해주세요.');
      return;
    }
    if (raid.minIlvl != null && Number(ilvl) < raid.minIlvl) {
      setError(
        `입력한 아이템 레벨(${ilvl})이 최소 요구 아이템 레벨(${raid.minIlvl})보다 낮습니다. 관리자에게 문의해주세요.`
      );
      return;
    }

    const caps = getCaps(raid);
    const others = apps.filter((a) => a.id !== existingApp?.id);
    const roleActive = others.filter((a) => a.status === 'active' && a.role === spec.role).length;
    const totalCount = others.filter((a) => a.status !== 'bench').length + 1;
    const wasBench = isEdit && existingApp.status === 'bench';
    const roleChanged = isEdit && !wasBench && existingApp.role !== spec.role;

    if (isEdit && !wasBench && !roleChanged) {
      persist(existingApp.status, false);
      return;
    }

    const positionFull = roleActive >= caps[spec.role];
    const totalOver = totalCount > caps.totalCap;

    if (positionFull || totalOver) {
      setWaitConfirm({ role: spec.role });
    } else {
      persist('active', true);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => onClose(false)}
      title={isEdit ? '신청 정보 수정' : '파티 참가 신청'}
    >
      {!guildAllowed ? (
        <div className="text-center py-6 space-y-3">
          <div className="text-4xl">🔒</div>
          <p className="font-semibold">신청 가능 길드가 아닙니다</p>
          <p className="text-sm text-base-400 leading-relaxed">
            이 레이드는 특정 길드 소속 인원만 신청할 수 있습니다.
            <br />
            소속 길드가 다르게 설정되어 있다면 관리자에게 문의해주세요.
          </p>
          <button type="button" className="btn-ghost" onClick={() => onClose(false)}>
            닫기
          </button>
        </div>
      ) : waitConfirm ? (
        <div className="text-center py-2 space-y-4">
          <div className="text-4xl">⚠️</div>
          <p className="font-semibold leading-relaxed">
            현재 대기자를 포함한 인원이 정원을 초과했습니다.
            <br />
            대기목록으로 등록됩니다.
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost flex-1" onClick={() => setWaitConfirm(null)}>
              취소
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={busy}
              onClick={() => persist('wait', true)}
            >
              대기 등록
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 벤치 토글 */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/5 border border-amber-500/30">
            <div>
              <p className="font-medium text-sm">벤치(예비 인원)로 신청</p>
              <p className="text-xs text-base-400">결원 시 와줄 수 있는 예비 전력 (정원·대기 미포함)</p>
            </div>
            <Toggle on={bench} onChange={setBench} />
          </div>

          {bench ? (
            <>
              {/* 벤치 — 캐릭터 복수 선택 */}
              <div>
                <label className="label-sm">벤치 캐릭터 <span className="text-base-400 font-normal">(여러 개 선택 가능)</span></label>
                <div className="space-y-1.5">
                  {characters.map((c) => {
                    const cCls = getClass(gamedata.classes, c.classId);
                    const checked = benchCharIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleBenchChar(c.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition ${
                          checked ? 'border-indigo-400 bg-indigo-500/10' : 'border-base-700 bg-base-850 hover:bg-base-700'
                        }`}
                      >
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] shrink-0 ${
                            checked ? 'bg-indigo-500 border-indigo-400 text-white' : 'border-base-600'
                          }`}
                        >
                          {checked ? '✓' : ''}
                        </span>
                        <span className="font-bold text-sm" style={badgeTextStyle(cCls?.color || '#fff')}>
                          {c.name}
                        </span>
                        <span className="text-xs text-base-400">
                          {c.server} · {cCls?.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="label-sm">참여 캐릭터</label>
                <div className="space-y-1.5">
                  {characters.map((c, i) => {
                    const cCls = getClass(gamedata.classes, c.classId);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectCharacter(i)}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition ${
                          charIndex === i
                            ? 'border-indigo-400 bg-indigo-500/10'
                            : 'border-base-700 bg-base-850 hover:bg-base-700'
                        }`}
                      >
                        <span className="font-bold text-sm" style={badgeTextStyle(cCls?.color || '#fff')}>
                          {c.name}
                        </span>
                        <span className="text-xs text-base-400">
                          {c.server} · {cCls?.name}
                        </span>
                        {(profile.mainCharIndex ?? 0) === i && (
                          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                            대표
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {cls && (
                <div>
                  <label className="label-sm">참여 특성 (이번 레이드)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {cls.specs.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSpecId(s.id)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                          specId === s.id
                            ? 'border-indigo-400 bg-indigo-500/15'
                            : 'border-base-700 bg-base-850 text-base-200 hover:bg-base-700'
                        }`}
                      >
                        <SpecIcon specId={s.id} size={16} className="mr-1 align-middle" />
                        {s.name}
                        <span className="ml-1 text-xs text-base-400">
                          {s.role === 'tank' ? '탱' : s.role === 'healer' ? '힐' : '딜'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="label-sm">
                  아이템 레벨{' '}
                  {raid.minIlvl != null && (
                    <span className="text-amber-400 font-normal">(최소 {raid.minIlvl})</span>
                  )}
                </label>
                <input
                  className="input-base"
                  value={ilvl}
                  onChange={(e) => setIlvl(e.target.value.replace(/\D/g, ''))}
                  placeholder="예: 489"
                  inputMode="numeric"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-base-850 border border-base-700">
                <p className="font-medium text-sm">공대장 가능</p>
                <Toggle on={leaderCapable} onChange={setLeaderCapable} />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-base-850 border border-base-700">
                <div>
                  <p className="font-medium text-sm">스왑 가능</p>
                  <p className="text-xs text-base-400">
                    {swapRoles.length > 0
                      ? '다른 역할 특성이 등록되어 있어 선택 가능합니다'
                      : '신청 특성과 다른 역할의 등록 특성이 없습니다'}
                  </p>
                </div>
                <Toggle on={swap} onChange={setSwap} disabled={swapRoles.length === 0} />
              </div>
            </>
          )}

          <div>
            <label className="label-sm">
              메모 <span className="text-amber-400/90 font-normal">— 관리자만 볼 수 있음</span>
            </label>
            <textarea
              className="input-base min-h-[64px] resize-y"
              value={memoText}
              onChange={(e) => setMemoText(e.target.value)}
              placeholder="관리자에게 전달할 내용 (선택)"
            />
          </div>

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          <button type="button" className="btn-primary w-full" disabled={busy} onClick={submit}>
            {busy ? '처리 중...' : bench ? '�
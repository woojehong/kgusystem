import { useEffect, useMemo, useState } from 'react';
import Modal from './Modal';
import { useApp } from '../context/AppContext';
import { getClass, getSpec, getCaps, badgeTextStyle } from '../lib/utils';
import { fetchUsersByGuild, submitApplication } from '../lib/db';

const ROLE_KO = { tank: '탱', healer: '힐', dps: '딜' };

// 길드 마스터가 자기 길드원을 레이드에 직접 추가 (자가신청과 동일한 데이터 구조).
// 예약(가짜 자리)이 아니라 그 회원 계정(userId)에 묶이는 실제 신청.
export default function AdminMemberAddModal({ open, onClose, raid, apps = [] }) {
  const { profile, guilds, gamedata } = useApp();

  const [members, setMembers] = useState(null);
  const [query, setQuery] = useState('');
  const [memberId, setMemberId] = useState('');
  const [charIndex, setCharIndex] = useState(0);
  const [specId, setSpecId] = useState('');
  const [ilvl, setIlvl] = useState('');
  const [swap, setSwap] = useState(false);
  const [status, setStatus] = useState('active');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const appliedIds = useMemo(() => new Set(apps.map((a) => a.userId).filter(Boolean)), [apps]);

  useEffect(() => {
    if (!open) return;
    setMembers(null);
    setMemberId('');
    setQuery('');
    setError('');
    fetchUsersByGuild(profile.guildId)
      .then((list) => {
        list.sort((a, b) => (a.nickname || '').localeCompare(b.nickname || '', 'ko'));
        setMembers(list);
      })
      .catch(() => setMembers([]));
  }, [open, profile.guildId]);

  const member = (members || []).find((m) => m.id === memberId) || null;
  const characters = member?.characters || [];
  const character = characters[charIndex] || null;
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

  const selectMember = (id) => {
    setMemberId(id);
    const m = (members || []).find((x) => x.id === id);
    const c = (m?.characters || [])[0];
    setCharIndex(0);
    setSpecId(c?.specs?.[0] || '');
    setIlvl(c?.ilvl ? String(c.ilvl) : '');
    setSwap(false);
    setStatus('active');
    setError('');
  };

  const selectCharacter = (idx) => {
    setCharIndex(idx);
    const c = characters[idx];
    setSpecId(c?.specs?.[0] || '');
    setIlvl(c?.ilvl ? String(c.ilvl) : '');
    setSwap(false);
  };

  const caps = getCaps(raid);
  const roleActiveCount = apps.filter((a) => a.status === 'active' && a.role === spec?.role).length;
  const roleCap = spec ? (spec.role === 'tank' ? caps.tank : spec.role === 'healer' ? caps.healer : caps.dps) : 0;

  const submit = async () => {
    setError('');
    if (!member) { setError('길드원을 선택해주세요.'); return; }
    if (!character || !cls || !spec) { setError('캐릭터와 특성을 선택해주세요.'); return; }
    const lvl = Number(ilvl);
    if (!lvl || lvl < 1) { setError('아이템 레벨을 입력해주세요.'); return; }

    if (appliedIds.has(member.id)) {
      const ok = window.confirm(`${member.nickname} 님은 이미 이 레이드에 신청되어 있습니다.\n기존 신청을 덮어쓸까요?`);
      if (!ok) return;
    }

    const guild = guilds.find((g) => g.id === member.guildId);
    const allSpecNames = (character.specs || [])
      .map((sId) => getSpec(gamedata.classes, character.classId, sId)?.name)
      .filter(Boolean);

    const data = {
      userId: member.id,
      nickname: member.nickname,
      guildId: member.guildId,
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
      ilvl: lvl,
      leaderCapable: !!member.leaderCapable,
      isGuildMaster: !!member.isGuildMaster,
      swap: swapRoles.length > 0 ? swap : false,
      swapRoles,
      status,
      seq: Date.now(),
      isReservation: false,
      benchChars: [],
      addedByMaster: true,
    };

    setBusy(true);
    try {
      await submitApplication(raid.id, member.id, data, '');
      onClose(true);
    } catch {
      setError('저장에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  const q = query.trim().toLowerCase();
  const filteredMembers = (members || []).filter(
    (m) =>
      !q ||
      (m.nickname || '').toLowerCase().includes(q) ||
      (m.characters || []).some((c) => (c.name || '').toLowerCase().includes(q))
  );

  return (
    <Modal open={open} onClose={() => onClose(false)} title="길드원 추가">
      <div className="space-y-4">
        <p className="text-xs text-base-400 leading-relaxed">
          내 길드원을 이 레이드에 직접 추가합니다. (그 회원이 직접 신청한 것과 동일하게 처리되며, 회원 본인도 수정·취소할 수 있습니다)
        </p>

        <div>
          <label className="label-sm">길드원 (로그인 ID · 캐릭터명 검색)</label>
          <input
            className="input-base mb-2"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="로그인 ID 또는 캐릭터명 검색 (예: 그늘)"
          />
          {members === null ? (
            <p className="text-sm text-base-400 py-3 text-center">불러오는 중…</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-base-400 py-3 text-center">소속 길드원이 없습니다.</p>
          ) : filteredMembers.length === 0 ? (
            <p className="text-sm text-base-400 py-3 text-center">검색 결과가 없습니다.</p>
          ) : (
            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
              {filteredMembers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => selectMember(m.id)}
                  className={`w-full px-3 py-2 rounded-xl border text-left transition ${
                    memberId === m.id ? 'border-indigo-400 bg-indigo-500/10' : 'border-base-700 bg-base-850 hover:bg-base-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-white truncate">{m.nickname}</span>
                    {appliedIds.has(m.id) && (
                      <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold">신청됨</span>
                    )}
                  </div>
                  {(m.characters || []).length > 0 && (
                    <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 mt-0.5">
                      {m.characters.map((c) => {
                        const cCls = getClass(gamedata.classes, c.classId);
                        return (
                          <span key={c.id} className="text-[11px] font-semibold leading-tight" style={{ color: cCls?.color || '#cbd5e1' }}>
                            {c.name}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {member && (
          <>
            <div>
              <label className="label-sm">참여 캐릭터</label>
              {characters.length === 0 ? (
                <p className="text-sm text-red-400 py-2">등록된 캐릭터가 없습니다.</p>
              ) : (
                <div className="space-y-1.5">
                  {characters.map((c, i) => {
                    const cCls = getClass(gamedata.classes, c.classId);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectCharacter(i)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition ${
                          charIndex === i ? 'border-indigo-400 bg-indigo-500/10' : 'border-base-700 bg-base-850 hover:bg-base-700'
                        }`}
                      >
                        <span className="font-bold text-sm" style={badgeTextStyle(cCls?.color || '#fff')}>{c.name}</span>
                        <span className="text-xs text-base-400">{c.server} · {cCls?.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {cls && (
              <div>
                <label className="label-sm">참여 특성</label>
                <div className="flex flex-wrap gap-1.5">
                  {cls.specs.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSpecId(s.id)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${
                        specId === s.id ? 'border-indigo-400 bg-indigo-500/15' : 'border-base-700 bg-base-850 text-base-200 hover:bg-base-700'
                      }`}
                    >
                      {s.name}<span className="ml-1 text-xs text-base-400">{ROLE_KO[s.role]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="label-sm">아이템 레벨</label>
              <input
                className="input-base"
                inputMode="numeric"
                value={ilvl}
                onChange={(e) => setIlvl(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="예: 639"
              />
            </div>

            {swapRoles.length > 0 && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-base-850 border border-base-700">
                <div>
                  <p className="font-medium text-sm">역할 스왑 가능</p>
                  <p className="text-xs text-base-400">{swapRoles.map((r) => ROLE_KO[r]).join('/')}(으)로 전환 가능</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSwap(!swap)}
                  className={`relative w-11 h-6 rounded-full transition shrink-0 ${swap ? 'bg-indigo-500' : 'bg-base-600'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${swap ? 'left-[22px]' : 'left-0.5'}`} />
                </button>
              </div>
            )}

            <div>
              <label className="label-sm">
                추가 상태
                {spec && <span className="ml-1.5 text-xs text-base-500">({ROLE_KO[spec.role]} {roleActiveCount}/{roleCap})</span>}
              </label>
              <div className="flex gap-2">
                {[['active', '참가 확정'], ['wait', '대기 명단']].map(([k, lbl]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setStatus(k)}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition ${
                      status === k ? 'border-indigo-400 bg-indigo-500/15 text-indigo-100' : 'border-base-700 bg-base-850 text-base-300'
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-400 text-center">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" className="btn-ghost flex-1" onClick={() => onClose(false)}>취소</button>
          <button type="button" className="btn-primary flex-1" disabled={busy || !member} onClick={submit}>
            {busy ? '추가 중…' : '추가하기'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

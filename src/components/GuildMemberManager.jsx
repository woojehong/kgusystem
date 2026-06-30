import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { getClass } from '../lib/utils';
import {
  fetchUsersByGuild,
  setMemberRole,
  setMemberLeaderCapable,
  setMemberGuild,
} from '../lib/db';

function Badge({ children, tone = 'base' }) {
  const tones = {
    base: 'bg-base-700 text-base-300',
    indigo: 'bg-indigo-500/20 text-indigo-300',
    amber: 'bg-amber-500/20 text-amber-300',
    rose: 'bg-rose-500/20 text-rose-300',
  };
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${tones[tone]}`}>
      {children}
    </span>
  );
}

const BTN = 'text-[11px] px-2 py-1 rounded-lg font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed';

// 길드 마스터 전용 길드원 관리 패널 — 길드 페이지(깃발 → 들어간 페이지) 최하단.
export default function GuildMemberManager({ guild }) {
  const { guilds, gamedata, userId, profile, isSuper } = useApp();
  const isMaster = isSuper || (profile?.isGuildMaster && profile?.guildId === guild.id);

  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState(null);
  const [noneOpen, setNoneOpen] = useState(false);
  const [noneList, setNoneList] = useState(null);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);

  if (!isMaster) return null;

  const noneId = (guilds.find((g) => g.isNone) || {}).id || 'none';

  const loadMembers = async () => {
    try {
      const list = await fetchUsersByGuild(guild.id);
      list.sort((a, b) => (a.nickname || '').localeCompare(b.nickname || '', 'ko'));
      setMembers(list);
    } catch {
      setMsg({ ok: false, text: '목록을 불러오지 못했습니다.' });
      setMembers([]);
    }
  };

  const loadNone = async () => {
    try {
      const list = await fetchUsersByGuild(noneId);
      list.sort((a, b) => (a.nickname || '').localeCompare(b.nickname || '', 'ko'));
      setNoneList(list);
    } catch {
      setNoneList([]);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && members === null) loadMembers();
  };

  const toggleNone = () => {
    const next = !noneOpen;
    setNoneOpen(next);
    if (next && noneList === null) loadNone();
  };

  const act = async (key, fn) => {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      await loadMembers();
      if (noneOpen) await loadNone();
      setMsg({ ok: true, text: '적용되었습니다.' });
    } catch {
      setMsg({ ok: false, text: '처리 실패 — 권한이 없거나 일시적 오류입니다.' });
    } finally {
      setBusy('');
    }
  };

  const charLine = (m) =>
    (m.characters || [])
      .map((c) => {
        const cls = getClass(gamedata.classes, c.classId);
        return `${c.name}${cls ? ` (${cls.name})` : ''}`;
      })
      .join(' · ') || '등록된 캐릭터 없음';

  const Row = ({ m }) => {
    const self = m.id === userId;
    const isSuperUser = m.role === 'super';
    const isAdminUser = m.role === 'admin';
    return (
      <div className="flex items-start justify-between gap-2 p-3 rounded-xl bg-base-850 border border-base-700">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-sm text-white truncate">{m.nickname || '(이름없음)'}</span>
            {isSuperUser && <Badge tone="rose">슈퍼</Badge>}
            {isAdminUser && <Badge tone="indigo">관리자</Badge>}
            {m.leaderCapable && <Badge tone="amber">공대장</Badge>}
            {self && <Badge>나</Badge>}
          </div>
          <p className="text-xs text-base-400 mt-0.5 break-words">{charLine(m)}</p>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          {isSuperUser ? (
            <span className="text-[11px] text-base-500">관리 불가</span>
          ) : (
            <>
              <button
                type="button"
                disabled={!!busy || self}
                onClick={() => act(`role-${m.id}`, () => setMemberRole(m.id, isAdminUser ? 'user' : 'admin'))}
                className={`${BTN} ${isAdminUser ? 'bg-base-700 hover:bg-base-600 text-base-200' : 'bg-indigo-500/20 hover:bg-indigo-500/35 text-indigo-200'}`}
              >
                {isAdminUser ? '관리자 강등' : '관리자 승격'}
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => act(`lead-${m.id}`, () => setMemberLeaderCapable(m.id, !m.leaderCapable))}
                className={`${BTN} ${m.leaderCapable ? 'bg-base-700 hover:bg-base-600 text-base-200' : 'bg-amber-500/15 hover:bg-amber-500/30 text-amber-200'}`}
              >
                {m.leaderCapable ? '공대장 해제' : '공대장 지정'}
              </button>
              <button
                type="button"
                disabled={!!busy || self}
                onClick={() => {
                  if (window.confirm(`${m.nickname} 님을 길드에서 제명할까요?\n(계정·캐릭터는 유지되고 소속만 '소속 없음'으로 바뀝니다)`)) {
                    act(`kick-${m.id}`, () => setMemberGuild(m.id, noneId));
                  }
                }}
                className={`${BTN} bg-rose-500/15 hover:bg-rose-500/30 text-rose-300`}
              >
                제명
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-base-850 border border-base-700 hover:border-base-500 transition"
      >
        <span className="font-bold text-sm text-base-100">
          길드원 관리 <span className="text-base-500 font-normal">· 길드 마스터 전용</span>
        </span>
        <span className="text-base-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {msg && (
            <p className={`text-xs text-center ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>
          )}

          {members === null ? (
            <p className="text-center text-sm text-base-400 py-6">불러오는 중…</p>
          ) : members.length === 0 ? (
            <p className="text-center text-sm text-base-400 py-6">소속된 회원이 없습니다.</p>
          ) : (
            members.map((m) => <Row key={m.id} m={m} />)
          )}

          {/* 소속없음 데려오기 — 작고 눈에 덜 띄게 */}
          <div className="pt-2">
            <button
              type="button"
              onClick={toggleNone}
              className="text-[11px] text-base-500 hover:text-base-300 transition underline underline-offset-2"
            >
              {noneOpen ? '소속 없음 회원 닫기' : '소속 없음으로 가입한 회원 데려오기'}
            </button>

            {noneOpen && (
              <div className="mt-2 space-y-2 p-3 rounded-xl bg-base-900/60 border border-base-800">
                <p className="text-[11px] text-base-500">
                  아래는 현재 ‘소속 없음’으로 가입한 회원입니다. ‘내 길드로’를 누르면 {guild.name} 소속으로 변경됩니다.
                </p>
                {noneList === null ? (
                  <p className="text-center text-xs text-base-500 py-3">불러오는 중…</p>
                ) : noneList.length === 0 ? (
                  <p className="text-center text-xs text-base-500 py-3">소속 없음 회원이 없습니다.</p>
                ) : (
                  noneList.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-base-850 border border-base-700">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-white truncate">{m.nickname || '(이름없음)'}</p>
                        <p className="text-[11px] text-base-400 truncate">{charLine(m)}</p>
                      </div>
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => act(`claim-${m.id}`, () => setMemberGuild(m.id, guild.id))}
                        className={`${BTN} bg-indigo-500/20 hover:bg-indigo-500/35 text-indigo-200 shrink-0`}
                      >
                        내 길드로
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

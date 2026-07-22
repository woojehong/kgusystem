import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useApp } from '../context/AppContext';

// permissions=326417861648 : 기본 메시지/임베드 + 스레드(생성·관리) + 채널 관리(포럼 자동 생성용)
const INVITE_URL = 'https://discord.com/oauth2/authorize?client_id=1517416730652315720&permissions=326417861648&integration_type=0&scope=bot+applications.commands';

// 알려진 길드의 디스코드 서버 ID (guild.discordServerId 미설정 시 폴백 → 자동 매칭)
const KNOWN_SERVER_IDS = {
  starfall: '1430130051734704259',
  'e-ayo': '861086826637557821',
  gyocharo: '1264845965387501630',
};

const chip = (on) =>
  `px-3 py-1.5 rounded-full text-xs font-semibold border transition ${on ? 'border-indigo-400 bg-indigo-500/15 text-indigo-200' : 'border-base-700 text-base-400 hover:text-base-200'}`;
const chipSm = (on) =>
  `px-2 py-0.5 rounded-full text-[11px] font-semibold border transition ${on ? 'border-indigo-400 bg-indigo-500/15 text-indigo-200' : 'border-base-700 text-base-400 hover:text-base-200'}`;

// 소분류 선택기 (전부 or 복수선택). value = 'all' | string[]
function SubPicker({ value, onChange, subCategories }) {
  const isAll = value === 'all' || !value;
  const arr = Array.isArray(value) ? value : [];
  const toggle = (id) => {
    if (isAll) { onChange([id]); return; }
    const next = arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
    onChange(next.length ? next : 'all');
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" onClick={() => onChange('all')} className={chip(isAll)}>전부</button>
      {subCategories.map((sc) => (
        <button key={sc.id} type="button" onClick={() => toggle(sc.id)} className={chip(!isAll && arr.includes(sc.id))}>{sc.label}</button>
      ))}
    </div>
  );
}

// 길드 마스터 전용: 이 서버가 받을 디스코드 채널 관리 (우리 길드 / 연합 레이드).
export default function GuildDiscordPanel({ guild }) {
  const { subCategories, userId } = useApp();
  const [open, setOpen] = useState(false);
  const [channels, setChannels] = useState([]);
  const [newId, setNewId] = useState('');
  const [newMajor, setNewMajor] = useState('guild'); // 'guild' | 'union'
  const [newSub, setNewSub] = useState('all');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [serverIdInput, setServerIdInput] = useState(guild.discordServerId || KNOWN_SERVER_IDS[guild.englishName] || '');
  const [forumBusy, setForumBusy] = useState(false);
  const [forumMsg, setForumMsg] = useState(null);

  // 서버 ID만으로 레이드 포럼 채널을 자동 생성 — 요청 문서 생성 후 결과 구독.
  const createForum = async () => {
    const sid = serverIdInput.trim();
    if (!/^\d{5,}$/.test(sid)) { setForumMsg({ ok: false, text: '먼저 위에 서버 ID(숫자)를 넣어주세요.' }); return; }
    if (!userId) { setForumMsg({ ok: false, text: '로그인 정보를 확인할 수 없어요.' }); return; }
    setForumBusy(true); setForumMsg({ ok: true, text: '포럼 채널을 만드는 중이에요…' });
    try {
      const ref = await addDoc(collection(db, 'forumRequests'), {
        guildId: guild.id, serverId: sid, requestedBy: userId, status: 'pending', createdAt: Date.now(),
      });
      let done = false;
      const unsub = onSnapshot(ref, (s) => {
        const d = s.data();
        if (!d || !d.status || d.status === 'pending') return;
        done = true; unsub();
        setForumBusy(false);
        setForumMsg({ ok: d.status === 'done', text: d.message || (d.status === 'done' ? '완료!' : '실패했어요.') });
      }, () => { setForumBusy(false); setForumMsg({ ok: false, text: '결과를 확인하지 못했어요.' }); });
      setTimeout(() => { if (!done) { unsub(); setForumBusy(false); setForumMsg({ ok: false, text: '처리가 지연돼요. 잠시 후 등록 목록을 확인해주세요.' }); } }, 30000);
    } catch {
      setForumBusy(false); setForumMsg({ ok: false, text: '요청 실패 — 길드마스터 권한을 확인해주세요.' });
    }
  };

  const guildFilter = guild.englishName ? `guild:${guild.englishName}` : guild.id;
  const serverId = guild.discordServerId || KNOWN_SERVER_IDS[guild.englishName] || '';
  const majorLabel = (f) => (f === 'union' ? '연합' : guild.name);

  const saveServerId = async () => {
    const sid = serverIdInput.trim();
    if (sid && !/^\d{5,}$/.test(sid)) { setMsg({ ok: false, text: '서버 ID는 숫자예요.' }); return; }
    try { await updateDoc(doc(db, 'guilds', guild.id), { discordServerId: sid || null }); setMsg({ ok: true, text: '서버 ID를 저장했어요.' }); }
    catch { setMsg({ ok: false, text: '서버 ID 저장 실패.' }); }
  };

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'cardChannels'), (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setChannels(all.filter((c) =>
        c.filter === guildFilter || c.filter === guild.id || c.createdByGuild === guild.id
        || (serverId && c.serverId === serverId)));
    }, () => {});
    return unsub;
  }, [guild.id, guildFilter, serverId]);

  const subLabel = (sub) => {
    if (!sub || sub === 'all') return '전부';
    const ids = Array.isArray(sub) ? sub : [sub];
    return ids.map((id) => (subCategories.find((s) => s.id === id)?.label || id)).join(', ');
  };

  const addChannel = async () => {
    const cid = newId.trim();
    if (!/^\d{5,}$/.test(cid)) { setMsg({ ok: false, text: '채널 ID는 숫자예요. 채널 우클릭 → ID 복사 (개발자 모드 필요).' }); return; }
    setBusy(true); setMsg(null);
    try {
      await setDoc(doc(db, 'cardChannels', cid), {
        channelId: cid, filter: newMajor === 'union' ? 'union' : guildFilter, subFilter: newSub, createdByGuild: guild.id, serverId: serverId || null, enabled: true, updatedAt: Date.now(),
      });
      setNewId(''); setNewSub('all'); setNewMajor('guild'); setMsg({ ok: true, text: '채널을 등록했어요.' });
    } catch {
      setMsg({ ok: false, text: '등록 실패 — 권한을 확인해주세요.' });
    } finally {
      setBusy(false);
    }
  };
  const removeChannel = async (cid) => {
    try { await deleteDoc(doc(db, 'cardChannels', cid)); } catch { setMsg({ ok: false, text: '삭제 실패.' }); }
  };
  const changeSub = async (cid, sub) => {
    try { await setDoc(doc(db, 'cardChannels', cid), { subFilter: sub, updatedAt: Date.now() }, { merge: true }); } catch { /* noop */ }
  };
  const changeMajor = async (cid, major) => {
    try { await setDoc(doc(db, 'cardChannels', cid), { filter: major === 'union' ? 'union' : guildFilter, createdByGuild: guild.id, updatedAt: Date.now() }, { merge: true }); } catch { /* noop */ }
  };

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-base-850 border border-base-700 hover:border-base-500 transition"
      >
        <span className="font-bold text-sm text-base-100">
          🔔 디스코드 알림 채널 관리 <span className="text-base-500 font-normal">· 길드 마스터 전용</span>
        </span>
        <span className="text-base-400 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-3 card p-4 space-y-4">
          <p className="text-xs text-base-400">이 서버가 받을 디스코드 채널을 관리합니다. <b className="text-base-200">우리 길드 레이드</b>와 <b className="text-base-200">연합 레이드</b> 둘 다 받을 수 있어요.</p>

          {/* 봇 초대 */}
          <div className="rounded-xl border border-base-700 bg-base-850 p-3 space-y-2">
            <p className="text-sm font-semibold text-base-100">1) 길레봇 초대</p>
            <a href={INVITE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition">
              🤖 길레봇 초대하기
            </a>
            <ul className="text-[12px] text-base-400 space-y-1 mt-1 list-disc pl-4">
              <li><b className="text-amber-300">반드시 이 버튼</b>으로 초대하세요. 이미 다른 방식으로 초대했다면, 서버에서 봇을 <b className="text-amber-300">먼저 추방</b>한 뒤 이 버튼으로 다시 초대해야 정상 작동합니다.</li>
              <li>이 버튼에는 <b className="text-base-200">채널 관리</b> 권한이 포함돼, 아래 <b className="text-base-200">레이드 포럼 자동 생성</b>이 바로 됩니다.</li>
            </ul>
          </div>

          {/* 우리 서버 ID */}
          <div className="rounded-xl border border-base-700 bg-base-850 p-3 space-y-2">
            <p className="text-sm font-semibold text-base-100">2) 우리 디스코드 서버 ID <span className="text-[11px] text-base-500 font-normal">(넣으면 채널 자동 표시 + 아래 포럼 자동 생성에 사용)</span></p>
            <div className="flex gap-2">
              <input className="input-base flex-1" placeholder="서버 ID (숫자) — 서버 우클릭 → ID 복사" value={serverIdInput} onChange={(e) => setServerIdInput(e.target.value)} />
              <button type="button" onClick={saveServerId} className="px-3 py-1.5 rounded-lg bg-base-700 hover:bg-base-600 text-base-200 text-sm font-bold transition shrink-0">저장</button>
            </div>
          </div>

          {/* ★ 레이드 포럼 자동 생성 (가장 간편) */}
          <div className="rounded-xl border border-indigo-500/40 bg-indigo-500/5 p-3 space-y-2">
            <p className="text-sm font-semibold text-indigo-200">⭐ 레이드 포럼 자동 생성 <span className="text-[11px] text-base-500 font-normal">(제일 간편 · 서버 ID만 있으면 끝)</span></p>
            <p className="text-[12px] text-base-400">
              버튼을 누르면 봇이 이 서버에 <b className="text-base-200">레이드 전용 포럼 채널</b>을 만들고(정렬=최근 활동순 · 목록형), <b className="text-base-200">{guild.name} 레이드</b>가 자동으로 올라오게 등록까지 해줍니다. 채널 ID 복사·설정 필요 없어요.
            </p>
            <button type="button" onClick={createForum} disabled={forumBusy} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition disabled:opacity-50">
              {forumBusy ? '만드는 중…' : '⭐ 레이드 포럼 만들기'}
            </button>
            <p className="text-[11px] text-base-500">또는 디스코드 서버 아무 채널에서 <code className="px-1 rounded bg-base-700 text-base-200">/포럼세팅</code> 명령을 쳐도 됩니다.</p>
            {forumMsg && <p className={`text-sm ${forumMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{forumMsg.text}</p>}
          </div>

          {/* 채널 등록 */}
          <div className="rounded-xl border border-base-700 bg-base-850 p-3 space-y-2">
            <p className="text-sm font-semibold text-base-100">3) 채널 등록</p>
            <p className="text-[12px] text-base-400">
              원하는 <b className="text-base-200"># 텍스트 채널</b>에서 <code className="px-1 rounded bg-base-700 text-base-200">/채널등록</code> 을 입력하거나, 아래에 채널 ID를 넣어 등록하세요.
            </p>
            <input className="input-base" placeholder="채널 ID (숫자) — 채널 우클릭 → ID 복사" value={newId} onChange={(e) => setNewId(e.target.value)} />
            <div>
              <p className="text-[11px] text-base-500 mb-1">받을 대분류</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setNewMajor('guild')} className={chip(newMajor === 'guild')}>{guild.name}</button>
                <button type="button" onClick={() => setNewMajor('union')} className={chip(newMajor === 'union')}>연합</button>
              </div>
            </div>
            <div>
              <p className="text-[11px] text-base-500 mb-1">받을 소분류</p>
              <SubPicker value={newSub} onChange={setNewSub} subCategories={subCategories} />
            </div>
            <button type="button" onClick={addChannel} disabled={busy} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition disabled:opacity-50">
              {busy ? '등록 중…' : '이 채널 등록'}
            </button>
          </div>

          {msg && <p className={`text-sm text-center ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>}

          {/* 목록 */}
          <div>
            <p className="text-sm font-semibold text-base-100 mb-2">등록된 채널 <span className="text-base-500">{channels.length}</span></p>
            {channels.length === 0 ? (
              <p className="text-xs text-base-500 text-center py-3">아직 등록된 채널이 없어요.</p>
            ) : (
              <div className="space-y-2">
                {channels.map((c) => (
                  <div key={c.id} className="rounded-xl border border-base-700 bg-base-850 p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono text-base-300 truncate">#{c.channelId}</span>
                      <button type="button" onClick={() => removeChannel(c.id)} className="shrink-0 text-xs text-red-400 hover:text-red-300 font-semibold px-2 py-1 rounded hover:bg-red-500/10">삭제</button>
                    </div>
                    <div className="flex items-center gap-2 mt-2 mb-1.5">
                      <span className="text-[11px] text-base-500">대분류:</span>
                      <button type="button" onClick={() => changeMajor(c.id, 'guild')} className={chipSm(c.filter !== 'union')}>{guild.name}</button>
                      <button type="button" onClick={() => changeMajor(c.id, 'union')} className={chipSm(c.filter === 'union')}>연합</button>
                    </div>
                    <p className="text-[11px] text-base-500 mb-1.5">받는 소분류: <b className="text-base-300">{subLabel(c.subFilter)}</b></p>
                    <SubPicker value={c.subFilter} onChange={(v) => changeSub(c.id, v)} subCategories={subCategories} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

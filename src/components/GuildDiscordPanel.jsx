import { useEffect, useState } from 'react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useApp } from '../context/AppContext';

const INVITE_URL = 'https://discord.com/oauth2/authorize?client_id=1517416730652315720&permissions=347136&integration_type=0&scope=bot+applications.commands';

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
  const { subCategories } = useApp();
  const [open, setOpen] = useState(false);
  const [channels, setChannels] = useState([]);
  const [newId, setNewId] = useState('');
  const [newMajor, setNewMajor] = useState('guild'); // 'guild' | 'union'
  const [newSub, setNewSub] = useState('all');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const guildFilter = guild.englishName ? `guild:${guild.englishName}` : guild.id;
  const majorLabel = (f) => (f === 'union' ? '연합' : guild.name);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'cardChannels'), (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setChannels(all.filter((c) => c.filter === guildFilter || c.filter === guild.id || c.createdByGuild === guild.id));
    }, () => {});
    return unsub;
  }, [guild.id, guildFilter]);

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
        channelId: cid, filter: newMajor === 'union' ? 'union' : guildFilter, subFilter: newSub, createdByGuild: guild.id, enabled: true, updatedAt: Date.now(),
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
              <li>알림은 <b className="text-base-200"># 텍스트 채널</b>에서만 됩니다. (포럼·음성 채널 불가)</li>
            </ul>
          </div>

          {/* 채널 등록 */}
          <div className="rounded-xl border border-base-700 bg-base-850 p-3 space-y-2">
            <p className="text-sm font-semibold text-base-100">2) 채널 등록</p>
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

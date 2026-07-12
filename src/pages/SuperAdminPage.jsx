import { useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDoc,
  getDocs,
  updateDoc,
  writeBatch,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useApp } from '../context/AppContext';
import {
  signIn,
  signOutUser,
  createSuperAccount,
  changeNickname,
  resetPinBySuper,
} from '../lib/auth';
import { seedInitialData, isSeeded, saveGuild, deleteGuild, softDeleteRaid, restoreRaid, hardDeleteRaid, migrateEvokerSpecName } from '../lib/db';
import { DIFFICULTIES, PIN_RULE, UNION_GUILD_ID } from '../lib/constants';
import {
  formatDateLabel,
  formatTimeRange,
  sortGuilds,
  badgeTextStyle,
  getClass,
  randomId,
} from '../lib/utils';
import Modal from '../components/Modal';
import GuildBadge, { buildBadgeStyles } from '../components/GuildBadge';
import GuildPageEditor from '../components/GuildPageEditor';
import { validateEnglishName, normalizePage } from '../lib/guildPage';

// ── Login / bootstrap ───────────────────────────────────────────────

function SuperLogin() {
  const [bootstrap, setBootstrap] = useState(null); // null=loading, true=create, false=login
  const [nickname, setNickname] = useState('');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'meta', 'super'))
      .then((snap) => setBootstrap(!snap.exists()))
      .catch(() => setBootstrap(false));
  }, []);

  const submit = async () => {
    setError('');
    if (!PIN_RULE.pattern.test(pin)) {
      setError('PIN은 숫자 4자리입니다.');
      return;
    }
    if (bootstrap && pin !== pin2) {
      setError('PIN이 일치하지 않습니다.');
      return;
    }
    setBusy(true);
    try {
      if (bootstrap) {
        await createSuperAccount(nickname.trim(), pin);
      } else {
        await signIn(nickname.trim(), pin);
      }
    } catch (e) {
      setError(e.message || '실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  if (bootstrap === null) {
    return <div className="min-h-screen flex items-center justify-center text-base-400 animate-pulse">확인 중...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <h1 className="text-2xl font-black mb-1">
        <span className="bg-gradient-to-b from-white to-base-400 bg-clip-text text-transparent">KWGU</span> 시스템 관리
      </h1>
      <p className="text-sm text-base-400 mb-6">
        {bootstrap ? '최초 실행 — 슈퍼관리자 계정을 생성합니다' : '슈퍼관리자 인증'}
      </p>
      <div className="w-full max-w-sm card p-6 space-y-3">
        <input
          className="input-base"
          placeholder="닉네임"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
        />
        <input
          className="input-base"
          type="password"
          inputMode="numeric"
          maxLength={4}
          placeholder="PIN 4자리"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
        />
        {bootstrap && (
          <input
            className="input-base"
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="PIN 확인"
            value={pin2}
            onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))}
          />
        )}
        {error && <p className="text-sm text-red-400 text-center">{error}</p>}
        <button type="button" className="btn-primary w-full" disabled={busy} onClick={submit}>
          {busy ? '처리 중...' : bootstrap ? '계정 생성' : '로그인'}
        </button>
      </div>
    </div>
  );
}

// ── Users tab ───────────────────────────────────────────────────────

function UsersTab({ guilds, gamedata }) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [guildFilter, setGuildFilter] = useState('all');
  const [target, setTarget] = useState(null);
  const [msg, setMsg] = useState('');

  const load = async () => {
    const snap = await getDocs(collection(db, 'users'));
    setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    load();
  }, []);

  // Guild filter tabs: 전체 + real guilds (not isNone) + 소속없음
  const noneGuild = guilds.find((g) => g.isNone);
  const filterTabs = [
    { id: 'all', name: '전체' },
    ...sortGuilds(guilds.filter((g) => !g.isNone && !g.isUnion)).map((g) => ({ id: g.id, name: g.name })),
    { id: '__none', name: '소속없음' },
  ];

  const filtered = users
    .filter((u) => u.role !== 'super')
    .filter((u) => !search || u.nickname.includes(search))
    .filter((u) => {
      if (guildFilter === 'all') return true;
      if (guildFilter === '__none') return u.guildId === noneGuild?.id || !u.guildId;
      return u.guildId === guildFilter;
    })
    .sort((a, b) => {
      const aT = a.createdAt?.toMillis?.() ?? 0;
      const bT = b.createdAt?.toMillis?.() ?? 0;
      if (aT !== bT) return aT - bT;
      return (a.nickname || '').localeCompare(b.nickname || '', 'ko');
    });

  return (
    <div>
      {/* Guild filter tabs */}
      <div className="flex gap-1 flex-wrap mb-3">
        {filterTabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setGuildFilter(t.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              guildFilter === t.id
                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                : 'bg-base-800 border border-base-700 text-base-400 hover:text-base-200'
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      <input
        className="input-base mb-3"
        placeholder="닉네임 검색"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {msg && <p className="text-sm text-green-400 mb-2">{msg}</p>}
      <div className="space-y-2">
        {filtered.map((u) => {
          const guild = guilds.find((g) => g.id === u.guildId);
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => setTarget(u)}
              className="w-full flex items-center gap-2 p-3 card hover:border-base-500 text-left transition"
            >
              <span className="font-bold">{u.nickname}</span>
              {u.isGuildMaster && <span className="text-base leading-none">👑</span>}
              {u.role === 'admin' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold">
                  관리자
                </span>
              )}
              <span className="text-xs text-base-400">{guild?.name || '소속 없음'}</span>
              <span className="ml-auto text-xs text-base-400">
                캐릭터 {(u.characters || []).length}개
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center text-base-400 py-8 text-sm">유저가 없습니다.</p>
        )}
      </div>

      {target && (
        <UserEditModal
          user={target}
          guilds={guilds}
          gamedata={gamedata}
          onClose={(changed, message) => {
            setTarget(null);
            if (message) {
              setMsg(message);
              setTimeout(() => setMsg(''), 4000);
            }
            if (changed) load();
          }}
        />
      )}
    </div>
  );
}

function UserEditModal({ user, guilds, gamedata, onClose }) {
  const [nickname, setNickname] = useState(user.nickname);
  const [guildId, setGuildId] = useState(user.guildId);
  const [leaderCapable, setLeaderCapable] = useState(!!user.leaderCapable);
  const [isAdmin, setIsAdmin] = useState(user.role === 'admin');
  const [isGuildMaster, setIsGuildMaster] = useState(!!user.isGuildMaster);
  const [tempPin, setTempPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    setError('');
    setBusy(true);
    try {
      const name = nickname.trim();
      if (name !== user.nickname) {
        await changeNickname(user.id, user.nickname, name);
      }
      await updateDoc(doc(db, 'users', user.id), {
        guildId,
        leaderCapable,
        isGuildMaster,
        role: isAdmin ? 'admin' : 'user',
      });
      onClose(true, '저장되었습니다.');
    } catch (e) {
      setError(e.message || '저장에 실패했습니다.');
      setBusy(false);
    }
  };

  const resetPin = async () => {
    setError('');
    if (!PIN_RULE.pattern.test(tempPin)) {
      setError('임시 PIN은 숫자 4자리입니다.');
      return;
    }
    setBusy(true);
    try {
      await resetPinBySuper(user.nickname, tempPin);
      onClose(true, `${user.nickname}의 PIN이 ${tempPin}(으)로 초기화되었습니다.`);
    } catch (e) {
      setError(e.message || 'PIN 초기화에 실패했습니다.');
      setBusy(false);
    }
  };

  const removeUser = async () => {
    setBusy(true);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'users', user.id));
      batch.delete(doc(db, 'nicknames', user.nickname));
      await batch.commit();
      onClose(true, '유저가 삭제되었습니다.');
    } catch {
      setError('삭제에 실패했습니다.');
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={() => onClose(false)} title={`유저 관리 · ${user.nickname}`}>
      <div className="space-y-4">
        <div>
          <label className="label-sm">닉네임</label>
          <input className="input-base" value={nickname} onChange={(e) => setNickname(e.target.value)} />
        </div>
        <div>
          <label className="label-sm">소속 길드</label>
          <select className="input-base" value={guildId} onChange={(e) => setGuildId(e.target.value)}>
            {sortGuilds(guilds).map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center justify-between p-3 rounded-xl bg-base-850 border border-base-700 cursor-pointer">
          <span className="text-sm font-medium">공대장 가능</span>
          <input
            type="checkbox"
            className="w-4 h-4 accent-indigo-500"
            checked={leaderCapable}
            onChange={(e) => setLeaderCapable(e.target.checked)}
          />
        </label>
        <label className="flex items-center justify-between p-3 rounded-xl bg-base-850 border border-amber-500/30 cursor-pointer">
          <span className="text-sm font-medium flex items-center gap-1.5">
            <span className="text-base">👑</span> 길드장
          </span>
          <input
            type="checkbox"
            className="w-4 h-4 accent-amber-500"
            checked={isGuildMaster}
            onChange={(e) => setIsGuildMaster(e.target.checked)}
          />
        </label>
        <label className="flex items-center justify-between p-3 rounded-xl bg-base-850 border border-base-700 cursor-pointer">
          <span className="text-sm font-medium">관리자 권한</span>
          <input
            type="checkbox"
            className="w-4 h-4 accent-indigo-500"
            checked={isAdmin}
            onChange={(e) => setIsAdmin(e.target.checked)}
          />
        </label>

        <div className="p-3 rounded-xl bg-base-850 border border-base-700 space-y-2">
          <p className="text-sm font-medium">캐릭터</p>
          {(user.characters || []).map((c) => {
            const cls = getClass(gamedata.classes, c.classId);
            return (
              <p key={c.id} className="text-xs text-base-300">
                <span style={badgeTextStyle(cls?.color || '#fff')} className="font-semibold">
                  {c.name}
                </span>{' '}
                · {c.server} · {cls?.name}
              </p>
            );
          })}
          {(user.characters || []).length === 0 && <p className="text-xs text-base-400">없음</p>}
        </div>

        <div className="p-3 rounded-xl bg-base-850 border border-amber-500/30 space-y-2">
          <p className="text-sm font-medium text-amber-300">PIN 초기화</p>
          <div className="flex gap-2">
            <input
              className="input-base flex-1"
              inputMode="numeric"
              maxLength={4}
              placeholder="임시 PIN 4자리"
              value={tempPin}
              onChange={(e) => setTempPin(e.target.value.replace(/\D/g, ''))}
            />
            <button type="button" className="btn-ghost" disabled={busy} onClick={resetPin}>
              초기화
            </button>
          </div>
        </div>

        {error && <p className="text-sm text-red-400 text-center">{error}</p>}

        <div className="flex gap-2">
          {confirmDelete ? (
            <button type="button" className="btn-danger flex-1" disabled={busy} onClick={removeUser}>
              정말 삭제할까요?
            </button>
          ) : (
            <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(true)}>
              유저 삭제
            </button>
          )}
          <button type="button" className="btn-primary flex-1" disabled={busy} onClick={save}>
            저장
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Guilds tab ──────────────────────────────────────────────────────

function GuildsTab({ guilds, reload }) {
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const ordered = sortGuilds(guilds);
  const movable = ordered.filter((g) => !g.isNone && !g.isUnion);
  const noneGuild = ordered.find((g) => g.isNone);
  const unionGuild = ordered.find((g) => g.isUnion) || {
    id: UNION_GUILD_ID, name: '연합', badgeName: '연합', color: '#a78bfa', badge: {}, isUnion: true,
  };

  // Persist the new sequence as a 0..n-1 `order` on every movable guild.
  const move = async (index, dir) => {
    const t = index + dir;
    if (busy || t < 0 || t >= movable.length) return;
    const arr = [...movable];
    [arr[index], arr[t]] = [arr[t], arr[index]];
    setBusy(true);
    try {
      await Promise.all(arr.map((g, i) => saveGuild(g.id, { order: i })));
      reload();
    } catch {
      /* ignore — reload keeps previous state */
    } finally {
      setBusy(false);
    }
  };

  const rowInner = (g, fixed) => (
    <button
      type="button"
      onClick={() => setTarget(g)}
      className="flex-1 flex items-center gap-3 text-left min-w-0 hover:opacity-90 transition"
    >
      <span className="w-5 h-5 rounded-full border border-base-600 shrink-0" style={{ backgroundColor: g.color }} />
      <span className="font-bold truncate" style={{ color: g.color }}>{g.name}</span>
      {g.englishName && <span className="text-[11px] text-base-500 shrink-0">/{g.englishName}</span>}
      {fixed && <span className="text-xs text-base-400 shrink-0">(고정)</span>}
    </button>
  );

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-base-400 mb-1">▲▼ 버튼으로 길드 깃발/목록 순서를 바꿉니다. 새 길드는 맨 뒤에 추가됩니다.</p>

      {movable.map((g, i) => (
        <div key={g.id} className="w-full flex items-center gap-2 p-3 card">
          <div className="flex flex-col gap-0.5 shrink-0">
            <button type="button" disabled={busy || i === 0} onClick={() => move(i, -1)}
              className="w-6 h-5 rounded bg-base-700 hover:bg-base-600 text-[10px] disabled:opacity-30">▲</button>
            <button type="button" disabled={busy || i === movable.length - 1} onClick={() => move(i, 1)}
              className="w-6 h-5 rounded bg-base-700 hover:bg-base-600 text-[10px] disabled:opacity-30">▼</button>
          </div>
          {rowInner(g, false)}
        </div>
      ))}

      {noneGuild && (
        <div key={noneGuild.id} className="w-full flex items-center gap-2 p-3 card opacity-80">
          <span className="w-6 shrink-0" />
          {rowInner(noneGuild, true)}
        </div>
      )}

      {/* 연합 레이드 전용 뱃지 — 슈퍼관리자만 편집 */}
      <div className="w-full flex items-center gap-2 p-3 card opacity-90 border border-violet-500/30">
        <span className="w-6 shrink-0" />
        <button
          type="button"
          onClick={() => setTarget(unionGuild)}
          className="flex-1 flex items-center gap-3 text-left min-w-0 hover:opacity-90 transition"
        >
          <span className="w-5 h-5 rounded-full border border-base-600 shrink-0" style={{ backgroundColor: unionGuild.color }} />
          <span className="font-bold truncate" style={{ color: unionGuild.color }}>{unionGuild.name || '연합'}</span>
          <span className="text-xs text-base-400 shrink-0">(연합 레이드 뱃지)</span>
        </button>
      </div>

      <button
        type="button"
        className="w-full py-3 rounded-xl border border-dashed border-base-600 text-base-400 hover:text-base-200 hover:border-base-400 transition text-sm font-medium"
        onClick={() => setTarget({ id: null, name: '', color: '#7dd3fc', logoPath: '', isNone: false })}
      >
        + 길드 추가
      </button>

      {target && (
        <GuildEditModal
          guild={target}
          nextOrder={movable.length}
          onClose={(changed) => {
            setTarget(null);
            if (changed) reload();
          }}
        />
      )}
    </div>
  );
}

// ── Badge tab option definitions ────────────────────────────────────

const SHAPE_OPTIONS = [
  // Radius-based (10)
  { key: 'pill',          label: '알약',      clip: null, radius: '9999px' },
  { key: 'rounded-sm',    label: '소원각',    clip: null, radius: '4px' },
  { key: 'rounded-md',    label: '중원각',    clip: null, radius: '8px' },
  { key: 'rounded-lg',    label: '대원각',    clip: null, radius: '14px' },
  { key: 'rounded-xl',    label: '특대원각',  clip: null, radius: '20px' },
  { key: 'square',        label: '직각',      clip: null, radius: '2px' },
  { key: 'leaf',          label: '잎사귀',    clip: null, radius: '50% 0% 50% 0%' },
  { key: 'circle',        label: '원형',      clip: null, radius: '50%' },
  { key: 'blob',          label: '블롭',      clip: null, radius: '30% 70% 70% 30% / 30% 30% 70% 70%' },
  { key: 'sharp-round',   label: '비대칭각',  clip: null, radius: '12px 0px 12px 0px' },
  // Clip-path based (12)
  { key: 'hexagon',       label: '육각형',    clip: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',                                      radius: null },
  { key: 'diamond',       label: '다이아',    clip: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',                                                          radius: null },
  { key: 'shield',        label: '방패',      clip: 'polygon(0% 0%, 100% 0%, 100% 65%, 50% 100%, 0% 65%)',                                                  radius: null },
  { key: 'octagon',       label: '팔각형',    clip: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)',                      radius: null },
  { key: 'star',          label: '별',        clip: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',     radius: null },
  { key: 'tag',           label: '태그',      clip: 'polygon(0% 0%, 85% 0%, 100% 50%, 85% 100%, 0% 100%)',                                                  radius: null },
  { key: 'chevron',       label: '쉐브론',    clip: 'polygon(15% 0%, 100% 0%, 100% 100%, 15% 100%, 0% 50%)',                                                radius: null },
  { key: 'ribbon',        label: '리본',      clip: 'polygon(0% 0%, 100% 0%, 85% 50%, 100% 100%, 0% 100%, 15% 50%)',                                        radius: null },
  { key: 'arrow',         label: '화살표',    clip: 'polygon(0% 20%, 65% 20%, 65% 0%, 100% 50%, 65% 100%, 65% 80%, 0% 80%)',                                radius: null },
  { key: 'parallelogram', label: '평행사변형',clip: 'polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)',                                                          radius: null },
  { key: 'pentagon',      label: '오각형',    clip: 'polygon(50% 0%, 100% 35%, 82% 100%, 18% 100%, 0% 35%)',                                                radius: null },
  { key: 'trapezoid',     label: '사다리꼴',  clip: 'polygon(8% 0%, 92% 0%, 100% 100%, 0% 100%)',                                                           radius: null },
];

const BG_OPTIONS = [
  { key: 'solid',             label: '단색' },
  { key: 'gradient-h',        label: '가로 그라디언트' },
  { key: 'gradient-v',        label: '세로 그라디언트' },
  { key: 'gradient-diagonal', label: '대각선 그라디언트' },
  { key: 'gradient-3',        label: '3색 그라디언트' },
  { key: 'radial',            label: '방사형' },
  { key: 'conic',             label: '코닉' },
  { key: 'glass',             label: '유리' },
  { key: 'mesh',              label: '메시' },
  { key: 'neon',              label: '네온' },
  { key: 'stripe',            label: '스트라이프' },
  { key: 'outline',           label: '테두리만' },
  { key: 'aurora',            label: '오로라' },
  { key: 'holographic',       label: '홀로그래픽' },
  { key: 'metallic',          label: '메탈릭' },
  { key: 'frosted',           label: '프로스티드' },
  { key: 'dots',              label: '도트 패턴' },
  { key: 'fire',              label: '파이어' },
  { key: 'ocean',             label: '오션' },
  { key: 'sunset',            label: '선셋' },
  { key: 'mirror',            label: '미러' },
];

const BORDER_OPTIONS = [
  { key: 'none',          label: '없음' },
  { key: 'thin',          label: '얇게' },
  { key: 'medium',        label: '보통' },
  { key: 'thick',         label: '굵게' },
  { key: 'dashed',        label: '파선' },
  { key: 'dotted',        label: '점선' },
  { key: 'double',        label: '이중선' },
  { key: 'gradient',      label: '그라디언트' },
  { key: 'outline-only',  label: '아웃라인' },
  { key: 'glow',          label: '글로우' },
  { key: 'neon-glow',     label: '네온 글로우' },
  { key: 'inner',         label: '안쪽선' },
  { key: 'groove',        label: '홈선' },
  { key: 'ridge',         label: '융기선' },
  { key: 'inset-2',       label: '두꺼운 안쪽' },
  { key: 'multi-glow',    label: '다중 글로우' },
  { key: 'thick-neon',    label: '두꺼운 네온' },
  { key: 'top-accent',    label: '상단 강조' },
  { key: 'bottom-accent', label: '하단 강조' },
  { key: 'sharp-outer',   label: '날카로운 외곽' },
];

const EFFECT_OPTIONS = [
  { key: 'none',          label: '없음' },
  { key: 'glow-sm',       label: '글로우(소)' },
  { key: 'glow-lg',       label: '글로우(대)' },
  { key: 'shimmer',       label: '쉬머 ✦' },
  { key: 'pulse',         label: '펄스 ✦' },
  { key: 'inner-glow',    label: '내부 글로우' },
  { key: 'shadow',        label: '그림자' },
  { key: 'emboss',        label: '엠보스' },
  { key: 'holo',          label: '홀로그램' },
  { key: 'float',         label: '플로팅' },
  { key: 'tilt',          label: '기울기 그림자' },
  { key: 'fire-glow',     label: '파이어 글로우' },
  { key: 'ice-glow',      label: '아이스 글로우' },
  { key: 'deep',          label: '깊은 그림자' },
  { key: 'rainbow-aura',  label: '레인보우 오라' },
  { key: 'sepia',         label: '세피아' },
  { key: 'blur-out',      label: '블러 아웃' },
  { key: 'flicker',       label: '깜빡임 ✦' },
];

const TEXT_COLOR_OPTIONS = [
  { key: 'auto',   label: '자동' },
  { key: 'white',  label: '흰색' },
  { key: 'dark',   label: '어두운색' },
  { key: 'custom', label: '직접 지정' },
];

const TEXT_STYLE_OPTIONS = [
  { key: 'normal',   label: '보통' },
  { key: 'bold',     label: '굵게' },
  { key: 'outlined', label: '외곽선' },
  { key: 'shadow',   label: '그림자' },
  { key: 'glow',     label: '글로우' },
];

// Helper: small option button
function OptBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition ${
        active
          ? 'border-indigo-400 bg-indigo-500/15 text-indigo-200'
          : 'border-base-700 bg-base-800 text-base-400 hover:text-base-200 hover:border-base-500'
      }`}
    >
      {children}
    </button>
  );
}

// Helper: section label inside badge tab
function BadgeSection({ label, children }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-base-400 uppercase tracking-wider mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function GuildEditModal({ guild, onClose, nextOrder = 0 }) {
  const isNew = !guild.id;
  const isUnion = !!guild.isUnion;
  const [activeTab, setActiveTab] = useState('info');

  // ── 기본정보 tab state ─────────────────────────────────────────
  const [name, setName] = useState(guild.name);
  const [shortName, setShortName] = useState(guild.shortName || '');
  const [englishName, setEnglishName] = useState(guild.englishName || '');
  const [badgeName, setBadgeName] = useState(guild.badgeName || '');
  const [color, setColor] = useState(guild.color || '#7dd3fc');
  const [page, setPage] = useState(normalizePage(guild.page, guild.color));
  const [logoPath, setLogoPath] = useState(guild.logoPath || '');
  const [showInFilter, setShowInFilter] = useState(guild.showInFilter !== false);
  const [showFlag, setShowFlag] = useState(guild.showFlag !== false);

  // ── 뱃지수정 tab state ─────────────────────────────────────────
  const eb = guild.badge || {};
  const [badgeShape,          setBadgeShape]          = useState(eb.shape           || 'pill');
  const [badgeBgType,         setBadgeBgType]         = useState(eb.bgType          || 'solid');
  const [badgeColor2,         setBadgeColor2]         = useState(eb.color2          || guild.color || '#7dd3fc');
  const [badgeColor3,         setBadgeColor3]         = useState(eb.color3          || guild.color || '#7dd3fc');
  const [badgeBorder,         setBadgeBorder]         = useState(eb.border          || 'thin');
  const [badgeBorderColor,    setBadgeBorderColor]    = useState(eb.borderColor     || guild.color || '#7dd3fc');
  const [badgeEffect,         setBadgeEffect]         = useState(eb.effect          || 'none');
  const [badgeTextColor,      setBadgeTextColor]      = useState(eb.textColor       || 'auto');
  const [badgeTextCustomColor,setBadgeTextCustomColor]= useState(eb.textCustomColor || guild.color || '#7dd3fc');
  const [badgeTextStyle_,     setBadgeTextStyle_]     = useState(eb.textStyle       || 'normal');

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const needsColor2 = [
    'gradient-h','gradient-v','gradient-diagonal','gradient-3','radial','conic',
    'glass','mesh','stripe','aurora','holographic','metallic','fire','ocean','sunset',
  ].includes(badgeBgType);
  const needsColor3 = [
    'gradient-3','conic','mesh','aurora','holographic','ocean','sunset',
  ].includes(badgeBgType);

  // Current badge config for live preview
  const previewBadgeConfig = {
    shape: badgeShape, bgType: badgeBgType,
    color2: badgeColor2, color3: badgeColor3,
    border: badgeBorder, borderColor: badgeBorderColor,
    effect: badgeEffect, textColor: badgeTextColor,
    textCustomColor: badgeTextCustomColor, textStyle: badgeTextStyle_,
  };
  const { style: pvStyle, animClass: pvAnim, isClipPath: pvClip } = buildBadgeStyles(previewBadgeConfig, color);

  const save = async () => {
    setError('');
    if (!name.trim()) { setError(isUnion ? '표시명을 입력해주세요.' : '길드명을 입력해주세요.'); return; }
    const sn = shortName.trim();
    const snLen = [...sn].length;
    if (!isUnion && sn && snLen > 4) { setError('약식명은 한글/영문 4자 이하로 입력해주세요.'); return; }
    const en = englishName.trim();
    if (!isUnion && en) {
      const enErr = validateEnglishName(en);
      if (enErr) { setError(enErr); return; }
    }
    setBusy(true);
    try {
      const id = guild.id || randomId('guild_');
      const badge = {
        shape: badgeShape, bgType: badgeBgType,
        color2: badgeColor2, color3: badgeColor3,
        border: badgeBorder, borderColor: badgeBorderColor,
        effect: badgeEffect, textColor: badgeTextColor,
        textCustomColor: badgeTextCustomColor, textStyle: badgeTextStyle_,
      };
      const payload = isUnion
        ? {
            // 연합 뱃지 문서: 뱃지 디자인 + 표시명/색만 저장.
            name: name.trim(),
            badgeName: name.trim(),
            color,
            isUnion: true,
            badge,
          }
        : {
            name: name.trim(),
            shortName: sn,
            englishName: en,
            badgeName: badgeName.trim(),
            color,
            logoPath: logoPath.trim(),
            isNone: !!guild.isNone,
            showInFilter,
            showFlag,
            page,
            ...(isNew ? { order: nextOrder } : {}),
            badge,
          };
      await saveGuild(id, payload);
      onClose(true);
    } catch {
      setError('저장에 실패했습니다.');
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try { await deleteGuild(guild.id); onClose(true); }
    catch { setError('삭제에 실패했습니다.'); setBusy(false); }
  };

  return (
    <Modal open onClose={() => onClose(false)} title={isNew ? '길드 추가' : `길드 수정 · ${guild.name}`}>
      {/* ── Tab selector ── */}
      <div className="flex gap-1 p-1 rounded-xl bg-base-850 border border-base-700 mb-4">
        {(isUnion ? [['info', '기본 정보'], ['badge', '뱃지 수정']] : [['info', '기본 정보'], ['badge', '뱃지 수정'], ['page', '소개글']]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition ${
              activeTab === key ? 'bg-base-700 text-white' : 'text-base-400 hover:text-base-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── 기본정보 Tab ── */}
      {activeTab === 'info' && (
        <div className="space-y-4">
          <div>
            <label className="label-sm">{isUnion ? '표시명 (뱃지에 표시되는 글자)' : '길드명'}</label>
            <input className="input-base" value={name} onChange={(e) => setName(e.target.value)} placeholder={isUnion ? '예: 연합' : ''} />
          </div>
          {!isUnion && (
          <div>
            <label className="label-sm">약식명 <span className="text-base-500 font-normal">(한글/영문 4자 이하 · 달력 표시용)</span></label>
            <input
              className="input-base"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              placeholder="예: 스타폴, Star"
              maxLength={8}
            />
          </div>
          )}
          {!isUnion && (
          <div>
            <label className="label-sm">뱃지명 <span className="text-base-500 font-normal">(뱃지에 표시 · 이모지/줄임 가능)</span></label>
            <input
              className="input-base"
              value={badgeName}
              onChange={(e) => setBadgeName(e.target.value)}
              placeholder="예: 🌲스타폴, SF (비우면 길드명)"
              maxLength={16}
            />
          </div>
          )}
          {!isUnion && (
          <div>
            <label className="label-sm">영문명 <span className="text-base-500 font-normal">(로고 파일명 · 페이지 주소 · 슈퍼관리자만 변경)</span></label>
            <input
              className="input-base"
              value={englishName}
              onChange={(e) => setEnglishName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="예: starfall"
            />
            <p className="text-[11px] text-base-400 mt-1">
              영문 소문자·숫자·하이픈(-)만. 로고는 <code className="text-base-300">public/guildflag/영문명.png</code>, 주소는 <code className="text-base-300">/guild/영문명</code>.
            </p>
          </div>
          )}
          <div>
            <label className="label-sm">시그니처 컬러</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-12 h-10 rounded-lg bg-base-800 border border-base-600 cursor-pointer"
              />
              <input className="input-base flex-1" value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
          </div>
          {!isUnion && (
          <div>
            <label className="label-sm">로고 경로 (repo 내 정적 파일)</label>
            <input
              className="input-base"
              value={logoPath}
              onChange={(e) => setLogoPath(e.target.value)}
              placeholder="예: logos/starfall.png"
            />
            <p className="text-[11px] text-base-400 mt-1 leading-relaxed">
              PNG 파일을 프로젝트 public/logos/ 폴더에 추가·커밋·배포 후 경로를 입력하세요.
              <br />규격 — 로고: <b className="text-base-300">512 × 512</b> · 깃발: <b className="text-base-300">512 × 640</b> (배경 투명)
            </p>
          </div>
          )}
          {isUnion && (
            <p className="text-[11px] text-base-400 leading-relaxed p-3 rounded-xl bg-base-850 border border-base-700">
              이 뱃지는 <b className="text-base-300">연합 레이드</b>의 달력/카드뷰 상단에 표시됩니다. 표시명·색·뱃지 디자인만 설정하면 됩니다.
            </p>
          )}
          {!guild.isNone && !isUnion && (
            <label className="flex items-center justify-between p-3 rounded-xl bg-base-850 border border-base-700 cursor-pointer">
              <div>
                <p className="text-sm font-medium">메인 화면 필터에 표시</p>
                <p className="text-[11px] text-base-400 mt-0.5">카테고리 필터에 이 길드를 노출합니다</p>
              </div>
              <input
                type="checkbox"
                className="w-4 h-4 accent-indigo-500"
                checked={showInFilter}
                onChange={(e) => setShowInFilter(e.target.checked)}
              />
            </label>
          )}
          {!guild.isNone && !isUnion && (
            <label className="flex items-center justify-between p-3 rounded-xl bg-base-850 border border-base-700 cursor-pointer">
              <div>
                <p className="text-sm font-medium">길드 소개 깃발에 표시</p>
                <p className="text-[11px] text-base-400 mt-0.5">"한국길드연합 소속 길드 소개" 깃발 목록에 이 길드를 노출합니다</p>
              </div>
              <input
                type="checkbox"
                className="w-4 h-4 accent-indigo-500"
                checked={showFlag}
                onChange={(e) => setShowFlag(e.target.checked)}
              />
            </label>
          )}
        </div>
      )}

      {/* ── 뱃지수정 Tab ── */}
      {activeTab === 'badge' && (
        <div className="space-y-4">
          {/* Live preview */}
          <div className="flex flex-col items-center gap-3 py-4 rounded-2xl bg-base-850 border border-base-700">
            <p className="text-[11px] text-base-500 font-semibold uppercase tracking-wider">미리보기</p>
            <span
              className={`inline-flex items-center justify-center text-sm font-semibold px-5 py-2 ${pvAnim}`}
              style={{
                ...pvStyle,
                ...(pvClip ? { minWidth: '6rem', minHeight: '2.4rem' } : { minWidth: '6rem' }),
              }}
            >
              {badgeName || name || guild.name || '길드명'}
            </span>
            <div className="flex gap-3">
              <span className="text-[11px] text-base-500">sm:</span>
              <GuildBadge guildName={badgeName || name || guild.name} guildColor={color} badgeConfig={previewBadgeConfig} size="sm" />
              <span className="text-[11px] text-base-500">xs:</span>
              <GuildBadge guildName={badgeName || name || guild.name} guildColor={color} badgeConfig={previewBadgeConfig} size="xs" />
            </div>
          </div>

          {/* Shape */}
          <BadgeSection label="모양">
            {SHAPE_OPTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setBadgeShape(s.key)}
                className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg border text-[10px] font-semibold transition ${
                  badgeShape === s.key
                    ? 'border-indigo-400 bg-indigo-500/10 text-indigo-200'
                    : 'border-base-700 bg-base-800 text-base-500 hover:text-base-200 hover:border-base-500'
                }`}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 22, height: 14,
                    background: `${color}88`,
                    clipPath: s.clip || undefined,
                    borderRadius: s.clip ? undefined : s.radius,
                  }}
                />
                {s.label}
              </button>
            ))}
          </BadgeSection>

          {/* Background */}
          <BadgeSection label="배경 스타일">
            {BG_OPTIONS.map((b) => (
              <OptBtn key={b.key} active={badgeBgType === b.key} onClick={() => setBadgeBgType(b.key)}>
                {b.label}
              </OptBtn>
            ))}
          </BadgeSection>

          {/* Color pickers */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-base-400 w-24 shrink-0">시그니처 컬러</span>
              <span
                className="w-6 h-6 rounded border border-base-600"
                style={{ background: color }}
              />
              <span className="text-[11px] text-base-400">{color} <span className="text-base-600">(기본정보 탭에서 변경)</span></span>
            </div>
            {needsColor2 && (
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-base-400 w-24 shrink-0">세컨드 컬러</label>
                <input
                  type="color"
                  value={badgeColor2}
                  onChange={(e) => setBadgeColor2(e.target.value)}
                  className="w-8 h-8 rounded border border-base-600 cursor-pointer bg-transparent"
                />
                <input
                  className="input-base flex-1 text-xs py-1"
                  value={badgeColor2}
                  onChange={(e) => setBadgeColor2(e.target.value)}
                />
              </div>
            )}
            {needsColor3 && (
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-base-400 w-24 shrink-0">써드 컬러</label>
                <input
                  type="color"
                  value={badgeColor3}
                  onChange={(e) => setBadgeColor3(e.target.value)}
                  className="w-8 h-8 rounded border border-base-600 cursor-pointer bg-transparent"
                />
                <input
                  className="input-base flex-1 text-xs py-1"
                  value={badgeColor3}
                  onChange={(e) => setBadgeColor3(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Border */}
          <BadgeSection label="테두리">
            {BORDER_OPTIONS.map((b) => (
              <OptBtn key={b.key} active={badgeBorder === b.key} onClick={() => setBadgeBorder(b.key)}>
                {b.label}
              </OptBtn>
            ))}
          </BadgeSection>

          {badgeBorder !== 'none' && (
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-base-400 w-24 shrink-0">테두리 색</label>
              <input
                type="color"
                value={badgeBorderColor}
                onChange={(e) => setBadgeBorderColor(e.target.value)}
                className="w-8 h-8 rounded border border-base-600 cursor-pointer bg-transparent"
              />
              <input
                className="input-base flex-1 text-xs py-1"
                value={badgeBorderColor}
                onChange={(e) => setBadgeBorderColor(e.target.value)}
              />
            </div>
          )}

          {/* Effects */}
          <BadgeSection label="이펙트">
            {EFFECT_OPTIONS.map((e) => (
              <OptBtn key={e.key} active={badgeEffect === e.key} onClick={() => setBadgeEffect(e.key)}>
                {e.label}
              </OptBtn>
            ))}
          </BadgeSection>

          {/* Text color */}
          <BadgeSection label="텍스트 색">
            {TEXT_COLOR_OPTIONS.map((t) => (
              <OptBtn key={t.key} active={badgeTextColor === t.key} onClick={() => setBadgeTextColor(t.key)}>
                {t.label}
              </OptBtn>
            ))}
          </BadgeSection>

          {badgeTextColor === 'custom' && (
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-base-400 w-24 shrink-0">텍스트 색상</label>
              <input
                type="color"
                value={badgeTextCustomColor}
                onChange={(e) => setBadgeTextCustomColor(e.target.value)}
                className="w-8 h-8 rounded border border-base-600 cursor-pointer bg-transparent"
              />
              <input
                className="input-base flex-1 text-xs py-1"
                value={badgeTextCustomColor}
                onChange={(e) => setBadgeTextCustomColor(e.target.value)}
              />
            </div>
          )}

          <BadgeSection label="텍스트 스타일">
            {TEXT_STYLE_OPTIONS.map((t) => (
              <OptBtn key={t.key} active={badgeTextStyle_ === t.key} onClick={() => setBadgeTextStyle_(t.key)}>
                {t.label}
              </OptBtn>
            ))}
          </BadgeSection>
        </div>
      )}

      {/* ── 소개글 Tab ── */}
      {activeTab === 'page' && (
        <GuildPageEditor
          value={page}
          onChange={setPage}
          guildColor={color}
          guildName={name || guild.name || '길드'}
          guildEnglishName={englishName || ''}
          guildLogoPath={logoPath || ''}
          guildBadge={previewBadgeConfig}
          guildBadgeName={badgeName || name || guild.name || ''}
        />
      )}

      {/* ── Footer ── */}
      <div className="mt-4 space-y-3">
        {error && <p className="text-sm text-red-400 text-center">{error}</p>}
        <div className="flex gap-2">
          {!isNew && !guild.isNone && !isUnion &&
            (confirmDelete ? (
              <button type="button" className="btn-danger flex-1" disabled={busy} onClick={remove}>
                정말 삭제할까요?
              </button>
            ) : (
              <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(true)}>
                삭제
              </button>
            ))}
          <button type="button" className="btn-primary flex-1" disabled={busy} onClick={save}>
            저장
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ── Raids & archive tab ─────────────────────────────────────────────

function RaidsTab() {
  const [raids, setRaids] = useState([]);
  const [view, setView] = useState('upcoming');
  const [rosterTarget, setRosterTarget] = useState(null);

  const load = async () => {
    const snap = await getDocs(collection(db, 'raids'));
    setRaids(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    load();
  }, []);

  const now = Date.now();

  const list = raids
    .filter((r) => {
      if (view === 'deleted') return !!r.deleted;
      if (r.deleted) return false;
      if (view === 'upcoming') return r.endAt.toMillis() >= now;
      return r.endAt.toMillis() < now; // archive
    })
    .sort((a, b) =>
      view === 'upcoming'
        ? a.startAt.toMillis() - b.startAt.toMillis()
        : b.startAt.toMillis() - a.startAt.toMillis()
    );

  const handleSoftDelete = async (raidId) => {
    await softDeleteRaid(raidId).catch(() => {});
    load();
  };

  const handleRestore = async (raidId) => {
    await restoreRaid(raidId).catch(() => {});
    load();
  };

  const handleHardDelete = async (raidId) => {
    // eslint-disable-next-line no-alert
    if (window.confirm('영구 삭제하면 복구할 수 없습니다. 계속할까요?')) {
      await hardDeleteRaid(raidId).catch(() => {});
      load();
    }
  };

  return (
    <div>
      <div className="flex gap-1 p-1 rounded-xl bg-base-850 mb-4">
        {[
          ['upcoming', '진행 / 예정'],
          ['archive', '아카이브'],
          ['deleted', '삭제됨'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
              view === key
                ? key === 'deleted'
                  ? 'bg-red-500/20 text-red-300'
                  : 'bg-base-700 text-white'
                : 'text-base-400 hover:text-base-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {list.map((r) => {
          const diff = DIFFICULTIES[r.difficulty] || DIFFICULTIES.normal;
          return (
            <div
              key={r.id}
              className={`flex items-center gap-3 p-3 card ${r.deleted ? 'opacity-60' : ''}`}
            >
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-md shrink-0"
                style={{ color: diff.color, backgroundColor: `${diff.color}22` }}
              >
                {diff.label}
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">
                  {r.title ? `${r.title} · ` : ''}
                  {formatDateLabel(r.dateKey)} {formatTimeRange(r.startAt.toDate(), r.endAt.toDate())}
                </p>
                <p className="text-xs text-base-400 truncate">공격대장 {r.leader}</p>
              </div>
              <div className="ml-auto flex gap-1.5 shrink-0">
                {view !== 'deleted' ? (
                  <>
                    <button
                      type="button"
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-base-700 hover:bg-base-600 font-semibold transition"
                      onClick={() => setRosterTarget(r)}
                    >
                      명단
                    </button>
                    <button
                      type="button"
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-red-500/15 text-red-300 hover:bg-red-500/25 font-semibold transition"
                      onClick={() => handleSoftDelete(r.id)}
                    >
                      삭제
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-green-500/15 text-green-300 hover:bg-green-500/25 font-semibold transition"
                      onClick={() => handleRestore(r.id)}
                    >
                      복구
                    </button>
                    <button
                      type="button"
                      className="text-xs px-2.5 py-1.5 rounded-lg bg-red-500/15 text-red-300 hover:bg-red-500/30 font-semibold transition"
                      onClick={() => handleHardDelete(r.id)}
                    >
                      영구삭제
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {list.length === 0 && (
          <p className="text-center text-base-400 py-8 text-sm">
            {view === 'upcoming'
              ? '예정된 레이드가 없습니다.'
              : view === 'archive'
              ? '아카이브가 비어 있습니다.'
              : '삭제된 레이드가 없습니다.'}
          </p>
        )}
      </div>

      {rosterTarget && <RosterModal raid={rosterTarget} onClose={() => setRosterTarget(null)} />}
    </div>
  );
}

const LOG_ACTION = {
  apply: { label: '신청', color: 'text-green-300' },
  cancel: { label: '취소', color: 'text-red-300' },
  change: { label: '변경', color: 'text-amber-300' },
};

function fmtLogTime(ts) {
  const d = ts && ts.toDate ? ts.toDate() : null;
  if (!d) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function RosterModal({ raid, onClose }) {
  const [view, setView] = useState('roster');
  const [apps, setApps] = useState(null);
  const [logs, setLogs] = useState(null);

  useEffect(() => {
    getDocs(collection(db, 'raids', raid.id, 'apps'))
      .then((snap) => setApps(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch(() => setApps([]));
  }, [raid.id]);

  useEffect(() => {
    if (view !== 'logs' || logs !== null) return;
    getDocs(query(collection(db, 'raids', raid.id, 'logs'), orderBy('at', 'desc')))
      .then((snap) => setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch(() => setLogs([]));
  }, [view, logs, raid.id]);

  const groups = apps
    ? [
        ['탱커', apps.filter((a) => a.status !== 'bench' && a.role === 'tank')],
        ['힐러', apps.filter((a) => a.status !== 'bench' && a.role === 'healer')],
        ['딜러', apps.filter((a) => a.status !== 'bench' && a.role === 'dps')],
        ['벤치', apps.filter((a) => a.status === 'bench')],
      ]
    : [];

  return (
    <Modal open onClose={onClose} title={formatDateLabel(raid.dateKey)}>
      <div className="flex gap-1 p-1 rounded-xl bg-base-850 mb-3">
        {[['roster', '명단'], ['logs', '로그']].map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setView(k)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition ${
              view === k ? 'bg-base-700 text-white' : 'text-base-400 hover:text-base-200'
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      {view === 'roster' ? (
        !apps ? (
          <p className="text-center text-base-400 py-6 animate-pulse">불러오는 중...</p>
        ) : apps.length === 0 ? (
          <p className="text-center text-base-400 py-6">신청자가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {groups.map(([label, list]) =>
              list.length === 0 ? null : (
                <div key={label}>
                  <p className="text-xs font-bold text-base-400 mb-1">
                    {label} ({list.length})
                  </p>
                  {list
                    .sort((a, b) => (a.seq || 0) - (b.seq || 0))
                    .map((a) => (
                      <p key={a.id} className="text-sm py-0.5">
                        <span className="font-semibold" style={badgeTextStyle(a.classColor)}>
                          {a.charName || a.nickname}
                        </span>{' '}
                        <span className="text-xs text-base-400">
                          {a.className || '미지정'}
                          {a.specName ? ` | ${a.specName}` : ''} ·{' '}
                          {a.status === 'active' ? '확정' : a.status === 'bench' ? '벤치' : '대기'}
                          {a.isReservation ? ' · 예약' : ''}
                        </span>
                      </p>
                    ))}
                </div>
              )
            )}
          </div>
        )
      ) : !logs ? (
        <p className="text-center text-base-400 py-6 animate-pulse">불러오는 중...</p>
      ) : logs.length === 0 ? (
        <p className="text-center text-base-400 py-6">기록된 로그가 없습니다.</p>
      ) : (
        <div className="space-y-0.5 max-h-[60vh] overflow-y-auto">
          {logs.map((lg) => {
            const a = LOG_ACTION[lg.action] || { label: lg.action, color: 'text-base-300' };
            return (
              <div key={lg.id} className="flex items-start gap-2 text-xs py-1 border-b border-base-800/70">
                <span className="text-base-500 tabular-nums shrink-0">{fmtLogTime(lg.at)}</span>
                <span className={`font-bold shrink-0 ${a.color}`}>{a.label}</span>
                <span className="font-bold shrink-0 break-keep" style={{ color: lg.classColor || '#cbd5e1' }}>
                  {lg.char || lg.actor}
                </span>
                {(lg.guildName || lg.nickname) && (
                  <span className="text-[11px] text-base-500 shrink-0">
                    {[lg.guildName, lg.nickname].filter(Boolean).join(' · ')}
                  </span>
                )}
                <span className="text-base-400 break-words">{lg.detail}</span>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

// ── Seed tab ────────────────────────────────────────────────────────

function SeedTab() {
  const [seeded, setSeeded] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [busyMig, setBusyMig] = useState(false);
  const [migMsg, setMigMsg] = useState('');

  useEffect(() => {
    isSeeded()
      .then(setSeeded)
      .catch(() => setSeeded(false));
  }, []);

  const run = async () => {
    setBusy(true);
    setMsg('');
    try {
      await seedInitialData();
      setSeeded(true);
      setMsg('초기 데이터가 설치되었습니다. (길드 / 클래스·특성 / 시너지 / 서버 목록)');
    } catch {
      setMsg('설치에 실패했습니다. Firestore 규칙과 연결 상태를 확인해주세요.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card p-5 space-y-3">
      <p className="font-bold">초기 데이터 설치</p>
      <p className="text-sm text-base-400 leading-relaxed">
        클래스 13종·특성 39종(한밤 기준, 포식 포함), 공격대 시너지 14종, 한국 서버 목록을
        Firestore에 설치합니다. 최초 1회만 실행하면 됩니다.
      </p>
      {seeded && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm text-amber-300 space-y-1">
          <p className="font-bold">⚠️ 재설치 주의사항</p>
          <p className="text-amber-200/80">
            길드 데이터는 <b>기존 편집 내용을 보존</b>합니다 (이름·색상·필터 설정 유지).
            클래스·시너지·서버 목록은 기본값으로 초기화됩니다.
          </p>
        </div>
      )}
      <button type="button" className="btn-primary" disabled={busy || seeded === null} onClick={run}>
        {busy ? '설치 중...' : seeded ? '재설치 (덮어쓰기)' : '초기 데이터 설치'}
      </button>
      {msg && <p className="text-sm text-green-400">{msg}</p>}

      <div className="pt-4 mt-2 border-t border-base-700 space-y-2">
        <p className="font-bold">기원사 특성명 수정 (파멸 → 황폐)</p>
        <p className="text-sm text-base-400 leading-relaxed">
          기원사 딜 특성이 <b className="text-base-200">파멸</b>로 잘못 등록돼 있던 것을 <b className="text-base-200">황폐</b>로 고칩니다.
          클래스 데이터를 갱신하고, 기존 신청서에 저장된 특성 이름도 함께 변환합니다. (캐릭터는 영향 없음)
        </p>
        <button
          type="button"
          className="btn-primary"
          disabled={busyMig}
          onClick={async () => {
            setBusyMig(true); setMigMsg('');
            try {
              const r = await migrateEvokerSpecName();
              setMigMsg(`완료 — 클래스 데이터 갱신, 신청서 ${r.apps}건 변환.`);
            } catch {
              setMigMsg('실패 — 권한/연결 상태를 확인해주세요.');
            } finally { setBusyMig(false); }
          }}
        >
          {busyMig ? '변환 중...' : '파멸 → 황폐 변환 실행'}
        </button>
        {migMsg && <p className="text-sm text-green-400">{migMsg}</p>}
      </div>
    </div>
  );
}

// ── Page shell ──────────────────────────────────────────────────────

// 최초 배포 후 DB가 비어 있을 때 자동 연동할 기존 기본 채널 (functions의 CARD_CHANNELS와 동일)
const DEFAULT_CARD_CHANNELS = [
  { channelId: '1517678646343635064', filter: 'union', serverId: null },                         // 한길련 서버(ID 미상)
  { channelId: '1517705693371830322', filter: 'union', serverId: '1430130051734704259' },        // 스타폴 서버 · 연합
  { channelId: '1517705660903587970', filter: 'guild:starfall', serverId: '1430130051734704259' },
  { channelId: '1519867938671165490', filter: 'guild:e-ayo', serverId: '861086826637557821' },
  { channelId: '1521323489573994586', filter: 'guild:gyocharo', serverId: '1264845965387501630' },
];

function ChanSubPicker({ value, onChange, subCategories }) {
  const isAll = value === 'all' || !value;
  const arr = Array.isArray(value) ? value : [];
  const toggle = (id) => {
    if (isAll) { onChange([id]); return; }
    const n = arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
    onChange(n.length ? n : 'all');
  };
  return (
    <div className="flex flex-wrap gap-1">
      <button type="button" onClick={() => onChange('all')} className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border transition ${isAll ? 'border-indigo-400 bg-indigo-500/15 text-indigo-200' : 'border-base-700 text-base-400 hover:text-base-200'}`}>전부</button>
      {subCategories.map((sc) => (
        <button key={sc.id} type="button" onClick={() => toggle(sc.id)} className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border transition ${!isAll && arr.includes(sc.id) ? 'border-indigo-400 bg-indigo-500/15 text-indigo-200' : 'border-base-700 text-base-400 hover:text-base-200'}`}>{sc.label}</button>
      ))}
    </div>
  );
}

function ChannelsTab({ guilds }) {
  const { subCategories } = useApp();
  const [channels, setChannels] = useState([]);
  const [newId, setNewId] = useState('');
  const [newFilter, setNewFilter] = useState('union');
  const [newSub, setNewSub] = useState('all');
  const [msg, setMsg] = useState(null);

  const seededOnce = useRef(false);
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'cardChannels'),
      (s) => {
        setChannels(s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.filter || '').localeCompare(b.filter || '')));
        // 비어 있으면(최초 배포 직후) 기존 기본 채널을 자동 연동 — 1회만.
        if (s.empty && !seededOnce.current) {
          seededOnce.current = true;
          DEFAULT_CARD_CHANNELS.forEach((c) => setDoc(
            doc(db, 'cardChannels', c.channelId),
            { channelId: c.channelId, filter: c.filter, subFilter: 'all', serverId: c.serverId || null, enabled: true, updatedAt: Date.now() },
            { merge: true },
          ).catch(() => {}));
        }
      },
      () => {}
    );
    return unsub;
  }, []);

  const majorOptions = [
    { value: 'union', label: '연합' },
    ...guilds.filter((g) => !g.isUnion && !g.isNone).map((g) => ({ value: g.englishName ? `guild:${g.englishName}` : g.id, label: g.name })),
  ];
  const majorLabel = (f) => majorOptions.find((o) => o.value === f)?.label || f;
  const subLabel = (sub) => (!sub || sub === 'all') ? '전부' : (Array.isArray(sub) ? sub : [sub]).map((id) => subCategories.find((s) => s.id === id)?.label || id).join(', ');

  const patch = (cid, data) => setDoc(doc(db, 'cardChannels', cid), { ...data, updatedAt: Date.now() }, { merge: true }).catch(() => setMsg({ ok: false, text: '저장 실패.' }));
  const remove = (cid) => deleteDoc(doc(db, 'cardChannels', cid)).catch(() => setMsg({ ok: false, text: '삭제 실패.' }));
  const add = async () => {
    const cid = newId.trim();
    if (!/^\d{5,}$/.test(cid)) { setMsg({ ok: false, text: '채널 ID는 숫자예요.' }); return; }
    try {
      await setDoc(doc(db, 'cardChannels', cid), { channelId: cid, filter: newFilter, subFilter: newSub, enabled: true, updatedAt: Date.now() });
      setNewId(''); setNewFilter('union'); setNewSub('all'); setMsg({ ok: true, text: '추가했어요.' });
    } catch { setMsg({ ok: false, text: '추가 실패.' }); }
  };
  const seedDefaults = async () => {
    try {
      for (const c of DEFAULT_CARD_CHANNELS) {
        await setDoc(doc(db, 'cardChannels', c.channelId), { channelId: c.channelId, filter: c.filter, subFilter: 'all', serverId: c.serverId || null, enabled: true, updatedAt: Date.now() }, { merge: true });
      }
      setMsg({ ok: true, text: '기존 기본 채널을 불러왔어요.' });
    } catch { setMsg({ ok: false, text: '불러오기 실패.' }); }
  };

  return (
    <div className="space-y-4">
      <div className="card p-4 space-y-3">
        <h3 className="font-bold">디스코드 채널 추가</h3>
        <input className="input-base" placeholder="채널 ID (숫자)" value={newId} onChange={(e) => setNewId(e.target.value)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <p className="text-[11px] text-base-500 mb-1">대분류</p>
            <select className="input-base" value={newFilter} onChange={(e) => setNewFilter(e.target.value)}>
              {majorOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <p className="text-[11px] text-base-500 mb-1">소분류</p>
            <ChanSubPicker value={newSub} onChange={setNewSub} subCategories={subCategories} />
          </div>
        </div>
        <button type="button" onClick={add} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition">추가</button>
        {msg && <p className={`text-sm ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>}
      </div>

      <div className="card p-4">
        <p className="font-bold mb-2">연동된 채널 <span className="text-base-500">{channels.length}</span></p>
        {channels.length === 0 ? (
          <div className="text-center py-4 space-y-2">
            <p className="text-xs text-base-500">기존 채널을 자동 연동 중이에요… 안 뜨면 아래 버튼을 눌러주세요.</p>
            <button type="button" onClick={seedDefaults} className="px-3 py-1.5 rounded-lg bg-base-700 hover:bg-base-600 text-base-200 text-sm font-semibold transition">기존 기본 채널 불러오기</button>
          </div>
        ) : (
          <div className="space-y-2">
            {channels.map((c) => (
              <div key={c.id} className="rounded-xl border border-base-700 bg-base-850 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-base-300 truncate">#{c.channelId} <span className="text-base-500">· {majorLabel(c.filter)} · {subLabel(c.subFilter)}</span></span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => patch(c.id, { enabled: c.enabled === false })} className={`text-[11px] px-2 py-0.5 rounded font-semibold ${c.enabled === false ? 'bg-base-700 text-base-400' : 'bg-green-500/15 text-green-300'}`}>{c.enabled === false ? '꺼짐' : '켜짐'}</button>
                    <button type="button" onClick={() => remove(c.id)} className="text-xs text-red-400 hover:text-red-300 font-semibold px-1">삭제</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                  <div>
                    <p className="text-[11px] text-base-500 mb-1">대분류</p>
                    <select className="input-base" value={majorOptions.some((o) => o.value === c.filter) ? c.filter : c.filter} onChange={(e) => patch(c.id, { filter: e.target.value })}>
                      {!majorOptions.some((o) => o.value === c.filter) && <option value={c.filter}>{majorLabel(c.filter)}</option>}
                      {majorOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-[11px] text-base-500 mb-1">소분류</p>
                    <ChanSubPicker value={c.subFilter} onChange={(v) => patch(c.id, { subFilter: v })} subCategories={subCategories} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SubCategoryTab() {
  const { subCategories } = useApp();
  const [items, setItems] = useState(subCategories);
  const [newLabel, setNewLabel] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setItems(subCategories); }, [subCategories]);

  const save = async (next) => {
    setBusy(true); setMsg(null);
    try {
      await setDoc(doc(db, 'config', 'raidMeta'), { subCategories: next }, { merge: true });
      setItems(next); setMsg({ ok: true, text: '저장했어요.' });
    } catch {
      setMsg({ ok: false, text: '저장 실패.' });
    } finally { setBusy(false); }
  };
  const add = () => {
    const label = newLabel.trim();
    if (!label) return;
    if (items.some((s) => s.label === label)) { setMsg({ ok: false, text: '이미 있는 항목이에요.' }); return; }
    setNewLabel('');
    save([...items, { id: `sc_${Date.now().toString(36)}`, label }]);
  };
  const remove = (id) => {
    if (id === 'none') { setMsg({ ok: false, text: '없음(기본)은 삭제할 수 없어요.' }); return; }
    save(items.filter((s) => s.id !== id));
  };

  return (
    <div className="card p-4 space-y-3">
      <div>
        <h3 className="font-bold">레이드 소분류 관리</h3>
        <p className="text-xs text-base-400 mt-1">레이드 등록·채널 필터에 쓰이는 공통 소분류 목록입니다. ‘없음(기본)’은 항상 유지됩니다.</p>
      </div>
      <div className="flex gap-2">
        <input className="input-base flex-1" placeholder="새 소분류 이름 (예: 트라이)" value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }} />
        <button type="button" onClick={add} disabled={busy} className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold transition disabled:opacity-50">추가</button>
      </div>
      {msg && <p className={`text-sm ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>}
      <div className="flex flex-wrap gap-2">
        {items.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-base-700 bg-base-850 text-sm">
            <span className={s.id === 'none' ? 'text-base-400' : 'text-base-100'}>{s.label}</span>
            {s.id !== 'none' && (
              <button type="button" onClick={() => remove(s.id)} className="text-base-500 hover:text-red-400 text-xs" title="삭제">✕</button>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function SuperAdminPage() {
  const { authReady, authUser, profile, isSuper, gamedata, guilds } = useApp();
  const [tab, setTab] = useState('users');
  const [guildList, setGuildList] = useState([]);

  const reloadGuilds = async () => {
    try {
      const snap = await getDocs(collection(db, 'guilds'));
      // Only update state when the query actually returns data to avoid
      // replacing the list with an empty array on transient failures.
      if (!snap.empty) {
        setGuildList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    } catch {
      // Silently ignore — effectiveGuilds will fall back to context guilds
    }
  };

  useEffect(() => {
    if (isSuper) reloadGuilds();
  }, [isSuper]);

  const effectiveGuilds = useMemo(
    () => (guildList.length > 0 ? guildList : guilds),
    [guildList, guilds]
  );

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="animate-pulse text-lg font-black bg-gradient-to-b from-white to-base-400 bg-clip-text text-transparent">KWGU</span>
      </div>
    );
  }

  if (!authUser || (profile && !isSuper)) {
    return <SuperLogin />;
  }

  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center text-base-400 animate-pulse">확인 중...</div>;
  }

  return (
    <div className="min-h-screen pb-16">
      <header className="sticky top-0 z-40 bg-base-900/90 backdrop-blur border-b border-base-800">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <p className="font-black">
            <span className="bg-gradient-to-b from-white to-base-400 bg-clip-text text-transparent">KWGU</span>{' '}
            <span className="text-indigo-400 text-sm font-bold">시스템 관리</span>
          </p>
          <div className="flex items-center gap-3">
            <a
              href={import.meta.env.BASE_URL}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-base-400 hover:text-base-200 transition"
            >
              메인 화면 ↗
            </a>
            <button
              type="button"
              className="text-xs text-base-400 hover:text-base-200 transition"
              onClick={() => signOutUser()}
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 mt-5">
        <div className="flex gap-1 p-1 rounded-xl bg-base-850 mb-5 overflow-x-auto">
          {[
            ['users', '유저 관리'],
            ['guilds', '길드 관리'],
            ['raids', '레이드 / 아카이브'],
            ['channels', '디스코드 채널'],
            ['subcat', '소분류'],
            ['system', '시스템'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex-1 whitespace-nowrap px-3 py-2 rounded-lg text-sm font-semibold transition ${
                tab === key ? 'bg-base-700 text-white' : 'text-base-400 hover:text-base-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'users' && <UsersTab guilds={effectiveGuilds} gamedata={gamedata} />}
        {tab === 'guilds' && <GuildsTab guilds={effectiveGuilds} reload={reloadGuilds} />}
        {tab === 'raids' && <RaidsTab />}
        {tab === 'channels' && <ChannelsTab guilds={effectiveGuilds} />}
        {tab === 'subcat' && <SubCategoryTab />}
        {tab === 'system' && <SeedTab />}
      </main>
    </div>
  );
}

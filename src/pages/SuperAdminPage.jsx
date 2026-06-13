import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  writeBatch,
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
import { seedInitialData, isSeeded, saveGuild, deleteGuild, softDeleteRaid, restoreRaid, hardDeleteRaid } from '../lib/db';
import { DIFFICULTIES, PIN_RULE } from '../lib/constants';
import {
  formatDateLabel,
  formatTimeRange,
  sortGuilds,
  badgeTextStyle,
  getClass,
  randomId,
} from '../lib/utils';
import Modal from '../components/Modal';

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
      <h1 className="text-2xl font-black mb-1">KGU 시스템 관리</h1>
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
  const [target, setTarget] = useState(null);
  const [msg, setMsg] = useState('');

  const load = async () => {
    const snap = await getDocs(collection(db, 'users'));
    setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = users
    .filter((u) => u.role !== 'super')
    .filter((u) => !search || u.nickname.includes(search))
    .sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko'));

  return (
    <div>
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
        {filtered.length === 0 && <p className="text-center text-base-400 py-8 text-sm">유저가 없습니다.</p>}
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

  return (
    <div className="space-y-2">
      {sortGuilds(guilds).map((g) => (
        <button
          key={g.id}
          type="button"
          onClick={() => setTarget(g)}
          className="w-full flex items-center gap-3 p-3 card hover:border-base-500 text-left transition"
        >
          <span className="w-5 h-5 rounded-full border border-base-600" style={{ backgroundColor: g.color }} />
          <span className="font-bold" style={{ color: g.color }}>
            {g.name}
          </span>
          {g.isNone && <span className="text-xs text-base-400">(고정)</span>}
          {g.logoPath && <span className="ml-auto text-xs text-base-400 truncate">{g.logoPath}</span>}
        </button>
      ))}
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
          onClose={(changed) => {
            setTarget(null);
            if (changed) reload();
          }}
        />
      )}
    </div>
  );
}

function GuildEditModal({ guild, onClose }) {
  const isNew = !guild.id;
  const [name, setName] = useState(guild.name);
  const [color, setColor] = useState(guild.color);
  const [logoPath, setLogoPath] = useState(guild.logoPath || '');
  // showInFilter: whether this guild appears in the main page category filter
  const [showInFilter, setShowInFilter] = useState(guild.showInFilter !== false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const save = async () => {
    setError('');
    if (!name.trim()) {
      setError('길드명을 입력해주세요.');
      return;
    }
    setBusy(true);
    try {
      const id = guild.id || randomId('guild_');
      await saveGuild(id, {
        name: name.trim(),
        color,
        logoPath: logoPath.trim(),
        isNone: !!guild.isNone,
        showInFilter,
      });
      onClose(true);
    } catch {
      setError('저장에 실패했습니다.');
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteGuild(guild.id);
      onClose(true);
    } catch {
      setError('삭제에 실패했습니다.');
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={() => onClose(false)} title={isNew ? '길드 추가' : `길드 수정 · ${guild.name}`}>
      <div className="space-y-4">
        <div>
          <label className="label-sm">길드명</label>
          <input className="input-base" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
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
        <div>
          <label className="label-sm">로고 경로 (repo 내 정적 파일)</label>
          <input
            className="input-base"
            value={logoPath}
            onChange={(e) => setLogoPath(e.target.value)}
            placeholder="예: logos/starfall.png"
          />
          <p className="text-[11px] text-base-400 mt-1">
            PNG 파일을 프로젝트 public/logos/ 폴더에 추가하고 커밋·배포한 뒤 경로를 입력하세요.
          </p>
        </div>

        {/* showInFilter toggle (소속 없음 제외) */}
        {!guild.isNone && (
          <label className="flex items-center justify-between p-3 rounded-xl bg-base-850 border border-base-700 cursor-pointer">
            <div>
              <p className="text-sm font-medium">메인 화면 필터에 표시</p>
              <p className="text-[11px] text-base-400 mt-0.5">
                카테고리 필터에 이 길드를 노출합니다
              </p>
            </div>
            <input
              type="checkbox"
              className="w-4 h-4 accent-indigo-500"
              checked={showInFilter}
              onChange={(e) => setShowInFilter(e.target.checked)}
            />
          </label>
        )}

        {error && <p className="text-sm text-red-400 text-center">{error}</p>}

        <div className="flex gap-2">
          {!isNew && !guild.isNone &&
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

function RosterModal({ raid, onClose }) {
  const [apps, setApps] = useState(null);

  useEffect(() => {
    getDocs(collection(db, 'raids', raid.id, 'apps'))
      .then((snap) => setApps(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch(() => setApps([]));
  }, [raid.id]);

  const groups = apps
    ? [
        ['탱커', apps.filter((a) => a.role === 'tank')],
        ['힐러', apps.filter((a) => a.role === 'healer')],
        ['딜러', apps.filter((a) => a.role === 'dps')],
      ]
    : [];

  return (
    <Modal open onClose={onClose} title={`명단 · ${formatDateLabel(raid.dateKey)}`}>
      {!apps ? (
        <p className="text-center text-base-400 py-6 animate-pulse">불러오는 중...</p>
      ) : apps.length === 0 ? (
        <p className="text-center text-base-400 py-6">신청자가 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {groups.map(([label, list]) => (
            <div key={label}>
              <p className="text-xs font-bold text-base-400 mb-1">
                {label} ({list.length})
              </p>
              {list
                .sort((a, b) => (a.seq || 0) - (b.seq || 0))
                .map((a) => (
                  <p key={a.id} className="text-sm py-0.5">
                    <span className="font-semibold" style={badgeTextStyle(a.classColor)}>
                      {a.charName}
                    </span>{' '}
                    <span className="text-xs text-base-400">
                      {a.className || '미지정'}
                      {a.specName ? ` | ${a.specName}` : ''} ·{' '}
                      {a.status === 'active' ? '확정' : '대기'}
                      {a.isReservation ? ' · 예약' : ''}
                    </span>
                  </p>
                ))}
            </div>
          ))}
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
        길드 5개(소속 없음 포함), 클래스 13종·특성 39종(한밤 기준, 포식 포함), 공격대 시너지
        14종, 한국 서버 목록을 Firestore에 설치합니다. 최초 1회만 실행하면 됩니다.
        {seeded && ' 다시 실행하면 기본값으로 덮어씁니다.'}
      </p>
      <button type="button" className="btn-primary" disabled={busy || seeded === null} onClick={run}>
        {busy ? '설치 중...' : seeded ? '재설치 (덮어쓰기)' : '초기 데이터 설치'}
      </button>
      {msg && <p className="text-sm text-green-400">{msg}</p>}
    </div>
  );
}

// ── Page shell ──────────────────────────────────────────────────────

export default function SuperAdminPage() {
  const { authReady, authUser, profile, isSuper, gamedata, guilds } = useApp();
  const [tab, setTab] = useState('users');
  const [guildList, setGuildList] = useState([]);

  const reloadGuilds = async () => {
    const snap = await getDocs(collection(db, 'guilds'));
    setGuildList(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => {
    if (isSuper) reloadGuilds();
  }, [isSuper]);

  const effectiveGuilds = useMemo(
    () => (guildList.length > 0 ? guildList : guilds),
    [guildList, guilds]
  );

  if (!authReady) {
    return <div className="min-h-screen flex items-center justify-center text-base-400 animate-pulse">KGU</div>;
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
            KWGU <span className="text-indigo-400 text-sm font-bold">시스템 관리</span>
          </p>
          <div className="flex items-center gap-3">
            <a
              href="/"
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
        {tab === 'system' && <SeedTab />}
      </main>
    </div>
  );
}

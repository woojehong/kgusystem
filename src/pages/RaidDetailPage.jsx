import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useApp } from '../context/AppContext';
import { DIFFICULTIES } from '../lib/constants';
import {
  formatDateLabel,
  formatTimeRange,
  getCaps,
  countFillColor,
  readableOn,
} from '../lib/utils';
import { updateRaid, fetchAllMemos, cancelApplication } from '../lib/db';
import Header from '../components/Header';
import SynergyBoard from '../components/SynergyBoard';
import SwapList from '../components/SwapList';
import ApplicantCard from '../components/ApplicantCard';
import RosterListRow from '../components/RosterListRow';
import BenchCard from '../components/BenchCard';
import { useToast } from '../components/Toast';
import ApplyModal from '../components/ApplyModal';
import ReservationModal from '../components/ReservationModal';
import AdminMemberAddModal from '../components/AdminMemberAddModal';
import SimulationModal from '../components/SimulationModal';
import AdminAppEditModal from '../components/AdminAppEditModal';
import RaidFormModal from '../components/RaidFormModal';
import Modal from '../components/Modal';

function sortBySeq(list) {
  return [...list].sort((a, b) => (a.seq || 0) - (b.seq || 0));
}

// 액티브 로스터: 클래스 가나다순 우선, 같은 클래스는 신청순(seq).
function sortByClass(list) {
  return [...list].sort((a, b) => {
    const c = (a.className || '').localeCompare(b.className || '', 'ko');
    if (c !== 0) return c;
    return (a.seq || 0) - (b.seq || 0);
  });
}

// 신청자의 특성이 원거리 딜인지 (gamedata의 range 사용; 클래스+특성명으로 조회).
// 같은 클래스 안에서 특성명은 유일하므로 동명 특성(냉기 등) 충돌 없음.
function isRangedDps(classes, a) {
  const cls = (classes || []).find((c) => c.id === a.classId);
  const spec = cls && (cls.specs || []).find((s) => s.name === a.specName);
  return !!spec && spec.range === 'ranged';
}

const ROLE_COLORS = { tank: '#38bdf8', healer: '#34d399', dps: '#fb7185' };

const STATUS_META = {
  active: { label: '참가 확정', color: '#22c55e' },
  wait: { label: '대기 명단', color: '#f59e0b' },
  bench: { label: '벤치', color: '#a3e635' },
};

function SectionHeader({ label, role, count, cap, adminMode, onAdd }) {
  const roleColor = ROLE_COLORS[role] || '#94a3b8';
  return (
    <div className="flex items-center justify-between mb-2">
      <p className="font-bold text-sm" style={{ color: roleColor }}>
        {label}{' '}
        <span className={countFillColor(count, cap)}>{count}/{cap}</span>
      </p>
      {adminMode && (
        <button
          type="button"
          onClick={onAdd}
          className="text-xs px-2 py-1 rounded-lg bg-base-700 hover:bg-base-600 font-semibold transition"
        >
          + 예약
        </button>
      )}
    </div>
  );
}

/**
 * Determines whether the current user can edit/delete this raid.
 * - SuperAdmin: always yes.
 * - Union raid (partyType === 'union' or missing): any admin.
 * - Guild raid: only admins whose guildId matches raid.partyType.
 */
function useCanEdit(raid, profile, isAdmin, isSuper, adminMode) {
  return useMemo(() => {
    if (!adminMode) return false;
    if (isSuper) return true;
    if (!isAdmin) return false;
    if (!raid) return false;
    if (!raid.partyType || raid.partyType === 'union') return true;
    return raid.partyType === profile?.guildId;
  }, [raid, profile, isAdmin, isSuper, adminMode]);
}

export default function RaidDetailPage() {
  const { raidId } = useParams();
  const { userId, isAdmin, isSuper, adminMode, profile, gamedata } = useApp();
  const toast = useToast();
  const adminView = isAdmin && adminMode;

  const [raid, setRaid] = useState(null);
  const [raidMissing, setRaidMissing] = useState(false);
  const [apps, setApps] = useState([]);
  const [memos, setMemos] = useState({});
  const [applyOpen, setApplyOpen] = useState(false);
  const [editApply, setEditApply] = useState(false);
  const [reserveRole, setReserveRole] = useState(null);
  const [memberAddOpen, setMemberAddOpen] = useState(false);
  const [simOpen, setSimOpen] = useState(false);
  // 로스터 표시 모드: 'list'(기본) | 'card'
  const [rosterView, setRosterView] = useState(() => {
    const v = typeof localStorage !== 'undefined' && localStorage.getItem('kwgu_roster_view');
    return v === 'card' ? 'card' : 'list';
  });
  const setRosterViewPersist = (v) => {
    setRosterView(v);
    try { localStorage.setItem('kwgu_roster_view', v); } catch { /* ignore */ }
  };
  const [adminTarget, setAdminTarget] = useState(null);
  const [raidEditOpen, setRaidEditOpen] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsubRaid = onSnapshot(doc(db, 'raids', raidId), (snap) => {
      if (snap.exists()) setRaid({ id: snap.id, ...snap.data() });
      else setRaidMissing(true);
    });
    const unsubApps = onSnapshot(collection(db, 'raids', raidId, 'apps'), (snap) => {
      setApps(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => {
      unsubRaid();
      unsubApps();
    };
  }, [raidId]);

  useEffect(() => {
    if (!adminView) return;
    fetchAllMemos(raidId)
      .then(setMemos)
      .catch(() => {});
  }, [adminView, raidId, apps]);

  const derived = useMemo(() => {
    const actives = apps.filter((a) => a.status === 'active');
    const waits = apps.filter((a) => a.status === 'wait');

    const tanks = sortByClass(actives.filter((a) => a.role === 'tank'));
    const healers = sortByClass(actives.filter((a) => a.role === 'healer'));
    const dps = sortByClass(actives.filter((a) => a.role === 'dps'));

    const waitTanks = sortBySeq(waits.filter((a) => a.role === 'tank'));
    const waitHealers = sortBySeq(waits.filter((a) => a.role === 'healer'));
    const waitDps = sortBySeq(waits.filter((a) => a.role === 'dps'));

    const bench = sortBySeq(apps.filter((a) => a.status === 'bench'));

    // 순번(번호)은 표시 위치와 무관하게 '신청 순(seq)'으로 매긴다.
    // → 클래스 가나다순으로 배치돼도 D4가 앞에, D1이 뒤에 올 수 있음.
    const activeRank = {};
    const rankRole = (list, letter) => {
      [...list]
        .sort((a, b) => (a.seq || 0) - (b.seq || 0))
        .forEach((a, i) => { activeRank[a.id] = `${letter}${i + 1}`; });
    };
    rankRole(tanks, 'T');
    rankRole(healers, 'H');
    rankRole(dps, 'D');

    // 딜러를 근딜/원딜로 분리 (정렬·순번은 그대로 유지)
    const meleeDps = dps.filter((a) => !isRangedDps(gamedata.classes, a));
    const rangedDps = dps.filter((a) => isRangedDps(gamedata.classes, a));

    return {
      tanks,
      healers,
      dps,
      meleeDps,
      rangedDps,
      waitTanks,
      waitHealers,
      waitDps,
      bench,
      activeRank,
      counts: { tank: tanks.length, healer: healers.length, dps: dps.length },
    };
  }, [apps, gamedata]);

  const canEdit = useCanEdit(raid, profile, isAdmin, isSuper, adminMode);

  const copyInvite = async () => {
    const active = [...derived.tanks, ...derived.healers, ...derived.dps];
    if (active.length === 0) return;
    const text = active.map((a) => `${a.charName}-${a.server}`).join(';');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available — silently ignore
    }
  };

  if (raidMissing) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="text-center py-24 text-base-400">
          <p>존재하지 않는 레이드입니다.</p>
          <Link to="/" className="text-indigo-400 hover:underline mt-2 inline-block">
            메인으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  if (!raid) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="text-center py-24 text-base-400 animate-pulse">불러오는 중...</div>
      </div>
    );
  }

  const ended = raid.endAt.toMillis() < Date.now();
  if (ended) {
    return (
      <div className="min-h-screen">
        <Header />
        <div className="text-center py-24 text-base-400">
          <p>종료된 레이드입니다.</p>
          <Link to="/" className="text-indigo-400 hover:underline mt-2 inline-block">
            메인으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const diff = DIFFICULTIES[raid.difficulty] || DIFFICULTIES.normal;
  const caps = getCaps(raid);
  const myApp = apps.find((a) => a.id === userId);

  const renderCards = (list, rankFn) =>
    list.map((app) => (
      <div
        key={app.id}
        style={{ flexBasis: 'calc(25% - 4.5px)', flexShrink: 0, minWidth: 0 }}
      >
        <ApplicantCard
          app={app}
          rank={rankFn(app)}
          memo={adminView ? memos[app.id] : undefined}
          adminView={adminView}
          onAdminClick={setAdminTarget}
          borderColor={app.classColor}
        />
      </div>
    ));

  // 목록형 행 리스트 (모바일·데스크탑 리스트뷰 공용)
  const renderList = (list, rankFn) =>
    list.map((app) => (
      <RosterListRow
        key={app.id}
        app={app}
        rank={rankFn(app)}
        memo={adminView ? memos[app.id] : undefined}
        adminView={adminView}
        onAdminClick={setAdminTarget}
      />
    ));

  // 대기자/벤치는 한 줄에 2명 (절반 폭)
  const renderCards2 = (list, rankFn) =>
    list.map((app) => (
      <div key={app.id} style={{ flexBasis: 'calc(50% - 3px)', flexShrink: 0, minWidth: 0 }}>
        <ApplicantCard
          app={app}
          rank={rankFn(app)}
          memo={adminView ? memos[app.id] : undefined}
          adminView={adminView}
          onAdminClick={setAdminTarget}
        />
      </div>
    ));

  // 벤치 카드 (여러 캐릭 표시용 전용 카드)
  const renderBenchCards = (list) =>
    list.map((app) => (
      <div key={app.id} style={{ flexBasis: 'calc(50% - 3px)', flexShrink: 0, minWidth: 0 }}>
        <BenchCard
          app={app}
          memo={adminView ? memos[app.id] : undefined}
          adminView={adminView}
          onAdminClick={setAdminTarget}
          highlight={app.id === userId}
        />
      </div>
    ));

  // 로스터 섹션 렌더 — 데스크탑은 카드/리스트 토글, 모바일은 항상 리스트.
  // cols: 데스크탑 리스트뷰 열 수 (탱힐딜=2, 대기/벤치=1), cardRender: 카드뷰 렌더러
  const renderRoster = (list, rankFn, cols = 2, cardRender = renderCards) => (
    <>
      {rosterView === 'card' ? (
        <div className="hidden sm:flex flex-wrap justify-center gap-1.5">{cardRender(list, rankFn)}</div>
      ) : (
        <div className={`hidden sm:grid gap-1.5 ${cols === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {renderList(list, rankFn)}
        </div>
      )}
      <div className="sm:hidden space-y-1.5">
        {list.length ? renderList(list, rankFn) : <p className="text-xs text-base-600 text-center py-2">없음</p>}
      </div>
    </>
  );

  const waitTotal = derived.waitTanks.length + derived.waitHealers.length + derived.waitDps.length;

  // 내 신청 순번 (참가확정: T/H/D번호, 대기: 대기번호)
  let myRank = null;
  if (myApp) {
    if (myApp.status === 'active') {
      myRank = derived.activeRank[myApp.id] || null;
    } else if (myApp.status === 'wait') {
      const list = myApp.role === 'tank' ? derived.waitTanks : myApp.role === 'healer' ? derived.waitHealers : derived.waitDps;
      myRank = list.findIndex((a) => a.id === myApp.id) + 1;
    }
  }

  const waitGroups = [
    ['탱커 대기', derived.waitTanks],
    ['힐러 대기', derived.waitHealers],
    ['딜러 대기', derived.waitDps],
  ];

  return (
    <div className="min-h-screen pb-20">
      <Header />
      <main className="max-w-6xl mx-auto px-4 mt-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-base-400 hover:text-base-200 transition mb-4"
        >
          ← 메인으로
        </Link>

        {/* ── Raid header ── */}
        <div className="card relative overflow-hidden p-5" style={{ backgroundColor: diff.soft }}>
          <span className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: diff.color }} />
          <div className="pl-2">
            {/* 레이드 수정 / 구성원 초대 / 시뮬레이션 — 우측 상단 절대배치 */}
            {canEdit && (
              <div className="absolute top-4 right-4 z-10 flex flex-col gap-2 items-end">
                <button
                  type="button"
                  onClick={() => setRaidEditOpen(true)}
                  className="text-sm px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold border border-indigo-400/50 shadow-md transition whitespace-nowrap"
                >
                  레이드 수정
                </button>
                <button
                  type="button"
                  onClick={copyInvite}
                  className="text-sm px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold border border-emerald-400/50 shadow-md transition whitespace-nowrap"
                >
                  {copied ? '복사됨 ✓' : '구성원 초대'}
                </button>
                <button
                  type="button"
                  onClick={() => setSimOpen(true)}
                  className="text-sm px-4 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-bold border border-violet-400/60 shadow-md ring-1 ring-violet-400/30 transition whitespace-nowrap"
                >
                  🧩 시뮬레이션
                </button>
              </div>
            )}
            <h1 className={`text-2xl font-black leading-tight break-keep ${canEdit ? 'pr-24 sm:pr-28' : ''}`}>
              {raid.title || `${diff.label} 공격대`}
            </h1>

            <div className="mt-2 flex items-center gap-2.5 flex-wrap">
              <span
                className="text-sm font-bold px-2.5 py-1 rounded-lg shrink-0"
                style={{ color: diff.color, backgroundColor: `${diff.color}22` }}
              >
                {diff.label}
              </span>
              <span className="text-xl sm:text-2xl font-bold text-white">
                {formatDateLabel(raid.dateKey)}
              </span>
              <span className="text-lg font-semibold text-base-200">
                {formatTimeRange(raid.startAt.toDate(), raid.endAt.toDate())}
              </span>
            </div>

            <div className="mt-3 pt-3 border-t border-base-700/60 flex flex-wrap gap-x-5 gap-y-1 text-sm text-base-300">
              <span>
                공격대장 : <b className="text-base-100">{raid.leader}</b>
              </span>
              <span>
                최소 아이템레벨 :{' '}
                <b className="text-base-100">{raid.minIlvl == null ? '제한없음' : raid.minIlvl}</b>
              </span>
              <span className="flex items-center gap-1.5">
                힐러 정원 : <b className="text-base-100">{caps.healer}</b>
                {canEdit && (
                  <span className="inline-flex gap-1 ml-1">
                    <button
                      type="button"
                      className="w-6 h-6 rounded-md bg-base-700 hover:bg-base-600 font-bold transition"
                      onClick={() =>
                        updateRaid(raid.id, { healerCap: Math.max(0, (raid.healerCap ?? caps.healer) - 1) })
                      }
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="w-6 h-6 rounded-md bg-base-700 hover:bg-base-600 font-bold transition"
                      onClick={() =>
                        updateRaid(raid.id, { healerCap: (raid.healerCap ?? caps.healer) + 1 })
                      }
                    >
                      +
                    </button>
                  </span>
                )}
              </span>
              <span className="ml-auto font-semibold">
                총원 :{' '}
                <b className={countFillColor(derived.counts.tank + derived.counts.healer + derived.counts.dps, caps.totalCap)}>
                  {derived.counts.tank + derived.counts.healer + derived.counts.dps}
                </b>
                <span className="text-base-400"> / {caps.totalCap}</span>
              </span>
            </div>

            {raid.description && (
              <p className="mt-3 text-sm text-base-200 whitespace-pre-wrap border-t border-base-700/50 pt-3">
                📢 {raid.description}
              </p>
            )}
          </div>
        </div>

        {/* ── 내 신청 현황 (4행: 상태 / 카드 / 수정 / 취소 — 모두 카드 너비) ── */}
        {myApp ? (
          <div className="mt-8 flex flex-col items-center gap-3">
            {/* 1행: 상태 — 상태색 배경 + 대비 글씨 */}
            {(() => {
              const meta = STATUS_META[myApp.status] || { label: '신청됨', color: '#64748b' };
              return (
                <div
                  className="w-full max-w-[220px] rounded-2xl py-2.5 text-center font-black text-base"
                  style={{ backgroundColor: meta.color, color: readableOn(meta.color) }}
                >
                  {meta.label}
                </div>
              );
            })()}

            {/* 2행: 내 카드 */}
            <div className="w-full max-w-[220px]">
              {myApp.status === 'bench' ? (
                <BenchCard app={myApp} />
              ) : (
                <ApplicantCard
                  app={myApp}
                  rank={myRank}
                  borderColor={myApp.status === 'active' ? myApp.classColor : undefined}
                />
              )}
            </div>

            {/* 3행: 신청 정보 수정 (노랑) */}
            <button
              type="button"
              className="w-full max-w-[220px] py-1 text-sm rounded-xl font-bold transition hover:brightness-110"
              style={{ backgroundColor: '#eab308', color: '#0b0e13' }}
              onClick={() => { setEditApply(true); setApplyOpen(true); }}
            >
              신청 정보 수정
            </button>

            {/* 4행: 신청 취소 (빨강) */}
            <button
              type="button"
              className="w-full max-w-[220px] btn-danger py-1 text-sm"
              onClick={() => setCancelConfirm(true)}
            >
              신청 취소
            </button>
          </div>
        ) : (
          <div className="mt-8">
            <button
              type="button"
              className="btn-primary w-full py-3.5 text-base"
              onClick={() => { setEditApply(false); setApplyOpen(true); }}
            >
              파티 참가 신청하기
            </button>
          </div>
        )}

        {/* ── 길드 마스터 전용: 내 길드원 직접 추가 (관리자 모드 ON, 연합/자기 길드 레이드만) ── */}
        {profile?.isGuildMaster && adminMode &&
          (!raid.partyType || raid.partyType === 'union' || raid.partyType === profile.guildId) && (
          <div className="mt-8 flex justify-end">
            <button
              type="button"
              onClick={() => setMemberAddOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-sm font-semibold transition"
            >
              👑 길드원 추가
            </button>
          </div>
        )}

        {/* ── 뷰 토글 (데스크탑 전용, 모바일은 항상 리스트) ── */}
        <div className="hidden sm:flex justify-end mt-8">
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-base-850 border border-base-700">
            <button
              type="button"
              onClick={() => setRosterViewPersist('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${rosterView === 'list' ? 'bg-base-700 text-white' : 'text-base-400 hover:text-base-200'}`}
            >
              목록형
            </button>
            <button
              type="button"
              onClick={() => setRosterViewPersist('card')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${rosterView === 'card' ? 'bg-base-700 text-white' : 'text-base-400 hover:text-base-200'}`}
            >
              카드형
            </button>
          </div>
        </div>

        {/* ── Roster (primary) ── */}
        <div className="mt-4 sm:mt-3 space-y-4">
          <div className="card p-3">
            <SectionHeader
              label="탱커"
              role="tank"
              count={derived.counts.tank}
              cap={caps.tank}
              adminMode={adminView}
              onAdd={() => setReserveRole('tank')}
            />
            {renderRoster(derived.tanks, (a) => derived.activeRank[a.id])}
          </div>

          <div className="card p-3">
            <SectionHeader
              label="힐러"
              role="healer"
              count={derived.counts.healer}
              cap={caps.healer}
              adminMode={adminView}
              onAdd={() => setReserveRole('healer')}
            />
            {renderRoster(derived.healers, (a) => derived.activeRank[a.id])}
          </div>

          <div className="card p-3">
            <SectionHeader
              label="딜러"
              role="dps"
              count={derived.counts.dps}
              cap={caps.dps}
              adminMode={adminView}
              onAdd={() => setReserveRole('dps')}
            />

            {/* 근딜 */}
            <div className="mb-1">
              <p className="text-xs font-bold text-base-400 mb-1.5">
                근딜 <span className="text-base-300">{derived.meleeDps.length}</span>
              </p>
              {renderRoster(derived.meleeDps, (a) => derived.activeRank[a.id])}
            </div>

            {/* 원딜 */}
            <div className="mt-3 pt-3 border-t border-base-700/60">
              <p className="text-xs font-bold text-base-400 mb-1.5">
                원딜 <span className="text-base-300">{derived.rangedDps.length}</span>
              </p>
              {renderRoster(derived.rangedDps, (a) => derived.activeRank[a.id])}
            </div>
          </div>

          {/* Secondary panels */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <SynergyBoard apps={apps} totalCap={caps.totalCap} />
            <SwapList apps={apps} />
          </div>

          {/* 대기자 + 벤치 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* 대기자 */}
            <div className="card p-3">
              <p className="font-bold text-sm mb-2">
                <span style={{ color: '#f59e0b' }}>대기자</span>{' '}
                <span className="text-white">{waitTotal}</span>
              </p>
              {waitTotal === 0 ? (
                <p className="text-sm text-base-400 text-center py-2">대기자가 없습니다.</p>
              ) : (
                <div className="space-y-3">
                  {waitGroups.map(([label, list]) =>
                    list.length === 0 ? null : (
                      <div key={label}>
                        <p className="text-xs font-semibold text-base-400 mb-1.5">{label}</p>
                        {renderRoster(list, (a) => list.indexOf(a) + 1, 1, renderCards2)}
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {/* 벤치 */}
            <div className="card p-3">
              <p className="font-bold text-sm mb-2">
                <span style={{ color: '#a3e635' }}>벤치</span>{' '}
                <span className="text-white">{derived.bench.length}</span>
              </p>
              {derived.bench.length === 0 ? (
                <p className="text-sm text-base-400 text-center py-2">벤치 인원이 없습니다.</p>
              ) : (
                renderRoster(derived.bench, () => null, 1, renderBenchCards)
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ── Modals ── */}
      <ApplyModal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        raid={raid}
        apps={apps}
        existingApp={editApply ? myApp : null}
      />
      <ReservationModal
        open={!!reserveRole}
        onClose={() => setReserveRole(null)}
        raid={raid}
        role={reserveRole || 'dps'}
      />
      <AdminAppEditModal
        open={!!adminTarget}
        onClose={() => setAdminTarget(null)}
        raid={raid}
        app={adminTarget}
      />
      <AdminMemberAddModal
        open={memberAddOpen}
        onClose={() => setMemberAddOpen(false)}
        raid={raid}
        apps={apps}
      />
      <SimulationModal
        open={simOpen}
        onClose={() => setSimOpen(false)}
        raid={raid}
        apps={apps}
      />
      <RaidFormModal
        open={raidEditOpen}
        onClose={() => setRaidEditOpen(false)}
        raid={raid}
        applicants={apps}
      />
      <Modal open={cancelConfirm} onClose={() => setCancelConfirm(false)} maxWidth="max-w-sm">
        <div className="text-center py-2 space-y-4">
          <p className="font-semibold">신청을 취소할까요?</p>
          <p className="text-sm text-base-400">재신청 시 최후순위로 배정됩니다.</p>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost flex-1" onClick={() => setCancelConfirm(false)}>
              돌아가기
            </button>
            <button
              type="button"
              className="btn-danger flex-1"
              onClick={async () => {
                try {
                  await cancelApplication(raid.id, userId);
                  toast('신청이 취소되었습니다');
                } catch {
                  toast('취소에 실패했습니다', 'error');
                }
                setCancelConfirm(false);
              }}
            >
              신청 취소
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

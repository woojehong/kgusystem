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
} from '../lib/utils';
import { updateRaid, fetchAllMemos, cancelApplication } from '../lib/db';
import Header from '../components/Header';
import SynergyBoard from '../components/SynergyBoard';
import SwapList from '../components/SwapList';
import ApplicantCard from '../components/ApplicantCard';
import BenchCard from '../components/BenchCard';
import { useToast } from '../components/Toast';
import ApplyModal from '../components/ApplyModal';
import ReservationModal from '../components/ReservationModal';
import AdminAppEditModal from '../components/AdminAppEditModal';
import RaidFormModal from '../components/RaidFormModal';
import Modal from '../components/Modal';

function sortBySeq(list) {
  return [...list].sort((a, b) => (a.seq || 0) - (b.seq || 0));
}

const ROLE_COLORS = { tank: '#38bdf8', healer: '#34d399', dps: '#fb7185' };

const STATUS_META = {
  active: { label: '참가 확정', color: '#34d399' },
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
  const { userId, isAdmin, isSuper, adminMode, profile } = useApp();
  const toast = useToast();
  const adminView = isAdmin && adminMode;

  const [raid, setRaid] = useState(null);
  const [raidMissing, setRaidMissing] = useState(false);
  const [apps, setApps] = useState([]);
  const [memos, setMemos] = useState({});
  const [applyOpen, setApplyOpen] = useState(false);
  const [editApply, setEditApply] = useState(false);
  const [reserveRole, setReserveRole] = useState(null);
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

    const tanks = sortBySeq(actives.filter((a) => a.role === 'tank'));
    const healers = sortBySeq(actives.filter((a) => a.role === 'healer'));
    const dps = sortBySeq(actives.filter((a) => a.role === 'dps'));

    const waitTanks = sortBySeq(waits.filter((a) => a.role === 'tank'));
    const waitHealers = sortBySeq(waits.filter((a) => a.role === 'healer'));
    const waitDps = sortBySeq(waits.filter((a) => a.role === 'dps'));

    const bench = sortBySeq(apps.filter((a) => a.status === 'bench'));

    return {
      tanks,
      healers,
      dps,
      waitTanks,
      waitHealers,
      waitDps,
      bench,
      counts: { tank: tanks.length, healer: healers.length, dps: dps.length },
    };
  }, [apps]);

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
          highlight={app.id === userId}
        />
      </div>
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
          highlight={app.id === userId}
        />
      </div>
    ));

  const waitTotal = derived.waitTanks.length + derived.waitHealers.length + derived.waitDps.length;

  // 내 신청 순번 (참가확정: T/H/D번호, 대기: 대기번호)
  let myRank = null;
  if (myApp) {
    if (myApp.status === 'active') {
      const letter = myApp.role === 'tank' ? 'T' : myApp.role === 'healer' ? 'H' : 'D';
      const list = myApp.role === 'tank' ? derived.tanks : myApp.role === 'healer' ? derived.healers : derived.dps;
      myRank = `${letter}${list.findIndex((a) => a.id === myApp.id) + 1}`;
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
            <div className="flex items-start gap-2">
              <h1 className="text-2xl font-black leading-tight break-keep">
                {raid.title || `${diff.label} 공격대`}
              </h1>

              {/* Edit + invite buttons (canEdit only) */}
              {canEdit && (
                <div className="ml-auto shrink-0 flex flex-col gap-2 items-end">
                  <button
                    type="button"
                    onClick={() => setRaidEditOpen(true)}
                    className="text-sm px-4 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-bold border-2 border-indigo-300 shadow-lg transition whitespace-nowrap"
                  >
                    레이드 수정
                  </button>
                  <button
                    type="button"
                    onClick={copyInvite}
                    className={`text-sm px-4 py-1.5 rounded-lg font-bold border-2 shadow-lg transition whitespace-nowrap ${
                      copied
                        ? 'bg-green-500 text-white border-green-300'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-white border-emerald-300'
                    }`}
                  >
                    {copied ? '복사됨 ✓' : '구성원 초대'}
                  </button>
                </div>
              )}
            </div>

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
            </div>

            {raid.description && (
              <p className="mt-3 text-sm text-base-200 whitespace-pre-wrap border-t border-base-700/50 pt-3">
                📢 {raid.description}
              </p>
            )}
          </div>
        </div>

        {/* ── 내 신청 현황 ── */}
        {myApp ? (
          <div className="mt-4 space-y-3">
            {/* 상태 칸 (가운데) */}
            <div className="card py-2.5 text-center">
              <span
                className="font-black text-base text-outline"
                style={{ color: STATUS_META[myApp.status]?.color || '#cbd5e1' }}
              >
                {STATUS_META[myApp.status]?.label || '신청됨'}
              </span>
            </div>
            {/* 내 카드 (명단과 동일) */}
            <div className="max-w-[220px] mx-auto">
              {myApp.status === 'bench' ? (
                <BenchCard app={myApp} highlight />
              ) : (
                <ApplicantCard app={myApp} rank={myRank} highlight />
              )}
            </div>
            {/* 수정 / 취소 */}
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-ghost flex-1"
                onClick={() => { setEditApply(true); setApplyOpen(true); }}
              >
                신청 정보 수정
              </button>
              <button type="button" className="btn-danger flex-1" onClick={() => setCancelConfirm(true)}>
                신청 취소
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <button
              type="button"
              className="btn-primary w-full py-3.5 text-base"
              onClick={() => { setEditApply(false); setApplyOpen(true); }}
            >
              파티 참가 신청하기
            </button>
          </div>
        )}

        {/* ── Roster (primary) ── */}
        <div className="mt-5 space-y-4">
          <div className="card p-3">
            <SectionHeader
              label="탱커"
              role="tank"
              count={derived.counts.tank}
              cap={caps.tank}
              adminMode={adminView}
              onAdd={() => setReserveRole('tank')}
            />
            <div className="flex flex-wrap justify-center gap-1.5">
              {renderCards(derived.tanks, (a) => `T${derived.tanks.indexOf(a) + 1}`)}
            </div>
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
            <div className="flex flex-wrap justify-center gap-1.5">
              {renderCards(derived.healers, (a) => `H${derived.healers.indexOf(a) + 1}`)}
            </div>
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
            <div className="flex flex-wrap justify-center gap-1.5">
              {renderCards(derived.dps, (a) => `D${derived.dps.indexOf(a) + 1}`)}
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
              <p className="font-bold text-sm mb-2 flex items-center justify-between">
                <span style={{ color: '#f59e0b' }}>대기자</span>
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
                        <div className="flex flex-wrap justify-center gap-1.5">
                          {renderCards2(list, (a) => list.indexOf(a) + 1)}
                        </div>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>

            {/* 벤치 */}
            <div className="card p-3">
              <p className="font-bold text-sm mb-2 flex items-center justify-between">
                <span style={{ color: '#a3e635' }}>벤치</span>
                <span className="text-white">{derived.bench.length}</span>
              </p>
              {derived.bench.length === 0 ? (
                <p className="text-sm text-base-400 text-center py-2">벤치 인원이 없습니다.</p>
              ) : (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {derived.bench.map((app) => (
                    <div key={app.id} style={{ flexBasis: 'calc(50% - 3px)', flexShrink: 0, minWidth: 0 }}>
                      <BenchCard
                        app={app}
                        memo={adminView ? memos[app.id] : undefined}
                        adminView={adminView}
                        onAdminClick={setAdminTarget}
                        highlight={app.id === userId}
                      />
                    </div>
                  ))}
                </div>
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

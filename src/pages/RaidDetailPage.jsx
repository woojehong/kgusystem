import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useApp } from '../context/AppContext';
import { DIFFICULTIES, RANGES } from '../lib/constants';
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
import ApplyModal from '../components/ApplyModal';
import ReservationModal from '../components/ReservationModal';
import AdminAppEditModal from '../components/AdminAppEditModal';
import RaidFormModal from '../components/RaidFormModal';
import Modal from '../components/Modal';

function sortBySeq(list) {
  return [...list].sort((a, b) => (a.seq || 0) - (b.seq || 0));
}

function SectionHeader({ label, count, cap, adminMode, onAdd }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <p className="font-bold text-sm">
        {label} <span className={countFillColor(count, cap)}>{count}/{cap}</span>
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

export default function RaidDetailPage() {
  const { raidId } = useParams();
  const { userId, isAdmin, adminMode } = useApp();
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
    const dpsAll = sortBySeq(actives.filter((a) => a.role === 'dps'));
    const dpsMelee = dpsAll.filter((a) => a.range === 'melee');
    const dpsRanged = dpsAll.filter((a) => a.range === 'ranged');
    const dpsUndecided = dpsAll.filter((a) => a.range == null);

    const dpsRank = new Map(dpsAll.map((a, i) => [a.id, i + 1]));

    const waitTanks = sortBySeq(waits.filter((a) => a.role === 'tank'));
    const waitHealers = sortBySeq(waits.filter((a) => a.role === 'healer'));
    const waitDps = sortBySeq(waits.filter((a) => a.role === 'dps'));

    return {
      tanks,
      healers,
      dpsAll,
      dpsMelee,
      dpsRanged,
      dpsUndecided,
      dpsRank,
      waitTanks,
      waitHealers,
      waitDps,
      counts: { tank: tanks.length, healer: healers.length, dps: dpsAll.length },
    };
  }, [apps]);

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
      <ApplicantCard
        key={app.id}
        app={app}
        rank={rankFn(app)}
        memo={adminView ? memos[app.id] : undefined}
        adminView={adminView}
        onAdminClick={setAdminTarget}
        highlight={app.id === userId}
      />
    ));

  const waitGroups = [
    ['탱커 대기', derived.waitTanks],
    ['힐러 대기', derived.waitHealers],
    ['딜러 대기', derived.waitDps],
  ];

  return (
    <div className="min-h-screen pb-20">
      <Header />
      <main className="max-w-6xl mx-auto px-4 mt-6">
        {/* ── Raid header ── */}
        <div className="card relative overflow-hidden p-5" style={{ backgroundColor: diff.soft }}>
          <span className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: diff.color }} />
          <div className="flex flex-wrap items-center gap-2 pl-2">
            <span
              className="text-sm font-bold px-2.5 py-1 rounded-lg"
              style={{ color: diff.color, backgroundColor: `${diff.color}22` }}
            >
              {diff.label}
            </span>
            <h1 className="text-xl font-bold">
              {formatDateLabel(raid.dateKey)} {formatTimeRange(raid.startAt.toDate(), raid.endAt.toDate())}
            </h1>
            {adminView && (
              <button
                type="button"
                onClick={() => setRaidEditOpen(true)}
                className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-base-700 hover:bg-base-600 font-semibold transition"
              >
                레이드 수정
              </button>
            )}
          </div>
          <div className="pl-2 mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-base-300">
            <span>
              공대장 <b className="text-base-100">{raid.leader}</b>
            </span>
            <span>
              최소 아이템레벨{' '}
              <b className="text-base-100">{raid.minIlvl == null ? '제한없음' : raid.minIlvl}</b>
            </span>
            <span className="flex items-center gap-1.5">
              힐러 정원 <b className="text-base-100">{caps.healer}</b>
              {adminView && (
                <span className="inline-flex gap-1 ml-1">
                  <button
                    type="button"
                    className="w-6 h-6 rounded-md bg-base-700 hover:bg-base-600 font-bold transition"
                    onClick={() => updateRaid(raid.id, { healerCap: Math.max(0, raid.healerCap - 1) })}
                  >
                    −
                  </button>
                  <button
                    type="button"
                    className="w-6 h-6 rounded-md bg-base-700 hover:bg-base-600 font-bold transition"
                    onClick={() => updateRaid(raid.id, { healerCap: raid.healerCap + 1 })}
                  >
                    +
                  </button>
                </span>
              )}
            </span>
          </div>
          {raid.description && (
            <p className="pl-2 mt-3 text-sm text-base-200 whitespace-pre-wrap border-t border-base-700/50 pt-3">
              📢 {raid.description}
            </p>
          )}
        </div>

        {/* ── Apply actions ── */}
        <div className="mt-4 flex gap-2">
          {myApp ? (
            <>
              <div className="flex-1 card px-4 py-3 flex items-center gap-2 text-sm">
                <span
                  className={`font-bold ${myApp.status === 'active' ? 'text-green-400' : 'text-amber-400'}`}
                >
                  {myApp.status === 'active' ? '참가 확정' : '대기 중'}
                </span>
                <span className="text-base-300 truncate">
                  {myApp.charName} · {myApp.specName}
                </span>
              </div>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setEditApply(true);
                  setApplyOpen(true);
                }}
              >
                신청 정보 수정
              </button>
              <button type="button" className="btn-danger" onClick={() => setCancelConfirm(true)}>
                신청 취소
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn-primary w-full py-3.5 text-base"
              onClick={() => {
                setEditApply(false);
                setApplyOpen(true);
              }}
            >
              파티 참가 신청하기
            </button>
          )}
        </div>

        {/* ── Body: positions / synergy / swap / waitlist ── */}
        <div className="mt-5 flex flex-col gap-4">
          <div className="order-2 sm:order-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SynergyBoard apps={apps} />
            <SwapList apps={apps} />
          </div>

          <div className="order-1 sm:order-2 space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="card p-3">
                <SectionHeader
                  label="탱커"
                  count={derived.counts.tank}
                  cap={caps.tank}
                  adminMode={adminView}
                  onAdd={() => setReserveRole('tank')}
                />
                <div className="space-y-1.5">
                  {renderCards(derived.tanks, (a) => derived.tanks.indexOf(a) + 1)}
                </div>
              </div>
              <div className="card p-3">
                <SectionHeader
                  label="힐러"
                  count={derived.counts.healer}
                  cap={caps.healer}
                  adminMode={adminView}
                  onAdd={() => setReserveRole('healer')}
                />
                <div className="space-y-1.5">
                  {renderCards(derived.healers, (a) => derived.healers.indexOf(a) + 1)}
                </div>
              </div>
            </div>

            <div className="card p-3">
              <SectionHeader
                label="딜러"
                count={derived.counts.dps}
                cap={caps.dps}
                adminMode={adminView}
                onAdd={() => setReserveRole('dps')}
              />
              <div className="grid grid-cols-2 gap-3">
                {[
                  [RANGES.melee.label, derived.dpsMelee],
                  [RANGES.ranged.label, derived.dpsRanged],
                ].map(([label, list]) => (
                  <div key={label}>
                    <p className="text-xs font-semibold text-base-400 mb-1.5">{label}</p>
                    <div className="space-y-1.5">
                      {renderCards(list, (a) => derived.dpsRank.get(a.id))}
                    </div>
                  </div>
                ))}
              </div>
              {derived.dpsUndecided.length > 0 && (
                <div className="mt-3 pt-3 border-t border-base-700">
                  <p className="text-xs font-semibold text-base-400 mb-1.5">칼럼 미정 (예약)</p>
                  <div className="space-y-1.5">
                    {renderCards(derived.dpsUndecided, (a) => derived.dpsRank.get(a.id))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="order-3 card p-3 sm:max-w-2xl sm:mx-auto sm:w-full">
            <p className="font-bold text-sm mb-2 text-center">대기 목록</p>
            {waitGroups.every(([, list]) => list.length === 0) ? (
              <p className="text-sm text-base-400 text-center py-2">대기자가 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {waitGroups.map(([label, list]) =>
                  list.length === 0 ? null : (
                    <div key={label}>
                      <p className="text-xs font-semibold text-base-400 mb-1.5">{label}</p>
                      <div className="space-y-1.5">
                        {renderCards(list, (a) => list.indexOf(a) + 1)}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
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
                await cancelApplication(raid.id, userId).catch(() => {});
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

const { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();

// ── 디스코드 봇 (Interactions 엔드포인트 + 명령어 등록) ──
Object.assign(exports, require('./discord-bot'));

const WEBHOOK_ANNOUNCE = defineSecret('DISCORD_WEBHOOK_ANNOUNCE');
const WEBHOOK_NOTIFY   = defineSecret('DISCORD_WEBHOOK_NOTIFY');

const SITE_URL   = 'https://wowkorea.site';
const ROLE_LABEL = { tank: '🛡 탱커', healer: '💚 힐러', dps: '⚔️ 딜러' };
const ROLE_COLOR = { tank: 0x38bdf8, healer: 0x34d399, dps: 0xfb7185 };
const FOOTER     = '한길련 레이드 시스템 · 제목 클릭 → 사이트 바로가기';

async function sendEmbed(webhookUrl, embed) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  });
  if (!res.ok) throw new Error(`Discord webhook error: ${res.status}`);
}

// Difficulty caps mirror the frontend (src/lib/constants.js).
// normal/heroic = 30-person raids, mythic = 20-person raids.
const DIFF_CAPS = {
  normal: { totalCap: 30, defaultHealers: 6 },
  heroic: { totalCap: 30, defaultHealers: 6 },
  mythic: { totalCap: 20, defaultHealers: 4 },
};
const TANK_CAP = 2;

function getCaps(raid) {
  const diff      = DIFF_CAPS[raid.difficulty] || DIFF_CAPS.normal;
  const tankCap   = TANK_CAP;
  const totalCap  = raid.totalCap ?? diff.totalCap;
  const healerCap = raid.healerCap ?? diff.defaultHealers;
  const dpsCap    = Math.max(0, totalCap - tankCap - healerCap);
  return { tankCap, healerCap, dpsCap };
}

async function getRaidCounts(raidId) {
  const snap = await getFirestore().collection('raids').doc(raidId).collection('apps').get();
  const counts = { tank: 0, healer: 0, dps: 0 };
  snap.forEach((d) => {
    const data = d.data();
    if (data.status === 'active' && counts[data.role] !== undefined) counts[data.role]++;
  });
  return counts;
}

async function getRaid(raidId) {
  const snap = await getFirestore().collection('raids').doc(raidId).get();
  return snap.exists ? snap.data() : null;
}

function formatDate(dateKey) {
  if (!dateKey) return '';
  // Accept both 'YYYY-MM-DD' (current storage format) and 'YYYYMMDD'.
  const m = String(dateKey).match(/^(\d{4})\D?(\d{2})\D?(\d{2})$/);
  return m ? `${m[1]}년 ${m[2]}월 ${m[3]}일` : String(dateKey);
}

// ── 공통 포맷 헬퍼 ───────────────────────────────────────────────
const DIFF_LABEL       = { normal: '일반', heroic: '영웅', mythic: '신화' };
const ROLE_KO          = { tank: '탱커', healer: '힐러', dps: '딜러' };
const ROLE_ICON        = { tank: '🛡', healer: '💚', dps: '⚔️' };
const ROLE_SWAP_PREFIX = { tank: '탱', healer: '힐', dps: '딜' };
const STATUS_LABEL     = { active: '확정', wait: '대기', bench: '벤치' };

// 알림은 연합 레이드(partyType 'union' 또는 미지정)에만 발송한다.
function isUnionRaid(raid) {
  return !!raid && (!raid.partyType || raid.partyType === 'union');
}

// 레이드 상세 페이지 (HashRouter).
function raidUrl(raidId) {
  return `${SITE_URL}/#/raid/${raidId}`;
}

function diffLabel(raid) {
  return DIFF_LABEL[raid.difficulty] || '일반';
}

// "6월 19일(금) 오후 9시" (Asia/Seoul · 분은 0이 아닐 때만 표기).
// 오전/오후는 ICU 로캘 의존을 피하려고 24시간 값에서 직접 계산한다.
function formatWhen(startAt) {
  const d = startAt && startAt.toDate ? startAt.toDate() : new Date(startAt);
  if (!d || isNaN(d.getTime())) return '';
  const dp = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short',
  }).formatToParts(d);
  const g = (t) => (dp.find((p) => p.type === t) || {}).value || '';
  const hp = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const hg = (t) => (hp.find((p) => p.type === t) || {}).value || '';
  const h24 = parseInt(hg('hour'), 10) % 24;
  const min = parseInt(hg('minute'), 10);
  const period = h24 < 12 ? '오전' : '오후';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const time = min === 0 ? `${period} ${h12}시` : `${period} ${h12}시 ${min}분`;
  return `${g('month')}월 ${g('day')}일(${g('weekday')}) ${time}`;
}

// "연합 길드 레이드, 6월 19일(금) 오후 9시, 신화"
function unionHeader(raid) {
  return `연합 길드 레이드, ${formatWhen(raid.startAt)}, ${diffLabel(raid)}`;
}

// 디스코드 동적 타임스탬프 — 보는 사람 시간대 자동 변환 + 상대시간.
// (마스크 링크 `[...](url)` 안에서는 렌더되지 않으므로 반드시 링크 밖 별도 줄에 사용)
function unixSec(startAt) {
  const ms = startAt && startAt.toMillis
    ? startAt.toMillis()
    : startAt && startAt.toDate
    ? startAt.toDate().getTime()
    : new Date(startAt).getTime();
  return ms && !isNaN(ms) ? Math.floor(ms / 1000) : null;
}
function dtFull(startAt) {
  const s = unixSec(startAt);
  return s ? `<t:${s}:F> · <t:${s}:R>` : formatWhen(startAt);
}

function hexToInt(hex, fallback) {
  if (!hex) return fallback;
  const n = parseInt(String(hex).replace('#', ''), 16);
  return Number.isFinite(n) ? n : fallback;
}

// 공지 채널: 헤더 줄 + 레이드 제목 줄(둘 다 크게·링크) → 공격대장 → 탱/힐/딜.
function noticeEmbed({ headWord, raid, raidId, color, counts }) {
  const url = raidUrl(raidId);
  const { tankCap, healerCap, dpsCap } = getCaps(raid);
  const c = counts || { tank: 0, healer: 0, dps: 0 };
  return {
    color,
    description:
      `## [${headWord}: ${unionHeader(raid)}](${url})\n` +
      `## [${raid.title || '공격대'}](${url})\n` +
      `📅 ${dtFull(raid.startAt)}\n\n` +
      `공격대장: ${raid.leader || '미정'}`,
    fields: [
      { name: '🛡 탱커', value: `${c.tank} / ${tankCap}`, inline: true },
      { name: '💚 힐러', value: `${c.healer} / ${healerCap}`, inline: true },
      { name: '⚔️ 딜러', value: `${c.dps} / ${dpsCap}`, inline: true },
    ],
  };
}

// 알림 채널: (역할아이콘) 캐릭터명 + 동작 제목(크게·링크) → 캐릭터-서버 → 역할/스왑/특성·클래스/아이템레벨.
function appEmbed({ verb, raid, raidId, app }) {
  const url  = raidUrl(raidId);
  const role = app.role || 'dps';
  const icon = ROLE_ICON[role] || '';
  const swap = (app.swap && Array.isArray(app.swapRoles) && app.swapRoles.length)
    ? `${app.swapRoles.map((r) => ROLE_SWAP_PREFIX[r] || r).join('/')}스왑 가능, `
    : '';
  const specClass = [app.specName, app.className].filter(Boolean).join(' ');
  return {
    color: hexToInt(app.classColor, 0x6366f1),
    description:
      `## [${icon} ${app.charName || '?'} ${verb}: ${unionHeader(raid)}](${url})\n\n` +
      `${app.charName || '?'} - ${app.server || ''}\n` +
      `${ROLE_KO[role] || role}, ${swap}${specClass}, 아이템 레벨 ${app.ilvl ?? '-'}`,
  };
}

// ── 채널 1(공지): 레이드 삭제 — 일정 취소 (소프트 삭제 감지) ──────
exports.notifyRaidDeleted = onDocumentUpdated(
  { document: 'raids/{raidId}', secrets: [WEBHOOK_ANNOUNCE] },
  async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();
    if (before.deleted || !after.deleted) return;
    if (!isUnionRaid(after)) return;

    const counts = await getRaidCounts(event.params.raidId);
    await sendEmbed(WEBHOOK_ANNOUNCE.value(), noticeEmbed({
      headWord: '일정 취소',
      raid: after,
      raidId: event.params.raidId,
      color: 0xef4444,
      counts,
    }));
  }
);

// ── 채널 1(공지): 레이드 생성 — 새로운 일정 ──────────────────────
exports.notifyRaidCreated = onDocumentCreated(
  { document: 'raids/{raidId}', secrets: [WEBHOOK_ANNOUNCE] },
  async (event) => {
    const raid = event.data.data();
    if (raid.deleted || !isUnionRaid(raid)) return;

    await sendEmbed(WEBHOOK_ANNOUNCE.value(), noticeEmbed({
      headWord: '새로운 일정',
      raid,
      raidId: event.params.raidId,
      color: 0x6366f1,
      counts: { tank: 0, healer: 0, dps: 0 },
    }));
  }
);

// ── 채널 2(알림): 신청 + 채널 1(공지): 모두 마감 체크 ─────────────
exports.notifyAppCreated = onDocumentCreated(
  { document: 'raids/{raidId}/apps/{userId}', secrets: [WEBHOOK_ANNOUNCE, WEBHOOK_NOTIFY] },
  async (event) => {
    const app = event.data.data();
    if (app.status === 'bench') return; // 벤치(예비)는 알림 제외
    const { raidId } = event.params;
    const [raid, counts] = await Promise.all([getRaid(raidId), getRaidCounts(raidId)]);
    if (!raid || raid.deleted || !isUnionRaid(raid)) return;

    const role = app.role || 'dps';
    const { tankCap, healerCap, dpsCap } = getCaps(raid);

    // 채널 2: 신청/예약 알림
    await sendEmbed(WEBHOOK_NOTIFY.value(), appEmbed({
      verb: app.isReservation ? '예약 신청' : '참가 신청',
      raid, raidId, app,
    }));

    // 채널 1: 탱/힐/딜 모두 마감되는 "순간"에만 1회 공지 (중복 방지)
    const before = { ...counts };
    if (app.status === 'active' && before[role] !== undefined) before[role] -= 1;
    const fullBefore = before.tank >= tankCap && before.healer >= healerCap && before.dps >= dpsCap;
    const fullAfter  = counts.tank >= tankCap && counts.healer >= healerCap && counts.dps >= dpsCap;
    if (fullAfter && !fullBefore) {
      await sendEmbed(WEBHOOK_ANNOUNCE.value(), noticeEmbed({
        headWord: '인원 마감',
        raid, raidId, color: 0xfbbf24, counts,
      }));
    }
  }
);

// ── 채널 2(알림): 신청 취소 ──────────────────────────────────────
exports.notifyAppDeleted = onDocumentDeleted(
  { document: 'raids/{raidId}/apps/{userId}', secrets: [WEBHOOK_NOTIFY] },
  async (event) => {
    const app = event.data.data();
    if (app.status === 'bench') return; // 벤치(예비)는 알림 제외
    const { raidId } = event.params;
    const raid = await getRaid(raidId);
    if (!raid || raid.deleted || !isUnionRaid(raid)) return;

    await sendEmbed(WEBHOOK_NOTIFY.value(), appEmbed({
      verb: '신청 취소',
      raid, raidId, app,
    }));
  }
);

// ── 채널 2(알림): 상태 전환 (확정/대기/벤치 사이 모든 변경) ────────
exports.notifyAppConfirmed = onDocumentUpdated(
  { document: 'raids/{raidId}/apps/{userId}', secrets: [WEBHOOK_NOTIFY] },
  async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();
    if (!before || !after) return;
    if (before.status === after.status) return;
    const b = STATUS_LABEL[before.status];
    const a = STATUS_LABEL[after.status];
    if (!b || !a) return;

    const { raidId } = event.params;
    const raid = await getRaid(raidId);
    if (!raid || raid.deleted || !isUnionRaid(raid)) return;

    await sendEmbed(WEBHOOK_NOTIFY.value(), appEmbed({
      verb: `${b} → ${a} 전환`,
      raid, raidId, app: after,
    }));
  }
);

// ── 채널 1(공지): 72/48/24/12/6/3/1시간 전 미마감 리마인드 (30분마다) ──
exports.scheduledRaidAlerts = onSchedule(
  { schedule: 'every 30 minutes', timeZone: 'Asia/Seoul', secrets: [WEBHOOK_ANNOUNCE] },
  async () => {
    const db = getFirestore();
    const now = new Date();

    const THRESHOLDS = [72, 48, 24, 12, 6, 3, 1];

    for (const hours of THRESHOLDS) {
      const targetMs  = now.getTime() + hours * 60 * 60 * 1000;
      const windowMin = new Date(targetMs - 15 * 60 * 1000);
      const windowMax = new Date(targetMs + 15 * 60 * 1000);

      const snap = await db
        .collection('raids')
        .where('startAt', '>=', windowMin)
        .where('startAt', '<=', windowMax)
        .get();

      for (const raidDoc of snap.docs) {
        const raid = raidDoc.data();
        if (raid.deleted || !isUnionRaid(raid)) continue;

        const counts = await getRaidCounts(raidDoc.id);
        const { tankCap, healerCap, dpsCap } = getCaps(raid);

        const allFull = counts.tank >= tankCap && counts.healer >= healerCap && counts.dps >= dpsCap;
        if (allFull) continue;

        await sendEmbed(WEBHOOK_ANNOUNCE.value(), noticeEmbed({
          headWord: `${hours}시간 후 출발 파티 인원 부족 알림`,
          raid, raidId: raidDoc.id, color: 0xf59e0b, counts,
        }));
      }
    }
  }
);

// ── 신청 로그 (신청/취소/변경) — 웹훅과 별개로 벤치 포함 모두 기록 ──
async function writeLog(raidId, entry) {
  await getFirestore()
    .collection('raids')
    .doc(raidId)
    .collection('logs')
    .add({ at: FieldValue.serverTimestamp(), ...entry });
}

const STATUS_KO = { active: '확정', wait: '대기', bench: '벤치' };

exports.logAppCreated = onDocumentCreated('raids/{raidId}/apps/{appId}', async (event) => {
  const app = event.data.data();
  if (!app) return;
  const kind = app.isReservation
    ? '예약'
    : app.status === 'bench'
    ? '벤치'
    : app.status === 'wait'
    ? '대기'
    : '신청';
  await writeLog(event.params.raidId, {
    action: 'apply',
    actor: app.nickname || app.charName || '?',
    char: app.charName || '',
    classColor: app.classColor || null,
    guildName: app.guildName || '',
    nickname: app.nickname || '',
    detail: `${kind} 등록${app.specName ? ` (${app.specName})` : ''}`,
  });
});

exports.logAppDeleted = onDocumentDeleted('raids/{raidId}/apps/{appId}', async (event) => {
  const app = event.data.data();
  if (!app) return;
  await writeLog(event.params.raidId, {
    action: 'cancel',
    actor: app.nickname || app.charName || '?',
    char: app.charName || '',
    classColor: app.classColor || null,
    guildName: app.guildName || '',
    nickname: app.nickname || '',
    detail: '신청 취소',
  });
});

exports.logAppUpdated = onDocumentUpdated('raids/{raidId}/apps/{appId}', async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (!before || !after) return;
  const changes = [];
  if (before.status !== after.status) {
    changes.push(`상태 ${STATUS_KO[before.status] || before.status} → ${STATUS_KO[after.status] || after.status}`);
  }
  if (before.role !== after.role) changes.push(`역할 ${before.role || '-'} → ${after.role || '-'}`);
  if (before.specName !== after.specName) changes.push(`특성 ${before.specName || '-'} → ${after.specName || '-'}`);
  if ((before.ilvl ?? null) !== (after.ilvl ?? null)) changes.push(`아이템레벨 ${before.ilvl ?? '-'} → ${after.ilvl ?? '-'}`);
  if (changes.length === 0) return;
  await writeLog(event.params.raidId, {
    action: 'change',
    actor: after.nickname || after.charName || '?',
    char: after.charName || '',
    classColor: after.classColor || null,
    guildName: after.guildName || '',
    nickname: after.nickname || '',
    detail: changes.join(', '),
  });
});

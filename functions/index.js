const { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();

const WEBHOOK_ANNOUNCE = defineSecret('DISCORD_WEBHOOK_ANNOUNCE');
const WEBHOOK_NOTIFY   = defineSecret('DISCORD_WEBHOOK_NOTIFY');

const SITE_URL   = 'https://woojehong.github.io/kgusystem/';
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
  const healerCap = raid.healerCap ?? diff.defaultHealers;
  const dpsCap    = Math.max(0, diff.totalCap - tankCap - healerCap);
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

// ── 채널 1: 레이드 삭제 (소프트 삭제 감지) ──────────────────────
exports.notifyRaidDeleted = onDocumentUpdated(
  { document: 'raids/{raidId}', secrets: [WEBHOOK_ANNOUNCE] },
  async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();
    if (before.deleted || !after.deleted) return;

    await sendEmbed(WEBHOOK_ANNOUNCE.value(), {
      title: `🗑️ 레이드 삭제 — ${after.title || '공격대'}`,
      url: SITE_URL,
      description: `**${after.title || '공격대'}** (${formatDate(after.dateKey)}) 레이드가 삭제됐습니다.`,
      color: 0xef4444,
      fields: [
        { name: '공격대장', value: after.leader || '미정', inline: true },
        { name: '일정', value: formatDate(after.dateKey) || '미정', inline: true },
      ],
      footer: { text: FOOTER },
      timestamp: new Date().toISOString(),
    });
  }
);

// ── 채널 1: 레이드 생성 ──────────────────────────────────────────
exports.notifyRaidCreated = onDocumentCreated(
  { document: 'raids/{raidId}', secrets: [WEBHOOK_ANNOUNCE] },
  async (event) => {
    const raid = event.data.data();
    if (raid.deleted) return;
    const { tankCap, healerCap, dpsCap } = getCaps(raid);

    await sendEmbed(WEBHOOK_ANNOUNCE.value(), {
      title: `⚔️ 새 레이드 등록 — ${raid.title || '공격대'}`,
      url: SITE_URL,
      description: `${formatDate(raid.dateKey)} · 공격대장: **${raid.leader || '미정'}**${raid.minIlvl ? ` · 최소 아이템레벨 **${raid.minIlvl}**` : ''}`,
      color: 0x6366f1,
      fields: [
        { name: '🛡 탱커', value: `0 / ${tankCap}`, inline: true },
        { name: '💚 힐러', value: `0 / ${healerCap}`, inline: true },
        { name: '⚔️ 딜러', value: `0 / ${dpsCap}`, inline: true },
      ],
      footer: { text: FOOTER },
      timestamp: new Date().toISOString(),
    });
  }
);

// ── 채널 2: 신청 알림 + 채널 1: 모두 마감 체크 ─────────────────
exports.notifyAppCreated = onDocumentCreated(
  { document: 'raids/{raidId}/apps/{userId}', secrets: [WEBHOOK_ANNOUNCE, WEBHOOK_NOTIFY] },
  async (event) => {
    const app = event.data.data();
    if (app.status === 'bench') return; // 벤치(예비)는 알림 제외
    const { raidId } = event.params;
    const [raid, counts] = await Promise.all([getRaid(raidId), getRaidCounts(raidId)]);
    if (!raid || raid.deleted) return;

    const role = app.role || 'dps';
    const { tankCap, healerCap, dpsCap } = getCaps(raid);
    const capMap = { tank: tankCap, healer: healerCap, dps: dpsCap };
    const specNames = (app.allSpecNames?.length ? app.allSpecNames : [app.specName]).filter(Boolean).join(' · ');

    // 채널 2: 신청 알림
    await sendEmbed(WEBHOOK_NOTIFY.value(), {
      title: `${app.isReservation ? '📌 예약 신청' : '✅ 신규 신청'} — ${ROLE_LABEL[role] || role}`,
      url: SITE_URL,
      description: `**${app.charName}** — ${app.server || ''}${specNames ? `\n${specNames}` : ''}${app.ilvl ? ` · 아이템레벨 **${app.ilvl}**` : ''}`,
      color: ROLE_COLOR[role] || 0x6366f1,
      fields: [
        { name: '상태', value: app.status === 'active' ? '✅ 참가 확정' : '⏳ 대기 중', inline: true },
        { name: ROLE_LABEL[role], value: `${counts[role]} / ${capMap[role]}`, inline: true },
        { name: '레이드', value: raid.title || '공격대', inline: true },
      ],
      footer: { text: FOOTER },
      timestamp: new Date().toISOString(),
    });

    // 채널 1: 탱/힐/딜 모두 마감 체크.
    // 미마감 → 마감으로 "전환"되는 순간에만 1회 발송한다. (중복 발송 방지)
    // 이번 신청 문서가 확정(active)이면 그 인원을 빼서 직전 상태를 재구성하고,
    // 직전엔 미마감이었는데 지금은 마감이면 그때만 공지한다.
    const before = { ...counts };
    if (app.status === 'active' && before[role] !== undefined) before[role] -= 1;
    const fullBefore = before.tank >= tankCap && before.healer >= healerCap && before.dps >= dpsCap;
    const fullAfter  = counts.tank >= tankCap && counts.healer >= healerCap && counts.dps >= dpsCap;
    if (fullAfter && !fullBefore) {
      await sendEmbed(WEBHOOK_ANNOUNCE.value(), {
        title: `🎉 인원 마감 — ${raid.title || '공격대'}`,
        url: SITE_URL,
        description: `**${raid.title || '공격대'}** (${formatDate(raid.dateKey)}) 탱커·힐러·딜러 모두 마감됐습니다!`,
        color: 0xfbbf24,
        fields: [
          { name: '🛡 탱커', value: `${counts.tank} / ${tankCap} ✓`, inline: true },
          { name: '💚 힐러', value: `${counts.healer} / ${healerCap} ✓`, inline: true },
          { name: '⚔️ 딜러', value: `${counts.dps} / ${dpsCap} ✓`, inline: true },
        ],
        footer: { text: FOOTER },
        timestamp: new Date().toISOString(),
      });
    }
  }
);

// ── 채널 2: 취소 알림 ────────────────────────────────────────────
exports.notifyAppDeleted = onDocumentDeleted(
  { document: 'raids/{raidId}/apps/{userId}', secrets: [WEBHOOK_NOTIFY] },
  async (event) => {
    const app = event.data.data();
    if (app.status === 'bench') return; // 벤치(예비)는 알림 제외
    const { raidId } = event.params;
    const raid = await getRaid(raidId);
    if (!raid || raid.deleted) return;

    await sendEmbed(WEBHOOK_NOTIFY.value(), {
      title: `❌ 신청 취소 — ${ROLE_LABEL[app.role] || app.role}`,
      url: SITE_URL,
      description: `**${app.charName}** — ${app.server || ''} 님이 신청을 취소했습니다.`,
      color: 0x6b7280,
      fields: [
        { name: '레이드', value: raid.title || '공격대', inline: true },
        { name: '역할', value: ROLE_LABEL[app.role] || app.role, inline: true },
      ],
      footer: { text: FOOTER },
      timestamp: new Date().toISOString(),
    });
  }
);

// ── 채널 2: 대기 → 확정 전환 알림 ───────────────────────────────
exports.notifyAppConfirmed = onDocumentUpdated(
  { document: 'raids/{raidId}/apps/{userId}', secrets: [WEBHOOK_NOTIFY] },
  async (event) => {
    const before = event.data.before.data();
    const after  = event.data.after.data();
    if (before.status !== 'wait' || after.status !== 'active') return;

    const { raidId } = event.params;
    const raid = await getRaid(raidId);
    if (!raid || raid.deleted) return;

    await sendEmbed(WEBHOOK_NOTIFY.value(), {
      title: `🆙 대기 → 확정 전환 — ${ROLE_LABEL[after.role] || after.role}`,
      url: SITE_URL,
      description: `**${after.charName}** — ${after.server || ''} 님이 대기에서 참가 확정으로 전환됐습니다.`,
      color: 0xa78bfa,
      fields: [
        { name: '레이드', value: raid.title || '공격대', inline: true },
        { name: '역할', value: ROLE_LABEL[after.role] || after.role, inline: true },
      ],
      footer: { text: FOOTER },
      timestamp: new Date().toISOString(),
    });
  }
);

// ── 채널 2: 72h/48h/24h/12h/6h/3h/1h 전 미마감 알림 (30분마다 실행) ──
exports.scheduledRaidAlerts = onSchedule(
  { schedule: 'every 30 minutes', timeZone: 'Asia/Seoul', secrets: [WEBHOOK_NOTIFY] },
  async () => {
    const db = getFirestore();
    const now = new Date();

    const THRESHOLDS = [
      { hours: 72, label: '72시간' },
      { hours: 48, label: '48시간' },
      { hours: 24, label: '24시간' },
      { hours: 12, label: '12시간' },
      { hours: 6,  label: '6시간'  },
      { hours: 3,  label: '3시간'  },
      { hours: 1,  label: '1시간'  },
    ];

    for (const { hours, label } of THRESHOLDS) {
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
        if (raid.deleted) continue;

        const counts = await getRaidCounts(raidDoc.id);
        const { tankCap, healerCap, dpsCap } = getCaps(raid);

        const allFull = counts.tank >= tankCap && counts.healer >= healerCap && counts.dps >= dpsCap;
        if (allFull) continue;

        const missing = [];
        if (counts.tank   < tankCap)   missing.push(`🛡 탱커 ${tankCap - counts.tank}명`);
        if (counts.healer < healerCap) missing.push(`💚 힐러 ${healerCap - counts.healer}명`);
        if (counts.dps    < dpsCap)    missing.push(`⚔️ 딜러 ${dpsCap - counts.dps}명`);

        await sendEmbed(WEBHOOK_NOTIFY.value(), {
          title: `⏰ 레이드 ${label} 전 — 아직 자리 있어요!`,
          url: SITE_URL,
          description: `**${raid.title || '공격대'}** (${formatDate(raid.dateKey)})\n모집 중: ${missing.join(', ')}`,
          color: 0xf59e0b,
          fields: [
            { name: '🛡 탱커', value: `${counts.tank} / ${tankCap}`, inline: true },
            { name: '💚 힐러', value: `${counts.healer} / ${healerCap}`, inline: true },
            { name: '⚔️ 딜러', value: `${counts.dps} / ${dpsCap}`, inline: true },
          ],
          footer: { text: FOOTER },
          timestamp: new Date().toISOString(),
        });
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
    detail: changes.join(', '),
  });
});

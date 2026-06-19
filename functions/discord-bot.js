// ─────────────────────────────────────────────────────────────────────────
// 한길련 디스코드봇 — Phase 0 뼈대
//  · discordInteractions   : 디스코드가 보내는 모든 상호작용 수신(서명검증 + PING + /핑)
//  · discordRegisterCommands: 슬래시 명령어 등록 (한 번/명령 바뀔 때만 호출, ?key= 가드)
//
// 의존성 추가 없이 Node 내장 crypto로 Ed25519 서명검증.
// ─────────────────────────────────────────────────────────────────────────
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const crypto = require('crypto');

const DISCORD_PUBLIC_KEY = defineSecret('DISCORD_PUBLIC_KEY'); // Portal > General Information > Public Key
const DISCORD_BOT_TOKEN  = defineSecret('DISCORD_BOT_TOKEN');  // Portal > Bot > Reset Token
const DISCORD_APP_ID     = defineSecret('DISCORD_APP_ID');     // Portal > General Information > Application ID
const DISCORD_GUILD_ID   = defineSecret('DISCORD_GUILD_ID');   // 우리 서버 ID (즉시 반영용)
const BOT_REGISTER_KEY   = defineSecret('BOT_REGISTER_KEY');   // 등록 함수 호출 가드 (아무 랜덤 문자열)

// 디스코드 Interaction 타입 / 응답 타입
const TYPE = { PING: 1, APP_COMMAND: 2, MESSAGE_COMPONENT: 3, MODAL_SUBMIT: 5 };
const REPLY = { PONG: 1, MESSAGE: 4, DEFERRED: 5 };
const EPHEMERAL = 1 << 6; // 64 = 본인에게만 보이는 메시지

// Ed25519 raw(32B hex) 공개키 → SPKI DER → KeyObject
function publicKeyFromHex(hex) {
  const der = Buffer.concat([
    Buffer.from('302a300506032b6570032100', 'hex'), // Ed25519 SPKI 헤더(고정)
    Buffer.from(hex, 'hex'),
  ]);
  return crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
}

// 디스코드 요청 서명 검증 (timestamp + rawBody 를 공개키로 검증)
function verifySignature(req, publicKeyHex) {
  const sig = req.get('X-Signature-Ed25519');
  const ts  = req.get('X-Signature-Timestamp');
  if (!sig || !ts || !req.rawBody) return false;
  try {
    const key = publicKeyFromHex(publicKeyHex);
    const msg = Buffer.concat([Buffer.from(ts, 'utf8'), req.rawBody]);
    return crypto.verify(null, msg, key, Buffer.from(sig, 'hex'));
  } catch (e) {
    return false;
  }
}

// ── 레이드 데이터 헬퍼 (웹 src/lib와 동일 규칙) ───────────────────────────
const DIFF_LABEL = { normal: '일반', heroic: '영웅', mythic: '신화' };
const DIFF_CAPS = {
  normal: { totalCap: 30, defaultHealers: 6 },
  heroic: { totalCap: 30, defaultHealers: 6 },
  mythic: { totalCap: 20, defaultHealers: 4 },
};
const TANK_CAP = 2;

function getCaps(raid) {
  const d = DIFF_CAPS[raid.difficulty] || DIFF_CAPS.normal;
  const tankCap = TANK_CAP;
  const healerCap = raid.healerCap ?? d.defaultHealers;
  const dpsCap = Math.max(0, d.totalCap - tankCap - healerCap);
  return { tankCap, healerCap, dpsCap };
}

function isUnionRaid(raid) {
  return !raid.partyType || raid.partyType === 'union';
}

async function getRaidCounts(db, raidId) {
  const snap = await db.collection('raids').doc(raidId).collection('apps').get();
  const c = { tank: 0, healer: 0, dps: 0 };
  snap.forEach((doc) => {
    const a = doc.data();
    if (a.status === 'active' && c[a.role] !== undefined) c[a.role]++;
  });
  return c;
}

// "6월 19일(금) 오후 9시" (Asia/Seoul · 분은 0이 아닐 때만)
function formatWhen(startAt) {
  const dd = startAt && startAt.toDate ? startAt.toDate() : new Date(startAt);
  if (!dd || isNaN(dd.getTime())) return '';
  const dp = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short' }).formatToParts(dd);
  const g = (t) => (dp.find((p) => p.type === t) || {}).value || '';
  const hp = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(dd);
  const hg = (t) => (hp.find((p) => p.type === t) || {}).value || '';
  const h24 = parseInt(hg('hour'), 10) % 24;
  const min = parseInt(hg('minute'), 10);
  const period = h24 < 12 ? '오전' : '오후';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const time = min === 0 ? `${period} ${h12}시` : `${period} ${h12}시 ${min}분`;
  return `${g('month')}월 ${g('day')}일(${g('weekday')}) ${time}`;
}

// 다가오는 연합 레이드 목록 임베드
async function buildScheduleEmbed() {
  const db = getFirestore();
  const snap = await db.collection('raids')
    .where('endAt', '>', Timestamp.now())
    .orderBy('endAt', 'asc')
    .limit(25)
    .get();
  const raids = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => !r.deleted && isUnionRaid(r))
    .sort((a, b) => a.startAt.toMillis() - b.startAt.toMillis())
    .slice(0, 8);

  if (raids.length === 0) {
    return { title: '📅 다가오는 연합 레이드', description: '예정된 연합 레이드가 없어요.', color: 0x6366f1 };
  }
  const counts = await Promise.all(raids.map((r) => getRaidCounts(db, r.id)));
  const lines = raids.map((r, i) => {
    const caps = getCaps(r);
    const c = counts[i];
    return `**${formatWhen(r.startAt)}** · ${DIFF_LABEL[r.difficulty] || ''}\n`
      + `${r.title || '공격대'}\n`
      + `🛡 ${c.tank}/${caps.tankCap}  💚 ${c.healer}/${caps.healerCap}  ⚔️ ${c.dps}/${caps.dpsCap}`;
  });
  return { title: '📅 다가오는 연합 레이드', description: lines.join('\n\n'), color: 0x6366f1 };
}

// ── 상호작용 수신 엔드포인트 ───────────────────────────────────────────────
// minInstances:1 — 인스턴스를 항상 깨워둬 콜드스타트 지연/타임아웃을 제거한다.
// (그래서 결과를 바로 응답해도 3초를 넘지 않음 → "생각 중"/"응답없음" 안 뜸)
exports.discordInteractions = onRequest(
  { secrets: [DISCORD_PUBLIC_KEY], minInstances: 1 },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }
    // 1) 서명 검증 — 실패 시 반드시 401 (디스코드 등록 검증 통과 조건)
    if (!verifySignature(req, DISCORD_PUBLIC_KEY.value())) {
      res.status(401).send('invalid request signature');
      return;
    }

    const body = req.body || {};

    // 2) PING → PONG (엔드포인트 등록 시 디스코드가 보냄)
    if (body.type === TYPE.PING) {
      res.json({ type: REPLY.PONG });
      return;
    }

    // 3) 슬래시 명령
    if (body.type === TYPE.APP_COMMAND) {
      const name = body.data && body.data.name;
      if (name === '핑') {
        res.json({
          type: REPLY.MESSAGE,
          data: { content: '🏓 퐁! 한길련봇 살아있습니다.', flags: EPHEMERAL },
        });
        return;
      }
      if (name === '일정') {
        try {
          const embed = await buildScheduleEmbed();
          res.json({ type: REPLY.MESSAGE, data: { embeds: [embed], flags: EPHEMERAL } });
        } catch (e) {
          res.json({ type: REPLY.MESSAGE, data: { content: `일정을 불러오지 못했어요: ${e.message}`, flags: EPHEMERAL } });
        }
        return;
      }
      if (name === '연동') {
        const reply = (content) => res.json({ type: REPLY.MESSAGE, data: { content, flags: EPHEMERAL } });
        try {
          const opt = (body.data.options || []).find((o) => o.name === '코드');
          const code = opt ? String(opt.value).trim() : '';
          const discordUser = (body.member && body.member.user) || body.user || {};
          const discordUserId = discordUser.id;
          const discordName = discordUser.global_name || discordUser.username || null;
          if (!code) { reply('6자리 코드를 입력해주세요.'); return; }
          if (!discordUserId) { reply('디스코드 사용자 정보를 확인할 수 없어요.'); return; }

          const db = getFirestore();
          const ref = db.collection('linkCodes').doc(code);
          const snap = await ref.get();
          if (!snap.exists) { reply('코드가 올바르지 않아요. 웹에서 다시 발급해주세요.'); return; }
          const data = snap.data();
          if (data.expiresAt && Date.now() > data.expiresAt) {
            await ref.delete();
            reply('코드가 만료됐어요(10분 경과). 웹에서 다시 발급해주세요.');
            return;
          }
          const userId = data.userId;
          await Promise.all([
            db.collection('discordLinks').doc(discordUserId).set({ userId, discordName, linkedAt: Timestamp.now() }),
            db.collection('users').doc(userId).set({ discordId: discordUserId, discordName }, { merge: true }),
          ]);
          await ref.delete();
          reply(`✅ 연동 완료! 이제 디스코드에서 바로 신청·조회할 수 있어요.${data.nickname ? `\n계정: **${data.nickname}**` : ''}`);
        } catch (e) {
          reply(`연동 실패: ${e.message}`);
        }
        return;
      }
      res.json({
        type: REPLY.MESSAGE,
        data: { content: `알 수 없는 명령: ${name}`, flags: EPHEMERAL },
      });
      return;
    }

    // 4) 그 외(버튼/모달 등) — 아직 미구현
    res.json({
      type: REPLY.MESSAGE,
      data: { content: '아직 준비 중인 동작이에요.', flags: EPHEMERAL },
    });
  }
);

// ── 슬래시 명령어 등록 ──────────────────────────────────────────────────────
// 호출: https://<함수주소>/discordRegisterCommands?key=<BOT_REGISTER_KEY값>
// 서버(길드) 범위로 등록 → 즉시 반영. 명령이 바뀔 때마다 한 번씩 호출.
const COMMANDS = [
  { name: '핑', description: '봇이 살아있는지 확인합니다', type: 1 },
  { name: '일정', description: '다가오는 연합 레이드 일정을 봅니다', type: 1 },
  {
    name: '연동',
    description: '웹 계정과 디스코드를 연결합니다 (웹에서 받은 6자리 코드 입력)',
    type: 1,
    options: [
      { name: '코드', description: '웹 프로필에서 발급한 6자리 코드', type: 3, required: true },
    ],
  },
];

exports.discordRegisterCommands = onRequest(
  { secrets: [DISCORD_BOT_TOKEN, DISCORD_APP_ID, DISCORD_GUILD_ID, BOT_REGISTER_KEY] },
  async (req, res) => {
    if (req.query.key !== BOT_REGISTER_KEY.value()) {
      res.status(403).send('forbidden — ?key= 값이 올바르지 않습니다.');
      return;
    }
    const appId   = DISCORD_APP_ID.value();
    const guildId = DISCORD_GUILD_ID.value();
    const url = `https://discord.com/api/v10/applications/${appId}/guilds/${guildId}/commands`;
    try {
      const resp = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN.value()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(COMMANDS),
      });
      const text = await resp.text();
      res.status(resp.ok ? 200 : resp.status).send(`등록 결과 [${resp.status}]\n${text}`);
    } catch (e) {
      res.status(500).send(`등록 실패: ${e.message}`);
    }
  }
);

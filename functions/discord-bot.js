// ─────────────────────────────────────────────────────────────────────────
// 한길련 디스코드봇 — Phase 0 뼈대
//  · discordInteractions   : 디스코드가 보내는 모든 상호작용 수신(서명검증 + PING + /핑)
//  · discordRegisterCommands: 슬래시 명령어 등록 (한 번/명령 바뀔 때만 호출, ?key= 가드)
//
// 의존성 추가 없이 Node 내장 crypto로 Ed25519 서명검증.
// ─────────────────────────────────────────────────────────────────────────
const { onRequest } = require('firebase-functions/v2/https');
const { onDocumentCreated, onDocumentUpdated, onDocumentWritten, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const crypto = require('crypto');
const { CLASSES } = require('./wow-data');

const DISCORD_PUBLIC_KEY = defineSecret('DISCORD_PUBLIC_KEY'); // Portal > General Information > Public Key
const DISCORD_BOT_TOKEN  = defineSecret('DISCORD_BOT_TOKEN');  // Portal > Bot > Reset Token
const DISCORD_APP_ID     = defineSecret('DISCORD_APP_ID');     // Portal > General Information > Application ID
const DISCORD_GUILD_ID   = defineSecret('DISCORD_GUILD_ID');   // 우리 서버 ID (즉시 반영용)
const BOT_REGISTER_KEY   = defineSecret('BOT_REGISTER_KEY');   // 등록 함수 호출 가드 (아무 랜덤 문자열)
const DISCORD_RAID_CHANNEL_ID = defineSecret('DISCORD_RAID_CHANNEL_ID'); // 라이브 카드 채널 ID

// 디스코드 Interaction 타입 / 응답 타입
const TYPE = { PING: 1, APP_COMMAND: 2, MESSAGE_COMPONENT: 3, MODAL_SUBMIT: 5 };
const REPLY = { PONG: 1, MESSAGE: 4, DEFERRED: 5, UPDATE_MESSAGE: 7, MODAL: 9 };
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
const DIFF_COLOR = { normal: 0x9ca3af, heroic: 0x3b82f6, mythic: 0xfbbf24 }; // 회/파랑/금
const ROLE_KO = { tank: '탱커', healer: '힐러', dps: '딜러' };
const SITE_URL = 'https://wowkorea.site';
function raidUrl(raidId) {
  return `${SITE_URL}/#/raid/${raidId}`;
}
const DIFF_CAPS = {
  normal: { totalCap: 30, defaultHealers: 6 },
  heroic: { totalCap: 30, defaultHealers: 6 },
  mythic: { totalCap: 20, defaultHealers: 4 },
};
const TANK_CAP = 2;

function getCaps(raid) {
  const d = DIFF_CAPS[raid.difficulty] || DIFF_CAPS.normal;
  const tankCap = TANK_CAP;
  const totalCap = raid.totalCap ?? d.totalCap;
  const healerCap = raid.healerCap ?? d.defaultHealers;
  const dpsCap = Math.max(0, totalCap - tankCap - healerCap);
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

// ── 디스코드 동적 타임스탬프 ────────────────────────────────────────
// 보는 사람의 시간대로 자동 변환 + "3시간 후" 상대시간을 클라이언트가 렌더한다.
// (셀렉트/버튼 라벨에는 렌더되지 않으므로 그쪽은 formatWhen 텍스트를 유지)
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
function dtShort(startAt) {
  const s = unixSec(startAt);
  return s ? `<t:${s}:f> (<t:${s}:R>)` : formatWhen(startAt);
}

// ── 클래스 아이콘 (로스터 가시성) ───────────────────────────────────
// 커스텀 이모지를 디스코드 서버에 올리고 아래 맵에 ID를 채우면 그걸 우선 사용한다.
//   형식: '<:slug:1234567890>' (애니메이션 이모지는 '<a:slug:id>')
// 비어 있으면 클래스 시그니처 색과 가장 가까운 유니코드 사각형으로 자동 대체한다.
const CLASS_EMOJI = {
  warrior: '<:warrioremoji:1518103765075623966>',
  paladin: '<:paladinemoji:1518103784922939493>',
  hunter: '<:hunteremoji:1518103777285111968>',
  rogue: '<:rogueemoji:1518103788156616766>',
  priest: '<:priestemoji:1518103786927820860>',
  deathknight: '<:deathknightemoji:1518103767613046904>',
  shaman: '<:shamanemoji:1518103790534922353>',
  mage: '<:mageemoji:1518103779348713654>',
  warlock: '<:warlockemoji:1518103792728670339>',
  monk: '<:monkemoji:1518103781441802393>',
  druid: '<:druidemoji:1518103772658929775>',
  demonhunter: '<:demonhunteremoji:1518103770255327252>',
  evoker: '<:evokeremoji:1518103775292952646>',
};
const SQUARES = [
  { e: '🟥', r: 231, g: 76, b: 60 },
  { e: '🟧', r: 230, g: 126, b: 34 },
  { e: '🟨', r: 241, g: 196, b: 15 },
  { e: '🟩', r: 46, g: 204, b: 113 },
  { e: '🟦', r: 52, g: 152, b: 219 },
  { e: '🟪', r: 155, g: 89, b: 182 },
  { e: '🟫', r: 121, g: 85, b: 72 },
  { e: '⬜', r: 236, g: 240, b: 241 },
  { e: '⬛', r: 30, g: 30, b: 30 },
];
function squareForColor(hex) {
  if (!hex || typeof hex !== 'string') return '⬜';
  const c = hex.replace('#', '');
  if (c.length < 6) return '⬜';
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  let best = SQUARES[0];
  let bestD = Infinity;
  for (const s of SQUARES) {
    const d = (s.r - r) ** 2 + (s.g - g) ** 2 + (s.b - b) ** 2;
    if (d < bestD) { bestD = d; best = s; }
  }
  return best.e;
}
function classIcon(a) {
  const custom = a && a.classId && CLASS_EMOJI[a.classId];
  return custom || squareForColor(a && a.classColor);
}

// 특성 근딜/원딜 분류 — wow-data의 range 사용. (classId|특성명 키로 동명 특성 충돌 방지)
const SPEC_RANGE = {};
CLASSES.forEach((c) => (c.specs || []).forEach((s) => {
  if (s.range) SPEC_RANGE[`${c.id}|${s.name}`] = s.range;
}));
function isRangedApp(a) {
  return !!a && SPEC_RANGE[`${a.classId}|${a.specName}`] === 'ranged';
}
// 클래스 분포 표기용 가나다 순서
const CLASS_GANADA = [
  'evoker', 'rogue', 'druid', 'mage', 'hunter', 'priest', 'paladin',
  'monk', 'demonhunter', 'warrior', 'shaman', 'deathknight', 'warlock',
];

// 다가오는 연합 레이드 목록 (정렬·필터)
async function upcomingUnionRaids(db, limit) {
  const snap = await db.collection('raids')
    .where('endAt', '>', Timestamp.now())
    .orderBy('endAt', 'asc')
    .limit(25)
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => !r.deleted && isUnionRaid(r))
    .sort((a, b) => a.startAt.toMillis() - b.startAt.toMillis())
    .slice(0, limit || 25);
}

// 게임 데이터(클래스/특성) — 웹과 동일하게 gamedata/classes 에서 읽음
async function loadClasses(db) {
  const snap = await db.collection('gamedata').doc('classes').get();
  const list = snap.exists ? (snap.data().list || []) : [];
  return list.length ? list : CLASSES; // Firestore에 없으면 내장 데이터 사용
}
function findSpec(classes, classId, specId) {
  const cls = (classes || []).find((c) => c.id === classId) || null;
  const spec = cls ? (cls.specs || []).find((s) => s.id === specId) || null : null;
  return { cls, spec };
}

// 캐릭터 정보 요약 텍스트 (클래스 · 특성 · 아이템레벨 · 스왑)
function charSummary(char, classes) {
  const cls = (classes || []).find((c) => c.id === char.classId);
  const specList = cls ? (cls.specs || []) : [];
  const specNames = (char.specs || []).map((sid) => (specList.find((s) => s.id === sid) || {}).name).filter(Boolean);
  const primary = specList.find((s) => s.id === (char.specs || [])[0]);
  const swap = new Set();
  if (primary) (char.specs || []).forEach((sid) => { const sp = specList.find((s) => s.id === sid); if (sp && sp.role !== primary.role) swap.add(sp.role); });
  const swapTxt = swap.size
    ? `${[...swap].map((r) => (r === 'tank' ? '탱' : r === 'healer' ? '힐' : '딜')).join('/')}스왑 가능`
    : '스왑 없음';
  return `**${char.name}** — ${cls ? cls.name : '?'}\n특성: ${specNames.join(', ') || '없음'}\n아이템레벨: ${char.ilvl || '미설정'} · ${swapTxt}`;
}

// 캐릭터로 신청 문서 생성 (웹 buildAppData와 동일 규칙)
// mode: 'active'(일반 참가) | 'bench'(예비) | 'swap'(스왑 가능 참가)
async function createSignup(db, userId, raidId, charIndex, mode) {
  const [userSnap, raidSnap, classes] = await Promise.all([
    db.collection('users').doc(userId).get(),
    db.collection('raids').doc(raidId).get(),
    loadClasses(db),
  ]);
  if (!userSnap.exists) return { error: '계정 정보를 찾을 수 없어요.' };
  if (!raidSnap.exists || raidSnap.data().deleted) return { error: '레이드를 찾을 수 없어요.' };
  const user = userSnap.data();
  const raid = raidSnap.data();
  const char = (user.characters || [])[charIndex];
  if (!char) return { error: '캐릭터를 찾을 수 없어요.' };
  const { cls, spec } = findSpec(classes, char.classId, (char.specs || [])[0]);
  if (!cls || !spec) return { error: '캐릭터 특성 정보를 확인할 수 없어요.' };

  let guildName = '소속 없음';
  let guildColor = '#64748b';
  if (user.guildId) {
    const g = await db.collection('guilds').doc(user.guildId).get();
    if (g.exists) { guildName = g.data().name || guildName; guildColor = g.data().color || guildColor; }
  }

  const swapSet = new Set();
  (char.specs || []).forEach((sid) => {
    const sp = (cls.specs || []).find((s) => s.id === sid);
    if (sp && sp.role !== spec.role) swapSet.add(sp.role);
  });
  const allSpecNames = (char.specs || [])
    .map((sid) => ((cls.specs || []).find((s) => s.id === sid) || {}).name)
    .filter(Boolean);

  let status;
  let swapFlag = false;
  if (mode === 'bench') {
    status = 'bench';
  } else {
    const counts = await getRaidCounts(db, raidId);
    const caps = getCaps(raid);
    const capMap = { tank: caps.tankCap, healer: caps.healerCap, dps: caps.dpsCap };
    status = counts[spec.role] >= capMap[spec.role] ? 'wait' : 'active';
    swapFlag = mode === 'swap' && swapSet.size > 0;
  }

  const app = {
    userId,
    nickname: user.nickname || '',
    guildId: user.guildId || 'none',
    guildName,
    guildColor,
    charId: char.id || null,
    charName: char.name || '',
    server: char.server || '',
    classId: cls.id,
    className: cls.name,
    classColor: cls.color,
    specId: spec.id,
    specName: spec.name,
    allSpecNames,
    role: spec.role,
    range: spec.role === 'dps' ? (spec.range || null) : null,
    ilvl: Number(char.ilvl) || 0,
    leaderCapable: !!user.leaderCapable,
    isGuildMaster: !!user.isGuildMaster,
    swap: swapFlag,
    swapRoles: [...swapSet],
    status,
    seq: Date.now(),
    isReservation: false,
    via: 'discord',
  };
  await db.collection('raids').doc(raidId).collection('apps').doc(userId).set(app);
  return { ok: true, raid, char, status, role: spec.role, swap: swapFlag };
}

// 다가오는 연합 레이드 목록 임베드 (raids를 받아서 렌더)
async function buildScheduleEmbed(db, raids) {
  if (!raids || raids.length === 0) {
    return { title: '📅 다가오는 레이드', description: '예정된 연합 레이드가 없어요.', color: 0x6366f1 };
  }
  const counts = await Promise.all(raids.map((r) => getRaidCounts(db, r.id)));
  const lines = raids.map((r, i) => {
    const caps = getCaps(r);
    const c = counts[i];
    return `${dtShort(r.startAt)} · ${DIFF_LABEL[r.difficulty] || ''}\n`
      + `**${r.title || '공격대'}**\n`
      + `🛡 ${c.tank}/${caps.tankCap}  💚 ${c.healer}/${caps.healerCap}  ⚔️ ${c.dps}/${caps.dpsCap}`;
  });
  return { title: '📅 다가오는 레이드', description: lines.join('\n\n'), color: 0x6366f1 };
}

// 레이드 상세 임베드 (로스터 — 웹 상세페이지의 디스코드판)
async function buildDetailEmbed(db, raidId) {
  const raidSnap = await db.collection('raids').doc(raidId).get();
  if (!raidSnap.exists || raidSnap.data().deleted) return null;
  const raid = raidSnap.data();
  const appsSnap = await db.collection('raids').doc(raidId).collection('apps').get();
  const apps = appsSnap.docs.map((d) => d.data());
  const caps = getCaps(raid);

  const active = { tank: [], healer: [], dps: [] };
  const wait = [];
  const bench = [];
  apps.forEach((a) => {
    if (a.status === 'active' && active[a.role]) active[a.role].push(a);
    else if (a.status === 'wait') wait.push(a);
    else if (a.status === 'bench') bench.push(a);
  });
  const NL = `
`;
  const ZWS = '​';
  // 로스터 한 줄: (클래스아이콘) **아이디** 특성2글자  (아이템레벨·스왑 미표기)
  const entry = (a) => `${classIcon(a)} **${a.charName}**${a.specName ? ` ${a.specName}` : ''}`;
  const col = (arr) => (arr.length ? arr.map(entry).join(NL).slice(0, 1024) : '—');

  const fields = [];
  // 한 섹션을 좌/우 2단으로: 전체폭 헤더 + 인라인 필드 2개(좌단/우단).
  const pushTwoCol = (label, arr) => {
    if (!arr.length) { fields.push({ name: label, value: '—', inline: false }); return; }
    const half = Math.ceil(arr.length / 2);
    fields.push({ name: label, value: ZWS, inline: false });
    fields.push({ name: ZWS, value: col(arr.slice(0, half)), inline: true });
    const right = arr.slice(half);
    fields.push({ name: ZWS, value: right.length ? col(right) : ZWS, inline: true });
  };

  const meleeDps = active.dps.filter((a) => !isRangedApp(a));
  const rangedDps = active.dps.filter((a) => isRangedApp(a));

  pushTwoCol(`🛡 탱커 ${active.tank.length}/${caps.tankCap}`, active.tank);
  pushTwoCol(`💚 힐러 ${active.healer.length}/${caps.healerCap}`, active.healer);
  pushTwoCol(`⚔️ 딜러 ${active.dps.length}/${caps.dpsCap} · 근딜 ${meleeDps.length}`, meleeDps);
  pushTwoCol(`🏹 원딜 ${rangedDps.length}`, rangedDps);
  if (wait.length) pushTwoCol(`⏳ 대기 ${wait.length}`, wait);
  if (bench.length) pushTwoCol(`🪑 벤치 ${bench.length}`, bench);

  // 클래스 분포 — 보유(이모지+수, 7개씩) / 결여(이모지만, 한 줄 균등 간격). 가나다순.
  const clsCount = {};
  [...active.tank, ...active.healer, ...active.dps].forEach((a) => {
    if (a.classId) clsCount[a.classId] = (clsCount[a.classId] || 0) + 1;
  });
  const heldRows = (arr) => {
    const out = [];
    for (let i = 0; i < arr.length; i += 7) out.push(arr.slice(i, i + 7).join(' '));
    return out.join(NL);
  };
  const held = CLASS_GANADA.filter((id) => clsCount[id]);
  const lack = CLASS_GANADA.filter((id) => !clsCount[id]);
  const distParts = [];
  if (held.length) distParts.push(`**보유**${NL}${heldRows(held.map((id) => `${CLASS_EMOJI[id] || ''} **${clsCount[id]}**`))}`);
  if (lack.length) distParts.push(`**결여**${NL}${lack.map((id) => CLASS_EMOJI[id] || '').join(' ')}`);
  if (distParts.length) fields.push({ name: '클래스 분포', value: distParts.join(NL + NL), inline: false });

  return {
    embed: {
      title: raid.title || '공격대',
      description: `📅 ${dtFull(raid.startAt)} · ${DIFF_LABEL[raid.difficulty] || ''}\n👑 공격대장: ${raid.leader || '미정'}`,
      color: DIFF_COLOR[raid.difficulty] || 0x9ca3af,
      fields,
    },
    raid,
  };
}

// ── 채널 라이브 카드 (Bot API) ──────────────────────────────────────────────
const DISCORD_API = 'https://discord.com/api/v10';

async function postToChannel(token, channelId, payload) {
  const resp = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    console.error('[postToChannel] 실패 channel=', channelId, 'status=', resp.status, 'body=', body.slice(0, 300));
    return null;
  }
  return resp.json(); // { id, ... }
}
async function editChannelMessage(token, channelId, messageId, payload) {
  await fetch(`${DISCORD_API}/channels/${channelId}/messages/${messageId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
async function deleteChannelMessage(token, channelId, messageId) {
  await fetch(`${DISCORD_API}/channels/${channelId}/messages/${messageId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bot ${token}` },
  });
}

// 카드 = 상세 임베드(로스터) + 버튼 [신청][상세][웹]
async function buildRaidCard(db, raidId) {
  const d = await buildDetailEmbed(db, raidId);
  if (!d) return null;
  return {
    embeds: [d.embed],
    components: [{ type: 1, components: [
      { type: 2, style: 1, label: '🎯 신청', custom_id: `card_signup:${raidId}` },
      { type: 2, style: 2, label: '📄 상세', custom_id: `card_detail:${raidId}` },
      { type: 2, style: 5, label: '🔗 웹에서 보기', url: raidUrl(raidId) },
    ] }],
  };
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
          const db = getFirestore();
          const filter = channelFilter(body.channel_id);
          const gmap = await loadGuildIdByEnglish(db);
          const raids = (await upcomingRaids(db, 50)).filter((r) => raidMatchesFilter(r, filter, gmap));
          const embed = await buildScheduleEmbed(db, raids.slice(0, 8));
          const components = [];
          if (raids.length > 0) {
            const opts = raids.slice(0, 25).map((r) => ({
              label: `${formatWhen(r.startAt)} · ${r.title || '공격대'}`.slice(0, 100),
              value: r.id,
            }));
            // 상세보기(모두) + 신청(연동된 사람만)
            components.push({ type: 1, components: [{ type: 3, custom_id: 'detail_raid', placeholder: '📄 상세 볼 레이드 선택', options: opts }] });
            const discordUserId = ((body.member && body.member.user) || body.user || {}).id;
            const linkSnap = await db.collection('discordLinks').doc(discordUserId).get();
            if (linkSnap.exists) {
              components.push({ type: 1, components: [{ type: 3, custom_id: 'signup_raid', placeholder: '🎯 신청할 레이드 선택', options: opts }] });
            }
          }
          res.json({ type: REPLY.MESSAGE, data: { embeds: [embed], components, flags: EPHEMERAL } });
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
      if (name === '신청') {
        try {
          const db = getFirestore();
          const discordUserId = ((body.member && body.member.user) || body.user || {}).id;
          const linkSnap = await db.collection('discordLinks').doc(discordUserId).get();
          if (!linkSnap.exists) {
            res.json({ type: REPLY.MESSAGE, data: { content: '먼저 `/연동` 으로 웹 계정을 연결해주세요.', flags: EPHEMERAL } });
            return;
          }
          const filter = channelFilter(body.channel_id);
          const gmap = await loadGuildIdByEnglish(db);
          const raids = (await upcomingRaids(db, 50)).filter((r) => raidMatchesFilter(r, filter, gmap));
          if (raids.length === 0) {
            res.json({ type: REPLY.MESSAGE, data: { content: '지금 신청할 수 있는 레이드가 없어요.', flags: EPHEMERAL } });
            return;
          }
          const options = raids.map((r) => ({
            label: `${formatWhen(r.startAt)} · ${r.title || '공격대'}`.slice(0, 100),
            value: r.id,
          }));
          res.json({
            type: REPLY.MESSAGE,
            data: {
              content: '어느 레이드에 신청할까요?',
              flags: EPHEMERAL,
              components: [{ type: 1, components: [{ type: 3, custom_id: 'signup_raid', placeholder: '레이드 선택', options }] }],
            },
          });
        } catch (e) {
          res.json({ type: REPLY.MESSAGE, data: { content: `신청 처리 오류: ${e.message}`, flags: EPHEMERAL } });
        }
        return;
      }
      if (name === '내신청') {
        try {
          const db = getFirestore();
          const discordUserId = ((body.member && body.member.user) || body.user || {}).id;
          const linkSnap = await db.collection('discordLinks').doc(discordUserId).get();
          if (!linkSnap.exists) {
            res.json({ type: REPLY.MESSAGE, data: { content: '먼저 `/연동` 으로 계정을 연결해주세요.', flags: EPHEMERAL } });
            return;
          }
          const userId = linkSnap.data().userId;
          const raids = await upcomingRaids(db, 100);
          const apps = await Promise.all(raids.map((r) => db.collection('raids').doc(r.id).collection('apps').doc(userId).get()));
          const mine = [];
          raids.forEach((r, i) => { if (apps[i].exists) mine.push({ raid: r, app: apps[i].data() }); });
          if (mine.length === 0) {
            res.json({ type: REPLY.MESSAGE, data: { content: '아직 신청한 연합 레이드가 없어요.', flags: EPHEMERAL } });
            return;
          }
          const lines = mine.map((m) => {
            const st = m.app.status === 'active' ? '✅ 확정' : m.app.status === 'wait' ? '⏳ 대기' : '🪑 벤치';
            return `${dtShort(m.raid.startAt)} · **${m.raid.title || '공격대'}**\n→ ${m.app.charName} (${st})`;
          });
          const options = mine.map((m) => ({
            label: `${formatWhen(m.raid.startAt)} · ${m.raid.title || '공격대'}`.slice(0, 100),
            value: m.raid.id,
          }));
          res.json({
            type: REPLY.MESSAGE,
            data: {
              embeds: [{ title: '📋 내 신청 현황', description: lines.join('\n\n'), color: 0x6366f1 }],
              components: [{ type: 1, components: [{ type: 3, custom_id: 'mysignup_manage', placeholder: '관리할 레이드 선택 (변경/취소)', options }] }],
              flags: EPHEMERAL,
            },
          });
        } catch (e) {
          res.json({ type: REPLY.MESSAGE, data: { content: `오류: ${e.message}`, flags: EPHEMERAL } });
        }
        return;
      }
      if (name === '내정보') {
        try {
          const db = getFirestore();
          const discordUserId = ((body.member && body.member.user) || body.user || {}).id;
          const linkSnap = await db.collection('discordLinks').doc(discordUserId).get();
          if (!linkSnap.exists) {
            res.json({ type: REPLY.MESSAGE, data: { content: '먼저 `/연동` 으로 계정을 연결해주세요.', flags: EPHEMERAL } });
            return;
          }
          const userId = linkSnap.data().userId;
          const userSnap = await db.collection('users').doc(userId).get();
          const chars = (userSnap.exists && userSnap.data().characters) || [];
          if (chars.length === 0) {
            res.json({ type: REPLY.MESSAGE, data: { content: '등록된 캐릭터가 없어요. 웹에서 캐릭터를 먼저 등록해주세요.', flags: EPHEMERAL } });
            return;
          }
          const classes = await loadClasses(db);
          const options = chars.slice(0, 25).map((c, i) => {
            const cls = (classes || []).find((x) => x.id === c.classId);
            return { label: `${c.name}${cls ? ` · ${cls.name}` : ''}`.slice(0, 100), value: String(i) };
          });
          res.json({
            type: REPLY.MESSAGE,
            data: {
              content: '내 캐릭터 — 정보를 보고 수정할 캐릭터를 고르세요.',
              components: [{ type: 1, components: [{ type: 3, custom_id: 'mychar_select', placeholder: '캐릭터 선택', options }] }],
              flags: EPHEMERAL,
            },
          });
        } catch (e) {
          res.json({ type: REPLY.MESSAGE, data: { content: `오류: ${e.message}`, flags: EPHEMERAL } });
        }
        return;
      }
      res.json({
        type: REPLY.MESSAGE,
        data: { content: `알 수 없는 명령: ${name}`, flags: EPHEMERAL },
      });
      return;
    }

    // 4) 버튼/셀렉트 등 컴포넌트 상호작용 (상세보기 / 신청 흐름)
    if (body.type === TYPE.MESSAGE_COMPONENT) {
      const update = (content, components) =>
        res.json({ type: REPLY.UPDATE_MESSAGE, data: { content, components: components || [], flags: EPHEMERAL } });
      const newMsg = (data) => res.json({ type: REPLY.MESSAGE, data: { ...data, flags: EPHEMERAL } });
      try {
        const db = getFirestore();
        const cid = (body.data && body.data.custom_id) || '';
        const values = (body.data && body.data.values) || [];
        const discordUserId = ((body.member && body.member.user) || body.user || {}).id;

        // 상세보기 (드롭다운/카드 버튼) — 연동 없이 누구나
        if (cid === 'detail_raid' || cid.startsWith('card_detail:')) {
          const raidId = cid.startsWith('card_detail:') ? cid.slice('card_detail:'.length) : values[0];
          const d = await buildDetailEmbed(db, raidId);
          if (!d) { newMsg({ content: '레이드를 찾을 수 없어요.' }); return; }
          newMsg({
            embeds: [d.embed],
            components: [{ type: 1, components: [{ type: 2, style: 5, label: '🔗 웹에서 보기', url: raidUrl(raidId) }] }],
          });
          return;
        }

        // 카드의 [신청] 버튼 — 새 임시메시지로 캐릭터 선택 (공개 카드는 안 건드림)
        if (cid.startsWith('card_signup:')) {
          const raidId = cid.slice('card_signup:'.length);
          const link = await db.collection('discordLinks').doc(discordUserId).get();
          if (!link.exists) { newMsg({ content: '먼저 `/연동` 으로 계정을 연결해주세요.' }); return; }
          const uid = link.data().userId;
          // 이미 신청했으면 본인에게만 "신청됨 + 취소" 안내
          const mine = await db.collection('raids').doc(raidId).collection('apps').doc(uid).get();
          if (mine.exists) {
            const a = mine.data();
            const st = a.status === 'active' ? '참가 확정' : a.status === 'wait' ? '대기' : '벤치';
            newMsg({
              content: `이미 **${a.charName}** (으)로 신청돼 있어요. (상태: ${st})`,
              components: [{ type: 1, components: [
                { type: 2, style: 1, label: '🔄 캐릭터 변경', custom_id: `card_change:${raidId}` },
                { type: 2, style: 4, label: '❌ 신청 취소', custom_id: `card_cancel:${raidId}` },
              ] }],
            });
            return;
          }
          const userSnap = await db.collection('users').doc(uid).get();
          const chars = (userSnap.exists && userSnap.data().characters) || [];
          if (chars.length === 0) { newMsg({ content: '등록된 캐릭터가 없어요. 웹에서 캐릭터를 먼저 등록해주세요.' }); return; }
          const classes = await loadClasses(db);
          const options = chars.slice(0, 25).map((c, i) => {
            const cls = (classes || []).find((x) => x.id === c.classId);
            return { label: `${c.name}${cls ? ` · ${cls.name}` : ''}`.slice(0, 100), value: String(i) };
          });
          newMsg({
            content: '어떤 캐릭터로 신청할까요?',
            components: [{ type: 1, components: [{ type: 3, custom_id: `signup_char:${raidId}`, placeholder: '캐릭터 선택', options }] }],
          });
          return;
        }

        // 카드의 [취소] 버튼 — 본인 신청 삭제
        if (cid.startsWith('card_cancel:')) {
          const raidId = cid.slice('card_cancel:'.length);
          const link = await db.collection('discordLinks').doc(discordUserId).get();
          if (!link.exists) { update('먼저 `/연동` 으로 계정을 연결해주세요.'); return; }
          const uid = link.data().userId;
          await db.collection('raids').doc(raidId).collection('apps').doc(uid).delete();
          update('❌ 신청을 취소했어요.');
          return;
        }

        // 카드의 [캐릭터 변경] 버튼 — 캐릭터 다시 선택 (signup_char가 덮어씀)
        if (cid.startsWith('card_change:')) {
          const raidId = cid.slice('card_change:'.length);
          const link = await db.collection('discordLinks').doc(discordUserId).get();
          if (!link.exists) { update('먼저 `/연동` 으로 계정을 연결해주세요.'); return; }
          const uid = link.data().userId;
          const userSnap = await db.collection('users').doc(uid).get();
          const chars = (userSnap.exists && userSnap.data().characters) || [];
          if (chars.length === 0) { update('등록된 캐릭터가 없어요. 웹에서 캐릭터를 먼저 등록해주세요.'); return; }
          const classes = await loadClasses(db);
          const options = chars.slice(0, 25).map((c, i) => {
            const cls = (classes || []).find((x) => x.id === c.classId);
            return { label: `${c.name}${cls ? ` · ${cls.name}` : ''}`.slice(0, 100), value: String(i) };
          });
          update('변경할 캐릭터를 선택하세요.', [
            { type: 1, components: [{ type: 3, custom_id: `signup_char:${raidId}`, placeholder: '캐릭터 선택', options }] },
          ]);
          return;
        }

        // /내신청에서 레이드 선택 → 그 신청의 변경/취소 버튼
        if (cid === 'mysignup_manage') {
          const raidId = values[0];
          const link = await db.collection('discordLinks').doc(discordUserId).get();
          if (!link.exists) { update('먼저 `/연동` 으로 계정을 연결해주세요.'); return; }
          const uid = link.data().userId;
          const appSnap = await db.collection('raids').doc(raidId).collection('apps').doc(uid).get();
          if (!appSnap.exists) { update('그 레이드엔 신청 내역이 없어요 (이미 취소됐나요?).'); return; }
          const a = appSnap.data();
          const st = a.status === 'active' ? '참가 확정' : a.status === 'wait' ? '대기' : '벤치';
          update(`**${a.charName}** (으)로 신청됨 (상태: ${st})`, [
            { type: 1, components: [
              { type: 2, style: 1, label: '🔄 캐릭터 변경', custom_id: `card_change:${raidId}` },
              { type: 2, style: 4, label: '❌ 신청 취소', custom_id: `card_cancel:${raidId}` },
            ] },
          ]);
          return;
        }

        // 이하 신청 흐름 — 연동 필요
        const linkSnap = await db.collection('discordLinks').doc(discordUserId).get();
        if (!linkSnap.exists) { update('먼저 `/연동` 으로 계정을 연결해주세요.'); return; }
        const userId = linkSnap.data().userId;

        if (cid === 'signup_raid') {
          const raidId = values[0];
          const userSnap = await db.collection('users').doc(userId).get();
          const chars = (userSnap.exists && userSnap.data().characters) || [];
          if (chars.length === 0) { update('등록된 캐릭터가 없어요. 웹에서 캐릭터를 먼저 등록해주세요.'); return; }
          const classes = await loadClasses(db);
          const options = chars.slice(0, 25).map((c, i) => {
            const cls = (classes || []).find((x) => x.id === c.classId);
            return { label: `${c.name}${cls ? ` · ${cls.name}` : ''}`.slice(0, 100), value: String(i) };
          });
          update('어떤 캐릭터로 신청할까요?', [
            { type: 1, components: [{ type: 3, custom_id: `signup_char:${raidId}`, placeholder: '캐릭터 선택', options }] },
          ]);
          return;
        }

        if (cid.startsWith('signup_char:')) {
          const raidId = cid.slice('signup_char:'.length);
          const charIndex = parseInt(values[0], 10);
          const userSnap = await db.collection('users').doc(userId).get();
          const char = ((userSnap.exists && userSnap.data().characters) || [])[charIndex];
          if (!char) { update('캐릭터를 찾을 수 없어요.'); return; }
          // 스왑 가능 역할 계산 (스왑 버튼 노출 여부)
          const classes = await loadClasses(db);
          const cls = (classes || []).find((c) => c.id === char.classId);
          const primary = cls ? (cls.specs || []).find((s) => s.id === (char.specs || [])[0]) : null;
          const swapRoles = new Set();
          if (cls && primary) (char.specs || []).forEach((sid) => {
            const sp = (cls.specs || []).find((s) => s.id === sid);
            if (sp && sp.role !== primary.role) swapRoles.add(sp.role);
          });
          const btns = [
            { type: 2, style: 3, label: '✅ 참가', custom_id: `signup_go:${raidId}:${charIndex}:active` },
            { type: 2, style: 2, label: '🪑 벤치(예비)', custom_id: `signup_go:${raidId}:${charIndex}:bench` },
          ];
          if (swapRoles.size) {
            const prefix = [...swapRoles].map((x) => (x === 'tank' ? '탱' : x === 'healer' ? '힐' : '딜')).join('/');
            btns.splice(1, 0, { type: 2, style: 1, label: `🔄 ${prefix}스왑 가능`, custom_id: `signup_go:${raidId}:${charIndex}:swap` });
          }
          update(`**${char.name}** (으)로 어떻게 신청할까요?`, [{ type: 1, components: btns }]);
          return;
        }

        if (cid.startsWith('signup_go:')) {
          const parts = cid.split(':'); // ['signup_go', raidId, charIndex, mode]
          const raidId = parts[1];
          const charIndex = parseInt(parts[2], 10);
          const mode = parts[3] || 'active';
          const r = await createSignup(db, userId, raidId, charIndex, mode);
          if (r.error) { update(`⚠️ ${r.error}`); return; }
          const roleKo = ROLE_KO[r.role] || r.role;
          const statusKo = r.status === 'active' ? '✅ 참가 확정' : r.status === 'wait' ? '⏳ 대기' : '🪑 벤치';
          update(`🎉 신청 완료!\n**${r.char.name}** (${roleKo}) → ${r.raid.title || '공격대'}\n상태: ${statusKo}${r.swap ? ' · 🔄 스왑 가능' : ''}`);
          return;
        }

        // ── /내정보 ──
        if (cid === 'mychar_select') {
          const idx = parseInt(values[0], 10);
          const userSnap = await db.collection('users').doc(userId).get();
          const char = ((userSnap.exists && userSnap.data().characters) || [])[idx];
          if (!char) { update('캐릭터를 찾을 수 없어요.'); return; }
          const classes = await loadClasses(db);
          update(charSummary(char, classes), [
            { type: 1, components: [
              { type: 2, style: 1, label: '✏️ 아이템레벨 수정', custom_id: `mychar_ilvl:${idx}` },
              { type: 2, style: 1, label: '🔄 특성 변경', custom_id: `mychar_spec:${idx}` },
            ] },
          ]);
          return;
        }
        if (cid.startsWith('mychar_ilvl:')) {
          const idx = cid.slice('mychar_ilvl:'.length);
          res.json({
            type: REPLY.MODAL,
            data: {
              custom_id: `mychar_ilvl_save:${idx}`,
              title: '아이템레벨 수정',
              components: [{ type: 1, components: [{ type: 4, custom_id: 'ilvl', label: '현재 아이템 레벨', style: 1, min_length: 1, max_length: 5, required: true, placeholder: '예: 639' }] }],
            },
          });
          return;
        }
        if (cid.startsWith('mychar_spec:')) {
          const idx = parseInt(cid.slice('mychar_spec:'.length), 10);
          const userSnap = await db.collection('users').doc(userId).get();
          const char = ((userSnap.exists && userSnap.data().characters) || [])[idx];
          if (!char) { update('캐릭터를 찾을 수 없어요.'); return; }
          const classes = await loadClasses(db);
          const cls = (classes || []).find((c) => c.id === char.classId);
          if (!cls) { update('클래스 정보를 확인할 수 없어요.'); return; }
          const options = (cls.specs || []).map((s) => ({
            label: `${s.name} (${s.role === 'tank' ? '탱' : s.role === 'healer' ? '힐' : '딜'})`,
            value: s.id,
            default: (char.specs || []).includes(s.id),
          }));
          update('특성을 선택하세요 (1~4개).', [
            { type: 1, components: [{ type: 3, custom_id: `mychar_spec_save:${idx}`, placeholder: '특성 선택', min_values: 1, max_values: Math.min(4, options.length), options }] },
          ]);
          return;
        }
        if (cid.startsWith('mychar_spec_save:')) {
          const idx = parseInt(cid.slice('mychar_spec_save:'.length), 10);
          const userRef = db.collection('users').doc(userId);
          const userSnap = await userRef.get();
          const chars = [...((userSnap.exists && userSnap.data().characters) || [])];
          if (!chars[idx]) { update('캐릭터를 찾을 수 없어요.'); return; }
          chars[idx] = { ...chars[idx], specs: values };
          await userRef.update({ characters: chars });
          const classes = await loadClasses(db);
          update(`✅ 특성을 변경했어요.\n\n${charSummary(chars[idx], classes)}`);
          return;
        }

        update('알 수 없는 동작이에요.');
      } catch (e) {
        res.json({ type: REPLY.UPDATE_MESSAGE, data: { content: `처리 오류: ${e.message}`, components: [], flags: EPHEMERAL } });
      }
      return;
    }

    // 5) 모달 제출 (아이템레벨 수정 등)
    if (body.type === TYPE.MODAL_SUBMIT) {
      try {
        const db = getFirestore();
        const cid = (body.data && body.data.custom_id) || '';
        const discordUserId = ((body.member && body.member.user) || body.user || {}).id;
        const linkSnap = await db.collection('discordLinks').doc(discordUserId).get();
        if (!linkSnap.exists) {
          res.json({ type: REPLY.MESSAGE, data: { content: '먼저 `/연동` 으로 계정을 연결해주세요.', flags: EPHEMERAL } });
          return;
        }
        const userId = linkSnap.data().userId;
        if (cid.startsWith('mychar_ilvl_save:')) {
          const idx = parseInt(cid.slice('mychar_ilvl_save:'.length), 10);
          let raw = '';
          ((body.data && body.data.components) || []).forEach((row) =>
            (row.components || []).forEach((c) => { if (c.custom_id === 'ilvl') raw = c.value; })
          );
          const ilvl = String(raw || '').replace(/\D/g, '');
          const userRef = db.collection('users').doc(userId);
          const userSnap = await userRef.get();
          const chars = [...((userSnap.exists && userSnap.data().characters) || [])];
          if (!chars[idx]) {
            res.json({ type: REPLY.MESSAGE, data: { content: '캐릭터를 찾을 수 없어요.', flags: EPHEMERAL } });
            return;
          }
          chars[idx] = { ...chars[idx], ilvl };
          await userRef.update({ characters: chars });
          const classes = await loadClasses(db);
          res.json({ type: REPLY.MESSAGE, data: { content: `✅ 아이템레벨을 변경했어요.\n\n${charSummary(chars[idx], classes)}`, flags: EPHEMERAL } });
          return;
        }
        res.json({ type: REPLY.MESSAGE, data: { content: '알 수 없는 입력이에요.', flags: EPHEMERAL } });
      } catch (e) {
        res.json({ type: REPLY.MESSAGE, data: { content: `처리 오류: ${e.message}`, flags: EPHEMERAL } });
      }
      return;
    }

    // 6) 그 외 — 아직 미구현
    res.json({
      type: REPLY.MESSAGE,
      data: { content: '아직 준비 중인 동작이에요.', flags: EPHEMERAL },
    });
  }
);

// ── 채널 라이브 카드 (출발순 게시판) ─────────────────────────────────────────
const CARD_SECRETS = [DISCORD_BOT_TOKEN];

// 채널 ↔ 필터 매핑 (채널 ID는 비밀 아님 → 코드 상수)
//   'union'   = 연합 레이드 / '<길드ID>' = 그 길드 레이드
const CARD_CHANNELS = [
  { channelId: '1517678646343635064', filter: 'union' },          // 한길련 서버 · 연합 (기존)
  { channelId: '1517705693371830322', filter: 'union' },          // 스타폴 서버 · 연합
  { channelId: '1517705660903587970', filter: 'guild:starfall' }, // 스타폴 서버 · 스타폴 길드(영문명)
  { channelId: '1519867938671165490', filter: 'guild:e-ayo' },    // 이에요 서버 · 이에요 길드(영문명)
  { channelId: '1521323489573994586', filter: 'guild:gyocharo' }, // 교차로 서버 · 교차로 길드(영문명)
];
const LEGACY_UNION_CHANNEL = '1517678646343635064';

// 영문명 → 길드 doc ID 매핑 (실제 ID가 랜덤이어도 영문명으로 안정 매칭)
async function loadGuildIdByEnglish(db) {
  const snap = await db.collection('guilds').get();
  const map = {};
  snap.forEach((d) => { const g = d.data(); if (g.englishName) map[g.englishName] = d.id; });
  return map;
}

// filter: 'union' | 'guild:<영문명>' | '<길드ID>'  (gmap = 영문명→ID)
function raidMatchesFilter(raid, filter, gmap) {
  if (filter === 'union') return isUnionRaid(raid);
  if (filter.indexOf('guild:') === 0) {
    const gid = gmap && gmap[filter.slice(6)];
    return gid ? raid.partyType === gid : false;
  }
  return raid.partyType === filter;
}
function channelFilter(channelId) {
  const ch = CARD_CHANNELS.find((c) => c.channelId === channelId);
  return ch ? ch.filter : 'union';
}
function raidTimeMillis(r) {
  return r && r.startAt && r.startAt.toMillis ? r.startAt.toMillis() : 0;
}
function displayChanged(b, a) {
  return b.title !== a.title || b.difficulty !== a.difficulty
    || b.leader !== a.leader || (b.healerCap ?? null) !== (a.healerCap ?? null);
}

// 다가오는 모든 레이드(연합·길드 포함, 출발 오름차순)
async function upcomingRaids(db, limit) {
  const snap = await db.collection('raids')
    .where('endAt', '>', Timestamp.now())
    .orderBy('endAt', 'asc')
    .limit(limit || 100)
    .get();
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r) => !r.deleted)
    .sort((a, b) => a.startAt.toMillis() - b.startAt.toMillis());
}

// 해당 레이드가 속하는(필터에 맞는) 채널 목록
function channelsForRaid(raid, gmap) {
  return CARD_CHANNELS.filter((ch) => raidMatchesFilter(raid, ch.filter, gmap));
}

// 지정한 채널만 출발순 재구성 (channels 미지정 시 전체). 다른 채널 상태는 유지.
// 먼 미래부터 게시 = 가까운 게 맨 아래.
async function rebuildBoard(db, token, channels) {
  const targets = channels || CARD_CHANNELS;
  if (!targets.length) return;
  const boardSnap = await db.collection('meta').doc('discordBoard').get();
  const board = (boardSnap.exists && boardSnap.data()) || {};
  const newBoard = { ...board };
  // 구버전 flat 카드(cardIds)는 레거시 채널을 재구성할 때만 정리
  if (targets.some((c) => c.channelId === LEGACY_UNION_CHANNEL) && Array.isArray(board.cardIds)) {
    for (const id of board.cardIds) await deleteChannelMessage(token, LEGACY_UNION_CHANNEL, id);
    delete newBoard.cardIds;
  }
  const all = await upcomingRaids(db, 100);
  const gmap = await loadGuildIdByEnglish(db);
  for (const ch of targets) {
    for (const id of (board[ch.channelId] || [])) {
      await deleteChannelMessage(token, ch.channelId, id);
    }
    const matching = all.filter((r) => raidMatchesFilter(r, ch.filter, gmap));
    const ordered = [...matching].reverse();
    const ids = [];
    for (const r of ordered) {
      const card = await buildRaidCard(db, r.id);
      if (!card) continue;
      const msg = await postToChannel(token, ch.channelId, card);
      if (msg && msg.id) {
        ids.push(msg.id);
        await db.collection('raids').doc(r.id).set({ discordCards: { [ch.channelId]: msg.id } }, { merge: true });
      }
    }
    newBoard[ch.channelId] = ids;
  }
  await db.collection('meta').doc('discordBoard').set(newBoard);
}

// 레이드의 모든 채널 카드 갱신
async function refreshRaidCards(db, token, raidId, cards) {
  const entries = Object.entries(cards || {});
  if (!entries.length) return;
  const card = await buildRaidCard(db, raidId);
  if (!card) return;
  for (const [channelId, msgId] of entries) {
    await editChannelMessage(token, channelId, msgId, card);
  }
}

// 레이드 생성 → 게시판 재구성
exports.cardOnRaidCreated = onDocumentCreated(
  { document: 'raids/{raidId}', secrets: CARD_SECRETS },
  async (event) => {
    const raid = event.data.data();
    if (!raid || raid.deleted) return;
    const db = getFirestore();
    const gmap = await loadGuildIdByEnglish(db);
    await rebuildBoard(db, DISCORD_BOT_TOKEN.value(), channelsForRaid(raid, gmap));
  }
);

// 레이드 수정/삭제 → 시간·삭제·파티변경이면 재구성, 그 외는 카드 제자리 갱신
exports.cardOnRaidUpdated = onDocumentUpdated(
  { document: 'raids/{raidId}', secrets: CARD_SECRETS },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    if (!before || !after) return;
    const db = getFirestore();
    const token = DISCORD_BOT_TOKEN.value();
    const timeChanged = raidTimeMillis(before) !== raidTimeMillis(after);
    const deletedToggled = (!!before.deleted) !== (!!after.deleted);
    const partyChanged = (before.partyType || '') !== (after.partyType || '');
    if (timeChanged || deletedToggled || partyChanged) {
      const gmap = await loadGuildIdByEnglish(db);
      const affected = new Map();
      [...channelsForRaid(before, gmap), ...channelsForRaid(after, gmap)].forEach((c) => affected.set(c.channelId, c));
      await rebuildBoard(db, token, [...affected.values()]);
      return;
    }
    if (after.deleted) return;
    if (!displayChanged(before, after)) return; // discordCards만 바뀐 경우(재구성 자기쓰기) 스킵
    await refreshRaidCards(db, token, event.params.raidId, after.discordCards);
  }
);

// 레이드 완전삭제(하드삭제) → 남아있던 카드 제거 + 해당 채널 재구성
exports.cardOnRaidDeleted = onDocumentDeleted(
  { document: 'raids/{raidId}', secrets: CARD_SECRETS },
  async (event) => {
    const raid = event.data && event.data.data();
    if (!raid) return;
    const db = getFirestore();
    const token = DISCORD_BOT_TOKEN.value();
    const gmap = await loadGuildIdByEnglish(db);
    // 필터상 속했던 채널 + 실제 카드가 박혀있던 채널을 합쳐 정리
    const affected = new Map();
    channelsForRaid(raid, gmap).forEach((c) => affected.set(c.channelId, c));
    Object.keys(raid.discordCards || {}).forEach((channelId) => {
      const ch = CARD_CHANNELS.find((c) => c.channelId === channelId);
      if (ch) affected.set(ch.channelId, ch);
    });
    if (!affected.size) return;
    await rebuildBoard(db, token, [...affected.values()]);
  }
);

// 신청 변동 → 그 레이드의 모든 채널 카드 로스터 갱신 (재구성 X)
exports.cardOnAppChange = onDocumentWritten(
  { document: 'raids/{raidId}/apps/{appId}', secrets: CARD_SECRETS },
  async (event) => {
    const db = getFirestore();
    const raidId = event.params.raidId;
    const raidSnap = await db.collection('raids').doc(raidId).get();
    if (!raidSnap.exists) return;
    const raid = raidSnap.data();
    if (raid.deleted) return;
    await refreshRaidCards(db, DISCORD_BOT_TOKEN.value(), raidId, raid.discordCards);
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
  { name: '신청', description: '연합 레이드에 신청합니다 (클릭으로 선택)', type: 1 },
  { name: '내신청', description: '내가 신청한 레이드를 보고 변경/취소합니다', type: 1 },
  { name: '내정보', description: '내 캐릭터의 특성·아이템레벨을 보고 수정합니다', type: 1 },
];

// 명령을 등록할 서버(길드) 목록 — DISCORD_GUILD_ID(한길련) + 아래 추가 서버들
const EXTRA_GUILD_IDS = ['1430130051734704259', '861086826637557821', '1264845965387501630']; // 스타폴, 이에요, 교차로 서버

exports.discordRegisterCommands = onRequest(
  { secrets: [DISCORD_BOT_TOKEN, DISCORD_APP_ID, DISCORD_GUILD_ID, BOT_REGISTER_KEY] },
  async (req, res) => {
    if (req.query.key !== BOT_REGISTER_KEY.value()) {
      res.status(403).send('forbidden — ?key= 값이 올바르지 않습니다.');
      return;
    }
    const appId = DISCORD_APP_ID.value();
    const token = DISCORD_BOT_TOKEN.value();
    const guildIds = [DISCORD_GUILD_ID.value(), ...EXTRA_GUILD_IDS];
    const out = [];
    for (const gid of guildIds) {
      try {
        const resp = await fetch(`https://discord.com/api/v10/applications/${appId}/guilds/${gid}/commands`, {
          method: 'PUT',
          headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(COMMANDS),
        });
        out.push(`${gid}: [${resp.status}]${resp.ok ? ' OK' : ' ' + (await resp.text()).slice(0, 200)}`);
      } catch (e) {
        out.push(`${gid}: 실패 ${e.message}`);
      }
    }
    res.status(200).send('등록 결과\n' + out.join('\n'));
  }
);

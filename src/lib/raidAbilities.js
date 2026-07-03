// 공대 능력 데이터 (한밤 12.0.x 기준 · 대표님 검증 대상).
// 판정 기준: 레이드에 신청한 1순위 특성(app.specId) / 클래스(app.classId).
//   - classId 로만 지정된 것 = 전 특성 공용
//   - specId 로 지정된 것 = 그 특성 전용

// ── 물리/마법 피해증가 디버프 (조별 필수) ──
export const DMG_DEBUFF = {
  physical: { classId: 'monk', name: '신비한 손길', label: '물리뎀증' },
  magic: { classId: 'demonhunter', name: '혼돈의 낙인', label: '마법뎀증' },
};

// ── 공대 이동기 ──
export const MOVEMENT_ABILITIES = [
  { classId: 'druid', name: '쇄도의 포효' },
  { classId: 'shaman', name: '바람 질주 토템' },
  { classId: 'warlock', name: '악마의 관문' },
  { classId: 'paladin', name: '자유의 축복' },
];

// ── 공대 생존기(방어 쿨기) — 특성 전용은 specId, 공용은 classId ──
export const RAID_CDS = [
  { specId: 'pr_discipline', classId: 'priest', name: '신의 권능: 방벽' },
  { specId: 'pr_holy', classId: 'priest', name: '천상의 찬가' },
  { specId: 'ev_preservation', classId: 'evoker', name: '되돌리기' },
  { specId: 'mo_mistweaver', classId: 'monk', name: '재활' },
  { specId: 'sh_resto', classId: 'shaman', name: '정신 고리 토템' },
  { specId: 'sh_resto', classId: 'shaman', name: '치유의 물결 토템' },
  { specId: 'dr_resto', classId: 'druid', name: '평온' },
  { classId: 'warrior', name: '재집결의 함성' },
  { classId: 'demonhunter', name: '어둠' },
  { specId: 'pa_holy', classId: 'paladin', name: '오라 숙련' },
  { classId: 'deathknight', name: '대마법 지대' },
];

// 한 명(app)이 특정 능력 항목을 보유하는지. specId 지정이면 1순위 특성 일치, 아니면 클래스 일치.
function memberHas(app, entry) {
  if (!app) return false;
  if (entry.specId) return app.specId === entry.specId;
  return app.classId === entry.classId;
}

/**
 * 주어진 인원(members)의 공대 능력 커버리지 분석.
 * members: [{ charName, classId, specId, classColor }]
 * 반환: { physical, magic, movement[], raidCds[] }
 *   physical/magic: { present:boolean, owners:[charName] }
 *   movement/raidCds: [{ name, owners:[charName] }] (보유자 있는 것만)
 */
export function analyzeCoverage(members) {
  const list = members || [];
  const ownersOf = (entry) => list.filter((m) => memberHas(m, entry)).map((m) => m.charName);

  const physOwners = ownersOf(DMG_DEBUFF.physical);
  const magOwners = ownersOf(DMG_DEBUFF.magic);

  const movement = MOVEMENT_ABILITIES.map((e) => ({ name: e.name, owners: ownersOf(e) })).filter((x) => x.owners.length);
  const raidCds = RAID_CDS.map((e) => ({ name: e.name, owners: ownersOf(e) })).filter((x) => x.owners.length);

  return {
    physical: { present: physOwners.length > 0, owners: physOwners },
    magic: { present: magOwners.length > 0, owners: magOwners },
    movement,
    raidCds,
  };
}

/**
 * 2조 분할 시 조정 필요 여부. 수도사/악사가 전체 2명 이상인데 한 조에만 몰려 있으면 경고.
 * groups: [membersArrayA, membersArrayB]  (각 조의 인원 배열)
 * 반환: [{ classId, label, msg }]
 */
export function splitWarnings(groups) {
  const warns = [];
  const check = (classId, label) => {
    const perGroup = groups.map((g) => g.filter((m) => m.classId === classId).length);
    const total = perGroup.reduce((a, b) => a + b, 0);
    if (total >= 2) {
      const groupsWith = perGroup.filter((n) => n > 0).length;
      if (groupsWith < 2) warns.push({ classId, label, msg: `${label} ${total}명이 한 조에 몰려 있습니다 — 조에 하나씩 나눠주세요.` });
    }
  };
  check('monk', '수도사(물리뎀증)');
  check('demonhunter', '악마사냥꾼(마법뎀증)');
  return warns;
}

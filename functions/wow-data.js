// 봇용 클래스/특성 데이터 (웹 src/lib/constants.js의 CLASSES와 동일).
// Firestore의 gamedata/classes 문서가 비어있을 때 fallback으로 사용.
const CLASSES = [
  { id: 'deathknight', name: '죽음의 기사', color: '#C41E3A', specs: [
    { id: 'dk_blood', name: '혈기', role: 'tank', range: null },
    { id: 'dk_frost', name: '냉기', role: 'dps', range: 'melee' },
    { id: 'dk_unholy', name: '부정', role: 'dps', range: 'melee' },
  ] },
  { id: 'demonhunter', name: '악마사냥꾼', color: '#A330C9', specs: [
    { id: 'dh_havoc', name: '파멸', role: 'dps', range: 'melee' },
    { id: 'dh_vengeance', name: '복수', role: 'tank', range: null },
    { id: 'dh_devourer', name: '포식', role: 'dps', range: 'ranged' },
  ] },
  { id: 'druid', name: '드루이드', color: '#FF7C0A', specs: [
    { id: 'dr_balance', name: '조화', role: 'dps', range: 'ranged' },
    { id: 'dr_feral', name: '야성', role: 'dps', range: 'melee' },
    { id: 'dr_guardian', name: '수호', role: 'tank', range: null },
    { id: 'dr_resto', name: '회복', role: 'healer', range: null },
  ] },
  { id: 'evoker', name: '기원사', color: '#33937F', specs: [
    { id: 'ev_devastation', name: '황폐', role: 'dps', range: 'ranged' },
    { id: 'ev_preservation', name: '보존', role: 'healer', range: null },
    { id: 'ev_augmentation', name: '증강', role: 'dps', range: 'ranged' },
  ] },
  { id: 'hunter', name: '사냥꾼', color: '#AAD372', specs: [
    { id: 'hu_bm', name: '야수', role: 'dps', range: 'ranged' },
    { id: 'hu_mm', name: '사격', role: 'dps', range: 'ranged' },
    { id: 'hu_survival', name: '생존', role: 'dps', range: 'melee' },
  ] },
  { id: 'mage', name: '마법사', color: '#3FC7EB', specs: [
    { id: 'ma_arcane', name: '비전', role: 'dps', range: 'ranged' },
    { id: 'ma_fire', name: '화염', role: 'dps', range: 'ranged' },
    { id: 'ma_frost', name: '냉기', role: 'dps', range: 'ranged' },
  ] },
  { id: 'monk', name: '수도사', color: '#00FF98', specs: [
    { id: 'mo_brewmaster', name: '양조', role: 'tank', range: null },
    { id: 'mo_mistweaver', name: '운무', role: 'healer', range: null },
    { id: 'mo_windwalker', name: '풍운', role: 'dps', range: 'melee' },
  ] },
  { id: 'paladin', name: '성기사', color: '#F48CBA', specs: [
    { id: 'pa_holy', name: '신성', role: 'healer', range: null },
    { id: 'pa_protection', name: '보호', role: 'tank', range: null },
    { id: 'pa_retribution', name: '징벌', role: 'dps', range: 'melee' },
  ] },
  { id: 'priest', name: '사제', color: '#FFFFFF', specs: [
    { id: 'pr_discipline', name: '수양', role: 'healer', range: null },
    { id: 'pr_holy', name: '신성', role: 'healer', range: null },
    { id: 'pr_shadow', name: '암흑', role: 'dps', range: 'ranged' },
  ] },
  { id: 'rogue', name: '도적', color: '#FFF468', specs: [
    { id: 'ro_assassination', name: '암살', role: 'dps', range: 'melee' },
    { id: 'ro_outlaw', name: '무법', role: 'dps', range: 'melee' },
    { id: 'ro_subtlety', name: '잠행', role: 'dps', range: 'melee' },
  ] },
  { id: 'shaman', name: '주술사', color: '#0070DD', specs: [
    { id: 'sh_elemental', name: '정기', role: 'dps', range: 'ranged' },
    { id: 'sh_enhancement', name: '고양', role: 'dps', range: 'melee' },
    { id: 'sh_resto', name: '복원', role: 'healer', range: null },
  ] },
  { id: 'warlock', name: '흑마법사', color: '#8788EE', specs: [
    { id: 'wl_affliction', name: '고통', role: 'dps', range: 'ranged' },
    { id: 'wl_demonology', name: '악마', role: 'dps', range: 'ranged' },
    { id: 'wl_destruction', name: '파괴', role: 'dps', range: 'ranged' },
  ] },
  { id: 'warrior', name: '전사', color: '#C69B3A', specs: [
    { id: 'wa_arms', name: '무기', role: 'dps', range: 'melee' },
    { id: 'wa_fury', name: '분노', role: 'dps', range: 'melee' },
    { id: 'wa_protection', name: '방어', role: 'tank', range: null },
  ] },
];

module.exports = { CLASSES };

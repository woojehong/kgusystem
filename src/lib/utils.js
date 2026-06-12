import { CLASSES, DIFFICULTIES, TANK_CAP } from './constants';

// ── Class / spec lookups ────────────────────────────────────────────

export function getClass(classes, classId) {
  return classes.find((c) => c.id === classId) || null;
}

export function getSpec(classes, classId, specId) {
  const cls = getClass(classes, classId);
  if (!cls) return null;
  return cls.specs.find((s) => s.id === specId) || null;
}

export const FALLBACK_CLASSES = CLASSES;

// ── Date helpers (KST local time) ───────────────────────────────────

export function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];

export function formatDateLabel(key) {
  const d = fromDateKey(key);
  return `${d.getMonth() + 1}/${d.getDate()} (${WEEKDAYS_KO[d.getDay()]})`;
}

/**
 * Builds start/end Date objects from a date key and HH:mm strings.
 * If end time is earlier than or equal to start time, the raid is
 * treated as ending on the following day (crossing midnight).
 * The raid always belongs to the start date.
 */
export function buildRaidTimes(dateKey, startTime, endTime) {
  const base = fromDateKey(dateKey);
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  const startAt = new Date(base);
  startAt.setHours(sh, sm, 0, 0);
  const endAt = new Date(base);
  endAt.setHours(eh, em, 0, 0);
  if (endAt <= startAt) endAt.setDate(endAt.getDate() + 1);
  return { startAt, endAt };
}

export function formatTimeRange(startAt, endAt) {
  const fmt = (d) =>
    `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${fmt(startAt)} ~ ${fmt(endAt)}`;
}

/** 4-week calendar matrix starting on the Sunday of the current week. */
export function buildCalendarWeeks(today = new Date()) {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  const weeks = [];
  for (let w = 0; w < 4; w += 1) {
    const week = [];
    for (let d = 0; d < 7; d += 1) {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      week.push(day);
    }
    weeks.push(week);
  }
  return weeks;
}

// ── Raid capacity ───────────────────────────────────────────────────

export function getCaps(raid) {
  const diff = DIFFICULTIES[raid.difficulty];
  const totalCap = diff ? diff.totalCap : 30;
  const healerCap = raid.healerCap ?? (diff ? diff.defaultHealers : 6);
  return {
    totalCap,
    tank: TANK_CAP,
    healer: healerCap,
    dps: totalCap - TANK_CAP - healerCap,
  };
}

export function countFillColor(current, cap) {
  if (current > cap) return 'text-red-400';
  if (current === cap) return 'text-green-400';
  return 'text-white';
}

// ── WCL ─────────────────────────────────────────────────────────────

/**
 * Warcraft Logs character URL. KR realm pages resolve with the Korean
 * realm name in the path, so the localized name is used directly.
 */
export function wclUrl(serverKo, characterName) {
  return `https://www.warcraftlogs.com/character/kr/${encodeURIComponent(serverKo)}/${encodeURIComponent(characterName)}`;
}

// ── Guild sorting: English first, then 가나다, '소속 없음' last ──────

export function sortGuilds(guilds) {
  return [...guilds].sort((a, b) => {
    if (a.isNone !== b.isNone) return a.isNone ? 1 : -1;
    const aEng = /^[A-Za-z]/.test(a.name);
    const bEng = /^[A-Za-z]/.test(b.name);
    if (aEng !== bEng) return aEng ? -1 : 1;
    return a.name.localeCompare(b.name, aEng ? 'en' : 'ko');
  });
}

// ── Misc ────────────────────────────────────────────────────────────

export function randomId(prefix = '') {
  const part = () => Math.random().toString(36).slice(2, 10);
  return `${prefix}${part()}${part()}`;
}

/** Readable text color (dark) for very bright class colors like Priest white. */
export function badgeTextStyle(color) {
  return { color, textShadow: '0 0 1px rgba(0,0,0,0.6)' };
}

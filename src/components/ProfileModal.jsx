import { useEffect, useState } from 'react';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useApp } from '../context/AppContext';
import { changePin } from '../lib/auth';
import { saveGuild } from '../lib/db';
import { PIN_RULE } from '../lib/constants';
import Modal from './Modal';
import GuildBadge, { buildBadgeStyles } from './GuildBadge';
import GuildPageEditor from './GuildPageEditor';
import CharacterEditor, { emptyCharacter, validateCharacter } from './CharacterEditor';
import { badgeTextStyle, getClass, getSpec } from '../lib/utils';
import { validateEnglishName, normalizePage } from '../lib/guildPage';

const MAX_CHARACTERS = 10;

// ── Badge editor constants (same as SuperAdminPage) ─────────────────
const SHAPE_OPTIONS = [
  { key: 'pill',          label: '알약',      clip: null, radius: '9999px' },
  { key: 'rounded-sm',    label: '소원각',    clip: null, radius: '4px' },
  { key: 'rounded-md',    label: '중원각',    clip: null, radius: '8px' },
  { key: 'rounded-lg',    label: '대원각',    clip: null, radius: '14px' },
  { key: 'rounded-xl',    label: '특대원각',  clip: null, radius: '20px' },
  { key: 'square',        label: '직각',      clip: null, radius: '2px' },
  { key: 'leaf',          label: '잎사귀',    clip: null, radius: '50% 0% 50% 0%' },
  { key: 'circle',        label: '원형',      clip: null, radius: '50%' },
  { key: 'blob',          label: '블롭',      clip: null, radius: '30% 70% 70% 30% / 30% 30% 70% 70%' },
  { key: 'sharp-round',   label: '비대칭각',  clip: null, radius: '12px 0px 12px 0px' },
  { key: 'hexagon',       label: '육각형',    clip: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)', radius: null },
  { key: 'diamond',       label: '다이아',    clip: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)', radius: null },
  { key: 'shield',        label: '방패',      clip: 'polygon(0% 0%, 100% 0%, 100% 65%, 50% 100%, 0% 65%)', radius: null },
  { key: 'octagon',       label: '팔각형',    clip: 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)', radius: null },
  { key: 'star',          label: '별',        clip: 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)', radius: null },
  { key: 'tag',           label: '태그',      clip: 'polygon(0% 0%, 85% 0%, 100% 50%, 85% 100%, 0% 100%)', radius: null },
  { key: 'chevron',       label: '쉐브론',    clip: 'polygon(15% 0%, 100% 0%, 100% 100%, 15% 100%, 0% 50%)', radius: null },
  { key: 'ribbon',        label: '리본',      clip: 'polygon(0% 0%, 100% 0%, 85% 50%, 100% 100%, 0% 100%, 15% 50%)', radius: null },
  { key: 'arrow',         label: '화살표',    clip: 'polygon(0% 20%, 65% 20%, 65% 0%, 100% 50%, 65% 100%, 65% 80%, 0% 80%)', radius: null },
  { key: 'parallelogram', label: '평행사변형',clip: 'polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)', radius: null },
  { key: 'pentagon',      label: '오각형',    clip: 'polygon(50% 0%, 100% 35%, 82% 100%, 18% 100%, 0% 35%)', radius: null },
  { key: 'trapezoid',     label: '사다리꼴',  clip: 'polygon(8% 0%, 92% 0%, 100% 100%, 0% 100%)', radius: null },
];

const BG_OPTIONS = [
  { key: 'solid',             label: '단색' },
  { key: 'gradient-h',        label: '가로 그라디언트' },
  { key: 'gradient-v',        label: '세로 그라디언트' },
  { key: 'gradient-diagonal', label: '대각선 그라디언트' },
  { key: 'gradient-3',        label: '3색 그라디언트' },
  { key: 'radial',            label: '방사형' },
  { key: 'conic',             label: '코닉' },
  { key: 'glass',             label: '유리' },
  { key: 'mesh',              label: '메시' },
  { key: 'neon',              label: '네온' },
  { key: 'stripe',            label: '스트라이프' },
  { key: 'outline',           label: '테두리만' },
  { key: 'aurora',            label: '오로라' },
  { key: 'holographic',       label: '홀로그래픽' },
  { key: 'metallic',          label: '메탈릭' },
  { key: 'frosted',           label: '프로스티드' },
  { key: 'dots',              label: '도트 패턴' },
  { key: 'fire',              label: '파이어' },
  { key: 'ocean',             label: '오션' },
  { key: 'sunset',            label: '선셋' },
  { key: 'mirror',            label: '미러' },
];

const BORDER_OPTIONS = [
  { key: 'none',          label: '없음' },
  { key: 'thin',          label: '얇게' },
  { key: 'medium',        label: '보통' },
  { key: 'thick',         label: '굵게' },
  { key: 'dashed',        label: '파선' },
  { key: 'dotted',        label: '점선' },
  { key: 'double',        label: '이중선' },
  { key: 'gradient',      label: '그라디언트' },
  { key: 'outline-only',  label: '아웃라인' },
  { key: 'glow',          label: '글로우' },
  { key: 'neon-glow',     label: '네온 글로우' },
  { key: 'inner',         label: '안쪽선' },
  { key: 'groove',        label: '홈선' },
  { key: 'ridge',         label: '융기선' },
  { key: 'inset-2',       label: '두꺼운 안쪽' },
  { key: 'multi-glow',    label: '다중 글로우' },
  { key: 'thick-neon',    label: '두꺼운 네온' },
  { key: 'top-accent',    label: '상단 강조' },
  { key: 'bottom-accent', label: '하단 강조' },
  { key: 'sharp-outer',   label: '날카로운 외곽' },
];

const EFFECT_OPTIONS = [
  { key: 'none',          label: '없음' },
  { key: 'glow-sm',       label: '글로우(소)' },
  { key: 'glow-lg',       label: '글로우(대)' },
  { key: 'shimmer',       label: '쉬머 ✦' },
  { key: 'pulse',         label: '펄스 ✦' },
  { key: 'inner-glow',    label: '내부 글로우' },
  { key: 'shadow',        label: '그림자' },
  { key: 'emboss',        label: '엠보스' },
  { key: 'holo',          label: '홀로그램' },
  { key: 'float',         label: '플로팅' },
  { key: 'tilt',          label: '기울기 그림자' },
  { key: 'fire-glow',     label: '파이어 글로우' },
  { key: 'ice-glow',      label: '아이스 글로우' },
  { key: 'deep',          label: '깊은 그림자' },
  { key: 'rainbow-aura',  label: '레인보우 오라' },
  { key: 'sepia',         label: '세피아' },
  { key: 'blur-out',      label: '블러 아웃' },
  { key: 'flicker',       label: '깜빡임 ✦' },
];

const TEXT_COLOR_OPTIONS = [
  { key: 'auto',   label: '자동' },
  { key: 'white',  label: '흰색' },
  { key: 'dark',   label: '어두운색' },
  { key: 'custom', label: '직접 지정' },
];

const TEXT_STYLE_OPTIONS = [
  { key: 'normal',   label: '보통' },
  { key: 'bold',     label: '굵게' },
  { key: 'outlined', label: '외곽선' },
  { key: 'shadow',   label: '그림자' },
  { key: 'glow',     label: '글로우' },
];

function OptBtn({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1 rounded-lg text-[11px] font-semibold border transition ${
        active
          ? 'border-indigo-400 bg-indigo-500/15 text-indigo-200'
          : 'border-base-700 bg-base-800 text-base-400 hover:text-base-200 hover:border-base-500'
      }`}
    >
      {children}
    </button>
  );
}

function BadgeSection({ label, children }) {
  return (
    <div>
      <p className="text-[11px] font-bold text-base-400 uppercase tracking-wider mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

// ── BasicTab ─────────────────────────────────────────────────────────
function BasicTab({ onClose }) {
  const { userId, profile } = useApp();
  const [leaderCapable, setLeaderCapable] = useState(!!profile.leaderCapable);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPin2, setNewPin2] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  // 디스코드 연동 코드
  const [linkCode, setLinkCode] = useState(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkErr, setLinkErr] = useState(null);

  const genLinkCode = async () => {
    setLinkErr(null);
    setLinkBusy(true);
    try {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      await setDoc(doc(db, 'linkCodes', code), {
        userId,
        nickname: profile.nickname,
        expiresAt: Date.now() + 10 * 60 * 1000, // 10분
      });
      setLinkCode(code);
    } catch {
      setLinkErr('코드 생성에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setLinkBusy(false);
    }
  };

  const save = async () => {
    setMsg(null);
    setBusy(true);
    try {
      await updateDoc(doc(db, 'users', userId), { leaderCapable });

      const wantsPinChange = currentPin || newPin || newPin2;
      if (wantsPinChange) {
        if (!PIN_RULE.pattern.test(newPin)) throw new Error('새 PIN은 숫자 4자리입니다.');
        if (newPin !== newPin2) throw new Error('새 PIN이 일치하지 않습니다.');
        await changePin(currentPin, newPin);
        setCurrentPin('');
        setNewPin('');
        setNewPin2('');
      }
      setMsg({ ok: true, text: '저장되었습니다.' });
      setTimeout(onClose, 600);
    } catch (e) {
      setMsg({ ok: false, text: e.message || '저장에 실패했습니다.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="label-sm">닉네임</label>
        <input className="input-base opacity-60 cursor-not-allowed" value={profile.nickname} disabled />
        <p className="text-[11px] text-base-500 mt-1">닉네임 변경은 슈퍼관리자에게 문의하세요.</p>
      </div>

      <div>
        <label className="label-sm">소속 길드</label>
        <div className="flex"><GuildBadge guildId={profile.guildId} /></div>
        <p className="text-[11px] text-base-500 mt-1">소속 길드 변경은 슈퍼관리자에게 문의하세요.</p>
      </div>

      <div className="flex items-center justify-between p-3 rounded-xl bg-base-850 border border-base-700">
        <div>
          <p className="font-medium text-sm">공대장 가능</p>
          <p className="text-xs text-base-400">레이드 공대장 후보로 표시됩니다</p>
        </div>
        <button
          type="button"
          onClick={() => setLeaderCapable(!leaderCapable)}
          className={`relative w-11 h-6 rounded-full transition ${leaderCapable ? 'bg-indigo-500' : 'bg-base-600'}`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
              leaderCapable ? 'left-[22px]' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      <div className="p-3 rounded-xl bg-base-850 border border-base-700 space-y-3">
        <p className="font-medium text-sm">PIN 변경</p>
        <input
          className="input-base"
          type="password"
          inputMode="numeric"
          maxLength={4}
          placeholder="현재 PIN"
          value={currentPin}
          onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            className="input-base"
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="새 PIN"
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
          />
          <input
            className="input-base"
            type="password"
            inputMode="numeric"
            maxLength={4}
            placeholder="새 PIN 확인"
            value={newPin2}
            onChange={(e) => setNewPin2(e.target.value.replace(/\D/g, ''))}
          />
        </div>
      </div>

      {/* 디스코드 연동 */}
      <div className="p-3 rounded-xl bg-base-850 border border-base-700 space-y-2">
        <div className="flex items-center justify-between">
          <p className="font-medium text-sm">디스코드 연동</p>
          {profile.discordId ? (
            <span className="text-[11px] text-green-400 font-bold">✓ 연동됨</span>
          ) : (
            <span className="text-[11px] text-base-500">미연동</span>
          )}
        </div>
        <p className="text-xs text-base-400 leading-relaxed">
          코드를 생성한 뒤, 디스코드에서 <code className="text-base-300">/연동 코드</code> 를 입력하면 연결됩니다. (10분 유효)
        </p>
        {linkCode && (
          <div className="text-center py-2 rounded-lg bg-base-900/60 border border-base-700">
            <p className="text-2xl font-black tracking-[0.3em] text-indigo-300">{linkCode}</p>
            <p className="text-[11px] text-base-500 mt-1">디스코드에 입력: <span className="text-base-300">/연동 {linkCode}</span></p>
          </div>
        )}
        <button type="button" className="btn-ghost w-full" disabled={linkBusy} onClick={genLinkCode}>
          {linkBusy ? '생성 중...' : linkCode ? '새 코드 생성' : (profile.discordId ? '다시 연동하기 (새 코드)' : '연동 코드 생성')}
        </button>
        {linkErr && <p className="text-xs text-red-400 text-center">{linkErr}</p>}
      </div>

      {msg && (
        <p className={`text-sm text-center ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>
          {msg.text}
        </p>
      )}

      <button type="button" className="btn-primary w-full" disabled={busy} onClick={save}>
        {busy ? '저장 중...' : '저장'}
      </button>
    </div>
  );
}

// ── CharactersTab ─────────────────────────────────────────────────────
function CharactersTab() {
  const { userId, profile, gamedata } = useApp();
  const [editingIndex, setEditingIndex] = useState(null);
  const [draft, setDraft] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const characters = profile.characters || [];

  const persist = async (nextCharacters, nextMainIndex) => {
    setBusy(true);
    setMsg(null);
    try {
      await updateDoc(doc(db, 'users', userId), {
        characters: nextCharacters,
        mainCharIndex: nextMainIndex ?? profile.mainCharIndex ?? 0,
      });
    } catch {
      setMsg('저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (index) => {
    setEditingIndex(index);
    setDraft(
      index === characters.length ? emptyCharacter(gamedata.servers) : { ...characters[index] }
    );
    setMsg(null);
  };

  const saveDraft = async () => {
    const err = validateCharacter(draft);
    if (err) { setMsg(err); return; }
    const next = [...characters];
    next[editingIndex] = { ...draft, name: draft.name.trim() };
    await persist(next);
    setEditingIndex(null);
    setDraft(null);
  };

  const removeCharacter = async (index) => {
    if (characters.length <= 1) { setMsg('캐릭터는 최소 1개가 필요합니다.'); return; }
    const next = characters.filter((_, i) => i !== index);
    let main = profile.mainCharIndex ?? 0;
    if (main === index) main = 0;
    else if (main > index) main -= 1;
    await persist(next, main);
    setEditingIndex(null);
  };

  if (editingIndex !== null && draft) {
    return (
      <div className="space-y-4">
        <p className="font-semibold text-sm text-base-200">
          캐릭터 {editingIndex + 1} {editingIndex === characters.length ? '추가' : '수정'}
        </p>
        <CharacterEditor value={draft} onChange={setDraft} />
        {msg && <p className="text-sm text-red-400">{msg}</p>}
        <div className="flex gap-2">
          <button type="button" className="btn-ghost flex-1" onClick={() => setEditingIndex(null)}>취소</button>
          {editingIndex < characters.length && (
            <button type="button" className="btn-danger" disabled={busy} onClick={() => removeCharacter(editingIndex)}>삭제</button>
          )}
          <button type="button" className="btn-primary flex-1" disabled={busy} onClick={saveDraft}>저장</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {characters.map((char, i) => {
        const cls = getClass(gamedata.classes, char.classId);
        const isMain = (profile.mainCharIndex ?? 0) === i;
        return (
          <div key={char.id || i} className="flex items-center justify-between p-3 rounded-xl bg-base-850 border border-base-700">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold truncate" style={badgeTextStyle(cls?.color || '#fff')}>
                  {char.name}
                </span>
                {isMain && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold shrink-0">대표</span>
                )}
              </div>
              <p className="text-xs text-base-400 mt-0.5 truncate">
                {char.server} · {cls?.name || '?'} ·{' '}
                {(char.specs || []).map((sId, idx) => {
                  const spec = getSpec(gamedata.classes, char.classId, sId);
                  return spec ? `${idx + 1}.${spec.name}` : null;
                }).filter(Boolean).join(' ')}
              </p>
            </div>
            <div className="flex gap-1.5 shrink-0 ml-2">
              {!isMain && (
                <button type="button" className="text-xs px-2 py-1.5 rounded-lg bg-base-700 hover:bg-base-600 transition" disabled={busy} onClick={() => persist(characters, i)}>
                  대표 설정
                </button>
              )}
              <button type="button" className="text-xs px-2 py-1.5 rounded-lg bg-base-700 hover:bg-base-600 transition" onClick={() => startEdit(i)}>
                수정
              </button>
            </div>
          </div>
        );
      })}

      {characters.length < MAX_CHARACTERS && (
        <button
          type="button"
          className="w-full py-3 rounded-xl border border-dashed border-base-600 text-base-400 hover:text-base-200 hover:border-base-400 transition text-sm font-medium"
          onClick={() => startEdit(characters.length)}
        >
          + 캐릭터 추가 ({characters.length}/{MAX_CHARACTERS})
        </button>
      )}

      {msg && <p className="text-sm text-red-400 text-center">{msg}</p>}
    </div>
  );
}

// ── GuildTab (길드장 전용) ────────────────────────────────────────────
function GuildTab({ onClose }) {
  const { profile, guilds } = useApp();
  const guild = guilds.find((g) => g.id === profile.guildId);

  const [badgeTab, setBadgeTab] = useState('info');
  const [name, setName] = useState(guild?.name || '');
  const [shortName, setShortName] = useState(guild?.shortName || '');
  const [badgeName, setBadgeName] = useState(guild?.badgeName || '');
  const [color, setColor] = useState(guild?.color || '#7dd3fc');
  const englishLocked = !!guild?.englishName;
  const [englishName, setEnglishName] = useState(guild?.englishName || '');
  const [page, setPage] = useState(normalizePage(guild?.page, guild?.color));

  const eb = guild?.badge || {};
  const [badgeShape,           setBadgeShape]           = useState(eb.shape           || 'pill');
  const [badgeBgType,          setBadgeBgType]          = useState(eb.bgType          || 'solid');
  const [badgeColor2,          setBadgeColor2]          = useState(eb.color2          || guild?.color || '#7dd3fc');
  const [badgeColor3,          setBadgeColor3]          = useState(eb.color3          || guild?.color || '#7dd3fc');
  const [badgeBorder,          setBadgeBorder]          = useState(eb.border          || 'thin');
  const [badgeBorderColor,     setBadgeBorderColor]     = useState(eb.borderColor     || guild?.color || '#7dd3fc');
  const [badgeEffect,          setBadgeEffect]          = useState(eb.effect          || 'none');
  const [badgeTextColor,       setBadgeTextColor]       = useState(eb.textColor       || 'auto');
  const [badgeTextCustomColor, setBadgeTextCustomColor] = useState(eb.textCustomColor || guild?.color || '#7dd3fc');
  const [badgeTextStyle_,      setBadgeTextStyle_]      = useState(eb.textStyle       || 'normal');

  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const needsColor2 = [
    'gradient-h','gradient-v','gradient-diagonal','gradient-3','radial','conic',
    'glass','mesh','stripe','aurora','holographic','metallic','fire','ocean','sunset',
  ].includes(badgeBgType);
  const needsColor3 = ['gradient-3','conic','mesh','aurora','holographic','ocean','sunset'].includes(badgeBgType);

  const previewBadgeConfig = {
    shape: badgeShape, bgType: badgeBgType,
    color2: badgeColor2, color3: badgeColor3,
    border: badgeBorder, borderColor: badgeBorderColor,
    effect: badgeEffect, textColor: badgeTextColor,
    textCustomColor: badgeTextCustomColor, textStyle: badgeTextStyle_,
  };
  const { style: pvStyle, animClass: pvAnim, isClipPath: pvClip } = buildBadgeStyles(previewBadgeConfig, color);

  const save = async () => {
    setMsg(null);
    if (!name.trim()) { setMsg({ ok: false, text: '길드명을 입력해주세요.' }); return; }
    const sn = shortName.trim();
    if (sn && [...sn].length > 4) { setMsg({ ok: false, text: '약식명은 한글/영문 4자 이하로 입력해주세요.' }); return; }
    const en = englishName.trim();
    if (!englishLocked && en) {
      const enErr = validateEnglishName(en);
      if (enErr) { setMsg({ ok: false, text: enErr }); return; }
    }
    setBusy(true);
    try {
      const payload = {
        ...guild,
        name: name.trim(),
        shortName: sn,
        badgeName: badgeName.trim(),
        color,
        page,
        badge: {
          shape: badgeShape, bgType: badgeBgType,
          color2: badgeColor2, color3: badgeColor3,
          border: badgeBorder, borderColor: badgeBorderColor,
          effect: badgeEffect, textColor: badgeTextColor,
          textCustomColor: badgeTextCustomColor, textStyle: badgeTextStyle_,
        },
      };
      // 영문명은 최초 1회만 길드장이 설정 가능 (이후 잠김 · 슈퍼관리자만 변경).
      if (!englishLocked && en) payload.englishName = en;
      await saveGuild(profile.guildId, payload);
      setMsg({ ok: true, text: '저장되었습니다.' });
      setTimeout(onClose, 600);
    } catch {
      setMsg({ ok: false, text: '저장에 실패했습니다.' });
    } finally {
      setBusy(false);
    }
  };

  if (!guild) {
    return <p className="text-sm text-base-400 text-center py-6">소속 길드 정보를 불러올 수 없습니다.</p>;
  }

  return (
    <div className="space-y-4">
      {/* 서브 탭 */}
      <div className="flex gap-1 p-1 rounded-xl bg-base-850 border border-base-700">
        {[['info', '기본 정보'], ['badge', '뱃지 수정'], ['page', '소개글']].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setBadgeTab(key)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition ${
              badgeTab === key ? 'bg-base-700 text-white' : 'text-base-400 hover:text-base-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 기본 정보 */}
      {badgeTab === 'info' && (
        <div className="space-y-4">
          <div>
            <label className="label-sm">길드명</label>
            <input className="input-base" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label-sm">약식명 <span className="text-base-500 font-normal">(한글/영문 4자 이하 · 달력 표시용)</span></label>
            <input
              className="input-base"
              value={shortName}
              onChange={(e) => setShortName(e.target.value)}
              placeholder="예: 스타폴, Star"
              maxLength={8}
            />
          </div>
          <div>
            <label className="label-sm">뱃지명 <span className="text-base-500 font-normal">(뱃지에 표시 · 이모지/줄임 가능)</span></label>
            <input
              className="input-base"
              value={badgeName}
              onChange={(e) => setBadgeName(e.target.value)}
              placeholder="예: 🌲스타폴, SF (비우면 길드명)"
              maxLength={16}
            />
          </div>
          <div>
            <label className="label-sm">영문명 <span className="text-base-500 font-normal">(로고 파일명 · 페이지 주소)</span></label>
            <input
              className="input-base"
              value={englishName}
              onChange={(e) => setEnglishName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="예: starfall"
              disabled={englishLocked}
            />
            {englishLocked ? (
              <p className="text-[11px] text-base-500 mt-1">
                최초 설정 후에는 변경할 수 없습니다. 변경이 필요하면 슈퍼관리자에게 문의하세요.
              </p>
            ) : (
              <p className="text-[11px] text-amber-300/90 mt-1 leading-relaxed">
                ⚠ 영문 소문자·숫자·하이픈(-)만, 띄어쓰기 불가. <b>최초 1회 설정 후 수정 불가</b>하니 신중히 입력하세요.
                로고는 <code className="text-base-300">public/guildflag/영문명.png</code> 로 넣습니다.
              </p>
            )}
          </div>
          <div>
            <label className="label-sm">시그니처 컬러</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-12 h-10 rounded-lg bg-base-800 border border-base-600 cursor-pointer"
              />
              <input className="input-base flex-1" value={color} onChange={(e) => setColor(e.target.value)} />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-base-850 border border-base-700 text-[11px] text-base-400 leading-relaxed">
            <b className="text-base-300">이미지 규격 안내</b>
            <br />· 로고: <b className="text-base-300">512 × 512</b> (정사각 · 배경 투명 PNG)
            <br />· 깃발: <b className="text-base-300">512 × 640</b> (4:5 · 배경 투명 PNG)
            <br />만들어서 관리자에게 전달하면 등록해 드립니다.
          </div>
        </div>
      )}

      {/* 뱃지 수정 */}
      {badgeTab === 'badge' && (
        <div className="space-y-4">
          {/* 미리보기 */}
          <div className="flex flex-col items-center gap-3 py-4 rounded-2xl bg-base-850 border border-base-700">
            <p className="text-[11px] text-base-500 font-semibold uppercase tracking-wider">미리보기</p>
            <span
              className={`inline-flex items-center justify-center text-sm font-semibold px-5 py-2 ${pvAnim}`}
              style={{
                ...pvStyle,
                ...(pvClip ? { minWidth: '6rem', minHeight: '2.4rem' } : { minWidth: '6rem' }),
              }}
            >
              {badgeName || name || guild.name}
            </span>
            <div className="flex gap-3">
              <span className="text-[11px] text-base-500">sm:</span>
              <GuildBadge guildName={badgeName || name || guild.name} guildColor={color} badgeConfig={previewBadgeConfig} size="sm" />
              <span className="text-[11px] text-base-500">xs:</span>
              <GuildBadge guildName={badgeName || name || guild.name} guildColor={color} badgeConfig={previewBadgeConfig} size="xs" />
            </div>
          </div>

          <BadgeSection label="모양">
            {SHAPE_OPTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setBadgeShape(s.key)}
                className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg border text-[10px] font-semibold transition ${
                  badgeShape === s.key
                    ? 'border-indigo-400 bg-indigo-500/10 text-indigo-200'
                    : 'border-base-700 bg-base-800 text-base-500 hover:text-base-200 hover:border-base-500'
                }`}
              >
                <span style={{ display:'inline-block', width:22, height:14, background:`${color}88`, clipPath: s.clip || undefined, borderRadius: s.clip ? undefined : s.radius }} />
                {s.label}
              </button>
            ))}
          </BadgeSection>

          <BadgeSection label="배경 스타일">
            {BG_OPTIONS.map((b) => (
              <OptBtn key={b.key} active={badgeBgType === b.key} onClick={() => setBadgeBgType(b.key)}>{b.label}</OptBtn>
            ))}
          </BadgeSection>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-base-400 w-24 shrink-0">시그니처 컬러</span>
              <span className="w-6 h-6 rounded border border-base-600" style={{ background: color }} />
              <span className="text-[11px] text-base-400">{color} <span className="text-base-600">(기본 정보 탭에서 변경)</span></span>
            </div>
            {needsColor2 && (
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-base-400 w-24 shrink-0">세컨드 컬러</label>
                <input type="color" value={badgeColor2} onChange={(e) => setBadgeColor2(e.target.value)} className="w-8 h-8 rounded border border-base-600 cursor-pointer bg-transparent" />
                <input className="input-base flex-1 text-xs py-1" value={badgeColor2} onChange={(e) => setBadgeColor2(e.target.value)} />
              </div>
            )}
            {needsColor3 && (
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-base-400 w-24 shrink-0">써드 컬러</label>
                <input type="color" value={badgeColor3} onChange={(e) => setBadgeColor3(e.target.value)} className="w-8 h-8 rounded border border-base-600 cursor-pointer bg-transparent" />
                <input className="input-base flex-1 text-xs py-1" value={badgeColor3} onChange={(e) => setBadgeColor3(e.target.value)} />
              </div>
            )}
          </div>

          <BadgeSection label="테두리">
            {BORDER_OPTIONS.map((b) => (
              <OptBtn key={b.key} active={badgeBorder === b.key} onClick={() => setBadgeBorder(b.key)}>{b.label}</OptBtn>
            ))}
          </BadgeSection>

          {badgeBorder !== 'none' && (
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-base-400 w-24 shrink-0">테두리 색</label>
              <input type="color" value={badgeBorderColor} onChange={(e) => setBadgeBorderColor(e.target.value)} className="w-8 h-8 rounded border border-base-600 cursor-pointer bg-transparent" />
              <input className="input-base flex-1 text-xs py-1" value={badgeBorderColor} onChange={(e) => setBadgeBorderColor(e.target.value)} />
            </div>
          )}

          <BadgeSection label="이펙트">
            {EFFECT_OPTIONS.map((e) => (
              <OptBtn key={e.key} active={badgeEffect === e.key} onClick={() => setBadgeEffect(e.key)}>{e.label}</OptBtn>
            ))}
          </BadgeSection>

          <BadgeSection label="텍스트 색">
            {TEXT_COLOR_OPTIONS.map((t) => (
              <OptBtn key={t.key} active={badgeTextColor === t.key} onClick={() => setBadgeTextColor(t.key)}>{t.label}</OptBtn>
            ))}
          </BadgeSection>

          {badgeTextColor === 'custom' && (
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-base-400 w-24 shrink-0">텍스트 색상</label>
              <input type="color" value={badgeTextCustomColor} onChange={(e) => setBadgeTextCustomColor(e.target.value)} className="w-8 h-8 rounded border border-base-600 cursor-pointer bg-transparent" />
              <input className="input-base flex-1 text-xs py-1" value={badgeTextCustomColor} onChange={(e) => setBadgeTextCustomColor(e.target.value)} />
            </div>
          )}

          <BadgeSection label="텍스트 스타일">
            {TEXT_STYLE_OPTIONS.map((t) => (
              <OptBtn key={t.key} active={badgeTextStyle_ === t.key} onClick={() => setBadgeTextStyle_(t.key)}>{t.label}</OptBtn>
            ))}
          </BadgeSection>
        </div>
      )}

      {/* 소개글 */}
      {badgeTab === 'page' && (
        <GuildPageEditor
          value={page}
          onChange={setPage}
          guildColor={color}
          guildName={name || guild?.name || '길드'}
          guildEnglishName={guild?.englishName || ''}
          guildLogoPath={guild?.logoPath || ''}
          guildBadge={previewBadgeConfig}
          guildBadgeName={badgeName || name || guild?.name || ''}
        />
      )}

      {msg && (
        <p className={`text-sm text-center ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>
      )}

      <button type="button" className="btn-primary w-full" disabled={busy} onClick={save}>
        {busy ? '저장 중...' : '저장'}
      </button>
    </div>
  );
}

// ── ProfileModal ──────────────────────────────────────────────────────
export default function ProfileModal({ open, onClose }) {
  const { profile } = useApp();
  const [tab, setTab] = useState('basic');

  useEffect(() => {
    if (open) setTab('basic');
  }, [open]);

  const tabs = [
    ['basic', '기본 정보'],
    ['characters', '캐릭터 정보'],
    ...(profile?.isGuildMaster ? [['guild', '길드 정보']] : []),
  ];

  return (
    <Modal open={open} onClose={onClose} title="프로필 수정">
      <div className="flex gap-1 p-1 rounded-xl bg-base-850 mb-5">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
              tab === key ? 'bg-base-700 text-white' : 'text-base-400 hover:text-base-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'basic'      && <BasicTab onClose={onClose} />}
      {tab === 'characters' && <CharactersTab />}
      {tab === 'guild'      && <GuildTab onClose={onClose} />}
    </Modal>
  );
}

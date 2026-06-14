import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { signIn, signUp, lookupNickname } from '../lib/auth';
import { PIN_RULE } from '../lib/constants';
import CharacterEditor, { emptyCharacter, validateCharacter } from '../components/CharacterEditor';
import GuildBadge from '../components/GuildBadge';

// ── Helpers ──────────────────────────────────────────────────────────

const KOREAN_ONLY = /^[가-힣]+$/;
const ENGLISH_ONLY = /^[A-Za-z]+$/;

/**
 * Returns a specific error string, or null if valid.
 * Korean: 2–7 chars. English: 2–11 chars. No mixing, numbers, or symbols.
 */
function validateNicknameDetailed(name) {
  if (!name || name.length === 0) return '닉네임을 입력해주세요.';
  if (name.length === 1) return '닉네임이 너무 짧습니다. (최소 2자)';

  const isKo = KOREAN_ONLY.test(name);
  const isEn = ENGLISH_ONLY.test(name);

  if (!isKo && !isEn) {
    return '한글만 또는 영문만 사용 가능합니다. (혼용·숫자·특수문자 불가)';
  }
  if (isKo && name.length >= 8) {
    return '닉네임이 너무 깁니다. (한글 최대 7자)';
  }
  if (isEn && name.length >= 12) {
    return '닉네임이 너무 깁니다. (영문 최대 11자)';
  }
  return null;
}

// ── Sub-components ───────────────────────────────────────────────────

function PinInput({ value, onChange, autoFocus }) {
  return (
    <input
      className="input-base text-center text-2xl tracking-[0.6em] font-bold"
      type="password"
      inputMode="numeric"
      autoComplete="off"
      maxLength={4}
      value={value}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
      placeholder="••••"
    />
  );
}

// ── Page ─────────────────────────────────────────────────────────────

export default function LoginPage() {
  const navigate = useNavigate();
  const { authUser, profile, guilds, gamedata } = useApp();
  const [mode, setMode] = useState('nickname'); // nickname | pin | signup
  const [nickname, setNickname] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // signup state
  const [signupStep, setSignupStep] = useState(0);
  const [signupPin, setSignupPin] = useState('');
  const [signupPin2, setSignupPin2] = useState('');
  const [guildId, setGuildId] = useState('');
  const [character, setCharacter] = useState(() => emptyCharacter(gamedata.servers));

  if (authUser && profile) {
    return <Navigate to={profile.role === 'super' ? '/kga_adminnn' : '/'} replace />;
  }

  // Free input — 특수문자·숫자·한영혼합도 입력은 허용하고, '다음'을 누를 때만
  // validateNicknameDetailed로 검증해 에러 메시지를 띄운다. (입력 자체는 막지 않음)
  const handleNicknameChange = (e) => {
    setNickname(e.target.value.slice(0, 20));
  };

  const handleNicknameNext = async () => {
    setError('');
    const name = nickname.trim();
    const validationError = validateNicknameDetailed(name);
    if (validationError) {
      setError(validationError);
      return;
    }
    setBusy(true);
    try {
      const mapping = await lookupNickname(name);
      setNickname(name);
      if (mapping) {
        setMode('pin');
      } else {
        setSignupStep(0);
        setMode('signup');
      }
    } catch {
      setError('연결에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = async () => {
    setError('');
    if (!PIN_RULE.pattern.test(pin)) {
      setError('PIN은 숫자 4자리입니다.');
      return;
    }
    setBusy(true);
    try {
      await signIn(nickname, pin);
      navigate('/', { replace: true });
    } catch (e) {
      setError(e.message || '로그인에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const handleSignup = async () => {
    setError('');
    const charError = validateCharacter(character);
    if (charError) {
      setError(charError);
      return;
    }
    setBusy(true);
    try {
      await signUp({
        nickname,
        pin: signupPin,
        guildId,
        character: { ...character, name: character.name.trim() },
        leaderCapable: false,
      });
      navigate('/', { replace: true });
    } catch (e) {
      setError(e.message || '가입에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const signupNext = () => {
    setError('');
    if (signupStep === 0) {
      if (!PIN_RULE.pattern.test(signupPin)) {
        setError('PIN은 숫자 4자리입니다.');
        return;
      }
      if (signupPin !== signupPin2) {
        setError('PIN이 일치하지 않습니다.');
        return;
      }
      setSignupStep(1);
    } else if (signupStep === 1) {
      if (!guildId) {
        setError('소속 길드를 선택해주세요.');
        return;
      }
      setSignupStep(2);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10">
      {/* Logo */}
      <div className="text-center mb-8">
        <h1 className="text-5xl font-black tracking-tight bg-gradient-to-b from-white to-base-400 bg-clip-text text-transparent">
          KWGU
        </h1>
        <p className="mt-1 font-semibold tracking-[0.3em] bg-gradient-to-b from-white to-base-400 bg-clip-text text-transparent">한.길.련</p>
      </div>

      <div className="w-full max-w-md card p-6">

        {/* ── 닉네임 입력 ── */}
        {mode === 'nickname' && (
          <div className="space-y-4">
            <div>
              <label className="label-sm">닉네임</label>
              <input
                className="input-base"
                value={nickname}
                autoFocus
                onChange={handleNicknameChange}
                onKeyDown={(e) => e.key === 'Enter' && handleNicknameNext()}
                placeholder="한글 2~7자 또는 영문 2~11자"
              />
              <p className="mt-1.5 text-xs text-base-400">
                한글만 또는 영문만 사용 가능 · 혼용·숫자·특수문자 불가
              </p>
            </div>

            <button
              type="button"
              className="btn-primary w-full"
              disabled={busy}
              onClick={handleNicknameNext}
            >
              {busy ? '확인 중...' : '다음'}
            </button>

            {/* 닉네임 안내 */}
            <div className="p-4 rounded-xl bg-base-850 border border-base-600 space-y-2">
              <p className="text-sm font-bold text-base-100">💡 닉네임 안내</p>
              <p className="text-sm text-base-200 leading-relaxed">
                앞으로 로그인할 때 사용할 닉네임입니다. 편한 걸 사용하셔도 됩니다.
                인게임 아이디와 동일할 필요는 없습니다.
              </p>
              <p className="text-sm font-semibold text-amber-300">
                ⚠ 한번 정한 닉네임은 꼭 기억해주세요. 찾을 방법이 없습니다.
              </p>
            </div>
          </div>
        )}

        {/* ── PIN 로그인 ── */}
        {mode === 'pin' && (
          <div className="space-y-4">
            <p className="text-center text-base-200">
              <span className="font-bold text-white">{nickname}</span> 님, PIN을 입력해주세요
            </p>
            <PinInput value={pin} onChange={setPin} autoFocus />
            <button
              type="button"
              className="btn-primary w-full"
              disabled={busy}
              onClick={handleLogin}
            >
              {busy ? '로그인 중...' : '로그인'}
            </button>
            <button
              type="button"
              className="w-full text-sm text-base-300 hover:text-base-100 transition"
              onClick={() => {
                setMode('nickname');
                setPin('');
                setError('');
              }}
            >
              ← 닉네임 다시 입력
            </button>
          </div>
        )}

        {/* ── 회원가입 ── */}
        {mode === 'signup' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-bold text-base-100">
                회원가입{' '}
                <span className="text-indigo-300">{nickname}</span>
              </p>
              <span className="text-xs text-base-300 font-semibold">{signupStep + 1} / 3</span>
            </div>

            {signupStep === 0 && (
              <>
                <div>
                  <label className="label-sm">PIN 4자리 설정</label>
                  <PinInput value={signupPin} onChange={setSignupPin} autoFocus />
                </div>
                <div>
                  <label className="label-sm">PIN 확인</label>
                  <PinInput value={signupPin2} onChange={setSignupPin2} />
                </div>
              </>
            )}

            {signupStep === 1 && (
              <div>
                <label className="label-sm">소속 길드</label>
                <div className="space-y-2">
                  {guilds.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setGuildId(g.id)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition ${
                        guildId === g.id
                          ? 'border-indigo-400 bg-indigo-500/10'
                          : 'border-base-600 bg-base-800 hover:bg-base-700'
                      }`}
                    >
                      <GuildBadge guildId={g.id} />
                      {guildId === g.id && (
                        <span className="text-indigo-300 text-sm font-bold">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {signupStep === 2 && (
              <>
                <p className="text-sm text-base-200">대표 캐릭터를 등록해주세요.</p>
                <CharacterEditor value={character} onChange={setCharacter} />
              </>
            )}

            <div className="flex gap-2">
              {signupStep > 0 && (
                <button
                  type="button"
                  className="btn-ghost flex-1"
                  onClick={() => {
                    setError('');
                    setSignupStep(signupStep - 1);
                  }}
                >
                  이전
                </button>
              )}
              {signupStep < 2 ? (
                <button type="button" className="btn-primary flex-1" onClick={signupNext}>
                  다음
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-primary flex-1"
                  disabled={busy}
                  onClick={handleSignup}
                >
                  {busy ? '가입 중...' : '가입 완료'}
                </button>
              )}
            </div>

            <button
              type="button"
              className="w-full text-sm text-base-300 hover:text-base-100 transition"
              onClick={() => {
                setMode('nickname');
                setError('');
              }}
            >
              ← 처음으로
            </button>
          </div>
        )}

        {error && (
          <p className="mt-3 text-sm text-red-400 text-center font-medium">{error}</p>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { signIn, signUp, lookupNickname } from '../lib/auth';
import { validateNickname, NICKNAME_RULE, PIN_RULE } from '../lib/constants';
import CharacterEditor, { emptyCharacter, validateCharacter } from '../components/CharacterEditor';
import GuildBadge from '../components/GuildBadge';

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

  const handleNicknameNext = async () => {
    setError('');
    const name = nickname.trim();
    if (!validateNickname(name)) {
      setError(NICKNAME_RULE.hint);
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
      <div className="text-center mb-8">
        <h1 className="text-5xl font-black tracking-tight bg-gradient-to-b from-white to-base-400 bg-clip-text text-transparent">
          KGU
        </h1>
        <p className="text-base-400 mt-1 font-medium tracking-[0.3em]">한길련</p>
      </div>

      <div className="w-full max-w-md card p-6">
        {mode === 'nickname' && (
          <div className="space-y-4">
            <div>
              <label className="label-sm">닉네임</label>
              <input
                className="input-base"
                value={nickname}
                autoFocus
                onChange={(e) => setNickname(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleNicknameNext()}
                placeholder={NICKNAME_RULE.hint}
              />
            </div>
            <button type="button" className="btn-primary w-full" disabled={busy} onClick={handleNicknameNext}>
              {busy ? '확인 중...' : '다음'}
            </button>
            <p className="text-xs text-base-400 text-center">
              처음이라면 닉네임 입력 후 바로 가입이 시작됩니다.
            </p>
          </div>
        )}

        {mode === 'pin' && (
          <div className="space-y-4">
            <p className="text-center text-base-200">
              <span className="font-bold text-white">{nickname}</span> 님, PIN을 입력해주세요
            </p>
            <PinInput value={pin} onChange={setPin} autoFocus />
            <button type="button" className="btn-primary w-full" disabled={busy} onClick={handleLogin}>
              {busy ? '로그인 중...' : '로그인'}
            </button>
            <button
              type="button"
              className="w-full text-sm text-base-400 hover:text-base-200 transition"
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

        {mode === 'signup' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="font-bold">
                회원가입 <span className="text-indigo-400">{nickname}</span>
              </p>
              <span className="text-xs text-base-400">{signupStep + 1} / 3</span>
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
                          : 'border-base-700 bg-base-800 hover:bg-base-700'
                      }`}
                    >
                      <GuildBadge guildId={g.id} />
                      {guildId === g.id && <span className="text-indigo-400 text-sm">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {signupStep === 2 && (
              <>
                <p className="text-sm text-base-400">대표 캐릭터를 등록해주세요.</p>
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
                <button type="button" className="btn-primary flex-1" disabled={busy} onClick={handleSignup}>
                  {busy ? '가입 중...' : '가입 완료'}
                </button>
              )}
            </div>
            <button
              type="button"
              className="w-full text-sm text-base-400 hover:text-base-200 transition"
              onClick={() => {
                setMode('nickname');
                setError('');
              }}
            >
              ← 처음으로
            </button>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-400 text-center">{error}</p>}
      </div>
    </div>
  );
}

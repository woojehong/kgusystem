import { useEffect, useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useApp } from '../context/AppContext';
import { changeNickname, changePin } from '../lib/auth';
import { PIN_RULE, NICKNAME_RULE } from '../lib/constants';
import Modal from './Modal';
import GuildBadge from './GuildBadge';
import CharacterEditor, { emptyCharacter, validateCharacter } from './CharacterEditor';
import { badgeTextStyle, getClass, getSpec } from '../lib/utils';

const MAX_CHARACTERS = 5;

function BasicTab({ onClose }) {
  const { userId, profile, guilds } = useApp();
  const [nickname, setNickname] = useState(profile.nickname);
  const [guildId, setGuildId] = useState(profile.guildId);
  const [leaderCapable, setLeaderCapable] = useState(!!profile.leaderCapable);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPin2, setNewPin2] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setMsg(null);
    setBusy(true);
    try {
      const name = nickname.trim();
      if (name !== profile.nickname) {
        await changeNickname(userId, profile.nickname, name);
      }
      await updateDoc(doc(db, 'users', userId), { guildId, leaderCapable });

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
        <input
          className="input-base"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder={NICKNAME_RULE.hint}
        />
      </div>

      <div>
        <label className="label-sm">소속 길드</label>
        <div className="flex flex-wrap gap-2">
          {guilds.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setGuildId(g.id)}
              className={`rounded-full transition ring-offset-2 ring-offset-base-800 ${
                guildId === g.id ? 'ring-2 ring-indigo-400' : 'opacity-70 hover:opacity-100'
              }`}
            >
              <GuildBadge guildId={g.id} />
            </button>
          ))}
        </div>
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
    if (err) {
      setMsg(err);
      return;
    }
    const next = [...characters];
    next[editingIndex] = { ...draft, name: draft.name.trim() };
    await persist(next);
    setEditingIndex(null);
    setDraft(null);
  };

  const removeCharacter = async (index) => {
    if (characters.length <= 1) {
      setMsg('캐릭터는 최소 1개가 필요합니다.');
      return;
    }
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
          <button type="button" className="btn-ghost flex-1" onClick={() => setEditingIndex(null)}>
            취소
          </button>
          {editingIndex < characters.length && (
            <button
              type="button"
              className="btn-danger"
              disabled={busy}
              onClick={() => removeCharacter(editingIndex)}
            >
              삭제
            </button>
          )}
          <button type="button" className="btn-primary flex-1" disabled={busy} onClick={saveDraft}>
            저장
          </button>
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
          <div
            key={char.id || i}
            className="flex items-center justify-between p-3 rounded-xl bg-base-850 border border-base-700"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold truncate" style={badgeTextStyle(cls?.color || '#fff')}>
                  {char.name}
                </span>
                {isMain && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold shrink-0">
                    대표
                  </span>
                )}
              </div>
              <p className="text-xs text-base-400 mt-0.5 truncate">
                {char.server} · {cls?.name || '?'} ·{' '}
                {(char.specs || [])
                  .map((sId, idx) => {
                    const spec = getSpec(gamedata.classes, char.classId, sId);
                    return spec ? `${idx + 1}.${spec.name}` : null;
                  })
                  .filter(Boolean)
                  .join(' ')}
              </p>
            </div>
            <div className="flex gap-1.5 shrink-0 ml-2">
              {!isMain && (
                <button
                  type="button"
                  className="text-xs px-2 py-1.5 rounded-lg bg-base-700 hover:bg-base-600 transition"
                  disabled={busy}
                  onClick={() => persist(characters, i)}
                >
                  대표 설정
                </button>
              )}
              <button
                type="button"
                className="text-xs px-2 py-1.5 rounded-lg bg-base-700 hover:bg-base-600 transition"
                onClick={() => startEdit(i)}
              >
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

export default function ProfileModal({ open, onClose }) {
  const [tab, setTab] = useState('basic');

  useEffect(() => {
    if (open) setTab('basic');
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="프로필 수정">
      <div className="flex gap-1 p-1 rounded-xl bg-base-850 mb-5">
        {[
          ['basic', '기본 정보'],
          ['characters', '캐릭터 정보'],
        ].map(([key, label]) => (
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
      {tab === 'basic' ? <BasicTab onClose={onClose} /> : <CharactersTab />}
    </Modal>
  );
}

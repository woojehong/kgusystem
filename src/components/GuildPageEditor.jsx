import {
  FONT_OPTIONS,
  SIZE_OPTIONS,
  ALIGN_OPTIONS,
  IMG_WIDTH_OPTIONS,
  emptyTextBlock,
  emptyImageBlock,
  dividerBlock,
  blockTextStyle,
  imgWidthValue,
  publicUrl,
  normalizePage,
  heroBackground,
  fontCss,
} from '../lib/guildPage';

const HERO_BG_OPTIONS = [
  ['signature', '시그니처'],
  ['solid', '단색'],
  ['gradient', '그라데이션'],
  ['none', '투명'],
];

function Mini({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition ${
        active
          ? 'border-indigo-400 bg-indigo-500/15 text-indigo-200'
          : 'border-base-700 bg-base-800 text-base-400 hover:text-base-200 hover:border-base-500'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Block-based guild-page editor.
 * value: { blocks: [...] }   onChange: (nextPage) => void
 */
export default function GuildPageEditor({ value, onChange, guildColor = '#64748b', guildName = '길드' }) {
  const page = normalizePage(value, guildColor);
  const blocks = page.blocks;
  const hero = page.hero;

  const commit = (next) => onChange({ hero, blocks: next });
  const updateHero = (patch) => onChange({ hero: { ...hero, ...patch }, blocks });

  const addBlock = (block) => commit([...blocks, block]);

  const updateBlock = (id, patch) =>
    commit(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const removeBlock = (id) => commit(blocks.filter((b) => b.id !== id));

  const move = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  };

  return (
    <div className="space-y-3">
      {/* ── 타이틀(히어로) 꾸미기 ── */}
      <div className="rounded-xl border border-base-700 bg-base-850 p-3 space-y-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-base-500">타이틀 박스 (길드명)</p>

        {/* 미리보기 */}
        <div
          className="rounded-lg py-5 px-3 flex flex-col items-center justify-center"
          style={{ background: heroBackground(hero, guildColor) }}
        >
          <p
            className="break-keep text-center"
            style={{
              fontFamily: fontCss(hero.nameFont),
              color: hero.nameColor,
              fontSize: hero.nameSize,
              fontWeight: 800,
              lineHeight: 1.2,
            }}
          >
            {guildName}
          </p>
        </div>

        {/* 길드명 글꼴/크기/색 */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-base-400 w-16 shrink-0">길드명</span>
          <select
            className="bg-base-800 border border-base-700 rounded-md text-[11px] px-1.5 py-1 text-base-200"
            value={hero.nameFont}
            onChange={(e) => updateHero({ nameFont: e.target.value })}
          >
            {FONT_OPTIONS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
          <select
            className="bg-base-800 border border-base-700 rounded-md text-[11px] px-1.5 py-1 text-base-200"
            value={hero.nameSize}
            onChange={(e) => updateHero({ nameSize: Number(e.target.value) })}
          >
            {SIZE_OPTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <input
            type="color"
            value={hero.nameColor}
            onChange={(e) => updateHero({ nameColor: e.target.value })}
            className="w-7 h-7 rounded-md border border-base-700 bg-transparent cursor-pointer"
            title="길드명 색"
          />
        </div>

        {/* 배경 스타일 */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-base-400 w-16 shrink-0">배경</span>
          {HERO_BG_OPTIONS.map(([k, l]) => (
            <Mini key={k} active={hero.bgStyle === k} onClick={() => updateHero({ bgStyle: k })}>{l}</Mini>
          ))}
        </div>

        {(hero.bgStyle === 'solid' || hero.bgStyle === 'gradient') && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-base-400 w-16 shrink-0">배경 색</span>
            <input
              type="color"
              value={hero.bgColor1}
              onChange={(e) => updateHero({ bgColor1: e.target.value })}
              className="w-7 h-7 rounded-md border border-base-700 bg-transparent cursor-pointer"
            />
            {hero.bgStyle === 'gradient' && (
              <input
                type="color"
                value={hero.bgColor2}
                onChange={(e) => updateHero({ bgColor2: e.target.value })}
                className="w-7 h-7 rounded-md border border-base-700 bg-transparent cursor-pointer"
              />
            )}
          </div>
        )}
      </div>

      <p className="text-[11px] text-base-400 leading-relaxed">
        블록을 추가해 길드 소개를 꾸며보세요. 이미지는{' '}
        <code className="text-base-300">public/guilds/</code> 폴더에 PNG를 올리고(push) 경로를 입력합니다.
        예: <code className="text-base-300">guilds/내영문명/intro.png</code>
      </p>

      {blocks.length === 0 && (
        <p className="text-center text-sm text-base-500 py-6 border border-dashed border-base-700 rounded-xl">
          아직 내용이 없습니다. 아래 버튼으로 추가하세요.
        </p>
      )}

      {blocks.map((b, i) => (
        <div key={b.id} className="rounded-xl border border-base-700 bg-base-850 p-3 space-y-2">
          {/* block header */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-base-500">
              {b.type === 'text' ? '텍스트' : b.type === 'image' ? '이미지' : '구분선'}
            </span>
            <div className="flex gap-1">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0}
                className="w-6 h-6 rounded-md bg-base-700 hover:bg-base-600 text-xs disabled:opacity-30">↑</button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === blocks.length - 1}
                className="w-6 h-6 rounded-md bg-base-700 hover:bg-base-600 text-xs disabled:opacity-30">↓</button>
              <button type="button" onClick={() => removeBlock(b.id)}
                className="w-6 h-6 rounded-md bg-red-500/15 text-red-300 hover:bg-red-500/25 text-xs">🗑</button>
            </div>
          </div>

          {/* TEXT */}
          {b.type === 'text' && (
            <>
              <textarea
                className="input-base min-h-[70px] resize-y"
                value={b.text}
                onChange={(e) => updateBlock(b.id, { text: e.target.value })}
                placeholder="내용을 입력하세요"
                style={blockTextStyle(b)}
              />
              <div className="flex flex-wrap items-center gap-1.5">
                <select
                  className="bg-base-800 border border-base-700 rounded-md text-[11px] px-1.5 py-1 text-base-200"
                  value={b.font}
                  onChange={(e) => updateBlock(b.id, { font: e.target.value })}
                >
                  {FONT_OPTIONS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
                <select
                  className="bg-base-800 border border-base-700 rounded-md text-[11px] px-1.5 py-1 text-base-200"
                  value={b.size}
                  onChange={(e) => updateBlock(b.id, { size: Number(e.target.value) })}
                >
                  {SIZE_OPTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <input
                  type="color"
                  value={b.color}
                  onChange={(e) => updateBlock(b.id, { color: e.target.value })}
                  className="w-7 h-7 rounded-md border border-base-700 bg-transparent cursor-pointer"
                  title="글자 색"
                />
                {ALIGN_OPTIONS.map((a) => (
                  <Mini key={a.key} active={b.align === a.key} onClick={() => updateBlock(b.id, { align: a.key })}>
                    {a.label}
                  </Mini>
                ))}
                <Mini active={b.bold} onClick={() => updateBlock(b.id, { bold: !b.bold })}>굵게</Mini>
              </div>
            </>
          )}

          {/* IMAGE */}
          {b.type === 'image' && (
            <>
              <input
                className="input-base text-sm"
                value={b.path}
                onChange={(e) => updateBlock(b.id, { path: e.target.value.trim() })}
                placeholder="예: guilds/내영문명/intro.png"
              />
              {b.path ? (
                <img
                  src={publicUrl(b.path)}
                  alt=""
                  className="rounded-lg mx-auto border border-base-700"
                  style={{ width: imgWidthValue(b.width) }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  onLoad={(e) => { e.currentTarget.style.display = 'block'; }}
                />
              ) : (
                <p className="text-[11px] text-base-500 text-center py-2">경로를 입력하면 미리보기가 표시됩니다.</p>
              )}
              <div className="flex gap-1.5">
                {IMG_WIDTH_OPTIONS.map((w) => (
                  <Mini key={w.key} active={b.width === w.key} onClick={() => updateBlock(b.id, { width: w.key })}>
                    {w.label}
                  </Mini>
                ))}
              </div>
            </>
          )}

          {/* DIVIDER */}
          {b.type === 'divider' && <hr className="border-base-600" />}
        </div>
      ))}

      <div className="flex gap-2 pt-1">
        <button type="button" className="btn-ghost flex-1 text-sm" onClick={() => addBlock(emptyTextBlock())}>+ 텍스트</button>
        <button type="button" className="btn-ghost flex-1 text-sm" onClick={() => addBlock(emptyImageBlock())}>+ 이미지</button>
        <button type="button" className="btn-ghost flex-1 text-sm" onClick={() => addBlock(dividerBlock())}>+ 구분선</button>
      </div>
    </div>
  );
}

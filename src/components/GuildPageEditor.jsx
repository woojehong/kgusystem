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
  normalizePage,
  heroBackground,
  fontCss,
  resolveImagePath,
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

function ToggleChip({ label, on, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition ${
        on
          ? 'border-indigo-400 bg-indigo-500/15 text-indigo-200'
          : 'border-base-700 bg-base-800 text-base-400'
      }`}
    >
      {label}
      <span className={`ml-2 w-7 h-4 rounded-full relative transition shrink-0 ${on ? 'bg-indigo-500' : 'bg-base-600'}`}>
        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${on ? 'left-[14px]' : 'left-0.5'}`} />
      </span>
    </button>
  );
}

/**
 * Block-based guild-page editor.
 * value: { hero, blocks }   onChange: (nextPage) => void
 * - guildEnglishName: used to resolve bare image file names.
 * - guildLogoPath: existing guild logo (reused as hero logo).
 * - canSetImagePaths: true for super admin (can type banner path); guild
 *   masters only toggle and reference admin-provided file names.
 */
export default function GuildPageEditor({
  value,
  onChange,
  guildColor = '#64748b',
  guildName = '길드',
  guildEnglishName = '',
  guildLogoPath = '',
  canSetImagePaths = false,
}) {
  const page = normalizePage(value, guildColor);
  const blocks = page.blocks;
  const hero = page.hero;

  const commit = (next) => onChange({ hero, blocks: next });
  const updateHero = (patch) => onChange({ hero: { ...hero, ...patch }, blocks });

  const addBlock = (block) => commit([...blocks, block]);
  const updateBlock = (id, patch) => commit(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const removeBlock = (id) => commit(blocks.filter((b) => b.id !== id));
  const move = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  };

  const logoUrl = guildLogoPath ? resolveImagePath(guildLogoPath, guildEnglishName) : '';
  const bannerUrl = hero.showBanner ? resolveImagePath(hero.bannerPath, guildEnglishName) : '';

  const nameStyle = {
    fontFamily: fontCss(hero.nameFont),
    color: hero.nameColor,
    fontSize: hero.nameSize,
    fontWeight: 800,
    lineHeight: 1.2,
  };
  const tagStyle = {
    fontFamily: fontCss(hero.tagFont),
    color: hero.tagColor,
    fontSize: hero.tagSize,
    lineHeight: 1.4,
    whiteSpace: 'pre-wrap',
  };

  return (
    <div className="space-y-3">
      {/* ── 타이틀 박스 ── */}
      <div className="rounded-xl border border-base-700 bg-base-850 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-wider text-base-500">타이틀 박스</p>
          <label className="flex items-center gap-1.5 text-[11px] text-base-300 cursor-pointer">
            표시
            <input
              type="checkbox"
              className="w-4 h-4 accent-indigo-500"
              checked={hero.showBox}
              onChange={(e) => updateHero({ showBox: e.target.checked })}
            />
          </label>
        </div>

        {hero.showBox && (
          <>
            {/* 미리보기 */}
            <div className="rounded-lg overflow-hidden" style={{ background: heroBackground(hero, guildColor) }}>
              {hero.showBanner && bannerUrl && (
                <img src={bannerUrl} alt="" className="w-full max-h-24 object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              )}
              <div className="py-5 px-3 flex flex-col items-center gap-2">
                {hero.showLogo && logoUrl && (
                  <img src={logoUrl} alt="" className="w-14 h-14 object-contain"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                )}
                {hero.showName && <p className="break-keep text-center" style={nameStyle}>{guildName}</p>}
                {hero.showTag && hero.tagText && <p className="break-keep text-center" style={tagStyle}>{hero.tagText}</p>}
                {!hero.showName && !hero.showTag && !hero.showLogo && !bannerUrl && (
                  <span className="text-[11px] text-base-500">(빈 타이틀 — 부품을 켜보세요)</span>
                )}
              </div>
            </div>

            {/* 부품 on/off */}
            <div className="grid grid-cols-2 gap-1.5">
              <ToggleChip label="로고" on={hero.showLogo} onChange={(v) => updateHero({ showLogo: v })} />
              <ToggleChip label="배너" on={hero.showBanner} onChange={(v) => updateHero({ showBanner: v })} />
              <ToggleChip label="길드명" on={hero.showName} onChange={(v) => updateHero({ showName: v })} />
              <ToggleChip label="추가 문구" on={hero.showTag} onChange={(v) => updateHero({ showTag: v })} />
            </div>

            {/* 로고 안내 */}
            {hero.showLogo && !logoUrl && (
              <p className="text-[11px] text-amber-300/80">로고 이미지는 관리자가 설정합니다. (관리자에게 문의)</p>
            )}

            {/* 배너 경로 (슈퍼관리자만 입력) */}
            {hero.showBanner && (
              canSetImagePaths ? (
                <div>
                  <label className="text-[11px] text-base-400">배너 이미지 (파일명)</label>
                  <input
                    className="input-base text-sm"
                    value={hero.bannerPath}
                    onChange={(e) => updateHero({ bannerPath: e.target.value.trim() })}
                    placeholder="예: banner.png"
                  />
                </div>
              ) : (
                <p className="text-[11px] text-amber-300/80">배너 이미지는 관리자가 설정합니다. (관리자에게 문의)</p>
              )
            )}

            {/* 길드명 글꼴/크기/색 */}
            {hero.showName && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-base-400 w-16 shrink-0">길드명</span>
                <select className="bg-base-800 border border-base-700 rounded-md text-[11px] px-1.5 py-1 text-base-200"
                  value={hero.nameFont} onChange={(e) => updateHero({ nameFont: e.target.value })}>
                  {FONT_OPTIONS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                </select>
                <select className="bg-base-800 border border-base-700 rounded-md text-[11px] px-1.5 py-1 text-base-200"
                  value={hero.nameSize} onChange={(e) => updateHero({ nameSize: Number(e.target.value) })}>
                  {SIZE_OPTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <input type="color" value={hero.nameColor} onChange={(e) => updateHero({ nameColor: e.target.value })}
                  className="w-7 h-7 rounded-md border border-base-700 bg-transparent cursor-pointer" title="길드명 색" />
              </div>
            )}

            {/* 추가 문구 */}
            {hero.showTag && (
              <div className="space-y-1.5">
                <textarea
                  className="input-base min-h-[48px] resize-y text-sm"
                  value={hero.tagText}
                  onChange={(e) => updateHero({ tagText: e.target.value })}
                  placeholder="추가 문구 (슬로건/한 줄 소개)"
                />
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-base-400 w-16 shrink-0">문구</span>
                  <select className="bg-base-800 border border-base-700 rounded-md text-[11px] px-1.5 py-1 text-base-200"
                    value={hero.tagFont} onChange={(e) => updateHero({ tagFont: e.target.value })}>
                    {FONT_OPTIONS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                  </select>
                  <select className="bg-base-800 border border-base-700 rounded-md text-[11px] px-1.5 py-1 text-base-200"
                    value={hero.tagSize} onChange={(e) => updateHero({ tagSize: Number(e.target.value) })}>
                    {SIZE_OPTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                  <input type="color" value={hero.tagColor} onChange={(e) => updateHero({ tagColor: e.target.value })}
                    className="w-7 h-7 rounded-md border border-base-700 bg-transparent cursor-pointer" title="문구 색" />
                </div>
              </div>
            )}

            {/* 배경 */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-base-400 w-16 shrink-0">배경</span>
              {HERO_BG_OPTIONS.map(([k, l]) => (
                <Mini key={k} active={hero.bgStyle === k} onClick={() => updateHero({ bgStyle: k })}>{l}</Mini>
              ))}
            </div>
            {(hero.bgStyle === 'solid' || hero.bgStyle === 'gradient') && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-base-400 w-16 shrink-0">배경 색</span>
                <input type="color" value={hero.bgColor1} onChange={(e) => updateHero({ bgColor1: e.target.value })}
                  className="w-7 h-7 rounded-md border border-base-700 bg-transparent cursor-pointer" />
                {hero.bgStyle === 'gradient' && (
                  <input type="color" value={hero.bgColor2} onChange={(e) => updateHero({ bgColor2: e.target.value })}
                    className="w-7 h-7 rounded-md border border-base-700 bg-transparent cursor-pointer" />
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── 본문 안내 ── */}
      <p className="text-[11px] text-base-400 leading-relaxed">
        블록을 추가해 길드 소개를 꾸며보세요. <b className="text-base-300">이미지 추가는 관리자에게 문의하세요.</b>
        관리자에게 이미지를 전달한 뒤 받은 파일명을 이미지 블록에 입력하면 표시됩니다. (.png 생략 가능)
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
              <label className="text-[11px] text-base-400">
                관리자에게 전달한 이미지의 파일명을 입력하세요 (.png 생략 가능)
              </label>
              <input
                className="input-base text-sm"
                value={b.path}
                onChange={(e) => updateBlock(b.id, { path: e.target.value.trim() })}
                placeholder="예: intro.png  또는  intro"
              />
              {b.path ? (
                <img
                  src={resolveImagePath(b.path, guildEnglishName)}
                  alt=""
                  className="rounded-lg mx-auto border border-base-700"
                  style={{ width: imgWidthValue(b.width) }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  onLoad={(e) => { e.currentTarget.style.display = 'block'; }}
                />
              ) : (
                <p className="text-[11px] text-base-500 text-center py-2">파일명을 입력하면 미리보기가 표시됩니다.</p>
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

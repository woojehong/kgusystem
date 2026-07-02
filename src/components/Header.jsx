import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { signOutUser } from '../lib/auth';
import GuildBadge from './GuildBadge';
import ProfileModal from './ProfileModal';

// 헤더 우측 버튼 공통 스타일 (프로필 · 관리자 · 로그아웃 동일)
const HEADER_BTN =
  'flex items-center gap-2 px-3 py-1.5 rounded-full bg-base-800 border border-base-600 hover:border-base-500 hover:bg-base-700 transition text-sm font-semibold text-base-100 shadow-sm';

function AdminToggle() {
  const { isAdmin, adminMode, setAdminMode } = useApp();
  if (!isAdmin) return null;
  return (
    <button type="button" onClick={() => setAdminMode(!adminMode)} className={HEADER_BTN} title="관리자 모드">
      <span>관리자</span>
      {/* ON일 때 고급스러운 금색 */}
      <span className={`relative w-9 h-5 rounded-full transition ${adminMode ? 'bg-amber-500' : 'bg-base-600'}`}>
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
            adminMode ? 'left-[18px]' : 'left-0.5'
          }`}
        />
      </span>
    </button>
  );
}

export default function Header() {
  const { profile } = useApp();
  const [profileOpen, setProfileOpen] = useState(false);

  const profileButton = (
    <button type="button" onClick={() => setProfileOpen(true)} className={HEADER_BTN}>
      {profile?.isGuildMaster && <span className="text-sm leading-none">👑</span>}
      <span>{profile?.nickname}</span>
      {/* 닉네임과 뱃지 사이 간격 */}
      <span className="ml-1.5">
        <GuildBadge guildId={profile?.guildId} size="xs" />
      </span>
    </button>
  );

  const logoutButton = (
    <button type="button" onClick={() => signOutUser()} className={HEADER_BTN}>
      로그아웃
    </button>
  );

  return (
    <>
      <header className="sticky top-0 z-40 bg-base-900/90 backdrop-blur border-b border-base-800 pt-[env(safe-area-inset-top)]">
        {/* Desktop */}
        <div className="hidden sm:flex items-center justify-between max-w-6xl mx-auto px-4 h-16">
          <Link to="/" className="flex flex-col group">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black tracking-tight bg-gradient-to-b from-white to-base-400 bg-clip-text text-transparent group-hover:to-indigo-300 transition">
                KWGU
              </span>
              <span className="text-sm font-semibold tracking-tight bg-gradient-to-b from-white to-base-400 bg-clip-text text-transparent group-hover:to-indigo-300 transition">한.길.련</span>
            </div>
            <span className="text-[10px] text-base-500 tracking-wider leading-none">
              Korean Wow Guild Union · 한국길드연합
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {profileButton}
            <AdminToggle />
            {logoutButton}
          </div>
        </div>

        {/* Mobile */}
        <div className="sm:hidden flex flex-col items-center px-4 py-3 gap-2">
          <Link to="/" className="flex flex-col items-center">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black tracking-tight bg-gradient-to-b from-white to-base-400 bg-clip-text text-transparent">
                KWGU
              </span>
              <span className="text-xs font-semibold tracking-tight bg-gradient-to-b from-white to-base-400 bg-clip-text text-transparent">한.길.련</span>
            </div>
            <span className="text-[9px] text-base-500 tracking-wider leading-none">
              Korean Wow Guild Union · 한국길드연합
            </span>
          </Link>
          <div className="flex items-center justify-center flex-wrap gap-2">
            {profileButton}
            <AdminToggle />
            {logoutButton}
          </div>
        </div>
      </header>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}

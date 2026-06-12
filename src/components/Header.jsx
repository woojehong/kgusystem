import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { signOutUser } from '../lib/auth';
import GuildBadge from './GuildBadge';
import ProfileModal from './ProfileModal';

function AdminToggle() {
  const { isAdmin, adminMode, setAdminMode } = useApp();
  if (!isAdmin) return null;
  return (
    <button
      type="button"
      onClick={() => setAdminMode(!adminMode)}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-base-800 border border-base-700 hover:border-base-600 transition"
      title="관리자 모드"
    >
      <span className={`text-xs font-semibold ${adminMode ? 'text-indigo-300' : 'text-base-400'}`}>
        관리자
      </span>
      <span
        className={`relative w-9 h-5 rounded-full transition ${adminMode ? 'bg-indigo-500' : 'bg-base-600'}`}
      >
        <span
          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
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
    <button
      type="button"
      onClick={() => setProfileOpen(true)}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-base-800 border border-base-700 hover:border-base-600 transition"
    >
      <span className="font-semibold text-sm">{profile?.nickname}</span>
      <GuildBadge guildId={profile?.guildId} size="xs" />
    </button>
  );

  return (
    <>
      <header className="sticky top-0 z-40 bg-base-900/90 backdrop-blur border-b border-base-800">
        {/* Desktop */}
        <div className="hidden sm:flex items-center justify-between max-w-6xl mx-auto px-4 h-16">
          <Link to="/" className="flex items-baseline gap-2 group">
            <span className="text-2xl font-black tracking-tight bg-gradient-to-b from-white to-base-400 bg-clip-text text-transparent group-hover:to-indigo-300 transition">
              KGU
            </span>
            <span className="text-sm text-base-400 font-semibold tracking-[0.25em]">한길련</span>
          </Link>
          <div className="flex items-center gap-2">
            {profileButton}
            <AdminToggle />
            <button
              type="button"
              onClick={() => signOutUser()}
              className="text-xs text-base-400 hover:text-base-200 px-2 transition"
            >
              로그아웃
            </button>
          </div>
        </div>

        {/* Mobile */}
        <div className="sm:hidden flex flex-col items-center px-4 py-3 gap-2">
          <Link to="/" className="flex items-baseline gap-2">
            <span className="text-2xl font-black tracking-tight bg-gradient-to-b from-white to-base-400 bg-clip-text text-transparent">
              KGU
            </span>
            <span className="text-xs text-base-400 font-semibold tracking-[0.25em]">한길련</span>
          </Link>
          <div className="flex items-center gap-2">
            {profileButton}
            <AdminToggle />
            <button
              type="button"
              onClick={() => signOutUser()}
              className="text-xs text-base-400 hover:text-base-200 px-1 transition"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </>
  );
}

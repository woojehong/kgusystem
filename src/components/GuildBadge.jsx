import { useApp } from '../context/AppContext';

export default function GuildBadge({ guildId, guildName, guildColor, size = 'sm' }) {
  const { guilds } = useApp();
  const guild = guilds.find((g) => g.id === guildId);
  const name = guildName ?? guild?.name ?? '소속 없음';
  const color = guildColor ?? guild?.color ?? '#64748b';
  const logoPath = guild?.logoPath;
  const sizeCls = size === 'xs' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${sizeCls}`}
      style={{
        color,
        backgroundColor: `${color}1a`,
        border: `1px solid ${color}55`,
      }}
    >
      {logoPath ? (
        <img
          src={`${import.meta.env.BASE_URL}${logoPath.replace(/^\//, '')}`}
          alt=""
          className="w-3.5 h-3.5 rounded-full object-cover"
        />
      ) : null}
      {name}
    </span>
  );
}

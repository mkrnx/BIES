import { Repeat } from 'lucide-react';
import { Link } from 'react-router-dom';

const NoteRepostHeader = ({ reposters, getDisplayName, repostTime, formatTime }) => {
  if (!reposters || reposters.length === 0) return null;

  const names = reposters.map(r => (
    <Link key={r.pubkey} to={`/builder/${r.pubkey}`}>{getDisplayName(r.pubkey)}</Link>
  ));

  let label;
  if (names.length === 1) {
    label = <>{names[0]}{' reposted'}</>;
  } else if (names.length === 2) {
    label = <>{names[0]}{' and '}{names[1]}{' reposted'}</>;
  } else {
    label = <>{names[0]}{', '}{names[1]}{`, and ${names.length - 2} other${names.length - 2 > 1 ? 's' : ''} reposted`}</>;
  }

  return (
    <div className="primal-repost-header">
      <Repeat size={14} />
      <span>
        {label}
        {repostTime && (() => { const t = formatTime(repostTime); return t === 'just now' ? ` ${t}` : ` ${t} ago`; })()}
      </span>
    </div>
  );
};

export default NoteRepostHeader;

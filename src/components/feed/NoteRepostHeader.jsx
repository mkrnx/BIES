import { Repeat } from 'lucide-react';
import { Link } from 'react-router-dom';

const NoteRepostHeader = ({ reposterPubkey, reposterName, repostTime, formatTime }) => {
  return (
    <div className="primal-repost-header">
      <Repeat size={14} />
      <span>
        <Link to={`/builder/${reposterPubkey}`}>{reposterName}</Link>
        {' reposted'}
        {repostTime && ` ${formatTime(repostTime)}`}
      </span>
    </div>
  );
};

export default NoteRepostHeader;

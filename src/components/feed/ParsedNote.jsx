import { nip19 } from 'nostr-tools';

/**
 * Parses note content and renders text with inline @mentions, #hashtags, and URLs.
 * Media URLs (images, videos) are handled separately by the parent.
 */
const ParsedNote = ({ text, profiles, getDisplayName }) => {
  if (!text) return null;

  // Split on nostr:npub mentions, URLs, and hashtags
  const tokenRegex = /(nostr:npub[a-z0-9]+|nostr:note[a-z0-9]+|#\w+|https?:\/\/[^\s<]+)/gi;
  const parts = text.split(tokenRegex);

  return (
    <div className="primal-note-message">
      {parts.map((part, i) => {
        // nostr:npub mention
        if (/^nostr:npub[a-z0-9]+$/i.test(part)) {
          const npubStr = part.slice(6);
          try {
            const decoded = nip19.decode(npubStr);
            if (decoded.type === 'npub') {
              const name = getDisplayName(decoded.data);
              return <span key={i} className="primal-note-mention">@{name}</span>;
            }
          } catch { /* fall through */ }
          return <span key={i} className="primal-note-mention">{part}</span>;
        }

        // nostr:note mention
        if (/^nostr:note[a-z0-9]+$/i.test(part)) {
          const noteStr = part.slice(6);
          try {
            const decoded = nip19.decode(noteStr);
            if (decoded.type === 'note') {
              const shortId = noteStr.substring(0, 12) + '...';
              return (
                <a key={i} href={`https://njump.me/${noteStr}`} target="_blank" rel="noopener noreferrer">
                  {shortId}
                </a>
              );
            }
          } catch { /* fall through */ }
          return <span key={i}>{part}</span>;
        }

        // Hashtag
        if (/^#\w+$/.test(part)) {
          return <span key={i} className="primal-note-hashtag">{part}</span>;
        }

        // URL (not media — parent already stripped those)
        if (/^https?:\/\//i.test(part)) {
          // Truncate display to ~50 chars
          const display = part.length > 50 ? part.substring(0, 47) + '...' : part;
          return (
            <a key={i} href={part} target="_blank" rel="noopener noreferrer">
              {display}
            </a>
          );
        }

        // Render plain text, preserving newlines
        return part.split('\n').map((line, j, arr) => (
          <span key={`${i}-${j}`}>
            {line}
            {j < arr.length - 1 && <br />}
          </span>
        ));
      })}
    </div>
  );
};

export default ParsedNote;

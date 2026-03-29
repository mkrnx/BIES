/**
 * Skeleton loading placeholder for feed notes (Primal style shimmer)
 */
const FeedSkeleton = ({ count = 5 }) => {
  return Array.from({ length: count }).map((_, i) => (
    <div key={i} className="primal-skeleton-note">
      <div className="primal-skeleton-avatar" />
      <div className="primal-skeleton-content">
        <div className="primal-skeleton-line short" />
        <div className="primal-skeleton-line long" />
        <div className="primal-skeleton-line medium" />
      </div>
    </div>
  ));
};

export default FeedSkeleton;

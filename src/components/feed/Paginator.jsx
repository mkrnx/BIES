import { useEffect, useRef } from 'react';

/**
 * Infinite scroll trigger using IntersectionObserver (Primal-style).
 * Fires `onIntersect` when the element enters the viewport.
 */
const Paginator = ({ onIntersect, disabled }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (disabled || !ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onIntersect();
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [onIntersect, disabled]);

  return <div ref={ref} className="primal-paginator" />;
};

export default Paginator;

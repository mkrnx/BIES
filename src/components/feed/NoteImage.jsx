/**
 * Primal-style image grid. Renders 1–5+ images in responsive grid layouts.
 */
const NoteImage = ({ images, onImageClick }) => {
  if (!images || images.length === 0) return null;

  const maxShow = 5;
  const displayImages = images.slice(0, maxShow);
  const extraCount = images.length - maxShow;

  const handleClick = (e, src) => {
    e.stopPropagation();
    onImageClick?.(src, images);
  };

  // Single image — proportional, no crop
  if (images.length === 1) {
    return (
      <div className="primal-image-grid primal-image-single">
        <img
          src={images[0]}
          alt=""
          loading="lazy"
          onClick={(e) => handleClick(e, images[0])}
        />
      </div>
    );
  }

  // 2 images — side by side
  if (images.length === 2) {
    return (
      <div className="primal-image-grid primal-image-grid-2">
        {images.map((src, i) => (
          <div key={i} onClick={(e) => handleClick(e, src)}>
            <img src={src} alt="" loading="lazy" />
          </div>
        ))}
      </div>
    );
  }

  // 3 images — large left + 2 stacked right
  if (images.length === 3) {
    return (
      <div className="primal-image-grid primal-image-grid-3">
        {images.map((src, i) => (
          <div key={i} onClick={(e) => handleClick(e, src)}>
            <img src={src} alt="" loading="lazy" />
          </div>
        ))}
      </div>
    );
  }

  // 4 images — 2x2 grid
  if (images.length === 4) {
    return (
      <div className="primal-image-grid primal-image-grid-4">
        {images.map((src, i) => (
          <div key={i} onClick={(e) => handleClick(e, src)}>
            <img src={src} alt="" loading="lazy" />
          </div>
        ))}
      </div>
    );
  }

  // 5+ images — 2 top + 3 bottom
  return (
    <div className="primal-image-grid primal-image-grid-5">
      <div className="primal-image-grid-5-top">
        {displayImages.slice(0, 2).map((src, i) => (
          <div key={i} onClick={(e) => handleClick(e, src)}>
            <img src={src} alt="" loading="lazy" />
          </div>
        ))}
      </div>
      <div className="primal-image-grid-5-bottom">
        {displayImages.slice(2, 5).map((src, i) => (
          <div key={i} onClick={(e) => handleClick(e, src)} style={{ position: 'relative' }}>
            <img src={src} alt="" loading="lazy" />
            {i === 2 && extraCount > 0 && (
              <div className="primal-image-more-overlay">+{extraCount}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default NoteImage;

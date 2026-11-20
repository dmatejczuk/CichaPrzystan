import { useState } from 'react'
import { useLanguage } from '../language/useLanguage.js'

const VISIBLE_PHOTOS = 3

export default function PhotoCarousel({ photos }) {
  const { t } = useLanguage()
  const [start, setStart] = useState(0)

  const slots = Array.from({ length: VISIBLE_PHOTOS }, (_, i) => photos[start + i])
  const canScroll = photos.length > VISIBLE_PHOTOS

  function showNext() {
    setStart((start + 1) % (photos.length - VISIBLE_PHOTOS + 1))
  }

  return (
    <div className="photo-carousel">
      {slots.map((src, i) => (
        <div key={i} className="photo-carousel-slot">
          {src && <img src={src} alt="" />}
        </div>
      ))}

      {canScroll && (
        <button className="photo-carousel-next" onClick={showNext} aria-label={t.nextPhotos}>
          &gt;
        </button>
      )}
    </div>
  )
}

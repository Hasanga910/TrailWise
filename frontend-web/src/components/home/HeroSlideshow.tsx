import { useEffect, useState } from 'react';
import sigiriya1024 from '../../assets/hero/sigiriya-rock-fortress-1024.webp';
import sigiriya640 from '../../assets/hero/sigiriya-rock-fortress-640.webp';
import beach1600 from '../../assets/hero/tropical-beach-palm-1600.webp';
import beach800 from '../../assets/hero/tropical-beach-palm-800.webp';

// The first slide lives in /public so index.html can preload it by a stable URL.
const MOUNTAIN_800 = '/hero/mountain-ridge-hikers-800.webp';
const MOUNTAIN_1600 = '/hero/mountain-ridge-hikers-1600.webp';

// Photos are Sri Lankan only. TODO: add one more Sri Lankan photo (see the Session 2 follow-ups).
// Each is exported at two widths so phones don't download the desktop image.
interface Slide {
  src: string;
  srcSet: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
  objectPosition: string;
}

const slides: Slide[] = [
  {
    src: MOUNTAIN_1600,
    srcSet: `${MOUNTAIN_800} 800w, ${MOUNTAIN_1600} 1600w`,
    width: 1600,
    height: 899,
    alt: 'Two hikers silhouetted on a mountain ridge at golden hour',
    caption: 'Mountain trekking',
    objectPosition: 'center 65%',
  },
  {
    src: sigiriya1024,
    srcSet: `${sigiriya640} 640w, ${sigiriya1024} 1024w`,
    width: 1024,
    height: 640,
    alt: 'Aerial view of Sigiriya Rock Fortress rising above the jungle',
    caption: 'Ancient wonders',
    objectPosition: 'center 40%',
  },
  {
    src: beach1600,
    srcSet: `${beach800} 800w, ${beach1600} 1600w`,
    width: 1600,
    height: 1200,
    alt: 'A leaning coconut palm over a tropical beach',
    caption: 'Coastal escapes',
    objectPosition: 'center 70%',
  },
];

export function HeroSlideshow() {
  const [activeIndex, setActiveIndex] = useState(0);
  // Only the first photo loads up front; the others wait until the page has settled so they never compete with it.
  const [loadRest, setLoadRest] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setLoadRest(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const interval = setInterval(() => {
      setActiveIndex((i) => (i + 1) % slides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const goToPrevious = () => {
    setActiveIndex((i) => (i - 1 + slides.length) % slides.length);
  };

  const goToNext = () => {
    setActiveIndex((i) => (i + 1) % slides.length);
  };

  return (
    <div className="absolute inset-0 overflow-hidden bg-brand-900">
      {slides.map((slide, index) => (
        <div
          key={slide.caption}
          aria-hidden={index !== activeIndex}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out motion-reduce:transition-none ${
            index === activeIndex ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {(index === 0 || loadRest) && (
          <img
            src={slide.src}
            srcSet={slide.srcSet}
            sizes="100vw"
            width={slide.width}
            height={slide.height}
            alt={slide.alt}
            className="h-full w-full object-cover"
            style={{ objectPosition: slide.objectPosition }}
            loading={index === 0 ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={index === 0 ? 'high' : 'auto'}
          />
          )}
          <div className="absolute inset-0 bg-brand-950/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-brand-950/70 via-transparent to-transparent" />
        </div>
      ))}

      <div className="absolute inset-x-0 bottom-20 z-10 px-6 text-center sm:bottom-24">
        <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur">
          {slides[activeIndex].caption}
        </span>
      </div>

      <button
        type="button"
        aria-label="Previous slide"
        onClick={goToPrevious}
        className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <button
        type="button"
        aria-label="Next slide"
        onClick={goToNext}
        className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
        </svg>
      </button>

      <div className="absolute inset-x-0 bottom-6 z-10 flex justify-center">
        {slides.map((slide, index) => (
          <button
            key={slide.caption}
            type="button"
            aria-label={slide.caption}
            aria-current={index === activeIndex}
            onClick={() => setActiveIndex(index)}
            className="flex h-6 w-6 items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 rounded-full"
          >
            <span
              className={`block h-2 rounded-full transition-all ${
                index === activeIndex ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/70'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

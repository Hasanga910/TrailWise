import { useEffect, useState } from 'react';
import mountainRidgeHikers from '../../assets/hero/mountain-ridge-hikers.jpg';
import lisbonStreetCouple from '../../assets/hero/lisbon-street-couple.jpg';
import sigiriyaRockFortress from '../../assets/hero/sigiriya-rock-fortress.jpg';
import tropicalBeachPalm from '../../assets/hero/tropical-beach-palm.jpg';

interface Slide {
  image: string;
  alt: string;
  caption: string;
  objectPosition: string;
}

const slides: Slide[] = [
  {
    image: mountainRidgeHikers,
    alt: 'Two hikers silhouetted on a mountain ridge at golden hour',
    caption: 'Mountain trekking',
    objectPosition: 'center 65%',
  },
  {
    image: lisbonStreetCouple,
    alt: 'A couple exploring a cobblestone European street with a map',
    caption: 'Guided city tours',
    objectPosition: '40% 25%',
  },
  {
    image: sigiriyaRockFortress,
    alt: 'Aerial view of Sigiriya Rock Fortress rising above the jungle',
    caption: 'Ancient wonders',
    objectPosition: 'center 40%',
  },
  {
    image: tropicalBeachPalm,
    alt: 'A leaning coconut palm over a tropical beach',
    caption: 'Coastal escapes',
    objectPosition: 'center 70%',
  },
];

export function HeroSlideshow() {
  const [activeIndex, setActiveIndex] = useState(0);

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
          <img
            src={slide.image}
            alt={slide.alt}
            className="h-full w-full object-cover"
            style={{ objectPosition: slide.objectPosition }}
            loading="eager"
            fetchPriority={index === 0 ? 'high' : 'auto'}
          />
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

      <div className="absolute inset-x-0 bottom-8 z-10 flex justify-center gap-2">
        {slides.map((slide, index) => (
          <button
            key={slide.caption}
            type="button"
            aria-label={slide.caption}
            onClick={() => setActiveIndex(index)}
            className={`h-2 rounded-full transition-all ${
              index === activeIndex ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/60'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

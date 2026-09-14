import { useEffect, useState } from 'react';

interface Slide {
  label: string;
  gradient: string;
  circles: string[];
  icon: React.ReactNode;
}

const slides: Slide[] = [
  {
    label: 'Mountain trekking',
    gradient: 'from-brand-700 via-brand-600 to-brand-900',
    circles: ['-right-16 -top-16 h-72 w-72 bg-white/10', '-bottom-24 -left-10 h-80 w-80 bg-accent-500/20'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m3 19 5.5-9 4 6.2L15.5 11 21 19H3Z"
        />
      </svg>
    ),
  },
  {
    label: 'Coastal tours',
    gradient: 'from-brand-500 via-brand-600 to-brand-800',
    circles: ['-left-16 -top-10 h-72 w-72 bg-white/10', '-bottom-20 -right-16 h-80 w-80 bg-accent-500/20'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2 17c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0 3-1.3 4.5 0M2 12c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0 3-1.3 4.5 0"
        />
      </svg>
    ),
  },
  {
    label: 'Cultural heritage',
    gradient: 'from-accent-600 via-brand-700 to-brand-900',
    circles: ['-right-10 -bottom-16 h-72 w-72 bg-white/10', '-top-16 -left-16 h-80 w-80 bg-accent-500/20'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m14.5 9.5-1.8 4.7a1 1 0 0 1-.5.5l-4.7 1.8 1.8-4.7a1 1 0 0 1 .5-.5l4.7-1.8Z"
        />
      </svg>
    ),
  },
  {
    label: 'Wildlife & nature',
    gradient: 'from-brand-600 via-brand-800 to-brand-950',
    circles: ['-left-10 -top-16 h-72 w-72 bg-white/10', '-bottom-16 -right-10 h-80 w-80 bg-accent-500/20'],
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 21c-4-4.5-7-8.2-7-11.5A7 7 0 0 1 19 9.5C19 12.8 16 16.5 12 21Z"
        />
        <circle cx="12" cy="9.5" r="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
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

  return (
    <div className="absolute inset-0 overflow-hidden bg-brand-900">
      {slides.map((slide, index) => (
        <div
          key={slide.label}
          aria-hidden={index !== activeIndex}
          className={`absolute inset-0 bg-gradient-to-br ${slide.gradient} transition-opacity duration-1000 ease-in-out motion-reduce:transition-none ${
            index === activeIndex ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {slide.circles.map((circle, i) => (
            <div
              key={i}
              className={`animate-drift absolute rounded-full blur-3xl motion-reduce:animate-none ${circle}`}
            />
          ))}
          <div className="absolute inset-0 flex items-center justify-center text-white/20">
            <div className="h-64 w-64">{slide.icon}</div>
          </div>
        </div>
      ))}

      <div className="absolute inset-x-0 bottom-8 z-10 flex justify-center gap-2">
        {slides.map((slide, index) => (
          <button
            key={slide.label}
            type="button"
            aria-label={slide.label}
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

import { useEffect } from 'react';

/** Sets the browser tab title while the page is mounted. */
export function usePageTitle(title: string | null | undefined): void {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = `${title} | TrailWise`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}

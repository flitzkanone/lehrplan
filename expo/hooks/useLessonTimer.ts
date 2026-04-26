import { useEffect, useRef, useState } from 'react';

/** Returns a live-updating elapsed time string in "MM:SS" format. */
export function useLessonTimer(startedAt: string | null): string {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!startedAt) {
      setElapsed(0);
      return;
    }

    const start = new Date(startedAt).getTime();

    const tick = () => {
      const diff = Math.floor((Date.now() - start) / 1000);
      setElapsed(Math.max(0, diff));
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startedAt]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

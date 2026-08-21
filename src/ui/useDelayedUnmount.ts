import { useState, useEffect } from 'react';

export function useDelayedUnmount(isMounted: boolean, delayTime: number) {
  const [shouldRender, setShouldRender] = useState(isMounted);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    if (isMounted) {
      setShouldRender(true);
      setIsExiting(false);
    } else if (shouldRender) {
      setIsExiting(true);
      timeoutId = setTimeout(() => {
        setShouldRender(false);
        setIsExiting(false);
      }, delayTime);
    }

    return () => {
      clearTimeout(timeoutId);
    };
  }, [isMounted, delayTime, shouldRender]);

  return { shouldRender, isExiting };
}

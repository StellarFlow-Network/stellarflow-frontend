import {
  useEffect,
  useRef,
} from 'react';

export function useRenderLoop(
  active: boolean,
  render: () => void,
) {
  const frameRef =
    useRef<number>();

  useEffect(() => {
    if (!active) {
      if (frameRef.current) {
        cancelAnimationFrame(
          frameRef.current,
        );
      }

      return;
    }

    const loop = () => {
      render();

      frameRef.current =
        requestAnimationFrame(
          loop,
        );
    };

    frameRef.current =
      requestAnimationFrame(loop);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(
          frameRef.current,
        );
      }
    };
  }, [active, render]);
}
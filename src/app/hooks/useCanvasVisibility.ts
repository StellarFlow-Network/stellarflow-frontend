import {
  useEffect,
  useState,
  useRef,
} from 'react';

export function useCanvasVisibility() {
  const ref =
    useRef<HTMLCanvasElement | null>(
      null,
    );

  const [visible, setVisible] =
    useState(true);

  useEffect(() => {
    const node = ref.current;

    if (!node) return;

    const observer =
      new IntersectionObserver(
        ([entry]) => {
          setVisible(
            entry.isIntersecting,
          );
        },
        {
          threshold: 0.1,
        },
      );

    observer.observe(node);

    return () => {
      observer.disconnect();
    };
  }, []);

  return {
    ref,
    visible,
  };
}
export function throttleRender(
  callback: () => void,
  fps = 30,
) {
  let last = 0;

  return () => {
    const now =
      performance.now();

    if (
      now - last >
      1000 / fps
    ) {
      callback();

      last = now;
    }
  };
}
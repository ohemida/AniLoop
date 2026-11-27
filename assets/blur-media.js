// Client-side blurred hints for static hosting such as GitHub Pages.
// Frames are first drawn into a tiny canvas (48 px wide, like the server's
// ffmpeg pipeline) and then upscaled, so the visible canvas never contains a
// sharp frame (covers use 14 px because they are shown small) even if someone removes CSS in the inspector. The answer data is
// already public in data/pool.json, so this is a fairness measure, not DRM.
const SMALL_WIDTH = 48;
const MID_WIDTH = 160;
const OUT_WIDTH = 480;

let filterSupport;
function supportsFilter() {
  if (filterSupport !== undefined) return filterSupport;
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.filter = 'blur(2px)';
    filterSupport = ctx.filter === 'blur(2px)';
  } catch {
    filterSupport = false;
  }
  return filterSupport;
}

function createPipeline(canvas, smallWidth = SMALL_WIDTH, blurPx = 2) {
  const small = document.createElement('canvas');
  const mid = document.createElement('canvas');
  const sctx = small.getContext('2d');
  const mctx = mid.getContext('2d');
  const ctx = canvas.getContext('2d');
  return (source, width, height) => {
    if (!width || !height) return;
    const ratio = height / width;
    const size = (c, w) => {
      const h = Math.max(1, Math.round(w * ratio));
      if (c.width !== w || c.height !== h) {
        c.width = w;
        c.height = h;
      }
    };
    size(small, smallWidth);
    size(mid, MID_WIDTH);
    size(canvas, OUT_WIDTH);
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(source, 0, 0, small.width, small.height);
    mctx.imageSmoothingEnabled = true;
    mctx.imageSmoothingQuality = 'high';
    if (supportsFilter()) mctx.filter = `blur(${blurPx}px)`;
    mctx.drawImage(small, 0, 0, mid.width, mid.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(mid, 0, 0, canvas.width, canvas.height);
  };
}

/** Mirrors a (visually hidden) video element into a blurred canvas. Returns a stop function. */
export function blurVideo(video, canvas) {
  const draw = createPipeline(canvas);
  let stopped = false,
    handle = 0;
  const paint = () => {
    if (video.readyState >= 2 && video.videoWidth) draw(video, video.videoWidth, video.videoHeight);
  };
  const useFrameCallback = typeof video.requestVideoFrameCallback === 'function';
  const loop = () => {
    if (stopped) return;
    if (!canvas.isConnected) {
      stop();
      return;
    }
    paint();
    handle = useFrameCallback ? video.requestVideoFrameCallback(loop) : requestAnimationFrame(loop);
  };
  const onStatic = () => paint();
  video.addEventListener('loadeddata', onStatic);
  video.addEventListener('seeked', onStatic);
  function stop() {
    stopped = true;
    if (useFrameCallback) video.cancelVideoFrameCallback?.(handle);
    else cancelAnimationFrame(handle);
    video.removeEventListener('loadeddata', onStatic);
    video.removeEventListener('seeked', onStatic);
  }
  loop();
  return stop;
}

/** Loads an image without attaching it to the DOM and paints a blurred copy into the canvas. */
export function blurImage(src, canvas) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.onload = () => {
      createPipeline(canvas, 14, 4)(image, image.naturalWidth, image.naturalHeight);
      resolve();
    };
    image.onerror = () => reject(new Error('The cover image could not be loaded.'));
    image.src = src;
  });
}

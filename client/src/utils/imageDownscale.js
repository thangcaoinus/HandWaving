/**
 * Client-side downscale + re-encode for images entering the canvas.
 *
 * WHY this is load-bearing: an image's base64 `src` rides the canvas JSON into the DB *and* to every
 * collaborator over Socket.IO. Pasting a few raw phone photos would blow the storage cap and choke
 * autosave/broadcast. So every inserted/pasted image is re-encoded to a bounded WebP before it ever
 * enters allStrokesRef.
 *
 * Tuning: the caps live in ONE constant below so quality/size can be adjusted in a single line later
 * (e.g. an upload-to-URL path could bump these way up).
 */

export const IMAGE_ENCODE = {
  maxEdge: 1600,        // longest edge in px after downscale (never upscales)
  type: 'image/webp',   // output MIME; WebP q0.82 keeps a photo ~150-400KB
  quality: 0.82,
};

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image failed to decode'));
    img.src = src;
  });
}

function readAsDataURL(fileOrBlob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.readAsDataURL(fileOrBlob);
  });
}

/**
 * Downscale a File/Blob/data-URL to a bounded WebP data URL.
 * @returns { dataURL, width, height } where width/height are the FINAL (downscaled) dimensions.
 * @throws if the input can't be read or decoded (caller shows an AlertModal).
 */
export async function downscaleToDataURL(input) {
  const srcDataURL = typeof input === 'string' ? input : await readAsDataURL(input);
  const img = await loadImage(srcDataURL);

  const { naturalWidth: nw, naturalHeight: nh } = img;
  if (!nw || !nh) throw new Error('Image has no dimensions');

  // Scale so the long edge <= maxEdge; never upscale (scale capped at 1).
  const scale = Math.min(1, IMAGE_ENCODE.maxEdge / Math.max(nw, nh));
  const width = Math.max(1, Math.round(nw * scale));
  const height = Math.max(1, Math.round(nh * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  let dataURL = canvas.toDataURL(IMAGE_ENCODE.type, IMAGE_ENCODE.quality);
  // Safety net: some browsers ignore an unsupported type and silently hand back PNG. That's fine
  // (still a valid data:image/ URI), just larger — we don't fail on it.
  if (!dataURL.startsWith('data:image/')) throw new Error('Re-encode produced no image');

  return { dataURL, width, height };
}

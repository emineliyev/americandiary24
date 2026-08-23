import type { Area } from 'react-easy-crop';

function getRadianAngle(degrees: number) {
  return (degrees * Math.PI) / 180;
}

// The bounding box of a rotated rectangle — needed so the intermediate
// canvas is big enough to hold the whole rotated image with nothing
// clipped off before cropping out of it.
function rotatedBoundingBox(width: number, height: number, rotationDeg: number) {
  const rad = getRadianAngle(rotationDeg);
  return {
    width: Math.abs(Math.cos(rad) * width) + Math.abs(Math.sin(rad) * height),
    height: Math.abs(Math.sin(rad) * width) + Math.abs(Math.cos(rad) * height),
  };
}

export async function getCroppedBlob(imageSrc: string, cropArea: Area, rotationDeg = 0): Promise<Blob> {
  const image = new window.Image();
  image.src = imageSrc;
  await new Promise((resolve) => { image.onload = resolve; });

  // Rotate the full source image onto its own canvas first — react-easy-crop
  // reports `cropArea` in that rotated image's coordinate space, so cropping
  // straight from the unrotated source would cut the wrong region whenever
  // rotation is non-zero. At rotation=0 this is a no-op (same behavior as
  // before rotation support existed).
  const { width: boxW, height: boxH } = rotatedBoundingBox(image.width, image.height, rotationDeg);
  const rotatedCanvas = document.createElement('canvas');
  rotatedCanvas.width = boxW;
  rotatedCanvas.height = boxH;
  const rotatedCtx = rotatedCanvas.getContext('2d')!;
  rotatedCtx.translate(boxW / 2, boxH / 2);
  rotatedCtx.rotate(getRadianAngle(rotationDeg));
  rotatedCtx.translate(-image.width / 2, -image.height / 2);
  rotatedCtx.drawImage(image, 0, 0);

  const canvas = document.createElement('canvas');
  canvas.width = cropArea.width;
  canvas.height = cropArea.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(
    rotatedCanvas,
    cropArea.x, cropArea.y, cropArea.width, cropArea.height,
    0, 0, cropArea.width, cropArea.height,
  );
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.92));
}

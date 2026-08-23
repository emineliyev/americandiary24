import { useCallback, useEffect, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { getCroppedBlob } from '../utils/cropImage';
import './CropStep.css';

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.1;

export function CropStep({
  imageSrc,
  aspect,
  recommendedSize,
  onConfirm,
  onCancel,
  confirming,
}: {
  imageSrc: string;
  /** Fixed aspect ratio (e.g. 16/9, 1). Omit to derive it from the picked
   * image's own natural dimensions instead of forcing a specific shape —
   * used by the Media Library, where uploads aren't all one aspect. */
  aspect?: number;
  /** Shown as a live "output size" readout under the cropper, colored by
   * whether the current crop selection actually reaches it — lets the
   * admin see (and fix, by zooming out) an undersized crop before
   * uploading, instead of only finding out after the fact. */
  recommendedSize?: { width: number; height: number; label: string };
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
  confirming?: boolean;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [naturalAspect, setNaturalAspect] = useState<number | null>(null);

  useEffect(() => {
    if (aspect) return;
    const img = new window.Image();
    img.onload = () => setNaturalAspect(img.naturalWidth / img.naturalHeight);
    img.src = imageSrc;
  }, [imageSrc, aspect]);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => setCroppedArea(areaPixels), []);

  async function confirm() {
    if (!croppedArea) return;
    const blob = await getCroppedBlob(imageSrc, croppedArea, rotation);
    onConfirm(blob);
  }

  function reset() {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  }

  const effectiveAspect = aspect ?? naturalAspect;
  if (!effectiveAspect) return null; // waiting for the natural size to load

  const outputW = croppedArea ? Math.round(croppedArea.width) : null;
  const outputH = croppedArea ? Math.round(croppedArea.height) : null;
  const meetsRecommended = recommendedSize && outputW && outputH
    ? outputW >= recommendedSize.width && outputH >= recommendedSize.height
    : null;

  return (
    <div>
      <div style={{ position: 'relative', width: '100%', height: 320, background: '#111' }}>
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          rotation={rotation}
          aspect={effectiveAspect}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onRotationChange={setRotation}
          onCropComplete={onCropComplete}
        />
      </div>

      {(outputW && outputH) && (
        <p className={`crop-output-size ${meetsRecommended === false ? 'is-low' : meetsRecommended ? 'is-ok' : ''}`}>
          Output: {outputW}×{outputH}px
          {recommendedSize && (
            meetsRecommended
              ? ' ✓ meets recommended size'
              : ` — below recommended ${recommendedSize.width}×${recommendedSize.height}px (${recommendedSize.label}); zoom out or pick a larger image`
          )}
        </p>
      )}

      <div className="crop-controls">
        <div className="crop-controls__row">
          <span className="crop-controls__label">Zoom</span>
          <button type="button" onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - ZOOM_STEP).toFixed(2)))}>−</button>
          <input
            type="range" min={MIN_ZOOM} max={MAX_ZOOM} step={ZOOM_STEP}
            value={zoom} onChange={(e) => setZoom(Number(e.target.value))}
          />
          <button type="button" onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + ZOOM_STEP).toFixed(2)))}>+</button>
        </div>
        <div className="crop-controls__row">
          <span className="crop-controls__label">Rotate</span>
          <button type="button" onClick={() => setRotation((r) => r - 90)} title="Rotate left 90°">⟲</button>
          <input
            type="range" min={-180} max={180} step={1}
            value={rotation} onChange={(e) => setRotation(Number(e.target.value))}
          />
          <button type="button" onClick={() => setRotation((r) => r + 90)} title="Rotate right 90°">⟳</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'center' }}>
        <button type="button" className="btn btn-primary" onClick={confirm} disabled={confirming}>
          {confirming ? 'Uploading…' : 'Crop & Confirm'}
        </button>
        <button type="button" className="btn" onClick={reset} disabled={confirming}>Reset</button>
        <button type="button" className="btn" onClick={onCancel} disabled={confirming}>Cancel</button>
      </div>
    </div>
  );
}

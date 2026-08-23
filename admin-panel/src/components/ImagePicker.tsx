import { useState } from 'react';
import { CropStep } from './CropStep';
import { MediaAssetPickerModal } from './media/MediaAssetPickerModal';
import { uploadAsset } from '../api/media';
import { useToast, errorMessage } from './toast/ToastContext';
import { formatRecommendedSize, type RecommendedSize } from '../utils/imageSizes';
import type { MediaAsset } from '../api/types';
import './ImagePicker.css';

export type ImagePickerValue = { id: number; url: string };

export function ImagePicker({
  value,
  onChange,
  aspect = 16 / 9,
  recommendedSize,
}: {
  value: ImagePickerValue | null;
  onChange: (value: ImagePickerValue | null) => void;
  aspect?: number;
  recommendedSize?: RecommendedSize;
}) {
  const toast = useToast();
  const [pickedSrc, setPickedSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPickedSrc(URL.createObjectURL(file));
  }

  async function handleCropConfirm(blob: Blob) {
    setUploading(true);
    try {
      const asset = await uploadAsset(new File([blob], 'image.jpg', { type: blob.type }));
      onChange({ id: asset.id, url: asset.file });
      toast.success('Image uploaded.');
      setPickedSrc(null);
    } catch (err: any) {
      toast.error(errorMessage(err, 'Failed to upload the image.'));
    } finally {
      setUploading(false);
    }
  }

  function handleLibrarySelect(asset: MediaAsset) {
    onChange({ id: asset.id, url: asset.file });
    setShowLibrary(false);
  }

  if (pickedSrc) {
    return (
      <CropStep
        imageSrc={pickedSrc}
        aspect={aspect}
        recommendedSize={recommendedSize}
        confirming={uploading}
        onConfirm={handleCropConfirm}
        onCancel={() => setPickedSrc(null)}
      />
    );
  }

  return (
    <div>
      {value && (
        <div className="image-picker-preview" style={{ aspectRatio: `${aspect}` }}>
          <img src={value.url} alt="" />
          <button type="button" className="image-picker-remove" onClick={() => onChange(null)}>Remove</button>
        </div>
      )}
      <div className="image-picker-actions">
        <label className="btn">
          Upload New
          <input type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
        </label>
        <button type="button" className="btn" onClick={() => setShowLibrary(true)}>Choose from Library</button>
      </div>
      <p className="field-hint">
        Uploaded as WebP; the original file isn't kept. Nothing is saved until you Save this form.
        {recommendedSize && <> Recommended size: <strong>{formatRecommendedSize(recommendedSize)}</strong>.</>}
      </p>

      {showLibrary && (
        <MediaAssetPickerModal onSelect={handleLibrarySelect} onClose={() => setShowLibrary(false)} />
      )}
    </div>
  );
}

import { useRef } from 'react';
import { CKEditor } from '@ckeditor/ckeditor5-react';
import {
  ClassicEditor, Essentials, Paragraph, Heading, Bold, Italic, Underline,
  FontColor, FontBackgroundColor, Link, LinkImage, List, BlockQuote,
  Table, TableToolbar, TableColumnResize,
  Image, ImageToolbar, ImageStyle, ImageResize, ImageUpload, ImageCaption,
  MediaEmbed, Alignment, HtmlEmbed,
} from 'ckeditor5';
import 'ckeditor5/ckeditor5.css';
import { DjangoUploadAdapterPlugin } from './ckeditorUploadAdapter';
import './CKEditorBody.css';

export function CKEditorBody({
  value,
  onChange,
  resetKey,
}: {
  value: string;
  onChange: (html: string) => void;
  /** Identifies *which document* `value` belongs to (e.g. the article id,
   * or 'new') — NOT the content itself. */
  resetKey: string | number;
}) {
  // `@ckeditor/ckeditor5-react`'s <CKEditor> compares its `data` prop on
  // *every* parent re-render (in its own internal shouldComponentUpdate,
  // not something we control) and force-calls `instance.data.set(...)`
  // whenever that prop differs from the editor's current content. Since
  // `value` changes on essentially every keystroke via the controlled
  // onChange loop, and image upload is async, this races: onChange fires
  // with a pre-upload-complete snapshot, React re-renders with that as the
  // new `data` prop, the upload finishes a moment later moving the editor's
  // real content past it, and the library then force-reverts the editor
  // back to the stale snapshot — the image disappears. There's no prop-level
  // way to opt out of that internal check, so `value` must never be fed back
  // into `data` after mount. Instead, capture it once per document (keyed on
  // resetKey) purely as an initial value, and use `key={resetKey}` to force
  // a full remount when switching to a different document — same effect as
  // the old setData-on-resetKey-change approach, but without ever handing
  // the library a live-updating `data` prop it can race against.
  const resetKeyRef = useRef(resetKey);
  const initialValueRef = useRef(value);
  if (resetKeyRef.current !== resetKey) {
    resetKeyRef.current = resetKey;
    initialValueRef.current = value;
  }

  return (
    <div className="ckeditor-wrap">
      <CKEditor
        key={resetKey}
        editor={ClassicEditor}
        data={initialValueRef.current}
        config={{
          licenseKey: 'GPL',
          plugins: [
            Essentials, Paragraph, Heading, Bold, Italic, Underline,
            FontColor, FontBackgroundColor, Link, LinkImage, List, BlockQuote,
            Table, TableToolbar, TableColumnResize,
            Image, ImageToolbar, ImageStyle, ImageResize, ImageUpload, ImageCaption,
            MediaEmbed, Alignment, HtmlEmbed,
          ],
          toolbar: [
            'undo', 'redo', '|',
            'heading', '|',
            'bold', 'italic', 'underline', 'fontColor', 'fontBackgroundColor', '|',
            'bulletedList', 'numberedList', 'blockQuote', 'link', '|',
            'alignment', 'insertTable', 'mediaEmbed', 'htmlEmbed', 'uploadImage',
          ],
          image: {
            toolbar: [
              'imageStyle:inline', 'imageStyle:wrapText', 'imageStyle:breakText', '|',
              'toggleImageCaption', 'imageTextAlternative', 'linkImage',
            ],
          },
          table: {
            contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells'],
          },
          mediaEmbed: {
            // The public site renders article.body server-side with no
            // CKEditor JS loaded — without this, saved HTML is an
            // editor-only placeholder <div data-oembed-url="...">, not a
            // real playable embed.
            previewsInData: true,
          },
          extraPlugins: [DjangoUploadAdapterPlugin],
        }}
        onChange={(_, editor) => onChange(editor.getData())}
      />
    </div>
  );
}

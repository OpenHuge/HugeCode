import ImageOff from "lucide-react/dist/esm/icons/image-off";
import RotateCcw from "lucide-react/dist/esm/icons/rotate-ccw";
import { memo, useMemo } from "react";
import { Badge } from "../../../design-system";
import { getDiffStatusBadgeTone, getDiffStatusLabel, splitPath } from "./GitDiffPanel.utils";
import * as imageStyles from "./GitDiffViewer.image.styles.css";
import * as styles from "./GitDiffViewer.styles.css";

type ImageDiffCardProps = {
  path: string;
  status: string;
  oldImageData?: string | null;
  newImageData?: string | null;
  oldImageMime?: string | null;
  newImageMime?: string | null;
  isSelected: boolean;
  showRevert?: boolean;
  onRequestRevert?: (path: string) => void;
};

function getImageMimeType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".gif")) {
    return "image/gif";
  }
  if (lower.endsWith(".webp")) {
    return "image/webp";
  }
  if (lower.endsWith(".svg")) {
    return "image/svg+xml";
  }
  if (lower.endsWith(".bmp")) {
    return "image/bmp";
  }
  if (lower.endsWith(".ico")) {
    return "image/x-icon";
  }
  return "image/png";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function cx(...classNames: Array<string | false | null | undefined>) {
  return classNames.filter(Boolean).join(" ");
}

export const ImageDiffCard = memo(function ImageDiffCard({
  path,
  status,
  oldImageData,
  newImageData,
  oldImageMime,
  newImageMime,
  isSelected,
  showRevert = false,
  onRequestRevert,
}: ImageDiffCardProps) {
  const { name: fileName, dir } = useMemo(() => splitPath(path), [path]);
  const displayDir = dir ? `${dir}/` : "";
  const oldDataUri = useMemo(() => {
    if (!oldImageData) {
      return null;
    }
    const mimeType = oldImageMime ?? getImageMimeType(path);
    return `data:${mimeType};base64,${oldImageData}`;
  }, [oldImageData, oldImageMime, path]);

  const newDataUri = useMemo(() => {
    if (!newImageData) {
      return null;
    }
    const mimeType = newImageMime ?? getImageMimeType(path);
    return `data:${mimeType};base64,${newImageData}`;
  }, [newImageData, newImageMime, path]);

  const oldSize = useMemo(() => {
    if (!oldImageData) {
      return null;
    }
    const bytes = Math.ceil((oldImageData.length * 3) / 4);
    return formatFileSize(bytes);
  }, [oldImageData]);

  const newSize = useMemo(() => {
    if (!newImageData) {
      return null;
    }
    const bytes = Math.ceil((newImageData.length * 3) / 4);
    return formatFileSize(bytes);
  }, [newImageData]);

  const isAdded = status === "A";
  const isDeleted = status === "D";
  const isModified = !isAdded && !isDeleted;
  const placeholderLabel = "Image preview unavailable.";
  const renderPlaceholder = () => (
    <div className={imageStyles.imagePlaceholder}>
      <ImageOff className={imageStyles.imagePlaceholderIcon} aria-hidden />
      <div className={imageStyles.imagePlaceholderText}>{placeholderLabel}</div>
    </div>
  );

  return (
    <div
      data-diff-path={path}
      className={cx(styles.item, styles.itemImage, isSelected && styles.itemActive)}
    >
      <div className={styles.header}>
        <Badge
          className={styles.status}
          tone={getDiffStatusBadgeTone(status)}
          shape="chip"
          size="md"
        >
          {getDiffStatusLabel(status)}
        </Badge>
        <span className={styles.path} title={path}>
          <span className={styles.name}>{fileName}</span>
          {displayDir && <span className={styles.dir}>{displayDir}</span>}
        </span>
        {showRevert && (
          <button
            type="button"
            className={cx(styles.headerAction, styles.headerActionDiscard)}
            title="Discard changes in this file"
            aria-label="Discard changes in this file"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRequestRevert?.(path);
            }}
          >
            <RotateCcw size={14} aria-hidden />
          </button>
        )}
      </div>
      <div className={imageStyles.imageContent}>
        {isModified && (
          <div className={imageStyles.imageSideBySide}>
            <div className={imageStyles.imagePane}>
              {oldDataUri ? (
                <img src={oldDataUri} alt="Previous version" className={imageStyles.imagePreview} />
              ) : (
                renderPlaceholder()
              )}
              {oldSize && <div className={imageStyles.imageMeta}>{oldSize}</div>}
            </div>
            <div className={imageStyles.imagePane}>
              {newDataUri ? (
                <img src={newDataUri} alt="Current version" className={imageStyles.imagePreview} />
              ) : (
                renderPlaceholder()
              )}
              {newSize && <div className={imageStyles.imageMeta}>{newSize}</div>}
            </div>
          </div>
        )}
        {isAdded && (
          <div className={imageStyles.imageSingle}>
            <div className={cx(imageStyles.imagePane, imageStyles.imageSinglePane)}>
              {newDataUri ? (
                <img src={newDataUri} alt="New version" className={imageStyles.imagePreview} />
              ) : (
                renderPlaceholder()
              )}
              {newSize && <div className={imageStyles.imageMeta}>{newSize}</div>}
            </div>
          </div>
        )}
        {isDeleted && (
          <div className={imageStyles.imageSingle}>
            <div className={cx(imageStyles.imagePane, imageStyles.imageSinglePane)}>
              {oldDataUri ? (
                <img src={oldDataUri} alt="Deleted version" className={imageStyles.imagePreview} />
              ) : (
                renderPlaceholder()
              )}
              {oldSize && <div className={imageStyles.imageMeta}>{oldSize}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

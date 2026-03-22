import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { getCachedFileTypeIconUrl, preloadFileTypeIconUrl } from "../../../utils/fileTypeIcons";

type FileTypeIconImageProps = {
  path: string;
  alt: string;
  className?: string;
  fallback: ReactNode;
};

export function FileTypeIconImage({ path, alt, className, fallback }: FileTypeIconImageProps) {
  const [iconUrl, setIconUrl] = useState<string | null>(() => getCachedFileTypeIconUrl(path));

  useEffect(() => {
    let isCancelled = false;
    const cached = getCachedFileTypeIconUrl(path);
    if (cached) {
      setIconUrl(cached);
      return () => {
        isCancelled = true;
      };
    }

    setIconUrl(null);
    void preloadFileTypeIconUrl(path)
      .then((resolvedIconUrl) => {
        if (!isCancelled) {
          setIconUrl(resolvedIconUrl);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setIconUrl(null);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [path]);

  if (!iconUrl) {
    return fallback;
  }

  return <img className={className} src={iconUrl} alt={alt} loading="lazy" decoding="async" />;
}

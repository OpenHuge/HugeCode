export type DownloadEvent =
  | {
      data: { contentLength: number };
      event: "Started";
    }
  | {
      data: { chunkLength: number };
      event: "Progress";
    }
  | {
      event: "Finished";
    };

export type Update = {
  close(): Promise<void>;
  downloadAndInstall(listener: (event: DownloadEvent) => void): Promise<void>;
  version: string;
};

export async function check(): Promise<Update | null> {
  return null;
}

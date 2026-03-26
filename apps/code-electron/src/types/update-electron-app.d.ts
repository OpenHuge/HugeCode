declare module "update-electron-app" {
  export const UpdateSourceType: {
    readonly ElectronPublicUpdateService: "ElectronPublicUpdateService";
    readonly StaticStorage: "StaticStorage";
  };

  export type UpdateElectronAppOptions =
    | {
        notifyUser?: boolean;
        updateSource: {
          type: typeof UpdateSourceType.ElectronPublicUpdateService;
          repo: string;
        };
      }
    | {
        notifyUser?: boolean;
        updateSource: {
          type: typeof UpdateSourceType.StaticStorage;
          baseUrl: string;
        };
      };

  export function updateElectronApp(options: UpdateElectronAppOptions): void;
}

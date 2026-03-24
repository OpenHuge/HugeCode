export default {
  packagerConfig: {
    appBundleId: "com.openhuge.hugecode",
    asar: true,
    executableName: "HugeCode",
    name: "HugeCode",
    protocols: [
      {
        name: "HugeCode",
        schemes: ["hugecode"],
      },
    ],
  },
  makers: [
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
    },
    {
      name: "@electron-forge/maker-dmg",
    },
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        name: "HugeCode",
        setupExe: "HugeCodeSetup.exe",
      },
    },
    {
      name: "@electron-forge/maker-deb",
      config: {
        options: {
          categories: ["Development"],
          maintainer: "OpenHuge",
          mimeType: ["x-scheme-handler/hugecode"],
          productDescription: "HugeCode beta desktop shell",
          section: "devel",
        },
      },
    },
  ],
  publishers: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        draft: false,
        prerelease: true,
        repository: {
          name: "HugeCode",
          owner: "OpenHuge",
        },
      },
    },
  ],
};

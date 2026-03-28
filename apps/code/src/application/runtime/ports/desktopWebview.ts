type CompatWebview = {
  setZoom: (zoom: number) => Promise<void>;
};

const compatWebview: CompatWebview = {
  async setZoom(_zoom: number) {},
};

export function getCurrentWebview(): CompatWebview {
  return compatWebview;
}

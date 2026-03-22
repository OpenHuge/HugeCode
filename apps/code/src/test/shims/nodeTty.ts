export function isatty() {
  return false;
}

const ttyShim = {
  isatty,
};

export default ttyShim;

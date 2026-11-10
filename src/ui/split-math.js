export function clampSplit(percent) {
  return Math.max(20, Math.min(80, percent));
}
export function splitFromPointer(clientX, left, width) {
  return clampSplit(((clientX - left) / width) * 100);
}

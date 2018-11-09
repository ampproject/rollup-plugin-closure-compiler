const ALLOWED_TYPES = [3, 4];
let OTHER_TYPES = [5, 6];

export function yes(value) {
  return OTHER_TYPES.indexOf(value) >= 0 && ALLOWED_TYPES.indexOf(value) >= 0;
}
export function exported(argument) {
  console.log(argument);
}

export default function Thing() {
  console.log('default');
}

const bar = 10;
const baz = _ => console.log('baz');
export { bar, baz };

export * from "./esm-import";
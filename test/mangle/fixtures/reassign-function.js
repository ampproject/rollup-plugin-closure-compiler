import _, { foo, bar as baz } from 'lodash';
import {thing, thing2 as thing3} from 'lodash2';
import j from 'lodash3';

export function reassigned() {
  const _ = 'reassigned _';
  const foo = 'reassigned foo';
  const bar = 'reassigned bar';
  const baz = 'reassigned baz';
  const thing = 'reassigned thing';
  const thing3 = 'reassigned thing3';
  const j = 'reassigned j';

  console.log('reassigned', {_, foo, bar, baz, thing, thing3, j});
}

export function initial() {
  console.log('initial', {_, foo, bar, baz, thing, thing3, j});
}

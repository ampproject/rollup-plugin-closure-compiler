import _ from 'lodash';

export function reassigned() {
  const _ = 'reassigned _';

  let initial = initial;
  initial();

  console.log('reassigned', {_});
}

export function initial() {
  console.log('initial', {_});

  {
    console.log(_);
  }
}

export {reassigned as foo};
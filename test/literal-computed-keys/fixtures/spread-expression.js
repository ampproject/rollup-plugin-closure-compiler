const A = ['put', 'add', 'delete', 'clear'];

export function SpreadExpression(yep) {
  return {
    ...A,
    get: (thing) => console.log('get thing'),
  }
}
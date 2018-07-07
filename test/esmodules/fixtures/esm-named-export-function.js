function changeContent(name) {
  document.body.innerHTML = 'hello ' + name;
}

export function exported(name) {
  changeContent(name || 'you');
}
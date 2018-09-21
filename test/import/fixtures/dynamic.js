export function exported() {
  import('./dynamic-imported.js').then(module => module.handleImport());
}
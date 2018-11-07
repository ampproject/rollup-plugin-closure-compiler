import {Storage} from 'storage';

export class Plugin extends Storage {
  constructor(val) {
    super(val);
  }
}

export default Storage;

export const PLUGIN = new Plugin("foo");
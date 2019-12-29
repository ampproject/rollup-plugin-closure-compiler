import _, { foo, bar as baz } from 'lodash';
import {thing, thing2 as thing3} from 'lodash2';
import j from 'lodash3';

console.log('lodash', _, foo, baz, thing, thing3, j);
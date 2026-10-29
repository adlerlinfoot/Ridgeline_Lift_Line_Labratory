import test from 'node:test';import assert from 'node:assert/strict';import {displayName} from '../src/display-labels.mjs';
test('hide missing names and editor placeholders, preserve real names',()=>{
 for(const name of [undefined,'','  ','New node','NEW NODE 12','New route','New junction','New route · lower','Unnamed run','Untitled','N12'])assert.equal(displayName({id:'N12',name}),'',String(name));
 for(const name of ['West peak','Run 3','New York','Aspen Express','Main Lodge'])assert.equal(displayName({id:'N12',name}),name);
});

import {readFileSync,writeFileSync} from 'node:fs';
import {Worker as NodeWorker} from 'node:worker_threads';
import assert from 'node:assert/strict';
import {JSDOM} from '../../Ridgeline_Map_Importer/node_modules/jsdom/lib/api.js';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const dom=new JSDOM(html,{url:'http://127.0.0.1:43880/'});
dom.window.HTMLDialogElement.prototype.showModal=function(){this.open=true;};dom.window.HTMLDialogElement.prototype.close=function(){this.open=false;};
const win=dom.window,frames=[],downloads=[],blobs=[],strokes=[];
let paintCount=0;const context=new Proxy({measureText:t=>({width:t.length*6}),stroke(){strokes.push(this.strokeStyle);}},{get:(o,k)=>k in o?o[k]:(...args)=>{paintCount++;}});
win.HTMLCanvasElement.prototype.getBoundingClientRect=function(){return {left:0,top:0,width:this.id==='mountain-3d'?850:1200,height:this.id==='mountain-3d'?500:260};};
win.HTMLCanvasElement.prototype.getContext=()=>context;
win.HTMLAnchorElement.prototype.click=function(){downloads.push(this.download);};
Object.assign(globalThis,{window:win,localStorage:win.localStorage,document:win.document,requestAnimationFrame:fn=>frames.push(fn)});
globalThis.URL.createObjectURL=blob=>{blobs.push(blob);return 'blob:fixture';};globalThis.URL.revokeObjectURL=()=>{};
globalThis.fetch=async file=>({ok:true,json:async()=>{const data=JSON.parse(readFileSync(new URL('../'+file,import.meta.url)));if(file==='MODEL_CONFIG.json')data.time.operating_day_minutes=2;return data;}});
class WorkerBridge{
 constructor(url){const code=`const {parentPort}=require('node:worker_threads');global.self={postMessage:x=>parentPort.postMessage(x)};import(${JSON.stringify(url.href)}).then(()=>parentPort.on('message',data=>self.onmessage({data})));`;this.w=new NodeWorker(code,{eval:true});this.w.on('message',data=>this.onmessage?.({data}));this.w.on('error',e=>this.onerror?.(e));}
 postMessage(x){this.w.postMessage(x)}terminate(){this.w.terminate()}
}
globalThis.Worker=WorkerBridge;
await import('../src/app.mjs');
const $=id=>win.document.getElementById(id);
assert.equal($('error').hidden,true);assert.equal($('rate').disabled,true);assert.equal($('lift-cards').children.length,4);assert.ok($('mountain').children.length>35);
$('mode').value='arrival';$('mode').dispatchEvent(new win.Event('change'));assert.equal($('rate').disabled,false);
$('lodge-percent').value='35';$('lodge-percent').dispatchEvent(new win.Event('input'));assert.equal($('lodge-percent-value').textContent,'35%');$('lodge-percent').dispatchEvent(new win.Event('change'));
$('scenario').value='four_lift_intervention';$('scenario').dispatchEvent(new win.Event('change'));assert.match($('map-scenario').textContent,/20 RUNS/);
$('play').click();assert.equal($('scenario').disabled,true);assert.equal($('lodge-percent').disabled,true);assert.equal($('play').textContent,'Pause');
$('speed').value='3600';
let now=0;for(let i=0;i<100&&!$('play').disabled;i++){now+=250;frames.shift()(now);}
assert.equal($('play').textContent,'Run complete');assert.match($('phase').textContent,/Complete/);
for(const id of ['export-json','export-series','export-agents'])$(id).click();assert.equal(downloads.length,3);
$('reset').click();assert.equal($('scenario').disabled,false);assert.equal($('play').textContent,'Start simulation');
assert.equal($('batch-start'),null);
const imported=JSON.parse(readFileSync(new URL('../tests/fixtures/imported.json',import.meta.url)));
$('map-import-open').click();assert.equal($('map-import-dialog').open,true);
win.dispatchEvent(new win.MessageEvent('message',{origin:'http://127.0.0.1:43881',source:$('map-import-frame').contentWindow,data:{type:'ridgeline.topology.v1',bundle:imported}}));
await new Promise(r=>setTimeout(r,30));assert.equal($('scenario').value,'imported');assert.equal($('lift-cards').children.length,3);assert.ok($('loaded-map-name').textContent.includes('Three lift'));assert.equal(win.document.querySelectorAll('[data-overlay-lift]').length,3);
assert.equal($('individual-lifts').querySelectorAll('fieldset').length,3);
assert.equal($('mountain-library').options.length,2);
const seats=$('individual-lifts').querySelector('input');seats.value='4';seats.dispatchEvent(new win.Event('input'));seats.dispatchEvent(new win.Event('change'));
$('map-save').click();assert.match($('map-plugin-status').textContent,/saved/);
const saved=JSON.parse(win.localStorage.getItem('ridgeline-mountains-v1'));assert.equal(saved[0].map.lifts[0].seats_per_chair,4);
$('mountain-library').value='0';await $('mountain-library').onchange();assert.equal($('individual-lifts').querySelector('input').value,'4');
$('map-edit').click();assert.equal($('map-import-dialog').open,true);$('map-import-close').click();
const second=structuredClone(imported);second.map.name='Second saved mountain';
await $('map-import-file').onchange({target:{files:[{size:100,text:async()=>JSON.stringify(second)}],value:'fixture'}});
assert.equal($('mountain-library').options.length,3);$('mountain-library').value='0';await $('mountain-library').onchange();assert.equal($('individual-lifts').querySelector('input').value,'4');



$('overlay-count').value='3';$('overlay-start').click();
await new Promise((resolve,reject)=>{const deadline=Date.now()+20000;function check(){if($('overlay-status').textContent.startsWith('Complete:'))return resolve();if($('overlay-status').textContent.startsWith('Could not')||$('overlay-status').textContent.startsWith('Stopped:'))return reject(new Error($('overlay-status').textContent));if(Date.now()>deadline)return reject(new Error('overlay timeout'));setTimeout(check,20);}check();});
assert.equal($('overlay-progress').value,3);assert.equal($('overlay-txt').disabled,false);assert.ok($('overlay-parameters').textContent.includes('35% lodge'));
$('overlay-txt').click();$('overlay-csv').click();assert.equal(downloads.length,5);
const exported=await blobs[3].text();assert.ok(exported.includes('MINUTE-BY-MINUTE'));assert.ok(exported.includes('Completed runs: 3 / 3'));
$('overlay-metric').value='wait';$('overlay-metric').dispatchEvent(new win.Event('change'));
win.document.querySelector('[data-overlay-lift="Chair_1"]').checked=false;win.document.querySelector('[data-overlay-lift="Chair_1"]').dispatchEvent(new win.Event('change'));
$('overlay-chart').dispatchEvent(new win.MouseEvent('pointermove',{clientX:600,clientY:120}));assert.match($('overlay-hover').textContent,/observed min.+max/);
assert.ok(strokes.includes('#ff666b'));assert.ok(strokes.includes('#61c9ed'));
$('overlay-count').value='20';$('overlay-start').click();$('overlay-stop').click();assert.ok($('overlay-status').textContent.includes('Stopped after'));

win.document.querySelector('button[data-view="3d"]').click();assert.equal($('map-views').dataset.view,'3d');
win.document.querySelector('button[data-view="flat"]').click();assert.equal($('map-views').dataset.view,'flat');
win.document.querySelector('button[data-view="split"]').click();assert.equal($('map-views').dataset.view,'split');$('map-restore').click();assert.equal($('scenario').value,'baseline_3_lifts');assert.equal($('lift-cards').children.length,4);
$('height-scale').value='2.3';$('height-scale').dispatchEvent(new win.Event('input'));assert.equal($('height-value').textContent,'2.3\u00d7');
$('camera-reset').click();assert.equal($('height-value').textContent,'1.5\u00d7');
$('cone-wrap').checked=false;$('cone-wrap').dispatchEvent(new win.Event('change'));$('height-scale').value='2';$('height-scale').dispatchEvent(new win.Event('input'));$('orbit-gyro').dispatchEvent(new win.KeyboardEvent('keydown',{key:'Home',cancelable:true}));assert.equal($('cone-wrap').checked,true);assert.equal($('height-value').textContent,'1.5\u00d7');
$('node-labels').checked=false;$('node-labels').dispatchEvent(new win.Event('change'));
$('mountain-3d').dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowRight',cancelable:true}));
assert.ok(paintCount>100);
$('population').value='-1';$('reset').click();assert.equal($('error').hidden,false);assert.equal($('play').disabled,true);
$('population').value='650';$('reset').click();assert.equal($('error').hidden,true);
writeFileSync(new URL('../.runtime/ui-qa-3d.json',import.meta.url),JSON.stringify({passed:true,checks:['startup','map','scenario reset','population mode','locked settings','playback completion','safe drain','three exports','removed batch UI','three view modes','height control','camera reset','label toggle','keyboard orbit','invalid settings'],downloads},null,2));
console.log('PASS: overlay worker, lift colors/visibility, TXT/CSV exports, hover and cancellation;  mirrored 3D/flat DOM integration, controls and three downloads. Canvas calls mocked; visual browser QA unavailable.');

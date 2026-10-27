const test=require('node:test'),assert=require('node:assert/strict');
const {dimensions}=require('../workbench-resize.js');
test('split clamps both panes to usable widths across desktop widths and stale saved ratios',()=>{
  for(const width of [701,900,1280,2560])for(const ratio of [-1,0,.2,.5,1,4,null]){const d=dimensions(width,ratio);assert.ok(d.left>=240);assert.ok(d.available-d.left>=360);}
});
test('saved proportion follows resized viewport and default respects available space',()=>{
  assert.equal(dimensions(1214,.4).left,480);assert.equal(dimensions(1614,.4).left,640);assert.equal(dimensions(1214,null).left,360);assert.equal(dimensions(0,.5).left,0);
});

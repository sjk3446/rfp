const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../pages-runtime.js'),'utf8');
const method=source.slice(source.indexOf('    async saveNow(workspace){'),source.lastIndexOf('\n  };'));
test('a local write finishing after project switching cannot restore the previous active project',async()=>{
 let finish;const writes=[],ctx={currentProject:{id:'old',name:'Old'},saveTimer:null,clearTimeout(){},structuredClone,now:()=>1,dbPut(value){writes.push(value);return new Promise(resolve=>{finish=resolve;});}};
 const portal=vm.runInNewContext(`({${method}})`,ctx),saving=portal.saveNow({projectId:'old',requirements:[]});
 const nextProject={id:'new',name:'New'};ctx.currentProject=nextProject;finish();await saving;
 assert.equal(writes[0].id,'old');assert.equal(ctx.currentProject,nextProject);
});

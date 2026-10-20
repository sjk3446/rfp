/* A device-local index of successfully opened shared projects, not credentials. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.ReqlyProjectDirectory=factory();
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const validId=id=>/^[a-f0-9]{64}$/.test(id||'');
  function create(storage){
    const key='reqly-shared-project-directory-v1';let memory=[];
    const clean=item=>({id:item.id,name:String(item.name||'이름 없는 프로젝트'),updatedAt:String(item.updatedAt||''),openedAt:String(item.openedAt||'')});
    function list(){
      try{const stored=JSON.parse(storage?.getItem(key)||'null');if(Array.isArray(stored))memory=stored.filter(item=>item&&validId(item.id)).map(clean);}catch(_){}
      return memory.map(clean).sort((a,b)=>b.openedAt.localeCompare(a.openedAt));
    }
    function remember(project,opened=false){
      if(!validId(project?.id))return;
      const entries=list(),old=entries.find(item=>item.id===project.id);
      const next=clean({id:project.id,name:project.name,updatedAt:project.updatedAt,
        openedAt:opened||!old?new Date().toISOString():old.openedAt});
      memory=[next,...entries.filter(item=>item.id!==project.id)];
      try{storage?.setItem(key,JSON.stringify(memory));}catch(_){}
    }
    return{list,remember};
  }
  function projectUrl(address,id){
    if(!validId(id))throw new Error('프로젝트 공유 링크를 확인해 주세요.');
    const url=new URL(address);url.search='';url.hash='';url.searchParams.set('project',id);return url.href;
  }
  function idFromUrl(address){
    let id;try{const url=new URL(String(address).trim());if(['http:','https:'].includes(url.protocol))id=url.searchParams.get('project');}catch(_){}
    if(!validId(id))throw new Error('프로젝트 공유 링크 전체를 붙여 넣어 주세요.');
    return id;
  }
  return{create,projectUrl,idFromUrl};
});

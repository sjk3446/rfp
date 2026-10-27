/* Adjustable list/detail split. Only the display preference is persisted. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ReqlyWorkbenchResize=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const preference='reqly-workbench-ratio-v1',gap=14;
  function dimensions(width,ratio){
    const available=Math.max(0,Number(width)-gap),minimum=Math.min(240,available/2),maximum=Math.max(minimum,available-360);
    const desired=Number.isFinite(ratio)?available*ratio:Math.min(360,available*.35);
    return{available,minimum,maximum,left:Math.round(Math.max(minimum,Math.min(maximum,desired)))};
  }
  function mount(container,list,editor){
    let ratio=null,frame=0,pendingX,dragging=false;
    try{const saved=localStorage.getItem(preference);if(saved!==null&&Number.isFinite(Number(saved)))ratio=Number(saved);}catch(_){}
    const handle=document.createElement('div');handle.className='workbench-divider';handle.tabIndex=0;
    handle.setAttribute('role','separator');handle.setAttribute('aria-orientation','vertical');handle.setAttribute('aria-label','요구사항 목록과 상세 화면 너비 조절');
    handle.title='좌우로 드래그하여 너비 조절 · 두 번 클릭하면 기본 너비';
    list.id ||= 'requirementListPanel';editor.id ||= 'requirementEditorPanel';handle.setAttribute('aria-controls',`${list.id} ${editor.id}`);
    container.insertBefore(handle,editor);
    function draw(){
      const size=dimensions(container.getBoundingClientRect().width,ratio);
      container.style.setProperty('--requirement-list-width',`${size.left}px`);
      handle.setAttribute('aria-valuemin',String(Math.round(size.minimum)));handle.setAttribute('aria-valuemax',String(Math.round(size.maximum)));handle.setAttribute('aria-valuenow',String(size.left));
      handle.setAttribute('aria-valuetext',`목록 ${size.left}픽셀`);return size;
    }
    function persist(){try{ratio===null?localStorage.removeItem(preference):localStorage.setItem(preference,String(ratio));}catch(_){}
    }
    function position(x){const rect=container.getBoundingClientRect(),size=dimensions(rect.width,ratio);ratio=size.available?Math.max(size.minimum,Math.min(size.maximum,x-rect.left-gap/2))/size.available:null;draw();}
    function flush(){frame=0;if(pendingX!==undefined){position(pendingX);pendingX=undefined;}}
    function finish(event){if(!dragging)return;dragging=false;if(frame)cancelAnimationFrame(frame);flush();persist();document.body.classList.remove('resizing-workbench');if(handle.hasPointerCapture?.(event.pointerId))handle.releasePointerCapture(event.pointerId);}
    handle.onpointerdown=event=>{if(event.button!==0)return;event.preventDefault();dragging=true;handle.setPointerCapture(event.pointerId);handle.focus();document.body.classList.add('resizing-workbench');};
    handle.onpointermove=event=>{if(!dragging)return;pendingX=event.clientX;if(!frame)frame=requestAnimationFrame(flush);};
    handle.onpointerup=finish;handle.onpointercancel=finish;handle.onlostpointercapture=finish;
    handle.ondblclick=()=>{ratio=null;persist();draw();};
    handle.onkeydown=event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();
      const size=draw(),step=event.shiftKey?50:10;
      const next=event.key==='Home'?size.minimum:event.key==='End'?size.maximum:size.left+(event.key==='ArrowLeft'?-step:step);
      ratio=size.available?Math.max(size.minimum,Math.min(size.maximum,next))/size.available:null;draw();persist();
    };
    new ResizeObserver(draw).observe(container);draw();return handle;
  }
  return{dimensions,mount};
});

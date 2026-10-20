/* Local retrieval and citation validation; no AI or network calls here. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ReqlyProjectQA=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const normalized=value=>String(value||'').normalize('NFKC').toLowerCase().replace(/\s+/g,'');
  const evidenceText=value=>String(value||'').normalize('NFKC').replace(/\s+/g,'');
  const synonyms=[['인력','인원','인적','인력현황','참여인력','투입인력'],['프로필','profile','이력서','이력사항','경력','경력사항'],['pl','프로젝트리더','프로젝트책임자','파트리더'],['pm','사업관리자','사업책임자','프로젝트관리자'],['제출','첨부','증빙','구비서류'],['기간','일정','기한','착수','완료일'],['예산','사업비','금액','대금'],['자격','참가조건','입찰참가'],['보안','정보보호','보호조치']];
  function tokens(text){
    const terms=new Set();for(const word of String(text||'').normalize('NFKC').toLowerCase().match(/[a-z0-9]+|[가-힣]+/g)||[]){
      if(word.length<2)continue;terms.add(word);
      if(/^[가-힣]+$/.test(word))for(const size of [2,3])for(let i=0;i+size<=word.length;i++)terms.add(word.slice(i,i+size));
    }return terms;
  }
  function units(text,meta={}){
    const parts=String(text||'').split(/(\[\[(?:PAGE|SHEET):[^\]\n]+\]\])/g),result=[];let page=null,sheet='';
    for(const part of parts){
      const marker=part.match(/^\[\[(PAGE|SHEET):([^\]\n]+)\]\]$/);if(marker){page=marker[1]==='PAGE'?Number(marker[2]):null;sheet=marker[1]==='SHEET'?marker[2]:'';continue;}
      const content=part.replace(/\[\[TABLE_LAYOUT\]\]/g,'').trim();
      for(let offset=0;offset<content.length;offset+=1240){const fragment=content.slice(offset,offset+1400);if(!fragment.trim())continue;result.push({...meta,page:page||meta.page||null,sheet:sheet||meta.sheet||'',text:fragment});if(offset+1400>=content.length)break;}
    }return result;
  }
  function retrieve(sources,question,queries=[],{maxChars=6000,maxUnits=8}={}){
    const search=normalized(question),expanded=[question,...queries],originalTokens=tokens(question);
    for(const group of synonyms)if(group.some(term=>/^[a-z0-9]+$/.test(term)?originalTokens.has(term):search.includes(term)))expanded.push(...group);
    const wanted=tokens(expanded.join(' ')),corpus=sources.map(unit=>({unit,terms:tokens(`${unit.title||''} ${unit.text}`)})),df=new Map();
    for(const term of wanted)df.set(term,corpus.filter(entry=>entry.terms.has(term)).length);
    const ranked=corpus.map((entry,index)=>({index,score:[...wanted].reduce((score,term)=>score+(entry.terms.has(term)?(1+Math.log((sources.length+1)/((df.get(term)||0)+1)))*(term.length>2?1.5:1):0),0)})).filter(entry=>entry.score>0).sort((a,b)=>b.score-a.score);
    const picked=new Set(),selected=[];let characters=0;
    const add=index=>{const unit=sources[index];if(!unit||picked.has(index)||selected.length>=maxUnits||characters+unit.text.length>maxChars)return;picked.add(index);selected.push({...unit,sourceId:`e${selected.length+1}`});characters+=unit.text.length;};
    // Include adjacent original passages so qualifications/exceptions are not lost.
    for(const entry of ranked){if(selected.length>=maxUnits)break;add(entry.index);const unit=sources[entry.index];if(unit.assetId&&unit.kind!=='requirement')for(const neighbor of [entry.index+1,entry.index-1])if(sources[neighbor]?.assetId===unit.assetId)add(neighbor);}
    return{units:selected,characters,total:sources.length};
  }
  function validate(response,sources){
    const byId=new Map(sources.map(unit=>[unit.sourceId,unit])),claims=[];let rejected=0;
    for(const claim of Array.isArray(response?.claims)?response.claims:[]){
      const text=String(claim?.text||'').trim(),evidence=[];
      for(const entry of Array.isArray(claim?.evidence)?claim.evidence:[]){
        const source=byId.get(entry?.sourceId),quote=String(entry?.quote||'').trim();
        if(source&&quote.length>=4&&quote.length<=2000&&evidenceText(source.text).includes(evidenceText(quote)))evidence.push({...source,quote});
      }
      if(text&&text.length<=4000&&evidence.length)claims.push({text,evidence});else rejected++;
    }
    const state=['answered','uncertain','conflict'].includes(response?.status)?response.status:'uncertain';
    return{status:!claims.length||rejected?'uncertain':state,claims,rejected,followUp:String(response?.followUp||'').slice(0,600)};
  }
  return{tokens,units,retrieve,validate,normalized};
});

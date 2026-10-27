const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const {webcrypto}=require('node:crypto');
function browser(records=new Map(),handler){
  const database={createObjectStore(){},transaction(){const tx={objectStore(){return{get(key){const r={};queueMicrotask(()=>{r.result=records.get(key);r.onsuccess?.();});return r;},put(value,key){records.set(key,structuredClone(value));queueMicrotask(()=>tx.oncomplete?.());return{};}};}};return tx;}};
  const calls=[];
  const ctx={crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,AbortController,setTimeout,clearTimeout,indexedDB:{open(){const r={result:database};queueMicrotask(()=>{r.onupgradeneeded?.();r.onsuccess?.();});return r;}},window:{fetch:async(url,options)=>{calls.push({url,options});return handler?handler(url,options):{ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:'실제로 해야 할 일: 데이터를 확인하세요.'}]}}]})};}},BroadcastChannel:undefined};
  vm.runInNewContext(fs.readFileSync(require.resolve('../persistent-ai.js'),'utf8'),ctx);
  return{api:ctx.window.ReqlyPersistentAI,calls,records};
}
test('connection persists after a new browser context without storing plaintext key',async()=>{const first=browser();await first.api.connect('gemini','gemini-3.1-flash-lite','dummy-not-real-key');assert.equal(await first.api.isConnected(),true);assert.equal(JSON.stringify(first.records.get('connection')).includes('dummy-not-real-key'),false);assert.equal(first.records.get('cipher').extractable,false);const second=browser(first.records);assert.equal(await second.api.isConnected(),true);const result=await second.api.generate('explain',{requirement:{description:'test'}});assert.match(result.text,/데이터/);assert.equal(second.calls[0].options.headers['x-goog-api-key'],'dummy-not-real-key');assert.equal(second.calls[0].url.includes('dummy-not-real-key'),false);});
test('explicit disconnect persists and prevents any AI request',async()=>{const b=browser();await b.api.connect('gemini','gemini-3.1-flash-lite','dummy');await b.api.disconnect();assert.equal(await browser(b.records).api.isConnected(),false);await assert.rejects(()=>b.api.generate('explain',{}),/연결/);assert.equal(b.calls.length,0);});

test('three service keys survive switching and only the selected service key is used',async()=>{const b=browser(new Map(),async()=>({ok:true,json:async()=>({stop_reason:'end_turn',content:[{type:'text',text:'ok'}]})}));await b.api.connect('gemini','gemini-3.1-flash-lite','gemini-dummy');await b.api.connect('openai','gpt-5-mini','gpt-dummy');await b.api.connect('anthropic','claude-sonnet-5-5','claude-dummy');const reloaded=browser(b.records,async()=>({ok:true,json:async()=>({stop_reason:'end_turn',content:[{type:'text',text:'ok'}]})}));assert.equal((await reloaded.api.getRegistrations()).filter(item=>item.registered).length,3);await reloaded.api.connect('openai','gpt-5');assert.equal((await reloaded.api.getConnectionInfo()).model,'gpt-5');await reloaded.api.connect('anthropic','claude-haiku-5-5');await reloaded.api.generate('explain',{});assert.equal(reloaded.calls[0].options.headers['x-api-key'],'claude-dummy');assert.equal(JSON.stringify(await reloaded.api.getRegistrations()).includes('dummy'),false);assert.equal(JSON.stringify([...b.records.values()]).includes('gpt-dummy'),false);});
test('legacy single connection migrates without losing its key, and deletion is service-scoped',async()=>{const b=browser();await b.api.connect('gemini','gemini-3.1-flash-lite','old-dummy');b.records.delete('provider:gemini');await b.api.connect('openai','gpt-5-mini','new-dummy');assert.equal((await b.api.getRegistrations()).filter(item=>item.registered).length,2);await b.api.removeProvider('gemini');assert.equal((await b.api.getConnectionInfo()).provider,'openai');await assert.rejects(()=>b.api.connect('gemini','gemini-3.1-flash-lite'),/API 키/);await b.api.disconnect();assert.equal((await b.api.getRegistrations()).find(item=>item.provider==='openai').registered,true);await b.api.connect('openai','gpt-5-mini');await b.api.removeProvider('openai');assert.equal(await b.api.isConnected(),false);assert.equal((await b.api.getRegistrations()).filter(item=>item.registered).length,0);});
test('quota failure does not retry or switch providers',async()=>{const b=browser(new Map(),async()=>({ok:false,status:429,json:async()=>({})}));await b.api.connect('gemini','gemini-3.1-flash-lite','dummy');await assert.rejects(()=>b.api.generate('explain',{}),/한도/);assert.equal(b.calls.length,1);});
test('glossary uses term definitions and caps alternatives at three',async()=>{const b=browser(new Map(),async()=>({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify({results:[{term:'off-boarding',candidates:Array.from({length:5},()=>({meaning:'퇴사·서비스 이용 종료 절차'}))},{term:'unrequested',candidates:[]}]})}]}}]})}));await b.api.connect('gemini','gemini-3.1-flash-lite','dummy');const result=await b.api.generate('glossary',{terms:['off-boarding'],context:'project'});assert.equal(result.results.length,1);assert.equal(result.results[0].candidates.length,3);assert.equal(result.results[0].candidates[0].source,'AI 문맥 해석');assert.match(JSON.parse(b.calls[0].options.body).systemInstruction.parts[0].text,/용어 자체의 뜻/);});
test('truncated AI output is not applied',async()=>{const b=browser(new Map(),async()=>({ok:true,json:async()=>({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:'unfinished'}]}}]})}));await b.api.connect('gemini','gemini-3.1-flash-lite','dummy');await assert.rejects(()=>b.api.generate('explain',{}),error=>error.code==='OUTPUT_LIMIT'&&/MAX_TOKENS/.test(error.message));});
test('disconnect while request is pending discards the response',async()=>{let resolveResponse;const b=browser(new Map(),()=>new Promise(resolve=>{resolveResponse=resolve;}));await b.api.connect('gemini','gemini-3.1-flash-lite','dummy');const task=b.api.generate('explain',{});while(!resolveResponse)await new Promise(resolve=>setImmediate(resolve));await b.api.disconnect();resolveResponse({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:'late result'}]}}]})});await assert.rejects(()=>task,/변경/);});

test('business overview uses structured output and its own evidence-based instruction',async()=>{
  const b=browser(new Map(),async()=>({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"items":[]}'}]}}]})}));
  await b.api.connect('gemini','gemini-3.1-flash-lite','dummy');
  const result=await b.api.generate('overview',{units:[{sourceId:'s1',text:'사업기간 12개월'}]});
  assert.equal(result.items.length,0);const body=JSON.parse(b.calls[0].options.body);
  assert.equal(body.generationConfig.responseMimeType,'application/json');assert.match(body.systemInstruction.parts[0].text,/사업·입찰/);assert.match(body.systemInstruction.parts[0].text,/quote/);
  assert.equal(Object.hasOwn(body,'store'),false);
});

test('connection display exposes only provider and model metadata without API requests or decryption',async()=>{
  const b=browser();await b.api.connect('gemini','gemini-3.1-flash-lite','dummy-not-real-key');
  // Metadata display must still work even if decryption would fail.
  b.records.get('connection').encrypted=new Uint8Array([1,2,3]);
  const info=await b.api.getConnectionInfo();
  assert.deepEqual(JSON.parse(JSON.stringify(info)),{connected:true,provider:'gemini',model:'gemini-3.1-flash-lite',label:'Gemini 3.1 Flash-Lite'});
  assert.equal(JSON.stringify(info).includes('dummy-not-real-key'),false);assert.equal(b.calls.length,0);
  info.connected=false;assert.equal((await b.api.getConnectionInfo()).connected,true);
  await b.api.disconnect();assert.equal((await b.api.getConnectionInfo()).label,'');assert.equal((await b.api.getConnectionInfo()).connected,false);
});

test('GPT display name follows the actual configured model and errors identify that model',async()=>{
  const b=browser(new Map(),async()=>({ok:false,status:503,json:async()=>({})}));await b.api.connect('openai','gpt-5-mini','dummy');
  assert.equal((await b.api.getConnectionInfo()).label,'GPT-5 mini');
  await assert.rejects(()=>b.api.generate('overview',{}),/GPT-5 mini 요청에 실패했습니다 \(503\)/);assert.equal(b.calls.length,1);
});

test('Claude requests use Messages headers and ignore thinking blocks',async()=>{
  const b=browser(new Map(),async()=>({ok:true,json:async()=>({stop_reason:'end_turn',content:[{type:'thinking',thinking:'private'},{type:'text',text:'쉽게 설명한 결과'}]})}));
  await b.api.connect('anthropic','claude-sonnet-5-5','dummy-claude-key');
  assert.equal((await b.api.getConnectionInfo()).label,'Claude Sonnet 5.5');
  assert.equal((await b.api.generate('explain',{})).text,'쉽게 설명한 결과');
  const request=b.calls[0],body=JSON.parse(request.options.body);
  assert.equal(request.url,'https://api.anthropic.com/v1/messages');
  assert.equal(request.options.headers['x-api-key'],'dummy-claude-key');
  assert.equal(request.options.headers['anthropic-dangerous-direct-browser-access'],'true');
  assert.equal(request.options.headers['anthropic-version'],'2023-06-01');
  assert.equal(body.model,'claude-sonnet-5-5');assert.equal(body.messages[0].role,'user');
  assert.equal(Object.hasOwn(body,'output_config'),false);
  assert.equal(JSON.stringify(b.records.get('connection')).includes('dummy-claude-key'),false);
});

test('Claude overview and glossary request structured output and share existing validators',async()=>{
  for(const task of ['overview','glossary']){
    const data=task==='overview'?{items:[]}:{results:[{term:'ETL',candidates:[{full:'Extract Transform Load',meaning:'데이터 추출·변환·적재'}]}]};
    const b=browser(new Map(),async()=>({ok:true,json:async()=>({stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(data)}]})}));
    await b.api.connect('anthropic','claude-haiku-5-5','dummy');
    const result=await b.api.generate(task,{terms:['ETL']});
    const format=JSON.parse(b.calls[0].options.body).output_config.format;
    assert.equal(format.type,'json_schema');assert.equal(format.schema.additionalProperties,false);
    if(task==='overview')assert.equal(result.items.length,0);else assert.equal(result.results[0].term,'ETL');
  }
});

test('Claude truncation is rejected and errors identify the selected model',async()=>{
  const b=browser(new Map(),async()=>({ok:true,json:async()=>({stop_reason:'max_tokens',content:[{type:'text',text:'incomplete'}]})}));
  await b.api.connect('anthropic','claude-opus-5-5','dummy');
  await assert.rejects(()=>b.api.generate('explain',{}),error=>error.code==='OUTPUT_LIMIT'&&/Claude Opus 5.5.*max_tokens/.test(error.message));
});

test('all providers distinguish output limit from refusal and use a larger overview budget',async()=>{
  for(const [provider,model,response,expected] of [
    ['gemini','gemini-3.1-flash-lite',{candidates:[{finishReason:'MAX_TOKENS'}]},'MAX_TOKENS'],
    ['anthropic','claude-opus-5-5',{stop_reason:'max_tokens'},'max_tokens'],
    ['openai','gpt-5-mini',{status:'incomplete',incomplete_details:{reason:'max_output_tokens'}},'max_output_tokens']
  ]){
    const b=browser(new Map(),async()=>({ok:true,json:async()=>response}));await b.api.connect(provider,model,'dummy');
    await assert.rejects(()=>b.api.generate('overview',{}),error=>error.code==='OUTPUT_LIMIT'&&error.message.includes(expected));
    const body=JSON.parse(b.calls[0].options.body);
    assert.equal(body.generationConfig?.maxOutputTokens||body.max_tokens||body.max_output_tokens,16384);
    if(provider==='anthropic')assert.equal(body.output_config.effort,'medium');
    assert.equal(b.calls.length,1);
  }
  const b=browser(new Map(),async()=>({ok:true,json:async()=>({stop_reason:'refusal'})}));await b.api.connect('anthropic','claude-opus-5-5','dummy');
  await assert.rejects(()=>b.api.generate('overview',{}),{code:'REFUSAL'});
});

test('malformed structured overview replies carry a recoverable error',async()=>{
  const b=browser(new Map(),async()=>({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text:'{"items":['}]}}]})}));
  await b.api.connect('gemini','gemini-3.1-flash-lite','dummy');
  await assert.rejects(()=>b.api.generate('overview',{}),{code:'INVALID_JSON'});
});

test('all providers support evidence-based requirements extraction without synthesizing IDs',async()=>{
  for(const [provider,model,response] of [
    ['gemini','gemini-3.1-flash-lite',{candidates:[{finishReason:'STOP',content:{parts:[{text:'{"items":[]}'}]}}]}],
    ['anthropic','claude-sonnet-5-5',{stop_reason:'end_turn',content:[{type:'text',text:'{"items":[]}'}]}],
    ['openai','gpt-5-mini',{status:'completed',output:[{content:[{type:'output_text',text:'{"items":[]}'}]}]}]
  ]){
    const b=browser(new Map(),async()=>({ok:true,json:async()=>response}));await b.api.connect(provider,model,'dummy');
    const result=await b.api.generate('requirements',{categories:['보안'],units:[{sourceId:'s1',text:'기록 보관'}]});assert.equal(result.items.length,0);
    const body=JSON.parse(b.calls[0].options.body),instruction=body.system||body.instructions||body.systemInstruction.parts[0].text;
    assert.match(instruction,/임의의 요구사항 번호를 만들지/);
    if(provider==='anthropic')assert.deepEqual(Object.keys(body.output_config.format.schema.properties.items.items.properties).sort(),['category','id','name','quote','sourceId']);
  }
});

test('project questions use grounded structured replies on all providers and expansion is a separate task',async()=>{
  for(const [provider,model] of [['gemini','gemini-3.1-flash-lite'],['anthropic','claude-sonnet-5-5'],['openai','gpt-5-mini']]){
    for(const task of ['projectAnswer','projectQuery']){
      const payload=task==='projectAnswer'?{status:'answered',claims:[{text:'PL급 제출',evidence:[{sourceId:'e1',quote:'PL급만 제출'}]}],followUp:''}:{queries:['개인별 경력사항']};
      const text=JSON.stringify(payload),data=provider==='gemini'?{candidates:[{finishReason:'STOP',content:{parts:[{text}]}}]}:provider==='anthropic'?{stop_reason:'end_turn',content:[{type:'text',text}]}:{status:'completed',output:[{content:[{type:'output_text',text}]}]};
      const b=browser(new Map(),async()=>({ok:true,json:async()=>data}));await b.api.connect(provider,model,'dummy');
      const result=await b.api.generate(task,{question:'인력 프로필 제출 대상은?',sources:[{sourceId:'e1',text:'PL급만 제출'}]});
      assert.equal(b.calls.length,1);
      if(task==='projectAnswer')assert.equal(result.claims.length,1);else assert.equal(result.queries.length,1);
      const body=JSON.parse(b.calls[0].options.body);
      if(provider==='anthropic'){assert.equal(body.output_config.effort,'low');assert.ok(body.output_config.format.schema.properties[task==='projectAnswer'?'claims':'queries']);}
    }
  }
});

test('all providers support one structured RFP analysis containing both evidence-based result types',async()=>{
  for(const [provider,model] of [['gemini','gemini-3.1-flash-lite'],['anthropic','claude-sonnet-5-5'],['openai','gpt-5-mini']]){
    const text=JSON.stringify({requirements:[],overview:[]});
    const data=provider==='gemini'?{candidates:[{finishReason:'STOP',content:{parts:[{text}]}}]}:provider==='anthropic'?{stop_reason:'end_turn',content:[{type:'text',text}]}:{status:'completed',output:[{content:[{type:'output_text',text}]}]};
    const b=browser(new Map(),async()=>({ok:true,json:async()=>data}));await b.api.connect(provider,model,'dummy');
    const result=await b.api.generate('rfpAnalysis',{requirementCategories:['기타'],overviewCategories:['사업기간'],units:[{sourceId:'s1',text:'사업기간은 12개월입니다.'}]});
    assert.equal(result.requirements.length,0);assert.equal(result.overview.length,0);assert.equal(b.calls.length,1);
    const body=JSON.parse(b.calls[0].options.body),instruction=body.system||body.instructions||body.systemInstruction.parts[0].text;
    assert.match(instruction,/requirements/);assert.match(instruction,/overview/);assert.match(instruction,/임의의 요구사항 번호를 만들지/);
    assert.equal(body.generationConfig?.maxOutputTokens||body.max_tokens||body.max_output_tokens,16384);
    if(provider==='anthropic'){
      const schema=body.output_config.format.schema;assert.deepEqual(schema.required,['requirements','overview']);assert.equal(schema.additionalProperties,false);
      assert.ok(schema.properties.requirements.items.properties.id);assert.ok(schema.properties.overview.items.properties.content);
    }
  }
});

test('combined RFP replies require both arrays and propagate output limits for safe splitting',async()=>{
  for(const text of ['{"requirements":[]}','{"overview":[]}','{"requirements":{},"overview":[]}','not JSON']){
    const b=browser(new Map(),async()=>({ok:true,json:async()=>({candidates:[{finishReason:'STOP',content:{parts:[{text}]}}]})}));await b.api.connect('gemini','gemini-3.1-flash-lite','dummy');
    await assert.rejects(b.api.generate('rfpAnalysis',{}),{code:'INVALID_JSON'});
  }
  const b=browser(new Map(),async()=>({ok:true,json:async()=>({stop_reason:'max_tokens',content:[{type:'text',text:'{"requirements":[]'}]})}));await b.api.connect('anthropic','claude-sonnet-5-5','dummy');
  await assert.rejects(b.api.generate('rfpAnalysis',{}),{code:'OUTPUT_LIMIT'});assert.equal(b.calls.length,1);
});

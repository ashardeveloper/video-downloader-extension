const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root='extension/';
async function contextTest(mode){
 let clears=0,ticks=0;
 const context={setInterval:()=>1,clearInterval:()=>clears++,readActiveLesson:()=>({page:'https://www.apnacollege.in/path-player',title:'Lesson'}),chrome:{runtime:{id:mode==='missing'?null:'test',sendMessage:()=>{ticks++;if(mode==='throw')throw new Error('Extension context invalidated.');if(mode==='reject')return Promise.reject(new Error('Extension context invalidated.'));return Promise.resolve({ok:true});}}}};
 vm.runInNewContext(fs.readFileSync(root+'lesson-title.js','utf8'),context);
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(clears,mode==='normal'?0:1);assert.equal(ticks,mode==='missing'?0:1);
}
async function helperVersionTest(){
 let listener,nativeListener;const sent=[];let legacy=true;
 const chrome={webRequest:{onCompleted:{addListener:()=>{}},onBeforeSendHeaders:{addListener:()=>{}}},cookies:{getAll:async()=>[]},storage:{local:{get:async()=>({lectures:[],lessonTitles:{}}),set:async()=>{}}},runtime:{id:'test',onMessage:{addListener:f=>listener=f},connectNative:()=>({onMessage:{addListener:f=>nativeListener=f},onDisconnect:{addListener:()=>{}},postMessage:msg=>{sent.push(msg);if(msg.action==='ping')queueMicrotask(()=>nativeListener({id:msg.id,state:'ready',...(legacy?{}:{recordMode:'private-records',udemyMedia:true,sessionHeaders:true,browserRequestHeaders:true,socialMedia:true,multiInput:true,helperVersion:'4.0.8'})}));}})}};
 const ctx=vm.createContext({chrome,URL,AbortSignal,console,crypto:require('crypto').webcrypto,setTimeout,clearTimeout});
 ctx.importScripts=(...files)=>files.forEach(file=>vm.runInContext(fs.readFileSync(root+file,'utf8'),ctx));
 vm.runInContext(fs.readFileSync(root+'worker.js','utf8'),ctx);
 const send=msg=>new Promise(resolve=>listener(msg,{id:'test'},resolve));
 const bad=await send({action:'download',id:'old'});assert.equal(bad.ok,false);assert(bad.error.includes('outdated downloader'));assert(sent.every(x=>x.action==='ping'));
 legacy=false;const good=await send({action:'ping'});assert.equal(good.ok,true);assert.equal(good.helperVersion,'4.0.8');
}
(async()=>{for(const mode of ['throw','reject','missing','normal'])await contextTest(mode);await helperVersionTest();console.log('PASS: synchronous/asynchronous context invalidation and missing runtime stop safely; normal context works; outdated helper blocked before download; current helper accepted');})().catch(e=>{console.error(e);process.exitCode=1;});

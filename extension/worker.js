importScripts('detector.js','active-title.js','udemy-detector.js','social-detector.js');
function supportedCourseHost(host){return ['www.apnacollege.in','apnacollege.in'].includes(host)||/(^|\.)udemy\.com$/.test(host)||/(^|\.)instagram\.com$/.test(host)||/(^|\.)facebook\.com$/.test(host)||/(^|\.)tiktok\.com$/.test(host);}
function udemyMediaHost(host){return ['udemy.com','udemycdn.com','cloudfront.net'].some(root=>host===root||host.endsWith('.'+root));}
async function udemyHeaders(page,url){
  const target=new URL(url);
  const course=new URL(page);
  if(!udemyMediaHost(target.hostname) || !/(^|\.)udemy\.com$/.test(course.hostname))return null;
  return {
    'Accept':'*/*',
    'Accept-Language':navigator.language||'en-US',
    'Origin':'https://www.udemy.com',
    'Referer':course.href,
    'User-Agent':navigator.userAgent
  };
}

// Remove the known incorrect breadcrumb cached by earlier releases.
pending=pending.then(async()=>{
 const {lectures=[],lessonTitles={}}=await chrome.storage.local.get(['lectures','lessonTitles']);
 let changed=false;
 for(const page of Object.keys(lessonTitles))if(/^path(?:\.mp4)?$/i.test(lessonTitles[page].trim())){delete lessonTitles[page];changed=true;}
 for(const lecture of lectures)if(!lecture.customTitle && /^path(?:\.mp4)?$/i.test((lecture.title||'').trim())){delete lecture.courseTitle;lecture.title='Lecture';lecture.titleSource='page';changed=true;}
 if(changed)await chrome.storage.local.set({lectures,lessonTitles});
}).catch(console.error);

let nativePort;
let helperReady;
function helperStatus(){
  if(helperReady)return helperReady;
  helperReady=new Promise((resolve,reject)=>{
    const id=crypto.randomUUID();
    const timer=setTimeout(()=>{waiting.delete(id);reject(new Error('Downloader did not respond. Disable the extension, run SETUP.cmd, then enable it again.'));},15000);
    waiting.set(id,result=>{
      clearTimeout(timer);
      if(!result.ok){reject(new Error(result.error));return;}
      if(result.recordMode!=='private-records' || result.udemyMedia!==true || result.sessionHeaders!==true || result.browserRequestHeaders!==true || result.socialMedia!==true || result.multiInput!==true){
        reject(new Error('An outdated downloader is still installed. Disable the extension and run SETUP.cmd from version 4.0.8, then enable it again.'));return;
      }
      resolve(result);
    });
    try{connect().postMessage({action:'ping',id});}catch(error){waiting.delete(id);clearTimeout(timer);reject(error);}
  }).catch(error=>{helperReady=null;throw error;});
  return helperReady;
}
async function refreshActiveTitle(){
  try {
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    if(!tab?.url || !supportedCourseHost(new URL(tab.url).hostname))return {ok:false,error:'Open your course tab, then open this extension.'};
    let results;
    try{results=await chrome.scripting.executeScript({target:{tabId:tab.id,allFrames:true},world:'ISOLATED',func:readActiveLesson});}
    catch{results=await chrome.scripting.executeScript({target:{tabId:tab.id},world:'ISOLATED',func:readActiveLesson});}
    const top=results.find(x=>x.frameId===0)?.result;
    const titles=[...new Set(results.map(x=>x.result?.title).filter(Boolean))];
    const title=top?.title || (titles.length===1?titles[0]:null);
    if(!title)return {ok:false,error:'Selected lesson title not found. Open the course sidebar.'};
    const page=top?.page || tab.url;
    if(!supportedCourseHost(new URL(page).hostname))return {ok:false,error:'Course page required'};
    pending=pending.then(async()=>{
      const {lectures=[],lessonTitles={}}=await chrome.storage.local.get(['lectures','lessonTitles']);
      lessonTitles[page]=title;
      for(const lecture of lectures.filter(x=>x.page===page)){
        if(Number(top?.duration)>0)lecture.duration=Number(top.duration);lecture.courseTitle=title;if(!lecture.customTitle){lecture.title=title;lecture.titleSource='lesson';}
      }
      await chrome.storage.local.set({lectures,lessonTitles});
    });await pending;return {ok:true,title};
  }catch(error){return {ok:false,error:error.message};}
}
let jobUpdates = Promise.resolve();
const waiting = new Map();
function updateJob(job) {
  jobUpdates = jobUpdates.then(async () => {
    const {jobs={}} = await chrome.storage.local.get('jobs');
    jobs[job.id] = {...jobs[job.id],...job};
    await chrome.storage.local.set({jobs});
  });
  return jobUpdates;
}
function connect() {
  if(nativePort) return nativePort;
  const port=chrome.runtime.connectNative('com.lecture_saver.host');
  nativePort=port;
  port.onMessage.addListener(value=>{
    if(waiting.has(value.id)) {
      const cb=waiting.get(value.id); waiting.delete(value.id);
      cb(value.state==='error'?{ok:false,error:value.message}:{ok:true,...value});
    } else updateJob(value);
  });
  port.onDisconnect.addListener(()=>{
    const error=chrome.runtime.lastError?.message || 'Downloader disconnected. Please try again.';
    if(nativePort===port)nativePort=null;
    helperReady=null;
    for(const cb of waiting.values())cb({ok:false,error});
    waiting.clear();
    jobUpdates=jobUpdates.then(async()=>{
      const {jobs={}}=await chrome.storage.local.get('jobs');
      for(const job of Object.values(jobs))if(['queued','downloading'].includes(job.state)){job.state='error';job.message=error;}
      await chrome.storage.local.set({jobs});
    });
  });
  return port;
}
chrome.runtime.onMessage.addListener((msg,sender,reply)=>{
  if(sender.id!==chrome.runtime.id)return;
  (async()=>{
    if(msg.action==='lessonTitle'){
      if(sender.frameId!==0 || !sender.tab || !supportedCourseHost(new URL(msg.page).hostname) || typeof msg.title!=='string' || !msg.title.trim() || msg.title.length>240){reply({ok:false});return;}
      pending=pending.then(async()=>{
        const {lectures=[],lessonTitles={}}=await chrome.storage.local.get(['lectures','lessonTitles']);
        lessonTitles[msg.page]=msg.title.trim();
        for(const lecture of lectures.filter(x=>x.page===msg.page)){
          lecture.courseTitle=msg.title.trim();if(Number(msg.duration)>0)lecture.duration=Number(msg.duration);
          if(!lecture.customTitle){lecture.title=lecture.courseTitle;lecture.titleSource='lesson';}
        }
        await chrome.storage.local.set({lectures,lessonTitles});
      });await pending;reply({ok:true});return;
    }
    if(msg.action==='activeSocialVideo'){
      if(!sender.tab || typeof msg.src!=='string' || !msg.src || !supportedCourseHost(new URL(msg.page).hostname)){reply({ok:false});return;}
      pending=pending.then(async()=>{
        const {socialActiveVideos={}}=await chrome.storage.local.get('socialActiveVideos');
        socialActiveVideos[sender.tab.id]={page:msg.page,src:msg.src,title:(msg.title||'').trim().slice(0,240),duration:Number(msg.duration)||0,seen:Date.now()};
        await chrome.storage.local.set({socialActiveVideos});
      });await pending;reply({ok:true});return;
    }
    if(sender.tab) {reply({ok:false,error:'Popup required'});return;}
    if(msg.action==='rename' || msg.action==='remove'){
      pending=pending.then(async()=>{
        const {lectures=[]}=await chrome.storage.local.get('lectures');
        if(msg.action==='rename') {const lecture=lectures.find(x=>x.id===msg.id);if(lecture && typeof msg.title==='string' && msg.title.trim()){lecture.title=msg.title.trim().slice(0,300);lecture.customTitle=true;}}
        const next=msg.action==='remove'?lectures.filter(x=>x.id!==msg.id):lectures;
        await chrome.storage.local.set({lectures:next});await chrome.action.setBadgeText({text:next.length?String(next.length):''});
      });await pending;reply({ok:true});return;
    }
    if(msg.action==='clear'){
      await pending; await chrome.storage.local.set({lectures:[]}); await chrome.action.setBadgeText({text:''}); reply({ok:true}); return;
    }
    if(msg.action==='refreshTitle'){
      reply(await refreshActiveTitle());return;
    }
    if(msg.action==='download'){
      await helperStatus();
      await refreshActiveTitle();
      await pending;
      const {lectures=[]}=await chrome.storage.local.get('lectures');
      const lecture=lectures.find(x=>x.id===msg.id);
      if(!lecture)throw new Error('Video not found. Refresh the page.');
      if(!lecture.customTitle && lecture.titleSource!=='lesson' && !['instagram','facebook','tiktok'].includes(lecture.provider))throw new Error('Selected video title not found. Open this video and keep the course sidebar visible.');
      msg.name=lecture.title;msg.page=lecture.page;
      const stream=lecture.streams.find(x=>x.url===msg.url);
      if(stream?.unsupported)throw new Error(stream.unsupported);
      msg.format=stream?.format||'HLS';
      msg.headers=stream?.headers || await udemyHeaders(lecture.page,msg.url);
      if(stream?.audioUrl){msg.audioUrl=stream.audioUrl;msg.audioHeaders=stream.audioHeaders||stream.headers||null;}

      await jobUpdates;
      const {jobs={}}=await chrome.storage.local.get('jobs');
      if(['queued','downloading'].includes(jobs[msg.id]?.state)){reply({ok:true});return;}
      await updateJob({id:msg.id,state:'queued',message:'',time:'',duration:Number(lecture.duration)||0});
      connect().postMessage(msg);reply({ok:true});return;
    }
    if(msg.action==='ping'){reply(await helperStatus());return;}
    if(msg.action==='open'){
      await helperStatus();
      const id=crypto.randomUUID(); waiting.set(id,reply);connect().postMessage({action:msg.action,id});return;
    }
    reply({ok:false,error:'Unknown action'});
  })().catch(e=>reply({ok:false,error:e.message}));
  return true;
});

const fs=require('fs'),vm=require('vm'),assert=require('assert');const root='extension/';
const handlers=[];const beforeHandlers=[];const stored={lessonTitles:{}};let page='https://www.udemy.com/course/nextjs-react-the-complete-guide/learn/lecture/41159808#overview';
stored.lessonTitles[page]='First Udemy lesson';const fetched=[];
const ctx=vm.createContext({URL,AbortSignal,console,crypto:require('crypto').webcrypto,chrome:{webRequest:{onCompleted:{addListener:(fn,filter)=>handlers.push({fn,filter})},onBeforeSendHeaders:{addListener:(fn,filter)=>beforeHandlers.push({fn,filter})}},tabs:{get:async()=>({url:page,title:'Udemy course'})},storage:{local:{get:async()=>structuredClone(stored),set:async v=>Object.assign(stored,structuredClone(v))}},action:{setBadgeText:async()=>{}}},fetch:async url=>{fetched.push(url);return {ok:true,text:async()=>url.includes('protected')?'<MPD><ContentProtection schemeIdUri="test"/></MPD>':url.includes('master')?'#EXTM3U\n#EXT-X-STREAM-INF:RESOLUTION=1920x1080\nvideo.m3u8':'#EXTM3U\n#EXTINF:10.5,\n1.ts\n#EXTINF:9.5,\n2.ts\n#EXT-X-ENDLIST'};}});
for(const file of ['detector.js','udemy-detector.js'])vm.runInContext(fs.readFileSync(root+file,'utf8'),ctx);
const handler=handlers.find(x=>x.filter.urls.includes('https://*.udemycdn.com/*')).fn;
const before=beforeHandlers.find(x=>x.filter.urls.includes('https://*.udemycdn.com/*')).fn;
async function emit(url,headers=[]){before({tabId:7,url,requestHeaders:[{name:'User-Agent',value:'Chrome Test'},{name:'Referer',value:page},{name:'Range',value:'bytes=0-'}]});handler({tabId:7,statusCode:200,url,responseHeaders:headers});await vm.runInContext('pending',ctx);}
(async()=>{
 await emit('https://video.udemycdn.com/master.m3u8?token=example');assert.equal(stored.lectures[0].title,'First Udemy lesson');assert(stored.lectures[0].streams.some(x=>x.label==='1080p'));const captured=stored.lectures[0].streams.find(x=>x.url.includes('master.m3u8'));assert.equal(captured.headers['User-Agent'],'Chrome Test');assert(!captured.headers.Range);
 await emit('https://video.udemycdn.com/video.m3u8');assert.equal(stored.lectures.length,1);
 await emit('https://video.udemycdn.com/lesson.mp4?token=example');assert(stored.lectures[0].streams.some(x=>x.format==='MP4'));assert(!fetched.some(x=>x.includes('lesson.mp4')));
 const count=stored.lectures[0].streams.length;await emit('https://video.udemycdn.com/seg-42.mp4');assert.equal(stored.lectures[0].streams.length,count);
 await emit('https://video.udemycdn.com/protected.mpd');assert(stored.lectures[0].streams.find(x=>x.format==='DASH').unsupported);
 page=page.replace('41159808','41159809');await emit('https://video.udemycdn.com/next.m3u8');assert.equal(stored.lectures.length,2);assert.equal(stored.lectures[1].duration,20);
 await emit('https://video.udemycdn.com/signed-video',[{name:'Content-Type',value:'video/mp4'}]);assert(stored.lectures[1].streams.some(x=>x.url.endsWith('signed-video')&&x.format==='MP4'));
 page='https://example.com/not-course';await emit('https://video.udemycdn.com/not-course.mp4');assert.equal(stored.lectures.length,2);
 console.log('PASS: Udemy scope, HLS quality parsing, direct MP4 without extra fetch, segment exclusion, DRM flag, separate lectures, duration and MIME-only URL detection');
})().catch(e=>{console.error(e);process.exitCode=1;});

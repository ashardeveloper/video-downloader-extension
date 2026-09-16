const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root='extension/';
const stored={};
const beforeHandlers=[];
const doneHandlers=[];
let page='https://www.tiktok.com/@user/video/123';
const ctx=vm.createContext({
  URL,AbortSignal,console,atob,crypto:require('crypto').webcrypto,
  chrome:{
    webRequest:{
      onBeforeSendHeaders:{addListener:(fn,filter)=>beforeHandlers.push({fn,filter})},
      onCompleted:{addListener:(fn,filter)=>doneHandlers.push({fn,filter})}
    },
    tabs:{get:async()=>({url:page,title:'My TikTok Video | TikTok'})},
    storage:{local:{get:async()=>structuredClone(stored),set:async value=>Object.assign(stored,structuredClone(value))}},
    action:{setBadgeText:async()=>{}}
  }
});
for(const file of ['detector.js','social-detector.js'])vm.runInContext(fs.readFileSync(root+file,'utf8'),ctx);
const before=beforeHandlers.find(x=>x.filter.urls.includes('https://*.tiktokcdn.com/*')).fn;
const done=doneHandlers.find(x=>x.filter.urls.includes('https://*.tiktokcdn.com/*')).fn;
async function emit(url){
  before({tabId:4,url,requestHeaders:[{name:'User-Agent',value:'Chrome Test'},{name:'Cookie',value:'short-session'},{name:'Range',value:'bytes=0-1023'},{name:'Referer',value:page}]});
  done({tabId:4,statusCode:200,url,responseHeaders:[{name:'Content-Type',value:'video/mp4'}]});
  await vm.runInContext('pending',ctx);
}
function setActive(tabId,src,pageUrl=page){
  stored.socialActiveVideos=stored.socialActiveVideos||{};
  stored.socialActiveVideos[tabId]={page:pageUrl,src,title:'Active Video',duration:12,seen:Date.now()};
}
async function emitWith(url,contentType='video/mp4'){
  before({tabId:4,url,requestHeaders:[{name:'User-Agent',value:'Chrome Test'},{name:'Cookie',value:'short-session'},{name:'Range',value:'bytes=0-1023'},{name:'Referer',value:page}]});
  done({tabId:4,statusCode:200,url,responseHeaders:[{name:'Content-Type',value:contentType}]});
  await vm.runInContext('pending',ctx);
}
async function emitTiny(url){
  before({tabId:4,url,requestHeaders:[{name:'User-Agent',value:'Chrome Test'},{name:'Range',value:'bytes=0-1023'},{name:'Referer',value:page}]});
  done({tabId:4,statusCode:200,url,responseHeaders:[{name:'Content-Type',value:'video/mp4'},{name:'Content-Length',value:'1024'}]});
  await vm.runInContext('pending',ctx);
}
(async()=>{
  page='https://www.instagram.com/reel/test/';
  await emitTiny('https://scontent.cdninstagram.com/init.mp4?token=1');
  assert(!stored.lectures);
  page='https://www.tiktok.com/@user/video/123';
  setActive(4,'https://v16-webapp.tiktokcdn.com/video.mp4?token=1');
  await emit('https://v16-webapp.tiktokcdn.com/video.mp4?token=1');
  assert.equal(stored.lectures.length,1);
  assert.equal(stored.lectures[0].provider,'tiktok');
  assert.equal(stored.lectures[0].streams[0].format,'MP4');
  assert.equal(stored.lectures[0].streams[0].headers['User-Agent'],'Chrome Test');
  assert.equal(stored.lectures[0].streams[0].headers.Range,'bytes=0-');
  assert.equal(stored.lectures[0].streams[0].headers.Cookie,'short-session');
  setActive(4,'https://v16-webapp-prime.tiktok.com/video/tos/example/?mime_type=video_mp4&signature=abc');
  await emitWith('https://v16-webapp-prime.tiktok.com/video/tos/example/?mime_type=video_mp4&signature=abc','application/octet-stream');
  assert.equal(stored.lectures[0].streams.length,2);
  assert.equal(stored.lectures[0].streams[1].headers['User-Agent'],'Chrome Test');
  await emitWith('https://v16-webapp-prime.tiktok.com/video/tos/wrong/?mime_type=video_mp4&signature=other','application/octet-stream');
  assert.equal(stored.lectures[0].streams.length,2);
  page='https://example.com/not-social';
  await emit('https://v16-webapp.tiktokcdn.com/other.mp4?token=1');
  assert.equal(stored.lectures.length,1);
  page='https://www.facebook.com/watch/?v=2245339912919082';
  const audio=Buffer.from(JSON.stringify({vencode_tag:'dash_ln_heaac_vbr3_audio'})).toString('base64');
  const video=Buffer.from(JSON.stringify({vencode_tag:'dash_hd_avc_video'})).toString('base64');
  const audioUrl='https://video.xx.fbcdn.net/o1/v/t2/f2/audio.mp4?efg='+encodeURIComponent(audio)+'&bytestart=10&byteend=20';
  const videoUrl='https://video.xx.fbcdn.net/o1/v/t2/f2/video.mp4?efg='+encodeURIComponent(video)+'&bytestart=30&byteend=40';
  await emit(audioUrl);
  assert.equal(stored.lectures.length,2);
  assert.equal(stored.lectures[1].streams.length,0);
  await emit(videoUrl);
  const fbStream=stored.lectures[1].streams[0];
  assert(fbStream.url.includes('video.mp4'));
  assert(!fbStream.url.includes('bytestart'));
  assert(fbStream.audioUrl.includes('audio.mp4'));
  assert(!fbStream.audioUrl.includes('byteend'));
  page='https://www.instagram.com/reel/test-real/';
  const igVideo=Buffer.from(JSON.stringify({vencode_tag:'ig-xpvds.clips.c2-C3.dash_r2evp9-r1gen2vp9_q90',xpv_asset_id:'ig123'})).toString('base64');
  const igAudio=Buffer.from(JSON.stringify({vencode_tag:'ig-xpvds.audio.aac',xpv_asset_id:'ig999'})).toString('base64');
  const igAudioSame=Buffer.from(JSON.stringify({vencode_tag:'ig-xpvds.audio.aac',xpv_asset_id:'ig123'})).toString('base64');
  const igUrl='https://scontent.cdninstagram.com/o1/v/t2/f2/clip.mp4?efg='+encodeURIComponent(igVideo)+'&bytestart=902&byteend=698130';
  setActive(4,'https://scontent.cdninstagram.com/o1/v/t2/f2/clip.mp4?efg='+encodeURIComponent(igVideo));
  await emitWith('https://scontent.cdninstagram.com/o1/v/t2/f2/wrong-audio.mp4?efg='+encodeURIComponent(igAudio)+'&bytestart=1&byteend=2');
  await emitWith(igUrl);
  const igStream=stored.lectures[2].streams[0];
  assert(igStream.url.includes('clip.mp4'));
  assert(!igStream.url.includes('bytestart'));
  assert.equal(igStream.headers.Range,'bytes=0-');
  assert(!igStream.audioUrl);
  await emitWith('https://scontent.cdninstagram.com/o1/v/t2/f2/right-audio.mp4?efg='+encodeURIComponent(igAudioSame)+'&bytestart=3&byteend=4');
  assert(stored.lectures[2].streams[0].audioUrl.includes('right-audio.mp4'));
  page='https://www.instagram.com/reel/blob-case/';
  setActive(4,'blob:https://www.instagram.com/blob-id');
  const blobVideo=Buffer.from(JSON.stringify({vencode_tag:'ig-xpvds.clips.c2-C3.dash_r2evp9-r1gen2vp9_q90',xpv_asset_id:'igblob'})).toString('base64');
  await emitWith('https://scontent.cdninstagram.com/o1/v/t2/f2/blob-video.mp4?efg='+encodeURIComponent(blobVideo)+'&bytestart=1&byteend=100');
  assert.equal(stored.lectures.length,4);
  console.log('PASS: social direct MP4 detection stores short browser headers, ignores non-social pages, and pairs Facebook DASH audio/video tracks');
})().catch(error=>{console.error(error);process.exitCode=1;});

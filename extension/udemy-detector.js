function udemyMediaKind(details){
  const path=new URL(details.url).pathname;
  if(/(?:^|\/)(?:init|seg(?:ment)?[-_\d]|chunk[-_\d])[^/]*\.mp4$/i.test(path))return null;
  const mime=(details.responseHeaders||[]).find(x=>x.name.toLowerCase()==='content-type')?.value?.split(';')[0].trim().toLowerCase();
  if(/\.m3u8$/i.test(path)||['application/vnd.apple.mpegurl','application/x-mpegurl'].includes(mime))return 'HLS';
  if(/\.mpd$/i.test(path)||mime==='application/dash+xml')return 'DASH';
  if(/\.mp4$/i.test(path)||mime==='video/mp4')return 'MP4';
  return null;
}
function udemyHost(host){return ['udemy.com','udemycdn.com','cloudfront.net'].some(root=>host===root||host.endsWith('.'+root));}
const udemyRequestHeaders=new Map();
function cleanUdemyRequestHeaders(headers){
  const keep=new Set(['accept','accept-language','origin','referer','sec-fetch-dest','sec-fetch-mode','sec-fetch-site','sec-ch-ua','sec-ch-ua-mobile','sec-ch-ua-platform','user-agent']);
  const result={};
  for(const header of headers||[]){
    const name=header.name;
    const lower=name.toLowerCase();
    if(!keep.has(lower))continue;
    if(!/^[A-Za-z0-9-]+$/.test(name))continue;
    const value=String(header.value||'');
    if(!value || value.length>8192 || /[\r\n]/.test(value))continue;
    result[name]=value;
  }
  return result;
}
chrome.webRequest.onBeforeSendHeaders.addListener(details=>{
  if(details.tabId<0)return;
  const kind=udemyMediaKind(details);if(!kind)return;
  udemyRequestHeaders.set(details.url,cleanUdemyRequestHeaders(details.requestHeaders));
  if(udemyRequestHeaders.size>100){
    const first=udemyRequestHeaders.keys().next().value;
    udemyRequestHeaders.delete(first);
  }
},{urls:['https://*.udemy.com/*','https://*.udemycdn.com/*','https://*.cloudfront.net/*']},['requestHeaders','extraHeaders']);
chrome.webRequest.onCompleted.addListener(details=>{
  if(details.tabId<0 || details.statusCode>=400)return;
  const kind=udemyMediaKind(details);if(!kind)return;
  const capturedHeaders=udemyRequestHeaders.get(details.url)||null;
  const tabSnapshot=chrome.tabs.get(details.tabId).catch(()=>null);
  pending=pending.then(async()=>{
    const tab=await tabSnapshot;
    if(!tab?.url || !/(^|\.)udemy\.com$/.test(new URL(tab.url).hostname) || !/\/learn\/lecture\/\d+/.test(new URL(tab.url).pathname))return;
    const {lectures=[],lessonTitles={}}=await chrome.storage.local.get(['lectures','lessonTitles']);
    let lecture=lectures.find(x=>x.provider==='udemy'&&x.page===tab.url);
    if(!lecture){lecture={id:crypto.randomUUID(),provider:'udemy',page:tab.url,title:lessonTitles[tab.url]||tab.title||'Udemy lecture',titleSource:lessonTitles[tab.url]?'lesson':'page',streams:[]};lectures.push(lecture);}
    const existing=lecture.streams.find(x=>x.url===details.url);
    if(existing){if(capturedHeaders)existing.headers=capturedHeaders;await chrome.storage.local.set({lectures});return;}
    let stream={url:details.url,label:kind==='MP4'?'MP4':kind==='HLS'?'Auto (HLS)':'Auto (DASH)',format:kind};
    if(capturedHeaders)stream.headers=capturedHeaders;
    const variants=[];
    if(kind!=='MP4'){
      try{
        const response=await fetch(details.url,{signal:AbortSignal.timeout(6000)});
        if(response.ok){
          const text=await response.text();
          if(kind==='DASH' && /<\s*(?:\w+:)?ContentProtection\b/i.test(text))stream.unsupported='This stream uses DRM protection and is not supported.';
          if(kind==='HLS' && /METHOD=SAMPLE-AES|KEYFORMAT="(?!identity")/i.test(text))stream.unsupported='This stream uses protected encryption and is not supported.';
          if(kind==='HLS'){
            const lengths=[...text.matchAll(/^#EXTINF:([\d.]+)/gm)].map(x=>Number(x[1]));
            if(lengths.length && text.includes('#EXT-X-ENDLIST'))lecture.duration=lengths.reduce((a,b)=>a+b,0);
            // Keep a master playlist when audio is supplied through a separate rendition.
            const separateAudio=/#EXT-X-MEDIA:.*TYPE=AUDIO/i.test(text);
            const lines=text.split(/\r?\n/).map(x=>x.trim());
            if(!separateAudio)for(let i=0;i<lines.length;i++){
              if(!lines[i].startsWith('#EXT-X-STREAM-INF:'))continue;
              const next=lines.slice(i+1).find(x=>x&&!x.startsWith('#'));if(!next)continue;
              const url=new URL(next,details.url);if(url.protocol!=='https:'||!udemyHost(url.hostname))continue;
              const height=lines[i].match(/RESOLUTION=\d+x(\d+)/)?.[1];
              variants.push({url:url.href,label:height?height+'p':'HLS quality',format:'HLS',unsupported:stream.unsupported,headers:udemyRequestHeaders.get(url.href)||capturedHeaders||undefined});
            }
          }
        }
      }catch{}
    }
    lecture.streams.push(stream);
    for(const variant of variants){const old=lecture.streams.find(x=>x.url===variant.url);if(old)Object.assign(old,variant);else lecture.streams.push(variant);}
    await chrome.storage.local.set({lectures});await chrome.action.setBadgeText({text:String(lectures.length)});
  }).catch(console.error);
},{urls:['https://*.udemy.com/*','https://*.udemycdn.com/*','https://*.cloudfront.net/*']},['responseHeaders']);

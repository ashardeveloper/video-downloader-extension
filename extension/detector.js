let pending = Promise.resolve();
const mediaCache = new Map();
function mediaIdFrom(url) {
  const path=new URL(url).pathname;
  return path.match(/\/embed\/(?:medias|iframe)\/([a-z0-9]{10})(?:[/.]|$)/i)?.[1] || path.match(/\/([a-z0-9]{10})\.m3u8$/i)?.[1] || '';
}
function parseMedia(text) {
  // JSONP is parsed as data only. Never execute the remote response.
  const first=text.indexOf('{'),last=text.lastIndexOf('}');
  if(first<0 || last<first)return null;
  const payload=JSON.parse(text.slice(first,last+1));
  const media=payload.media || payload;
  return typeof media.name==='string' && media.name.trim() ? media : null;
}
async function fetchMedia(id,observedUrl) {
  if(mediaCache.has(id))return mediaCache.get(id);
  const urls=[observedUrl,...['json','jsonp'].map(ext=>'https://fast.wistia.com/embed/medias/'+id+'.'+ext)].filter(Boolean);
  for(const url of [...new Set(urls)]) {
    try {
      const response=await fetch(url,{signal:AbortSignal.timeout(5000)});
      if(!response.ok)continue;
      const media=parseMedia(await response.text());
      if(media){mediaCache.set(id,media);return media;}
    }catch{}
  }
  return null;
}
function applyMedia(lecture,media,id) {
  if(!lecture.customTitle)lecture.title=lecture.courseTitle || media.name.trim().slice(0,300);
  lecture.titleSource=lecture.customTitle?'custom':lecture.courseTitle?'lesson':'video';lecture.mediaId=id;
  lecture.duration=Number(media.duration)||0;
  const poster=media.assets?.find(x=>x.type==='still_image');
  if(poster?.url && /^https:\/\/[^/]*wistia\.(com|net)\//.test(poster.url))lecture.thumbnail=poster.url;
}
function deliveryKey(url){try{return new URL(url).pathname.match(/\/deliveries\/([a-z0-9]+)/i)?.[1] || '';}catch{return '';}}
function metadataMatches(entry,url){const key=deliveryKey(url);return key && entry.media.assets?.some(asset=>deliveryKey(asset.url)===key);}
chrome.webRequest.onCompleted.addListener(details=>{
  if(details.tabId<0)return;
  const path=new URL(details.url).pathname;
  const playlist=/\.m3u8$/i.test(path);
  const id=mediaIdFrom(details.url);
  const infoRequest=id && /\/embed\/(?:medias|iframe)\//.test(path) && !playlist;
  if(!playlist && !infoRequest)return;
  // Capture the page now, not after earlier fetches have finished.
  const tabSnapshot=chrome.tabs.get(details.tabId).catch(()=>null);
  pending=pending.then(async()=>{
    const tab=await tabSnapshot;
    if(!tab?.url || !['www.apnacollege.in','apnacollege.in'].includes(new URL(tab.url).hostname))return;
    const {lectures=[],videoMetadata={},lessonTitles={}}=await chrome.storage.local.get(['lectures','videoMetadata','lessonTitles']);
    const page=tab.url;
    let media=id?await fetchMedia(id,/\.jsonp?$/i.test(path)?details.url:null):null;
    if(media)videoMetadata[id]={page,media,seen:Date.now()};
    let resolvedId=id;
    if(!media){
      const matched=Object.entries(videoMetadata).find(([key,entry])=>metadataMatches(entry,details.url));
      if(matched){resolvedId=matched[0];media=matched[1].media;}
    }
    let lecture=lectures.find(x=>x.page===page && (resolvedId ? x.mediaId===resolvedId : x.streams.some(s=>s.url===details.url)));
    if(!lecture)lecture=lectures.find(x=>x.page===page && !x.mediaId);
    if(!lecture && playlist && !resolvedId){
      const candidates=lectures.filter(x=>x.page===page);
      if(candidates.length===1)lecture=candidates[0];
    }
    if(!lecture && playlist){lecture={id:crypto.randomUUID(),page,title:tab.title||'Lecture',titleSource:'page',streams:[]};lectures.push(lecture);}
    if(lecture && lessonTitles[page]){lecture.courseTitle=lessonTitles[page];if(!lecture.customTitle){lecture.title=lecture.courseTitle;lecture.titleSource='lesson';}}
    if(media){
      // Metadata may arrive after the stream. Correct already-listed fallback titles.
      for(const old of lectures.filter(x=>x.page===page && (x.mediaId===resolvedId || !x.mediaId)))applyMedia(old,media,resolvedId);
      if(lecture)applyMedia(lecture,media,resolvedId);
    }
    if(playlist && lecture){
      // Late metadata can identify an earlier delivery-only request.
      if(!media){
        const entries=Object.entries(videoMetadata).filter(([,entry])=>entry.page===page);
        if(entries.length===1)applyMedia(lecture,entries[0][1].media,entries[0][0]);
      }
      if(!lecture.streams.some(x=>x.url===details.url)){
        const variants=[];
        try{
          const response=await fetch(details.url,{signal:AbortSignal.timeout(8000)});
          if(response.ok){
            const lines=(await response.text()).split(/\r?\n/).map(x=>x.trim());
            for(let i=0;i<lines.length;i++){
              if(!lines[i].startsWith('#EXT-X-STREAM-INF:'))continue;
              const next=lines.slice(i+1).find(x=>x&&!x.startsWith('#'));if(!next)continue;
              const url=new URL(next,details.url);if(url.protocol!=='https:')continue;
              variants.push({url:url.href,label:lines[i].match(/NAME="([^"]+)"/)?.[1]||lines[i].match(/RESOLUTION=([^,]+)/)?.[1]||'Quality option'});
            }
          }
        }catch{}
        if(variants.length){lecture.streams=lecture.streams.filter(x=>!variants.some(v=>v.url===x.url));lecture.streams.push(...variants);}
        else lecture.streams.push({url:details.url,label:'Detected stream'});
      }
    }
    const recent=Object.fromEntries(Object.entries(videoMetadata).sort((a,b)=>b[1].seen-a[1].seen).slice(0,150));
    await chrome.storage.local.set({lectures,videoMetadata:recent});
    await chrome.action.setBadgeText({text:lectures.length?String(lectures.length):''});
  }).catch(console.error);
},{urls:['https://*.wistia.com/*','https://*.wistia.net/*']});

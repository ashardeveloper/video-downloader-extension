function socialPageHost(host){return /(^|\.)instagram\.com$/.test(host)||/(^|\.)facebook\.com$/.test(host)||/(^|\.)tiktok\.com$/.test(host);}
function socialMediaHost(host){
  return ['instagram.com','cdninstagram.com','facebook.com','fbcdn.net','tiktok.com','tiktokcdn.com','tiktokv.com','byteoversea.com','ibytedtos.com'].some(root=>host===root||host.endsWith('.'+root));
}
function socialProvider(host){
  if(/(^|\.)instagram\.com$/.test(host))return 'instagram';
  if(/(^|\.)facebook\.com$/.test(host))return 'facebook';
  if(/(^|\.)tiktok\.com$/.test(host))return 'tiktok';
  return 'social';
}
function normalizeSocialUrl(url){
  try{
    const parsed=new URL(url);
    parsed.searchParams.delete('bytestart');
    parsed.searchParams.delete('byteend');
    return parsed.href;
  }catch{return url;}
}
function isSocialHttps(url){
  try{
    const parsed=new URL(url);
    return parsed.protocol==='https:'&&socialMediaHost(parsed.hostname);
  }catch{return false;}
}
function socialMediaKind(details){
  const url=new URL(details.url);
  const path=url.pathname;
  if(/\.(?:jpg|jpeg|png|webp|gif|css|js|json|m4s|ts)$/i.test(path))return null;
  const mime=(details.responseHeaders||[]).find(x=>x.name.toLowerCase()==='content-type')?.value?.split(';')[0].trim().toLowerCase();
  if((url.searchParams.get('mime_type')||'').toLowerCase().includes('video_mp4'))return 'MP4';
  if(/\.m3u8$/i.test(path)||['application/vnd.apple.mpegurl','application/x-mpegurl'].includes(mime))return 'HLS';
  if(/\.mp4$/i.test(path)||mime==='video/mp4')return 'MP4';
  return null;
}
function rangedMp4Info(url){
  const parsed=new URL(url);
  const supportsDashMeta=/(^|\.)fbcdn\.net$/.test(parsed.hostname)||/(^|\.)facebook\.com$/.test(parsed.hostname)||/(^|\.)cdninstagram\.com$/.test(parsed.hostname)||/(^|\.)instagram\.com$/.test(parsed.hostname);
  if(!supportsDashMeta)return {url,role:'unknown',fragment:false};
  const fragment=parsed.searchParams.has('bytestart')||parsed.searchParams.has('byteend');
  parsed.searchParams.delete('bytestart');
  parsed.searchParams.delete('byteend');
  let role='unknown';
  const efg=parsed.searchParams.get('efg');
  if(efg){
    try{
      const value=JSON.parse(atob(efg.replace(/-/g,'+').replace(/_/g,'/')));
      const tag=String(value.vencode_tag||'')+' '+String(value.urlgen_source||'');
      if(/audio|aac|opus/i.test(tag))role='audio';
      else if(/dash|video|avc|hevc|vp9|vbr|clips/i.test(tag))role='video';
    }catch{}
  }
  let assetId='';
  const efgValue=parsed.searchParams.get('efg');
  if(efgValue){
    try{
      const value=JSON.parse(atob(efgValue.replace(/-/g,'+').replace(/_/g,'/')));
      assetId=String(value.xpv_asset_id||value.video_id||'');
    }catch{}
  }
  return {url:parsed.href,role,fragment,assetId};
}
function cleanSocialRequestHeaders(headers,host){
  const keep=new Set(['accept','accept-language','origin','referer','sec-fetch-dest','sec-fetch-mode','sec-fetch-site','sec-ch-ua','sec-ch-ua-mobile','sec-ch-ua-platform','user-agent']);
  const rangeHost=/(^|\.)tiktok(?:cdn|v)?\.com$/.test(host)||/(^|\.)byteoversea\.com$/.test(host)||/(^|\.)ibytedtos\.com$/.test(host)||/(^|\.)instagram\.com$/.test(host)||/(^|\.)cdninstagram\.com$/.test(host);
  if(rangeHost){keep.add('range');keep.add('cookie');}
  const result={};
  for(const header of headers||[]){
    const name=header.name;
    const lower=name.toLowerCase();
    if(!keep.has(lower))continue;
    if(!/^[A-Za-z0-9-]+$/.test(name))continue;
    const value=String(header.value||'');
    if(!value || value.length>8192 || /[\r\n]/.test(value))continue;
    result[name]=lower==='range'?'bytes=0-':value;
  }
  return result;
}
const socialRequestHeaders=new Map();
chrome.webRequest.onBeforeSendHeaders.addListener(details=>{
  if(details.tabId<0)return;
  const kind=socialMediaKind(details);if(!kind)return;
  const host=new URL(details.url).hostname;
  if(!socialMediaHost(host))return;
  const cleaned=cleanSocialRequestHeaders(details.requestHeaders,host);
  socialRequestHeaders.set(details.url,cleaned);
  socialRequestHeaders.set(rangedMp4Info(details.url).url,cleaned);
  socialRequestHeaders.set(normalizeSocialUrl(details.url),cleaned);
  if(socialRequestHeaders.size>150){
    const first=socialRequestHeaders.keys().next().value;
    socialRequestHeaders.delete(first);
  }
},{urls:[
  'https://*.instagram.com/*','https://*.cdninstagram.com/*',
  'https://*.facebook.com/*','https://*.fbcdn.net/*',
  'https://*.tiktok.com/*','https://*.tiktokcdn.com/*','https://*.tiktokv.com/*',
  'https://*.byteoversea.com/*','https://*.ibytedtos.com/*'
]},['requestHeaders','extraHeaders']);
chrome.webRequest.onCompleted.addListener(details=>{
  if(details.tabId<0 || details.statusCode>=400)return;
  const kind=socialMediaKind(details);if(!kind)return;
  if(kind==='MP4'){
    const lengthHeader=(details.responseHeaders||[]).find(x=>x.name.toLowerCase()==='content-length')?.value;
    const contentLength=Number(lengthHeader)||0;
    const rangeHeader=(details.responseHeaders||[]).find(x=>x.name.toLowerCase()==='content-range')?.value||'';
    const total=Number(rangeHeader.match(/\/(\d+)$/)?.[1])||0;
    if(contentLength>0 && contentLength<32768 && total<32768)return;
  }
  const mediaUrl=new URL(details.url);
  if(!socialMediaHost(mediaUrl.hostname))return;
  const ranged=rangedMp4Info(details.url);
  const downloadUrl=ranged.url;
  const capturedHeaders=socialRequestHeaders.get(downloadUrl)||socialRequestHeaders.get(details.url)||null;
  const tabSnapshot=chrome.tabs.get(details.tabId).catch(()=>null);
  pending=pending.then(async()=>{
    const tab=await tabSnapshot;
    if(!tab?.url)return;
    const pageUrl=new URL(tab.url);
    if(!socialPageHost(pageUrl.hostname))return;
    const provider=socialProvider(pageUrl.hostname);
    const {lectures=[],socialActiveVideos={}}=await chrome.storage.local.get(['lectures','socialActiveVideos']);
    const active=socialActiveVideos[details.tabId];
    const activeSrc=active&&Date.now()-Number(active.seen)<20000?normalizeSocialUrl(active.src):'';
    const strictActiveMatch=(provider==='instagram'||provider==='tiktok')&&activeSrc&&isSocialHttps(activeSrc);
    if(strictActiveMatch && ranged.role!=='audio' && normalizeSocialUrl(downloadUrl)!==activeSrc)return;
    let lecture=lectures.find(x=>x.provider===provider&&x.page===tab.url);
    if(!lecture){
      const title=(active?.title||tab.title||provider+' video').replace(/\s*[-|].*$/,'').trim()||provider+' video';
      lecture={id:crypto.randomUUID(),provider,page:tab.url,title,titleSource:'page',duration:Number(active?.duration)||0,streams:[]};
      lectures.push(lecture);
    }
    if((provider==='facebook'||provider==='instagram')&&kind==='MP4'){
      lecture.socialTracks=lecture.socialTracks||{};
      const assetKey=ranged.assetId||'default';
      lecture.socialTracks.audioByAsset=lecture.socialTracks.audioByAsset||{};
      if(ranged.role==='audio'){
        lecture.socialTracks.audioByAsset[assetKey]={url:downloadUrl,headers:capturedHeaders||undefined};
        for(const stream of lecture.streams.filter(x=>x.socialDashVideo && (x.assetKey||'default')===assetKey)){
          stream.audioUrl=downloadUrl;
          stream.audioHeaders=capturedHeaders||undefined;
          stream.label='MP4 + Audio';
        }
        await chrome.storage.local.set({lectures});
        await chrome.action.setBadgeText({text:String(lectures.length)});
        return;
      }
      if(ranged.role==='unknown'&&ranged.fragment)return;
      const audio=lecture.socialTracks.audioByAsset[assetKey];
      const old=lecture.streams.find(x=>x.url===downloadUrl);
      const next={url:downloadUrl,label:audio?'MP4 + Audio':'MP4',format:'MP4',headers:capturedHeaders||undefined,socialDashVideo:ranged.fragment||ranged.role==='video',assetKey};
      if(audio){next.audioUrl=audio.url;next.audioHeaders=audio.headers;}
      if(old)Object.assign(old,next);else lecture.streams.push(next);
    } else {
      const label=kind==='MP4'?'MP4':'Auto (HLS)';
      const old=lecture.streams.find(x=>x.url===downloadUrl);
      if(old){if(capturedHeaders)old.headers=capturedHeaders;}
      else lecture.streams.push({url:downloadUrl,label,format:kind,headers:capturedHeaders||undefined});
    }
    await chrome.storage.local.set({lectures});
    await chrome.action.setBadgeText({text:String(lectures.length)});
  }).catch(console.error);
},{urls:[
  'https://*.instagram.com/*','https://*.cdninstagram.com/*',
  'https://*.facebook.com/*','https://*.fbcdn.net/*',
  'https://*.tiktok.com/*','https://*.tiktokcdn.com/*','https://*.tiktokv.com/*',
  'https://*.byteoversea.com/*','https://*.ibytedtos.com/*'
]},['responseHeaders']);

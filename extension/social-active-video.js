(function(){
  if(!/(^|\.)instagram\.com$|(^|\.)facebook\.com$|(^|\.)tiktok\.com$/.test(location.hostname))return;
  let last='';
  function clean(url){
    try{
      const parsed=new URL(url,location.href);
      parsed.searchParams.delete('bytestart');
      parsed.searchParams.delete('byteend');
      return parsed.href;
    }catch{return '';}
  }
  function visibleScore(video){
    const rect=video.getBoundingClientRect();
    const width=Math.max(0,Math.min(rect.right,innerWidth)-Math.max(rect.left,0));
    const height=Math.max(0,Math.min(rect.bottom,innerHeight)-Math.max(rect.top,0));
    return width*height;
  }
  function activeVideo(){
    const videos=[...document.querySelectorAll('video')].filter(video=>clean(video.currentSrc||video.src));
    videos.sort((a,b)=>{
      const ap=!a.paused&&!a.ended?1:0,bp=!b.paused&&!b.ended?1:0;
      if(ap!==bp)return bp-ap;
      return visibleScore(b)-visibleScore(a);
    });
    return videos[0]||null;
  }
  async function send(){
    if(!chrome.runtime?.id)return;
    const video=activeVideo();
    if(!video)return;
    const src=clean(video.currentSrc||video.src);
    if(!src || src===last)return;
    last=src;
    try{await chrome.runtime.sendMessage({action:'activeSocialVideo',page:location.href,src,title:document.title||'',duration:Number.isFinite(video.duration)?video.duration:0});}catch{}
  }
  setInterval(send,1000);
  document.addEventListener('play',send,true);
  document.addEventListener('playing',send,true);
  send();
})();

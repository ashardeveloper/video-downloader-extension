// Self-contained so Chrome can run it in an isolated world on demand.
function readActiveLesson() {
  if(/(^|\.)udemy\.com$/.test(location.hostname)){
    const id=location.pathname.match(/\/learn\/lecture\/(\d+)/)?.[1];
    if(!id)return {page:location.href,title:null};
    const candidates=[];
    for(const link of document.querySelectorAll('a[href*="/learn/lecture/"], a[href*="/lecture/"]')){
      try{if(new URL(link.getAttribute('href'),location.href).pathname.match(/\/lecture\/(\d+)/)?.[1]===id)candidates.push(link);}catch{}
    }
    for(const node of document.querySelectorAll('[aria-current="true"], [aria-current="page"], [data-purpose="curriculum-item-link"][aria-selected="true"], [class*="curriculum-item-link--is-current"]'))candidates.push(node);
    const titles=[...new Set(candidates.map(node=>{
      const title=node.querySelector('[data-purpose="item-title"], [data-purpose="lecture-title"], [class*="item-title"]');
      return (title?.textContent||node.textContent||'').replace(/\s+/g,' ').trim().replace(/^\d+\.\s*/, '');
    }).filter(x=>x&&x.length<=240))];
    const video=document.querySelector('video');
    return {page:location.href,title:titles.length===1?titles[0]:null,duration:Number.isFinite(video?.duration)?video.duration:0};
  }
  const nodes=[...document.querySelectorAll('.lrn-path-cont-main[aria-current="page"] .lrn-path-cont-name')];
  const titles=[...new Set(nodes.map(node=>(node.textContent||'').replace(/\s+/g,' ').trim()).filter(title=>title && title.length<=240))];
  return {page:location.href,title:titles.length===1?titles[0]:null};
}

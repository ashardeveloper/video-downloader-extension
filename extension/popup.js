const list=document.querySelector('#list'),status=document.querySelector('#status');
const message=data=>chrome.runtime.sendMessage(data);
function el(tag,className,text){const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;}
function duration(value){const sec=Math.floor(value);return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');}
function downloadProgress(job,totalDuration){
  if(job.state==='done')return 100;
  const total=Number(job.duration)||Number(totalDuration);
  if(!Number.isFinite(total)||total<=0)return null;
  if(!job.time)return 0;
  const match=/^(\d+):(\d{2}):(\d{2}(?:\.\d+)?)$/.exec(job.time);
  if(!match)return null;
  const seconds=Number(match[1])*3600+Number(match[2])*60+Number(match[3]);
  return Math.max(0,Math.min(99,Math.floor(seconds/total*100)));
}
async function render(){
  const {lectures=[],jobs={}}=await chrome.storage.local.get(['lectures','jobs']);list.replaceChildren();
  if(!lectures.length)list.append(el('p','empty','Refresh the page and play a video.'));
  for(const lecture of lectures){
    const row=el('article'),preview=el('div','preview','▶');
    if(lecture.thumbnail){const img=el('img');img.src=lecture.thumbnail;img.alt='Video preview';img.onerror=()=>img.remove();preview.append(img);}
    if(lecture.duration>0)preview.append(el('span','duration',duration(lecture.duration)));
    const details=el('div','details'),heading=el('div','heading');
    const rawTitle=lecture.title.replace(/\.mp4$/i,'');
    const title=el('h2','title',rawTitle+'.mp4');const tag=el('span','tag',lecture.streams[0]?.format||'HLS');heading.append(tag,title);
    const controls=el('div','controls'),edit=el('button','edit','✎');edit.title='Rename video';edit.setAttribute('aria-label','Rename video');
    edit.onclick=()=>{
      if(heading.querySelector('input'))return;
      const input=el('input','edit-title');input.value=rawTitle;input.setAttribute('aria-label','Video title');title.replaceWith(input);input.focus();input.select();
      let saved=false;const save=async()=>{if(saved)return;saved=true;if(input.value.trim())await message({action:'rename',id:lecture.id,title:input.value.trim()});await render();};
      input.onblur=save;input.onkeydown=e=>{if(e.key==='Enter')input.blur();if(e.key==='Escape'){saved=true;render();}};
    };
    const quality=el('div','quality');quality.append(el('span',null,'MP4'));const select=el('select');select.setAttribute('aria-label','Video quality');
    for(const stream of lecture.streams){const option=el('option',null,stream.label);option.value=stream.url;select.append(option);}
    const preferred=lecture.streams.find(x=>x.label==='1080p');if(preferred)select.value=preferred.url;quality.append(select);const updateTag=()=>{tag.textContent=lecture.streams.find(x=>x.url===select.value)?.format||'HLS';};select.onchange=updateTag;updateTag();
    const button=el('button','download','↓ Download'),info=el('p','job');info.dataset.job=lecture.id;info.dataset.duration=String(lecture.duration||0);
    button.onclick=async()=>{button.disabled=true;try{const r=await message({action:'download',id:lecture.id,name:lecture.title,url:select.value});if(!r.ok)throw new Error(r.error);info.textContent='Queued…';}catch(e){info.textContent=e.message;button.disabled=false;}};
    const remove=el('button','remove','×');remove.title='Remove from list';remove.setAttribute('aria-label','Remove from list');remove.onclick=async()=>{await message({action:'remove',id:lecture.id});await render();};
    controls.append(edit,quality,button);details.append(heading,...(!lecture.customTitle && lecture.titleSource!=='lesson'?[el('p','job','Lesson title unavailable. Showing the video or page name.')]:[]),controls,info);row.append(preview,details,remove);list.append(row);
  }showJobs(jobs);
}
function showJobs(jobs){for(const info of list.querySelectorAll('[data-job]')){const job=jobs[info.dataset.job];if(!job)continue;const percent=downloadProgress(job,info.dataset.duration);info.textContent=job.state==='done'?'100% — Saved: '+job.path:job.state==='error'?job.message:job.state==='queued'?'Queued…':percent===null?'Downloading…':percent===99?'Downloading… 99% · Finishing MP4':'Downloading… '+percent+'%';info.closest('article').querySelector('.download').disabled=['queued','downloading'].includes(job.state);}}
chrome.storage.onChanged.addListener(changes=>{if(changes.jobs)showJobs(changes.jobs.newValue||{});if(changes.lectures&&!document.querySelector('.edit-title'))render();});
document.querySelector('#open').onclick=async()=>{const r=await message({action:'open'});if(!r.ok)status.textContent=r.error;};
document.querySelector('#clear').onclick=async()=>{if(confirm('Clear the video list? Downloaded videos will be kept.')){await message({action:'clear'});await render();}};
render();message({action:'refreshTitle'}).then(r=>{if(!r.ok)status.textContent=r.error;});message({action:'ping'}).then(r=>{status.textContent=r.ok?'Ready · Videos are saved in Downloads / Lecture Videos.':'Run SETUP.cmd. '+(r.error||'');});

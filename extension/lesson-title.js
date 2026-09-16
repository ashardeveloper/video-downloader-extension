// Reads the selected sidebar row only. Does not access or alter the player.
(()=>{
 let last='',timer=null,stopped=false;
 function stop(){stopped=true;if(timer!==null)clearInterval(timer);}
 async function reportLesson(){
  if(stopped)return;
  try{
   if(!chrome.runtime?.id){stop();return;}
   const value=readActiveLesson();if(!value.title)return;
   const key=value.page+'\n'+value.title;if(key===last)return;last=key;
   const result=await chrome.runtime.sendMessage({action:'lessonTitle',...value});
   if(!result?.ok)last='';
  }catch(error){
   last='';
   if(/context invalidated|extension.*invalid|cannot access.*runtime/i.test(String(error?.message||error)))stop();
  }
 }
 timer=setInterval(reportLesson,1000);void reportLesson();
})();

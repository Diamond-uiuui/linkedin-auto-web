import {cloudConfigured,hasCloudSession,cloudReady,cloudRequest,cloudJson,login,logout} from './cloud.js?v=wh2';
const $=id=>document.getElementById(id);
const MAX_FILE=25*1024*1024;
const stateLabels={stored:'Оригинал сохранён',queued:'В очереди',processing:'Обрабатывается',ready:'Готово',error:'Нужен повтор'};
export function initCapture({switchView,putInEditor}) {
 let files=[],saving=false,recorder=null,stream=null,chunks=[],recordedBytes=0,recordTimer=null,started=0,ideaId=null,selected=null,urls=[];
 const notify=message=>$('status').textContent=message;
 async function signIn(){try{await login();}catch(error){notify(error.message);}}
 $('cloud-login').onclick=signIn;$('capture-login').onclick=signIn;$('cloud-logout').onclick=async()=>{try{await logout();}catch(error){notify(error.message);}};
 function updateAuth(){const signed=hasCloudSession();document.querySelector('.private-label').textContent=signed?'Облачный аккаунт подключён':'Черновики на устройстве';$('cloud-login').hidden=signed;$('cloud-logout').hidden=!signed;$('capture-login').hidden=signed;$('capture-save').disabled=!signed||saving||recorder?.state==='recording';$('ideas-cloud-status').textContent=signed?'Закрытое облачное пространство · доступно на всех ваших устройствах.':cloudConfigured?'Войдите через GitHub, чтобы сохранить и открыть идеи с любого устройства.':'Облачное хранение готовится. Пока идеи и вложения не синхронизируются.';if(signed){$('connection').textContent='Облачный аккаунт подключён. Записи сохраняются перед обработкой.';document.querySelector('.api-state').textContent='AI через защищённый API';loadIdeas();}else{$('cloud-ideas').replaceChildren();$('idea-detail').hidden=true;$('ideas-count').textContent='0';}}
 window.addEventListener('cloud-session',updateAuth);cloudReady.then(result=>{updateAuth();if(result.error)notify(result.error);});updateAuth();
 function openCapture(){ $('capture-status').textContent=hasCloudSession()?'Оригиналы сохраняются в закрытом облаке. Для загрузки нужен интернет.':'Для сохранения на всех устройствах нужен вход в облако. Сейчас ничего не загружено.';if(!$('capture-dialog').open)$('capture-dialog').showModal();$('capture-title').focus(); }
 $('quick-capture').onclick=openCapture;$('ideas-new').onclick=openCapture;
 $('capture-close').onclick=()=>{if(saving||recorder?.state==='recording'){$('capture-status').textContent='Сначала завершите запись или дождитесь загрузки.';return;}$('capture-dialog').close();};
 $('capture-dialog').addEventListener('cancel',event=>{if(saving||recorder?.state==='recording')event.preventDefault();});
 window.addEventListener('beforeunload',event=>{if(saving||recorder?.state==='recording'||files.length||$('capture-body').value.trim()||$('capture-title').value.trim()){event.preventDefault();event.returnValue='';}});
 function renderFiles(){ $('capture-attachments').replaceChildren();for(const item of files){const row=document.createElement('div');row.className='pending-file';const name=document.createElement('span');name.textContent=item.file.name+' · '+(item.file.size/1024/1024).toFixed(1)+' МБ';const remove=document.createElement('button');remove.textContent='Убрать';remove.disabled=saving;remove.onclick=()=>{files=files.filter(x=>x.id!==item.id);renderFiles();};row.append(name,remove);$('capture-attachments').append(row);}}
 function addFiles(incoming){for(const file of incoming){if(file.size>MAX_FILE){$('capture-status').textContent=`${file.name}: максимум 25 МБ на файл. Остальные файлы можно сохранить.`;continue;}if(files.length>=10){$('capture-status').textContent='До 10 вложений в одной идее.';break;}files.push({id:crypto.randomUUID(),file,uploaded:false});}renderFiles();}
 $('capture-files').onchange=()=>{addFiles($('capture-files').files);$('capture-files').value='';};
 $('record-start').onclick=async()=>{
  if(saving||recorder?.state==='recording')return;
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){$('capture-status').textContent='Запись микрофона не поддерживается этим браузером. Прикрепите готовое аудио.';return;}
  try{
   stream=await navigator.mediaDevices.getUserMedia({audio:true});
   const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(type=>MediaRecorder.isTypeSupported(type));
   recorder=new MediaRecorder(stream,mime?{mimeType:mime}:{});chunks=[];recordedBytes=0;started=Date.now();
   recorder.ondataavailable=event=>{if(event.data.size){chunks.push(event.data);recordedBytes+=event.data.size;if(recordedBytes>=MAX_FILE-1024*1024 && recorder.state==='recording')recorder.stop();}};
   recorder.onstop=()=>{clearInterval(recordTimer);stream?.getTracks().forEach(track=>track.stop());const type=recorder.mimeType||'audio/webm';const ext=type.includes('mp4')?'m4a':'webm';const file=new File(chunks,`voice-${new Date().toISOString().replace(/[:.]/g,'-')}.${ext}`,{type});chunks=[];if(file.size)addFiles([file]);$('record-start').hidden=false;$('record-stop').hidden=true;$('capture-status').textContent='Запись готова. Нажмите «Сохранить в облако», чтобы загрузить оригинал.';updateAuth();};
   recorder.onerror=()=>{$('capture-status').textContent='Ошибка микрофона. Сохраните доступную запись или прикрепите готовое аудио.';if(recorder.state==='recording')recorder.stop();stream?.getTracks().forEach(track=>track.stop());};
   recorder.start(1000);$('record-start').hidden=true;$('record-stop').hidden=false;$('capture-save').disabled=true;$('capture-status').textContent='Идёт запись. Не закрывайте страницу. До 10 минут за одну запись.';
   recordTimer=setInterval(()=>{const seconds=Math.floor((Date.now()-started)/1000);$('record-timer').textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;if(seconds>=600&&recorder.state==='recording')recorder.stop();},500);
  }catch(error){stream?.getTracks().forEach(track=>track.stop());$('capture-status').textContent=error.name==='NotAllowedError'?'Разрешите микрофон в настройках браузера или загрузите готовую запись.':'Не удалось включить микрофон. Попробуйте снова.';}
 };
 $('record-stop').onclick=()=>{if(recorder?.state==='recording')recorder.stop();};
 $('capture-save').onclick=async()=>{
  if(!hasCloudSession()){notify('Войдите в облачный аккаунт.');return;}if(saving||recorder?.state==='recording')return;
  const body=$('capture-body').value.trim(),title=$('capture-title').value.trim()||body.slice(0,100)||files[0]?.file.name;
  if(!title){$('capture-status').textContent='Напишите мысль, запишите голос или добавьте файл.';return;}
  saving=true;updateAuth();renderFiles();$('record-start').disabled=true;$('capture-files').disabled=true;
  try{
   if(!ideaId){ideaId=crypto.randomUUID();await cloudJson('/ideas',{id:ideaId,title,body});}else await cloudJson('/ideas/'+ideaId,{title,body},'PATCH');
   let completed=files.filter(x=>x.uploaded).length;
   for(const item of files){if(item.uploaded)continue;$('capture-status').textContent=`Загружаем ${completed+1} из ${files.length}: ${item.file.name}`;
    await (await cloudRequest(`/ideas/${ideaId}/attachments/${item.id}`,{method:'PUT',headers:{'Content-Type':item.file.type||'application/octet-stream','X-Filename':encodeURIComponent(item.file.name)},body:item.file})).json();item.uploaded=true;completed++;
   }
   let processingErrors=0;
   for(const item of files){if(/^(audio|video|image)\//.test(item.file.type)){try{await cloudJson('/attachments/'+item.id+'/process',{});}catch{processingErrors++;}}}
   const savedId=ideaId;files=[];ideaId=null;$('capture-title').value='';$('capture-body').value='';$('record-timer').textContent='';renderFiles();$('capture-dialog').close();
   notify(processingErrors?'Идея и оригиналы сохранены. Для части вложений обработку нужно повторить.':'Идея сохранена в облаке. Доступна на всех ваших устройствах.');switchView('ideas');await loadIdeas();await openIdea(savedId);
  }catch(error){$('capture-status').textContent=error.message+' Уже загруженные оригиналы сохранены. Нажмите сохранить ещё раз для повтора; не закрывайте страницу с незагруженными файлами.';}
  finally{saving=false;$('record-start').disabled=false;$('capture-files').disabled=false;updateAuth();renderFiles();}
 };
 async function loadIdeas(){if(!hasCloudSession())return;try{const data=await (await cloudRequest('/ideas')).json();$('cloud-ideas').replaceChildren();$('ideas-count').textContent=data.ideas.length;
  if(!data.ideas.length){$('cloud-ideas').textContent='Здесь будут ваши идеи. Сохраните первую голосом, текстом или файлом.';return;}
  for(const idea of data.ideas){const card=document.createElement('article');card.className='library-item';const title=document.createElement('strong');title.textContent=idea.title;const meta=document.createElement('p');meta.className='muted';meta.textContent=new Date(idea.created).toLocaleString('ru-RU')+(idea.status==='later'?' · На будущее':'');const snippet=document.createElement('p');snippet.textContent=idea.body.slice(0,160);const open=document.createElement('button');open.textContent='Открыть идею';open.onclick=()=>openIdea(idea.id);card.append(title,meta,snippet,open);$('cloud-ideas').append(card);}
 }catch(error){$('ideas-cloud-status').textContent=error.message;}}
 async function openIdea(id){try{const idea=await (await cloudRequest('/ideas/'+id)).json();selected=idea;urls.forEach(URL.revokeObjectURL);urls=[];$('idea-detail').hidden=false;$('idea-detail-title').textContent=idea.title;$('idea-detail-body').textContent=idea.body;$('idea-attachments').replaceChildren();
  for(const file of idea.attachments){const card=document.createElement('article');card.className='attachment-card';const title=document.createElement('strong');title.textContent=file.name;const state=document.createElement('p');state.className='muted';state.textContent=stateLabels[file.status]||file.status;const result=document.createElement('p');result.className='attachment-result';result.textContent=file.result||file.error||'';const original=document.createElement('button');original.textContent=file.mime.startsWith('audio/')?'Прослушать оригинал':'Открыть оригинал';original.onclick=async()=>{try{const response=await cloudRequest('/attachments/'+file.id);const blob=await response.blob();const url=URL.createObjectURL(blob);urls.push(url);if(file.mime.startsWith('audio/')){const player=document.createElement('audio');player.controls=true;player.src=url;card.append(player);}else if(['image/jpeg','image/png','image/webp','image/gif'].includes(file.mime)){const image=document.createElement('img');image.src=url;image.alt=file.name;card.append(image);}else{const link=document.createElement('a');link.href=url;link.download=file.name;link.click();}}catch(error){notify(error.message);}};
   card.append(title,state,result,original);
   if(/^(audio|video|image)\//.test(file.mime)&&!['ready','queued','processing'].includes(file.status)){const process=document.createElement('button');process.textContent='Распознать';process.onclick=async()=>{process.disabled=true;try{await cloudJson('/attachments/'+file.id+'/process',{});await openIdea(id);}catch(error){notify(error.message);}finally{process.disabled=false;}};card.append(process);}
   $('idea-attachments').append(card);
  }
 }catch(error){notify(error.message);}}
 $('idea-detail-close').onclick=()=>{selected=null;$('idea-detail').hidden=true;urls.forEach(URL.revokeObjectURL);urls=[];};
 $('idea-to-editor').onclick=()=>{if(!selected)return;const result=[selected.body,...selected.attachments.filter(x=>x.result).map(x=>x.result)].filter(Boolean).join('\n\n');putInEditor(result||selected.title);};
 $('idea-mark-later').onclick=async()=>{if(!selected)return;try{await cloudJson('/ideas/'+selected.id,{status:'later'},'PATCH');await loadIdeas();notify('Идея отмечена на будущее.');}catch(error){notify(error.message);}};
 document.querySelector('[data-view="ideas"]').addEventListener('click',loadIdeas);
 setInterval(()=>{if(!document.hidden&&hasCloudSession()&&selected?.attachments?.some(x=>['queued','processing'].includes(x.status)))openIdea(selected.id);},5000);
 // The existing audio import now stores the original in the same cloud inbox first.
 $('transcribe').onclick=()=>{const file=$('audio').files[0];if(!file){notify('Выберите запись.');return;}openCapture();$('capture-title').value=file.name;addFiles([file]);$('capture-status').textContent='Сохраните идею: оригинал загрузится в облако, затем начнётся распознавание.';};
}

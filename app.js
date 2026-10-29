import {initEditor} from './editor.js?v=wh3';
import {initAccounts} from './accounts.js?v=wh2';
import {cloudRequest,cloudJson,cloudReady,hasCloudSession} from './cloud.js?v=wh2';
import {initCapture} from './capture.js?v=cloud1';
import { API_BASE_URL, RSS_WIDGET_URL } from './config.js?v=cloud1';
const $ = id => document.getElementById(id);
const storageKey = 'linkedin-workshop-v1';
const configured = /^https:\/\//.test(API_BASE_URL);
let busy = false;
let pendingPublication = null;
try { const saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); $('idea').value = saved.idea || ''; $('draft').value = saved.draft || ''; $('angle').value = saved.angle || ''; $('language').value = saved.language || 'en'; } catch { $('status').textContent = 'Не удалось восстановить локальный черновик.'; }
function save() { try { localStorage.setItem(storageKey, JSON.stringify({idea:$('idea').value,draft:$('draft').value,angle:$('angle').value,language:$('language').value})); } catch { $('status').textContent = 'Сохранение в браузере недоступно. Скачайте текст.'; } updateCount(); }
['idea','draft','angle','language'].forEach(id => $(id).addEventListener('input', save));
function controls() { ['generate','transcribe'].forEach(id => $(id).disabled = busy || !hasCloudSession()); ['publish','confirm'].forEach(id=>$(id).disabled=true); }
$('connection').textContent = configured ? 'Для AI и публикации потребуется авторизованная сессия.' : 'AI-генерация и LinkedIn ещё не подключены. Редактор, сохранение и новости уже работают.';
controls();
async function request(path, body, json = true, headers = {}) {
  const response = await cloudRequest(path, {method:'POST', headers:{...(json ? {'Content-Type':'application/json'} : {}), ...headers}, body:json ? JSON.stringify(body) : body});
  if (!response.ok) throw new Error(response.status === 401 ? 'Войдите в приложение через сервер авторизации.' : 'API не выполнил запрос. Повторите позже.');
  return response.json();
}
async function run(task) { busy = true; controls(); $('status').textContent = 'Выполняется…'; try { await task(); } catch(error) { $('status').textContent = error.message; } finally { busy = false; controls(); } }
$('generate').onclick = () => run(async () => { const idea = $('idea').value.trim(); if (!idea) throw new Error('Добавьте идею для публикации.'); const data = await request('/drafts/generate', {idea,angle:$('angle').value,language:$('language').value}); if(typeof data.text !== 'string') throw new Error('API вернул некорректный черновик.'); $('draft').value = data.text; pendingPublication = null; save(); $('status').textContent = 'Черновик готов. Проверьте и отредактируйте текст.'; });
$('transcribe').onclick = () => run(async () => { const file = $('audio').files[0]; if(!file) throw new Error('Выберите аудиозапись.'); if(file.size > 25 * 1024 * 1024) throw new Error('Выберите запись меньше 25 МБ.'); const form = new FormData(); form.append('audio',file); const data = await request('/audio/transcribe', form, false); if(typeof data.text !== 'string') throw new Error('API вернул некорректную расшифровку.'); $('idea').value = data.text; save(); $('status').textContent = 'Расшифровка готова. Можно подготовить черновик.'; });
$('download').onclick = () => { const url = URL.createObjectURL(new Blob([$('draft').value],{type:'text/plain;charset=utf-8'})); const link = document.createElement('a'); link.href = url; link.download = 'linkedin-draft.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000); };
$('clear').onclick = () => { if(!confirm('Удалить идею и черновик с этого устройства?')) return; $('idea').value = ''; $('draft').value = ''; $('angle').value = ''; pendingPublication = null; save(); $('status').textContent = 'Черновик очищен.'; };
$('publish').onclick = () => { const text = $('draft').value.trim(); if(!text) { $('status').textContent = 'Сначала добавьте текст публикации.'; return; } if(!pendingPublication || pendingPublication.text !== text) pendingPublication = {text, key:crypto.randomUUID()}; $('preview').textContent = text; $('confirmation').showModal(); };
$('cancel').onclick = () => $('confirmation').close();
$('confirm').onclick = () => run(async () => { if(!pendingPublication) throw new Error('Подтвердите текст заново.'); const data = await request('/linkedin/posts', {text:pendingPublication.text, confirmed:true}, true, {'Idempotency-Key':pendingPublication.key}); if(!data.id) throw new Error('Нет подтверждения публикации. Проверьте LinkedIn перед повторной попыткой.'); $('confirmation').close(); $('status').textContent = 'Публикация подтверждена LinkedIn.'; });

function updateCount() { const text = $('draft').value; $('word-count').textContent = `${text.trim() ? text.trim().split(/\s+/).length : 0} слов · ${text.length} / 3 000 символов`; window.dispatchEvent(new Event('wh-editor-change')); }
updateCount();
document.querySelectorAll('[data-topic]').forEach(button => button.onclick = () => { if($('idea').value.trim() && !confirm('Заменить текущую идею выбранной темой?')) return; $('idea').value = button.dataset.topic; save(); $('idea').focus(); });
let library = [];
try { const data = JSON.parse(localStorage.getItem('draft-library') || '[]'); if(Array.isArray(data)) library = data; } catch {}
function persistLibrary() { try { localStorage.setItem('draft-library',JSON.stringify(library)); return true; } catch { $('status').textContent = 'Не удалось сохранить библиотеку. Скачайте текст.'; return false; } }
function renderLibrary() { $('library-count').textContent = library.length; $('draft-library').replaceChildren(); if(!library.length) { $('draft-library').textContent = 'Пока нет сохранённых версий.'; return; } library.forEach((item,index) => { const row=document.createElement('article'); row.className='library-item'; const title=document.createElement('strong'); title.textContent=String(item.draft || '').slice(0,90); const date=document.createElement('p'); date.className='muted'; date.textContent=new Date(item.date).toLocaleString('ru-RU'); const open=document.createElement('button'); open.textContent='Открыть'; open.onclick=()=>{ if(!confirm('Открыть сохранённую версию вместо текущего текста?')) return; ['idea','draft','angle'].forEach(id=>$(id).value=item[id] || ''); $('language').value=item.language || 'en'; pendingPublication=null; switchView('workspace'); setEditorMode(false); save(); $('draft').focus(); }; const remove=document.createElement('button'); remove.textContent='Удалить'; remove.onclick=async()=>{ if(!confirm(item.cloud?'Убрать эту версию из облачной библиотеки?':'Удалить эту версию с устройства?')) return; try {if(item.cloud) await cloudRequest('/drafts/'+item.id,{method:'DELETE'});library.splice(index,1);if(!item.cloud) persistLibrary();renderLibrary();}catch(error){$('status').textContent=error.message;} }; row.append(title,date,open,remove); $('draft-library').append(row); }); }
$('save-draft').onclick=async()=>{ if(!$('draft').value.trim()) { $('status').textContent='Добавьте текст черновика.'; return; } const item={date:new Date().toISOString(),idea:$('idea').value,draft:$('draft').value,angle:$('angle').value,language:$('language').value}; if(hasCloudSession()){try{await cloudJson('/drafts',{text:item.draft,language:item.language});await loadCloudDrafts();$('status').textContent='Версия сохранена в облачной библиотеке.';}catch(error){$('status').textContent=error.message;}}else{library.unshift(item);if(persistLibrary())$('status').textContent='Версия сохранена только на этом устройстве. Для синхронизации войдите в облако.';renderLibrary();} };
renderLibrary();
function safeUrl(value) { try { const url=new URL(value); return ['https:','http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; } catch { return null; } }
function addIdea(title,url,angle='') { switchView('workspace'); $('idea').value += `${$('idea').value ? '\n\n' : ''}${title}\nИсточник: ${url}`; if(angle) $('angle').value=angle; save(); $('idea').focus(); $('status').textContent='Источник добавлен в идею. Откройте оригинал и добавьте собственный вывод.'; }
import { sources } from './research.js?v=2';
for(const source of sources) { const card=document.createElement('article'); card.className='source-card'; const tag=document.createElement('p'); tag.className='step'; tag.textContent=source.topic; const link=document.createElement('a'); link.href=source.url; link.target='_blank'; link.rel='noopener noreferrer'; link.textContent=source.name+' ↗'; const context=document.createElement('p'); context.textContent=source.angle; const button=document.createElement('button'); button.textContent='Взять тему'; button.onclick=()=>addIdea(source.topic,source.url,source.angle); card.append(tag,link,context,button); $('source-list').append(card); }
function showWidget(value) { const url=new URL(value); if(url.protocol!=='https:' || url.hostname!=='rss.app' || !url.pathname.startsWith('/embed/') || url.search || url.hash || url.username || url.password) throw new Error('Нужна публичная ссылка https://rss.app/embed/… без ключей и параметров.'); const iframe=document.createElement('iframe'); iframe.src=url.href; iframe.title='Новости RSS.app'; iframe.loading='eager'; iframe.referrerPolicy='no-referrer'; iframe.setAttribute('sandbox','allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');  $('rss-widget').replaceChildren(iframe); }
$('connect-widget').onclick=()=>{ try { showWidget($('widget-url').value.trim()); try { localStorage.setItem('rss-widget-url',$('widget-url').value.trim()); } catch {} $('rss-status').textContent='Виджет подключён. Если он пуст, проверьте настройки и тариф RSS.app.'; } catch(error) { $('rss-status').textContent=error.message; } };
$('disconnect-widget').onclick=()=>{ $('rss-widget').replaceChildren(); $('widget-url').value=''; try { localStorage.setItem('rss-widget-url','disabled'); } catch {} $('rss-status').textContent='Виджет отключён.'; };
try { const stored=localStorage.getItem('rss-widget-url'); const url=stored === 'disabled' ? '' : (stored || RSS_WIDGET_URL); if(url) { $('widget-url').value=url; showWidget(url); } } catch { if(RSS_WIDGET_URL) showWidget(RSS_WIDGET_URL); }
$('rss-file').onchange=async()=>{ try { const file=$('rss-file').files[0]; if(!file) return; if(file.size>3*1024*1024) throw new Error('Выберите XML меньше 3 МБ.'); const xml=new DOMParser().parseFromString(await file.text(),'application/xml'); if(xml.querySelector('parsererror')) throw new Error('Файл содержит некорректный XML.'); const entries=[...xml.querySelectorAll('item, entry')].slice(0,100); if(!entries.length) throw new Error('В файле нет RSS / Atom записей.'); $('news-list').replaceChildren(); const seen=new Set(); for(const entry of entries) { const title=entry.querySelector('title')?.textContent?.trim(); const links=[...entry.querySelectorAll('link')]; const link=links.find(x=>x.getAttribute('rel')==='alternate') || links.find(x=>!x.getAttribute('rel')); const url=safeUrl(link?.getAttribute('href') || link?.textContent || ''); if(!title || !url || seen.has(url)) continue; seen.add(url); const card=document.createElement('article'); card.className='source-card'; const heading=document.createElement('a'); heading.textContent=title; heading.href=url; heading.target='_blank'; heading.rel='noopener noreferrer'; const date=document.createElement('p'); date.className='muted'; const raw=entry.querySelector('pubDate, published, updated')?.textContent; date.textContent=raw && !Number.isNaN(Date.parse(raw)) ? new Date(raw).toLocaleDateString('ru-RU') : 'Дата не указана'; const button=document.createElement('button'); button.textContent='В черновик →'; button.onclick=()=>addIdea(title,url); card.append(heading,date,button); $('news-list').append(card); } $('rss-status').textContent=`Импортировано ${seen.size} записей. Это снимок ленты, автоматическое обновление не включено.`; } catch(error) { $('rss-status').textContent=error.message; } };

async function loadNews() {
  try {
    const response=await fetch('./news.json',{cache:'no-store'});
    if(!response.ok) throw new Error('Новости временно недоступны. Откройте источники выше.');
    const data=await response.json();
    if(!Array.isArray(data.items)) throw new Error('Не удалось прочитать новостную ленту.');
    $('news-list').replaceChildren();
    for(const item of data.items) {
      const url=safeUrl(item.url); if(!url || typeof item.title!=='string') continue;
      const card=document.createElement('article'); card.className='source-card';
      const link=document.createElement('a'); link.href=url; link.textContent=item.title; link.target='_blank'; link.rel='noopener noreferrer';
      const meta=document.createElement('p'); meta.className='muted'; meta.textContent=(item.source || new URL(url).hostname)+(item.date && !Number.isNaN(Date.parse(item.date)) ? ' · '+new Date(item.date).toLocaleDateString('ru-RU') : '');
      const button=document.createElement('button'); button.textContent='В черновик →'; button.onclick=()=>addIdea(item.title,url);
      card.append(link,meta,button); $('news-list').append(card);
    }
    const updated=new Date(data.updatedAt);
    const age=Date.now()-updated.getTime();
    $('rss-status').textContent='RSS.app · Обновлено '+updated.toLocaleString('ru-RU')+(age>86400000 ? ' · Данные старше суток; проверьте оригинал.' : '')+'. Нажмите «В черновик», чтобы добавить новость в идею.';
  } catch(error) { $('rss-status').textContent=error.message; }
}
loadNews();

// Workspace navigation and presentation controls.
function switchView(name) {
  const valid=['workspace','ideas','library','sources','accounts']; if(!valid.includes(name)) name='workspace';
  for(const view of valid) { const node=$('view-'+view); node.hidden=view!==name; node.classList.toggle('active-view',view===name); }
  document.querySelectorAll('.nav-item').forEach(button=>{ const selected=button.dataset.view===name; button.classList.toggle('active',selected); if(selected) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current'); });
  $('breadcrumb-current').textContent={workspace:'Рабочий стол',ideas:'Банк идей',library:'Мои черновики',sources:'Источники и RSS',accounts:'Аккаунты'}[name];
  history.replaceState(null,'','#'+name);
  window.scrollTo({top:0,behavior:'instant'});
}
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>switchView(button.dataset.view)));
document.querySelector('.brand').addEventListener('click',event=>{event.preventDefault();switchView('workspace');});
switchView(location.hash.startsWith('#linked=')?'accounts':location.hash.slice(1)||'workspace');
function setEditorMode(preview) {
  $('editing-surface').hidden=preview; $('post-preview').hidden=!preview;
  $('post-preview-text').textContent=$('draft').value.trim() || 'Здесь появится ваш текст. Перейдите в редактор, чтобы начать.';
  $('edit-tab').classList.toggle('selected',!preview); $('preview-tab').classList.toggle('selected',preview);
  $('edit-tab').tabIndex=preview?-1:0; $('preview-tab').tabIndex=preview?0:-1;
  $('edit-tab').setAttribute('aria-selected',String(!preview)); $('preview-tab').setAttribute('aria-selected',String(preview));
}
$('edit-tab').onclick=()=>setEditorMode(false); $('preview-tab').onclick=()=>setEditorMode(true);
$('draft').addEventListener('input',()=>{ $('post-preview-text').textContent=$('draft').value; });
$('audio').addEventListener('change',()=>{ $('audio-label').textContent=$('audio').files[0]?.name || 'Добавить голосовую'; });
let selectedNewsFilter='all';
const newsTerms={jewellery:/jewel|jewell|diamond|gemstone|cartier|bulgari|winston|cleef|ювелир|бриллиант/i,watches:/watch|horlog|zenith|timepiece|час|swiss/i,dubai:/dubai|uae|gcc|dmcc|abu dhabi|дубай|оаэ/i};
function filterNews() {
 const query=$('news-search').value.toLowerCase().trim(); let visible=0;
 $('news-list').querySelectorAll('article').forEach(card=>{ const text=card.textContent.toLowerCase(); const matched=(!query||text.includes(query))&&(selectedNewsFilter==='all'||newsTerms[selectedNewsFilter].test(text)); card.hidden=!matched; if(matched) visible++; });
 $('news-count').textContent=String(visible);
 let empty=$('news-empty'); if(!empty) {empty=document.createElement('p');empty.id='news-empty';empty.className='news-empty';empty.textContent='По этому запросу новостей нет. Попробуйте другую тему.';$('news-list').append(empty);}
 empty.hidden=visible>0;
}
$('news-search').addEventListener('input',filterNews);
document.querySelectorAll('[data-news-filter]').forEach(button=>button.onclick=()=>{selectedNewsFilter=button.dataset.newsFilter;document.querySelectorAll('[data-news-filter]').forEach(b=>b.classList.toggle('selected',b===button));filterNews();});
new MutationObserver(records=>{if(records.some(record=>[...record.addedNodes].some(node=>node.nodeName==='ARTICLE'))) filterNews();}).observe($('news-list'),{childList:true});
let toastTimer;
new MutationObserver(()=>{clearTimeout(toastTimer);/* Status messages remain readable until the next action. */}).observe($('status'),{childList:true});

initCapture({switchView,putInEditor:(value)=>{ $('idea').value=value;save();setEditorMode(false);switchView('workspace');$('idea').focus(); }});
window.addEventListener('cloud-session',controls); cloudReady.then(controls);

async function loadCloudDrafts(){if(!hasCloudSession())return;try{const data=await(await cloudRequest('/drafts')).json();library=data.drafts.map(x=>({id:x.id,date:x.created,draft:x.text,language:x.language,cloud:true}));renderLibrary();document.querySelector('.library-banner p').textContent='Облачные версии доступны на всех ваших устройствах после входа.';}catch(error){$('status').textContent=error.message;}}
cloudReady.then(()=>{if(hasCloudSession())loadCloudDrafts();});window.addEventListener('cloud-session',()=>{if(hasCloudSession())loadCloudDrafts();else{try{library=JSON.parse(localStorage.getItem('draft-library')||'[]');}catch{library=[];}renderLibrary();document.querySelector('.library-banner p').textContent='Локальные версии этого браузера. Для доступа к облачной библиотеке войдите в аккаунт.';}});

initAccounts();
initEditor();

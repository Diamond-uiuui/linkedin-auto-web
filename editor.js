// LinkedIn posts are plain text: preserve line breaks, emoji and URLs verbatim.
export function initEditor(){
 const $=id=>document.getElementById(id),draft=$('draft'),copy=$('copy-post'),status=$('transfer-status'),picker=$('emoji-picker');
 const panel=document.querySelector('.editor-panel'),focusDialog=$('editor-focus-dialog');let homeMarker;
 $('expand-editor').onclick=()=>{if(focusDialog.open)return;homeMarker=document.createComment('editor-home');panel.before(homeMarker);$('editor-focus-slot').append(panel);$('expand-editor').hidden=true;focusDialog.showModal();draft.focus();};
 $('close-editor-focus').onclick=()=>focusDialog.close();focusDialog.addEventListener('close',()=>{if(homeMarker){homeMarker.replaceWith(panel);homeMarker=null;}$('expand-editor').hidden=false;$('expand-editor').focus();});
 function refresh(){const length=draft.value.length;copy.disabled=!draft.value.trim();$('word-count').classList.toggle('over-limit',length>3000);$('post-length-warning').hidden=length<=3000;$('post-length-warning').textContent=length>3000?`В тексте ${length} символов; лимит поста LinkedIn — 3 000. Сократите текст или оформите его как статью. Копирование доступно без обрезки.`:'';status.hidden=true;}
 copy.onclick=async()=>{const text=draft.value;if(!text.trim())return;try{await navigator.clipboard.writeText(text);status.hidden=false;status.textContent='Текст скопирован с абзацами. В LinkedIn нажмите «Start a post» и вставьте его (⌘V / Ctrl+V).';}catch{$('copy-fallback-text').value=text;$('copy-fallback').showModal();$('copy-fallback-text').focus();$('copy-fallback-text').select();}};
 $('select-copy-text').onclick=()=>{$('copy-fallback-text').focus();$('copy-fallback-text').select();};$('close-copy-fallback').onclick=()=>$('copy-fallback').close();
 function closePicker(){picker.hidden=true;$('emoji-toggle').setAttribute('aria-expanded','false');}
 for(const [emoji,label]of [['💎','Бриллиант'],['✨','Искры'],['💡','Идея'],['👏','Аплодисменты'],['🤝','Сотрудничество'],['🌍','Мир'],['📍','Место'],['→','Стрелка']]){const button=document.createElement('button');button.textContent=emoji;button.setAttribute('aria-label',label);button.onclick=()=>{const start=draft.selectionStart,end=draft.selectionEnd;draft.setRangeText(emoji,start,end,'end');draft.dispatchEvent(new Event('input',{bubbles:true}));closePicker();draft.focus();};picker.append(button);}
 $('emoji-toggle').onclick=()=>{picker.hidden=!picker.hidden;$('emoji-toggle').setAttribute('aria-expanded',String(!picker.hidden));if(!picker.hidden)picker.querySelector('button').focus();};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!picker.hidden){closePicker();$('emoji-toggle').focus();}});document.addEventListener('click',e=>{if(!picker.hidden&&!picker.contains(e.target)&&!$('emoji-toggle').contains(e.target))closePicker();});
 window.addEventListener('wh-editor-change',refresh);draft.addEventListener('input',refresh);refresh();
 // Arrow keys provide the expected tablist navigation without reaching hidden controls.
 const tabs=[$('edit-tab'),$('preview-tab')];tabs.forEach((tab,i)=>{tab.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?1:1-i;tabs[next].click();tabs[next].focus();}});});
}

(()=>{
 const media=matchMedia('(prefers-color-scheme: dark)');
 let preference;try{preference=localStorage.getItem('wh-theme');}catch{}
 const apply=dark=>{document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.style.colorScheme=dark?'dark':'light';document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#10151e':'#f3f5f8');const button=document.getElementById('theme-toggle');if(button){button.setAttribute('aria-pressed',String(dark));button.setAttribute('aria-label',dark?'Включить светлую тему':'Включить тёмную тему');button.title=dark?'Светлая тема':'Тёмная тема';}};
 apply(preference?preference==='dark':media.matches);
 media.addEventListener('change',e=>{if(!preference)apply(e.matches);});
 document.addEventListener('DOMContentLoaded',()=>{apply(document.documentElement.dataset.theme==='dark');document.getElementById('theme-toggle').onclick=()=>{preference=document.documentElement.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('wh-theme',preference);}catch{}apply(preference==='dark');};});
})();

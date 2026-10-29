import {cloudConfigured,hasCloudSession,cloudReady,cloudRequest,cloudJson,login} from './cloud.js?v=wh2';
const linkedOnArrival=new URLSearchParams(location.hash.slice(1)).has('linked');
export function initAccounts(){
 const $=id=>document.getElementById(id),message=text=>$('accounts-message').textContent=text;
 async function refresh(){
  const signed=hasCloudSession();$('account-login').hidden=signed;$('linkedin-login').hidden=signed;$('account-status').textContent=signed?'Вы вошли в личное пространство.':cloudConfigured?'Войдите, чтобы подключить профиль.':'Облачный сервер ещё не подключён. Вход и привязка станут доступны после настройки.';
  $('account-login').disabled=!cloudConfigured;$('linkedin-login').disabled=!cloudConfigured;$('linkedin-connect').disabled=!signed;$('linkedin-connect').hidden=false;$('linkedin-disconnect').hidden=true;
  $('linkedin-status').textContent='Профиль не подключён.';
  if(!signed)return;
  try{const data=await(await cloudRequest('/connections/linkedin')).json();$('linkedin-status').textContent=data.connected?'Подключён: '+data.name:data.configured?'Готов к подключению.':'Нужно настроить LinkedIn Developer App на сервере.';$('linkedin-connect').disabled=!data.configured;$('linkedin-connect').hidden=data.connected;$('linkedin-disconnect').hidden=!data.connected;}catch(e){message(e.message);}
 }
 $('account-login').onclick=()=>login().catch(e=>message(e.message));$('linkedin-login').onclick=()=>login('linkedin').catch(e=>message(e.message));
 $('linkedin-connect').onclick=async()=>{try{const {url}=await cloudJson('/connections/linkedin/start',{});location.assign(url);}catch(e){message(e.message);}};
 $('linkedin-disconnect').onclick=async()=>{try{await cloudRequest('/connections/linkedin',{method:'DELETE'});message('Связь удалена. Вход через GitHub сохранён.');await refresh();}catch(e){message(e.message);}};
 cloudReady.then(()=>{const p=new URLSearchParams(location.hash.slice(1));if(linkedOnArrival){message('LinkedIn успешно подключён.');history.replaceState(null,'',location.pathname+location.search+'#accounts');}refresh();});window.addEventListener('cloud-session',refresh);refresh();
}

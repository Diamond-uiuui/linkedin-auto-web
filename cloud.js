import {API_BASE_URL} from './config.js?v=wh2';
const base=API_BASE_URL.replace(/\/$/,'');
export const cloudConfigured=base.startsWith('https://');
let session='';try{session=sessionStorage.getItem('atelier-session')||'';}catch{}
export const hasCloudSession=()=>cloudConfigured&&!!session;
export async function cloudRequest(path,options={}) {
 if(!cloudConfigured)throw new Error('Облачный сервис ещё не развёрнут.');
 const headers=new Headers(options.headers||{});if(session)headers.set('Authorization','Bearer '+session);
 const response=await fetch(base+path,{...options,headers,credentials:'omit'});
 if(response.status===401){session='';try{sessionStorage.removeItem('atelier-session');}catch{}window.dispatchEvent(new Event('cloud-session'));}
 if(!response.ok){let message='Облачный сервис временно недоступен.';try{message=(await response.json()).error||message;}catch{}throw new Error(message);}
 return response;
}
export async function cloudJson(path,body,method='POST'){return (await cloudRequest(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).json();}
export async function login(provider='github') {
 if(!cloudConfigured)throw new Error('Cloudflare ещё не подключён. Идеи пока не синхронизируются.');
 const readiness=await(await cloudRequest('/health')).json();if(!readiness.auth?.[provider])throw new Error(provider==='linkedin'?'Вход LinkedIn ещё настраивается.':'Вход GitHub ещё настраивается.');
 const verifier=[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const challenge=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)))].map(x=>x.toString(16).padStart(2,'0')).join('');
 sessionStorage.setItem('atelier-login-verifier',verifier);
 location.assign(base+(provider==='linkedin'?'/auth/linkedin/start':'/auth/start')+'?challenge='+challenge);
}
export async function logout(){try{await cloudJson('/auth/logout',{});}finally{session='';try{sessionStorage.removeItem('atelier-session');}catch{}window.dispatchEvent(new Event('cloud-session'));}}
export const cloudReady=(async()=>{
 const params=new URLSearchParams(location.hash.slice(1));const code=params.get('login');
 if(code && cloudConfigured){history.replaceState(null,'',location.pathname+location.search+'#workspace');try{const verifier=sessionStorage.getItem('atelier-login-verifier');sessionStorage.removeItem('atelier-login-verifier');const response=await cloudJson('/auth/exchange',{code,verifier});session=response.token;sessionStorage.setItem('atelier-session',session);}catch(error){session='';return {error:error.message};}}
 if(hasCloudSession()){try{await (await cloudRequest('/me')).json();}catch(error){return {error:error.message};}}
 return {ok:hasCloudSession()};
})();

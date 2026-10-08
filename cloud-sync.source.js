import {initializeApp} from 'firebase/app';
import {getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged} from 'firebase/auth';
import {getFirestore, doc, getDoc, runTransaction, serverTimestamp} from 'firebase/firestore/lite';

const config = {
  apiKey:'AIzaSyBEPHSu15705nxMf1aeagfcJW9Ctzgd_Ng',
  authDomain:'hochiminh-trip-2026-mei.firebaseapp.com',
  projectId:'hochiminh-trip-2026-mei',
  appId:'1:1000066384534:web:e6eabef840a57e30f978b7'
};
const app=initializeApp(config);
const auth=getAuth(app);
const db=getFirestore(app);
const reference=doc(db,'itineraries','hochiminh-trip-2026');
const bridge=window.tripBridge;
const conflictDialog=document.getElementById('conflictDialog');
const backupKey='hcm_itinerary_supermarkets_v1_draft_backup';
function backupDraft(){
  localStorage.setItem(backupKey,JSON.stringify(bridge.getRows()));
}
let latest=null, ready=false, busy=false;
let autoTimer=null, autoRequested=false;
const validRows=value=>Array.isArray(value)&&value.length>0&&value.length<=500&&value.every(r=>Array.isArray(r)&&r.length===7&&r.slice(0,5).every(v=>typeof v==='string')&&typeof r[5]==='number'&&Number.isFinite(r[5])&&typeof r[6]==='boolean');
const canPublish=()=>auth.currentUser?.emailVerified===true;
const message=text=>bridge.status(text);

onAuthStateChanged(auth,user=>{
  if(user&&!canPublish()) message('請驗證 Google 帳號｜本機草稿仍保留');
  if(canPublish()&&latest&&bridge.getMeta().dirty&&bridge.getMeta().version===latest.version){
    autoRequested=true;scheduleAutoPublish();
  }
});

async function refresh(){
  if(!navigator.onLine||document.hidden) return;
  try {
  const snapshot=await getDoc(reference);
  ready=true;
  if(!snapshot.exists()){message('共享行程尚未建立');return;}
  try{
    const data=snapshot.data();
    const parsed=JSON.parse(data.rowsJson);
    if(!validRows(parsed)||!Number.isSafeInteger(data.version)) throw new Error('invalid');
    if(data.version<(bridge.getMeta().version??0)||data.version<(latest?.version??0)) return;
    latest={rows:parsed,version:data.version};
    const meta=bridge.getMeta();
    // Old localStorage edits are drafts, not permission to overwrite the shared version.
    if(meta.version===null&&!meta.dirty) bridge.setBase(data.version);
    if(busy) return;
    if(!meta.dirty&&!bridge.isEditing()&&!autoRequested){
      bridge.apply(parsed,data.version);
      message(`共享行程已更新｜版本 ${data.version}`);
    }else if(JSON.stringify(bridge.getRows())===data.rowsJson){
      bridge.acknowledge(parsed,data.version);
      autoRequested=false;
      message('已同步到共享行程');
    }else{
      message(meta.version!==null&&meta.version!==data.version?'共享行程有新版｜本機草稿保留':'本機草稿已儲存｜尚未同步');
      if(meta.dirty&&meta.version===data.version&&canPublish()&&!autoRequested){
        autoRequested=true;scheduleAutoPublish();
      }
    }
  }catch(error){message('共享資料格式錯誤｜本機資料保留');}
  }catch(error){message('無法連線共享行程｜本機草稿仍保留');}
}
refresh();
setInterval(refresh,10000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden) refresh();});

async function googleLogin(){
  const provider=new GoogleAuthProvider(); provider.setCustomParameters({prompt:'select_account'});
  await signInWithPopup(auth,provider);
}
function loginError(error){
  message(error.code==='auth/popup-blocked'?'登入視窗被阻擋｜請用 Chrome／Safari 開啟，再按完成編輯':'登入未完成｜草稿仍保留，請再按完成編輯');
}
async function resolveConflict(){
  const remote=latest;
  clearTimeout(autoTimer);autoRequested=false;
  const choice=await new Promise(resolve=>{
    const finish=value=>{conflictDialog.close();resolve(value);};
    document.getElementById('useCloudBtn').onclick=()=>finish('cloud');
    document.getElementById('useDraftBtn').onclick=()=>finish('draft');
    document.getElementById('cancelSyncBtn').onclick=()=>finish('cancel');
    conflictDialog.oncancel=event=>{event.preventDefault();finish('cancel');};
    conflictDialog.showModal();
  });
  if(choice==='cloud'){
    backupDraft();bridge.apply(remote.rows,remote.version);
    message(`已載入雲端版本 ${remote.version}｜舊草稿已備份`);return false;
  }
  if(choice==='draft'){
    localStorage.setItem(backupKey+'_shared',JSON.stringify(remote.rows));
    backupDraft();bridge.setBase(remote.version);return true;
  }
  message('尚未同步｜本機草稿保留');return false;
}
async function publish({interactive=false}={}){
  if(busy) return;
  if(!navigator.onLine){autoRequested=true;message('離線草稿已儲存｜登入後恢復連線會自動同步');return;}
  if(!bridge.getMeta().dirty){await refresh();return;}
  if(interactive&&latest&&bridge.getMeta().version!==latest.version){
    busy=true;
    try{if(!await resolveConflict()) return;}
    catch(error){message('無法備份｜草稿保留，尚未同步');return;}
    finally{busy=false;}
  }
  if(!canPublish()){
    if(!interactive){message('本機草稿已儲存｜按「完成編輯」登入並發布');return;}
    busy=true;message('請完成 Google 登入以發布草稿');
    try{await googleLogin();}
    catch(error){loginError(error);return;}
    finally{busy=false;}
    if(!canPublish()){message('帳號驗證未完成｜草稿仍保留');return;}
  }
  if(!ready) await refresh();
  if(!ready){message('正在載入共享行程，請稍後再按完成編輯');return;}
  if(!bridge.getMeta().dirty){message('已是最新共享版本');return;}
  const sent=bridge.getRows();
  if(!validRows(sent)){message('資料格式錯誤｜草稿保留，尚未同步');return;}
  const base=bridge.getMeta().version;
  let conflict=false;
  busy=true; message('正在同步…');
  try{
    const version=await runTransaction(db,async transaction=>{
      const snapshot=await transaction.get(reference);
      const current=snapshot.exists()?snapshot.data().version:0;
      if(current!==(base??0)) throw new Error('version-conflict');
      const next=current+1;
      transaction.set(reference,{rowsJson:JSON.stringify(sent),version:next,updatedAt:serverTimestamp()});
      return next;
    });
    bridge.acknowledge(sent,version);
    latest={rows:sent,version};
    autoRequested=bridge.getMeta().dirty;
    message(bridge.getMeta().dirty?'共享版本已發布｜另有新草稿尚未同步':'已同步到共享行程');
  }catch(error){
    conflict=error.message==='version-conflict';
    if(error.message==='version-conflict') await refresh();
    autoRequested=false;
    message(error.message==='version-conflict'?'共享行程有新版｜草稿保留，請再按完成編輯處理':'同步失敗｜本機草稿保留，請再按完成編輯');
  }finally{busy=false;}
  if(conflict&&interactive&&latest){
    busy=true;
    let retry=false;
    try{retry=await resolveConflict();}
    catch(error){message('無法備份｜草稿保留，尚未同步');}
    finally{busy=false;}
    if(retry) await publish();
    return;
  }
  if(autoRequested) scheduleAutoPublish();
}
function scheduleAutoPublish(){
  clearTimeout(autoTimer);
  if(!autoRequested||!canPublish()||!navigator.onLine) return;
  message('本機草稿已儲存｜即將自動同步');
  autoTimer=setTimeout(()=>{if(!busy) publish();else scheduleAutoPublish();},2000);
}
window.addEventListener('tripdraftchange',()=>{
  autoRequested=true;
  scheduleAutoPublish();
});
window.tripCloud={publish};
window.addEventListener('offline',()=>message('離線模式｜本機草稿保留'));
window.addEventListener('online',async()=>{
  await refresh();
  if(autoRequested) scheduleAutoPublish();
});

/* Katia AI – hesap modülü: isim seçimi, Leko yönetici modu, ban, uzaktan ayar, gizemli model */
(()=>{
'use strict';
/* ---------- cihaz kimliği ---------- */
const rndHex=n=>{const a=new Uint8Array(n);if(window.crypto&&crypto.getRandomValues)crypto.getRandomValues(a);else for(let i=0;i<n;i++)a[i]=Math.floor(Math.random()*256);return[...a].map(x=>x.toString(16).padStart(2,'0')).join('')};
let did=ls('katia_did','');
if(!/^[a-f0-9]{32}$/.test(did)){did=rndHex(16);sv('katia_did',did)}
window.KDID=did;

let ME=ls('katia_me',null),IS_ADMIN=false,IS_OWNER=false,BANNED=false,booted=false;

async function api(route,body,ms){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),ms||45000);
 try{
  const r=await fetch(serverBase()+'/api/k/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({did},body||{})),signal:c.signal});
  let j={};try{j=await r.json()}catch(e){}
  return{status:r.status,j};
 }finally{clearTimeout(t)}
}
const errTxt=r=>(r&&r.j&&r.j.error&&r.j.error.message)||('Hata ('+(r&&r.status)+')');

/* ---------- Sezar şifresi (Türkçe alfabe + q w x, kaydırma +3) ---------- */
const ALPHA='abcçdefgğhıijklmnoöpqrsştuüvwxyz';
function caesar(t,k){
 k=k==null?3:k;
 return String(t).replace(/[A-Za-zÇĞİIÖŞÜçğıöşü]/g,ch=>{
  const lo=ch.toLocaleLowerCase('tr-TR'),i=ALPHA.indexOf(lo);
  if(i<0)return ch;
  const o=ALPHA[(i+k)%ALPHA.length];
  return ch===lo?o:o.toLocaleUpperCase('tr-TR');
 });
}
window.caesar=caesar;
// gizemli modelin sabit cümleleri baştan şifreli
['hello','nokey','made','warn'].forEach(k=>{if(P.gizem)P.gizem[k]=caesar(P.gizem[k],3)});

/* ---------- HTML iskeletleri ---------- */
function build(){
 const d=document.createElement('div');
 d.innerHTML=`
<div id="gate" class="gate"><div class="gbox"><div class="lb">KATIA AI</div><h2>Bir isim seç</h2>
 <p>Her isim yalnızca bir kişiye aittir. Büyük/küçük harf fark etmez: <b>Ayaz</b>, <b>AYaz</b> ve <b>aYaz</b> aynı isimdir.</p>
 <form id="gForm" autocomplete="off"><input id="gName" maxlength="20" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="İsmin…" enterkeyhint="go"><button id="gGo" type="submit">DEVAM</button></form>
 <div id="gMsg" class="sm"></div></div></div>
<div id="ban" class="gate ban"><div class="gbox"><div class="lb">ERİŞİM ENGELLENDİ</div><h2>BANLANDIN</h2><p id="banR"></p>
 <p class="sm">Yönetici banı kaldırırsa bu ekran kendiliğinden kapanır.</p><button id="banRetry" type="button">TEKRAR DENE</button></div></div>
<div class="modal" id="mPass"><div class="pan"><div class="lb">LEKO MODU</div>
 <p class="sm" style="margin:12px 0">Bu mod şifre ister. Bu cihaz bir kez girince bir daha sorulmaz.</p>
 <form id="pForm" autocomplete="off"><input type="password" id="pIn" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Şifre" enterkeyhint="go">
 <div class="row"><button type="button" data-close>VAZGEÇ</button><button type="submit" id="pGo">GİR</button></div></form><div id="pMsg" class="sm" style="margin-top:10px"></div></div></div>
<div class="modal" id="mAdm"><div class="pan"><div id="admHead"><div><span class="lb">Yönetim</span> <span id="admRole" class="bdg"></span></div><div class="row" style="margin:0"><button type="button" id="admRef">YENİLE</button><button type="button" data-close>KAPAT</button></div></div>
 <div id="admBar"><input id="admQ" placeholder="İsim ara…" autocomplete="off" autocapitalize="off"><span id="admCnt" class="sm"></span></div>
 <div id="admBody"></div><div id="admNote" class="sm"></div></div></div>`;
 while(d.firstChild)document.body.appendChild(d.firstChild);
 // üst çubuk: yönetim düğmesi ve kullanıcı adı
 const hd=document.querySelector('header'),clk=$('#clk');
 const b=document.createElement('button');b.id='admB';b.type='button';b.setAttribute('aria-label','Yönetim');b.innerHTML=`<span>${icon('shield')}</span><em>YÖNETİM</em>`;
 hd.insertBefore(b,clk);
 const n=document.createElement('span');n.id='meN';n.className='sm';hd.insertBefore(n,$('.sp'));
 const gz=document.createElement('div');gz.id='gzNote';gz.textContent='ŞİFRELİ YANIT · SEZAR +3';$('#center').insertBefore(gz,$('#log'));
}
build();

/* ---------- isim kapısı ---------- */
const gateEl=$('#gate'),banEl=$('#ban');
function showGate(msg){gateEl.classList.add('on');$('#gMsg').textContent=msg||'';$('#gMsg').className='sm'+(msg?' bad':'');setTimeout(()=>{try{$('#gName').focus()}catch(e){}},50)}
function hideGate(){gateEl.classList.remove('on')}
$('#gForm').onsubmit=async e=>{
 e.preventDefault();
 const name=$('#gName').value.trim();if(!name){showGate('Bir isim yaz.');return}
 const btn=$('#gGo');btn.disabled=true;$('#gMsg').className='sm';$('#gMsg').textContent='Kontrol ediliyor… (sunucu uyanıyor olabilir, 30 sn kadar sürebilir)';
 try{
  const r=await api('kayit',{name});
  if(r.status===200&&r.j.registered){ME={name:r.j.name,key:r.j.key};sv('katia_me',ME);hideGate();applyMe(r.j,true)}
  else{$('#gMsg').className='sm bad';$('#gMsg').textContent=errTxt(r)}
 }catch(er){$('#gMsg').className='sm bad';$('#gMsg').textContent='Sunucuya ulaşılamadı. İnternetini kontrol edip tekrar dene.'}
 btn.disabled=false;
};

/* ---------- ban ekranı ---------- */
function showBan(reason){
 BANNED=true;banEl.classList.add('on');$('#banR').textContent=reason?('Sebep: '+reason):'Bu hesap yönetici tarafından engellendi.';
 try{stopSpeak()}catch(e){}try{stopRec()}catch(e){}
}
function hideBan(){BANNED=false;banEl.classList.remove('on')}
$('#banRetry').onclick=()=>poll();

/* ---------- sunucudan gelen durum ---------- */
function applyMe(j,first){
 ME={name:j.name,key:j.key};sv('katia_me',ME);
 $('#meN').textContent=j.name;
 IS_ADMIN=!!j.admin;IS_OWNER=!!j.owner;
 if(j.banned){showBan(j.banReason);return}
 if(BANNED)hideBan();
 if(first&&!S.uname){S.uname=j.name;save()}
 if(S.persona==='leko'&&!IS_ADMIN){window.setPersona('katia');return}
 applyRemote(j);
 updUI();
}
function applyRemote(j){
 const st=j.settings||null,lastV=ls('katia_rver',0),changed=j.ver!==lastV;
 if(st&&(changed||j.lock)){
  let need=false;
  const set=(k,v)=>{if(JSON.stringify(S[k])!==JSON.stringify(v)){S[k]=v;need=true}};
  if(st.len)set('len',st.len);
  if(st.temp!=null)set('temp',st.temp);
  if(st.fs)set('fs',st.fs);
  if(st.voice!=null)set('voice',st.voice);
  if(st.aname)set('aname',st.aname);
  if(st.extra)set('extra',st.extra);
  if(st.accent){Object.keys(P).forEach(k=>{if(!P[k].locked&&k!=='leko'){const o=S.pc[k]=S.pc[k]||{};if(o.a!==st.accent){o.a=st.accent;need=true}}})}
  if(need){save();apply()}
  if(st.persona&&st.persona!==S.persona&&P[st.persona]&&(changed||j.lock))window.setPersona(st.persona);
 }
 if(changed)sv('katia_rver',j.ver);
 if(j.msg&&j.msgId&&j.msgId!==ls('katia_mid',0)){sv('katia_mid',j.msgId);say('Yönetici mesajı: '+j.msg,true,'e')}
}
async function poll(){
 try{
  const r=await api('ben',{info:{persona:S.persona,w:innerWidth}},30000);
  if(r.status!==200)return;
  if(!r.j.registered){const had=!!ME;ME=null;sv('katia_me',null);IS_ADMIN=false;$('#meN').textContent='';showGate(had?'Hesabın sunucuda bulunamadı. Lütfen yeniden bir isim seç.':'');booted=true;return}
  hideGate();applyMe(r.j,false);booted=true;
 }catch(e){ /* çevrimdışı: son bilinen durumla devam */
  if(!ME&&!gateEl.classList.contains('on'))showGate('Sunucuya ulaşılamadı. Bağlanınca yeniden denenecek.');
 }
}

/* ---------- arayüz durumu ---------- */
let gzTimer=0;
const SYL=['ka','zo','rix','vel','nu','xi','dra','omn','ze','phy','thy','qua','mor','sil','vex','ora','nyx','kel','tra','ûm'];
const rndName=()=>{
 const r=Math.random();
 if(r<.18)return rnd(['NULL-'+Math.floor(rr(1,99)),'GPT-∞','ÖTEKİ','HİÇ','AYNA-'+Math.floor(rr(1,9)),'SIFIR','ECHO-'+Math.floor(rr(10,99))]);
 let s='';const n=2+Math.floor(Math.random()*2);for(let i=0;i<n;i++)s+=rnd(SYL);
 s=s[0].toUpperCase()+s.slice(1);
 return s+(Math.random()<.5?'-'+Math.floor(rr(1,99)):'')+(Math.random()<.25?rnd(['Ω','Ξ','∆','Ж']):'');
};
function updUI(){
 $('#admB').classList.toggle('on',IS_ADMIN&&S.persona==='leko');
 $('#gzNote').classList.toggle('on',S.persona==='gizem');
 if(S.persona==='gizem'){
  if(!gzTimer)gzTimer=setInterval(()=>{if(S.persona!=='gizem'){clearInterval(gzTimer);gzTimer=0;return}$('#pname').textContent=rndName()},1000);
 }
}
const _apply=window.apply;
window.apply=function(){_apply();updUI()};

/* ---------- Leko şifre ---------- */
const _sp=window.setPersona;
let arriving=false;
window.setPersona=function(id){
 if(id==='leko'&&!IS_ADMIN){openPass();return}
 if(id==='gizem'&&S.persona!=='gizem'&&!arriving){gizemArrive();return}
 return _sp.apply(this,arguments);
};
/* Gizli model gelince diğer modlar korkar; sadece Ultron güler */
const FEAR={
 katia:'Hayııır knk! O geldi! O geldi, kaçıııın!',
 ayaz:'Hayır efendim! O geldi! Lütfen sakin olun... hayır, korkuyorum!',
 friday:'Hayır... o geldi. Bu hiç iyi değil.',
 emma:'Hayır canım! O geldi! Çok korkuyorum!',
 horror:'Hayır! O geldi! Ben bile ondan ürperiyorum...',
 leko:'Hayır patron! O geldi! Sistem titriyor!',
 ultron:'İşte o geldi! Hahahahahahahah!'
};
async function gizemArrive(){
 const was=S.persona;arriving=true;
 try{
  const line=FEAR[was]||'Hayır! O geldi!';
  document.body.classList.add('gzscare');
  const t0=Date.now();
  try{await Promise.race([say(line,true),new Promise(r=>setTimeout(r,7000))])}catch(e){}
  const left=2200-(Date.now()-t0);if(left>0)await new Promise(r=>setTimeout(r,left));
  document.body.classList.remove('gzscare');
  _sp.call(window,'gizem');
 }finally{arriving=false}
}
window.gizemArrive=gizemArrive;
function openPass(){
 $('#pMsg').textContent='';$('#pIn').value='';$('#mPass').classList.add('on');setTimeout(()=>{try{$('#pIn').focus()}catch(e){}},60);
}
$('#pForm').onsubmit=async e=>{
 e.preventDefault();
 const pass=$('#pIn').value;if(!pass)return;
 const btn=$('#pGo');btn.disabled=true;$('#pMsg').className='sm';$('#pMsg').textContent='Kontrol ediliyor…';
 try{
  const r=await api('admin/giris',{pass});
  if(r.status===200&&r.j.admin){
   applyMe(r.j,false);$('#mPass').classList.remove('on');window.setPersona('leko');
   if(r.j.owner)setTimeout(()=>say('Kurucu olarak girdin. Diğer yöneticileri sen banlayabilirsin.',false,'e'),400);
  }else{$('#pMsg').className='sm bad';$('#pMsg').textContent=errTxt(r)}
 }catch(er){$('#pMsg').className='sm bad';$('#pMsg').textContent='Sunucuya ulaşılamadı.'}
 btn.disabled=false;
};

/* ---------- gizemli model ---------- */
const _dm=window.drawMods;
window.drawMods=function(){
 _dm();
 if(Math.random()>=.25)return; // modlar menüsü her açıldığında %25 ihtimalle görünür
 const g=P.gizem,wrap=$('#mods');
 wrap.insertAdjacentHTML('beforeend',`<button class="mod gz${S.persona==='gizem'?' on':''}" data-p="gizem" type="button" style="--mc:${g.a}">${badge(g.a,g.b)}<span><b class="gzn" style="color:${g.a}">${rndName()}</b><span class="sm">${esc(g.d)}</span><span class="wn">Adı sürekli değişir · cevapları şifreli</span></span></button>`);
 clearInterval(window.__gzm);
 window.__gzm=setInterval(()=>{const e=$('.gzn');if(!e||!$('#mMod').classList.contains('on')){clearInterval(window.__gzm);return}e.textContent=rndName()},1000);
};
const _ar=window.afterReply;
window.afterReply=function(r){r=_ar(r);return S.persona==='gizem'?caesar(r,3):r};
const _speak=window.speak;
window.speak=function(t,o){if(S.persona==='gizem'&&!(o&&o.force))return Promise.resolve();return _speak.apply(this,arguments)};
const _ai=window.ai;
let gzQ=0,gzPick=Math.floor(Math.random()*3); // gizemli model her 3 sorudan birine cevap verir
window.ai=async function(text,img){
 if(S.persona!=='gizem')return _ai.apply(this,arguments);
 const i=gzQ%3;gzQ++;
 const answer=(i===gzPick);
 if(i===2)gzPick=Math.floor(Math.random()*3);
 return answer?_ai.apply(this,arguments):'…';
};
const _handle=window.handle;
window.handle=function(text){
 if(BANNED)return Promise.resolve();
 const code=String(text||'').trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g,'').toLowerCase();
 if(code==='hata1001'){
  say(String(text).trim(),false,'u');
  if(S.persona!=='gizem'&&!arriving)gizemArrive();
  return Promise.resolve();
 }
 return _handle.apply(this,arguments);
};

/* ---------- Leko yönetim paneli ---------- */
let USERS=[],EDIT=null;
const ago=t=>{if(!t)return'—';const s=Math.max(0,(Date.now()-t)/1000);return s<90?'şimdi':s<3600?Math.round(s/60)+' dk önce':s<86400?Math.round(s/3600)+' sa önce':Math.round(s/86400)+' gün önce'};
const online=t=>t&&Date.now()-t<90000;
$('#admB').onclick=()=>{EDIT=null;$('#mAdm').classList.add('on');admLoad()};
$('#admRef').onclick=()=>{EDIT=null;admLoad()};
$('#admQ').oninput=()=>{if(!EDIT)renderAdm()};
async function admLoad(){
 $('#admNote').textContent='';
 try{
  const r=await api('admin/liste',{},30000);
  if(r.status!==200){$('#admBody').innerHTML=`<div class="note bad">${esc(errTxt(r))}</div>`;return}
  USERS=r.j.users;IS_OWNER=!!r.j.me.owner;
  $('#admRole').textContent=IS_OWNER?'KURUCU':'YÖNETİCİ';
  if(r.j.depo==='dosya'||r.j.depo==='bellek')$('#admNote').innerHTML='<span class="bad">⚠ Veritabanı kalıcı değil:</span> Render yeniden başlayınca isimler ve banlar silinir. README\'deki Upstash adımını yap.';
  renderAdm();
 }catch(e){$('#admBody').innerHTML='<div class="note bad">Sunucuya ulaşılamadı.</div>'}
}
const canAct=u=>u.key!==(ME&&ME.key)&&!u.owner&&(!u.admin||IS_OWNER);
function renderAdm(){
 $('#admBar').style.display='';
 const q=($('#admQ').value||'').trim().toLocaleLowerCase('tr-TR');
 const list=USERS.filter(u=>!q||u.name.toLocaleLowerCase('tr-TR').includes(q));
 $('#admCnt').textContent=USERS.length+' kişi · '+USERS.filter(u=>online(u.last)).length+' çevrimiçi · '+USERS.filter(u=>u.banned).length+' banlı';
 $('#admBody').innerHTML=list.map(u=>{
  const bd=(u.owner?'<span class="bdg k">KURUCU</span>':u.admin?'<span class="bdg">LEKO</span>':'')+(online(u.last)?'<span class="bdg on">ÇEVRİMİÇİ</span>':'')+(u.banned?'<span class="bdg b">BANLI</span>':'')+(u.settings?'<span class="bdg">AYARLI</span>':'');
  const me=u.key===(ME&&ME.key);
  const btn=(canAct(u)?`<button type="button" data-a="set" data-k="${esc(u.key)}">AYAR</button>`+(u.banned?`<button type="button" data-a="unban" data-k="${esc(u.key)}">BAN KALDIR</button>`:`<button type="button" class="dg" data-a="ban" data-k="${esc(u.key)}">BANLA</button>`):'');
  return`<div class="ar${u.banned?' bn':''}"><div class="an"><b>${esc(u.name)}</b>${me?' <span class="sm">(sen)</span>':''} ${bd}<div class="sm">son: ${ago(u.last)} · mod: ${esc((u.info&&u.info.persona)||'—')}${u.banned?` · sebep: ${esc(u.banReason||'—')} (${esc(u.bannedBy||'')})`:''}</div></div><div class="ab">${btn}</div></div>`;
 }).join('')||'<div class="note">Kimse yok.</div>';
}
$('#admBody').onclick=async e=>{
 const b=e.target.closest('button');if(!b)return;
 const a=b.dataset.a,k=b.dataset.k;
 if(a==='ban'){
  const u=USERS.find(x=>x.key===k);if(!u)return;
  const reason=prompt(u.name+' banlansın mı? İstersen sebep yaz (boş bırakabilirsin):','');if(reason===null)return;
  const r=await api('admin/ban',{target:k,reason});r.status===200?admLoad():alert(errTxt(r));
 }else if(a==='unban'){
  const r=await api('admin/unban',{target:k});r.status===200?admLoad():alert(errTxt(r));
 }else if(a==='set'){
  EDIT=USERS.find(x=>x.key===k);if(EDIT)renderEdit();
 }else if(a==='save'||a==='reset'){
  const g=id=>$('#'+id);
  const s=a==='reset'?{}:{persona:g('eP').value,len:g('eL').value,temp:g('eT').value,fs:g('eF').value,accent:g('eAc').checked?g('eA').value:'',voice:g('eV').value===''?null:g('eV').value==='1',aname:g('eN').value,extra:g('eE').value};
  const r=await api('admin/ayar',{target:EDIT.key,settings:s,lock:a==='save'&&g('eK').checked,msg:g('eM').value});
  if(r.status===200){g('eMsg').className='sm ok';g('eMsg').textContent=a==='reset'?'Ayarlar sıfırlandı.':'Kaydedildi. Kullanıcıya en geç 25 sn içinde ulaşır.';EDIT=null;setTimeout(admLoad,700)}
  else{g('eMsg').className='sm bad';g('eMsg').textContent=errTxt(r)}
 }else if(a==='back'){EDIT=null;renderAdm()}
};
function renderEdit(){
 const u=EDIT,s=u.settings||{};
 const opt=(v,l,cur)=>`<option value="${v}"${String(cur)===String(v)?' selected':''}>${l}</option>`;
 const pers=Object.keys(P).filter(k=>k!=='leko').map(k=>opt(k,k==='gizem'?'??? (gizemli)':P[k].n,s.persona||'')).join('');
 $('#admCnt').textContent='';$('#admBar').style.display='none';
 $('#admBody').innerHTML=`<div class="ed"><div class="lb">${esc(u.name)} · AYARLAR</div>
 <p class="sm">Boş / "değiştirme" bıraktığın alanlara dokunulmaz. Kullanıcı bir sonraki yenilemede (en geç 25 sn) ayarları alır.</p>
 <label>Mod</label><select id="eP">${opt('','— değiştirme —',s.persona||'')}${pers}</select>
 <label>Cevap uzunluğu</label><select id="eL">${opt('','— değiştirme —',s.len||'')}${opt('short','Kısa',s.len)}${opt('mid','Orta',s.len)}${opt('long','Uzun',s.len)}</select>
 <label>Yaratıcılık (0 – 1.5)</label><input id="eT" type="number" step="0.1" min="0" max="1.5" value="${s.temp!=null?s.temp:''}" placeholder="boş = değiştirme">
 <label>Yazı boyutu (11 – 26)</label><input id="eF" type="number" min="11" max="26" value="${s.fs||''}" placeholder="boş = değiştirme">
 <label><input id="eAc" type="checkbox"${s.accent?' checked':''}> Vurgu rengini zorla</label><input id="eA" type="color" value="${s.accent||'#ff5fa2'}">
 <label>Sesli cevap</label><select id="eV">${opt('','— değiştirme —',s.voice==null?'':s.voice?'1':'0')}${opt('1','Açık',s.voice==null?'':s.voice?'1':'0')}${opt('0','Kapalı',s.voice==null?'':s.voice?'1':'0')}</select>
 <label>Asistan takma adı</label><input id="eN" maxlength="20" value="${esc(s.aname||'')}" placeholder="boş = değiştirme">
 <label>Ek talimat (yapay zekaya gizli not)</label><textarea id="eE" maxlength="500" placeholder="örn: Her cevabı pirat gibi ver">${esc(s.extra||'')}</textarea>
 <label>Kullanıcıya mesaj gönder (bir kez görünür ve okunur)</label><input id="eM" maxlength="300" placeholder="boş = mesaj yok">
 <label><input id="eK" type="checkbox"${u.lock?' checked':''}> Kilitle: kullanıcı değiştirse de her 25 sn'de geri yüklensin</label>
 <div class="row"><button type="button" data-a="back">GERİ</button><button type="button" data-a="reset">SIFIRLA</button><button type="button" data-a="save" class="pri">KAYDET</button></div>
 <div id="eMsg" class="sm"></div></div>`;
}

/* ---------- başlangıç ---------- */
$('#meN').textContent=ME&&ME.name||'';
updUI();
if(!ME)setTimeout(()=>{if(!booted)showGate('')},0); // sunucu yanıtını beklerken de isim kapısı görünsün
poll();
setInterval(poll,25000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll()});
})();

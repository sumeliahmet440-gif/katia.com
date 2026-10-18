/* Katia AI v3 – ek modül: reklam görselleri, şeker/şaka, canlı kamera */
(()=>{
const AD=['reklam1.jpg','reklam2.jpg','reklam3.jpg'];let adI=0;
function adFlash(){ // mod değişirken 3 sn göster, sonra sil
 const el=document.createElement('div');el.className='adx';el.innerHTML=`<img src="${AD[adI++%AD.length]}" alt="Katia AI">`;
 document.body.appendChild(el);requestAnimationFrame(()=>el.classList.add('on'));
 return new Promise(r=>setTimeout(()=>{el.classList.remove('on');setTimeout(()=>{el.remove();r()},350)},3000));
}
AD.forEach(u=>{const i=new Image();i.src=u});

/* mod değişimi */
const _sp=window.setPersona;
window.setPersona=function(id){
 const was=S.persona;_sp(id);
 adFlash().then(()=>{if(id==='horror'&&was!=='horror'&&S.persona==='horror'&&!prankOn())askTrick()});
};
const _ap=window.apply;
window.apply=function(){_ap();document.body.classList.toggle('prank',prankOn())};

/* ŞEKER Mİ ŞAKA MI */
function askTrick(){
 horrorStop();
 const m=document.createElement('div');m.className='modal on';m.id='mTrick';
 m.innerHTML='<div class="pan trick"><div class="tk">🎃</div><div class="lb">ŞEKER Mİ, ŞAKA MI?</div><p>Hehehe... seç bakalım...</p><div class="row"><button id="tkS">🍬 ŞEKER</button><button id="tkK" class="bad">💀 ŞAKA</button></div></div>';
 document.body.appendChild(m);speak('Şeker mi, şaka mı? Hehehe...',{force:true,p:.6,r:.8});
 $('#tkS').onclick=()=>{m.remove();stopSpeak();candy()};
 $('#tkK').onclick=()=>{m.remove();stopSpeak();prank()};
}
function prank(){ // 12 saat: tüm modlar korkunç
 sv('katia_prank',Date.now()+12*3600*1000);apply();horrorStart();
 say('Şaka seçtin... Önümüzdeki 12 saat hiçbir mod güvenli değil... hihihi...');
 setTimeout(scare,3500);
}
function candy(){ // logo şekeri alır, sonra ana (korkunç) hâline döner
 const o=document.createElement('div');o.className='candy';o.textContent='🍬';document.body.appendChild(o);
 document.body.classList.add('eat');$('#psym').textContent='🍬';
 say('Mmm... şeker... teşekkürler... ama yine de arkana bak... hehehe');
 setTimeout(()=>{o.remove();document.body.classList.remove('eat');$('#psym').textContent='';horrorStart();setTimeout(scare,3000)},3300);
}
setInterval(()=>{if(!prankOn()&&document.body.classList.contains('prank')){document.body.classList.remove('prank');if(S.persona!=='horror')horrorStop()}},30000);
if(prankOn()){document.body.classList.add('prank');horrorStart()}

/* CANLI KAMERA: kameradaki görüntü sürekli analiz edilip ekrana yazılır */
let liveT=0,liveBusy=false,lastLive='';
async function liveTick(){
 if(!stream){liveStop();return}
 if(liveBusy||document.hidden||speaking||busy)return;
 const f=frame();if(!f)return;liveBusy=true;
 try{
  const order=(BUILTIN.includes(S.persona)?['builtin']:[]).concat(provOrder(true));
  for(const id of order){
   try{
    const t=await callProv(id,'Sen canlı kamera yorumcususun. Kamerada şu an görünenleri Türkçe, TEK kısa cümleyle söyle. Önceki cümleyi tekrar etme.',[{role:'user',content:'Şu an ne görüyorsun? Önceki: '+(lastLive||'-')}],f,{temp:.3,max:90});
    lastLive=t;$('#liveCap').textContent=t;break;
   }catch(e){}
  }
 }finally{liveBusy=false}
}
function liveStop(){clearInterval(liveT);liveT=0;$('#liveB').classList.remove('on');$('#liveCap').classList.remove('on')}
const cb=document.querySelector('#camWrap .cb');
if(cb){
 const b=document.createElement('button');b.id='liveB';b.type='button';b.textContent='● CANLI';cb.appendChild(b);
 const cap=document.createElement('div');cap.id='liveCap';$('#center').appendChild(cap);
 b.onclick=async()=>{
  if(liveT){liveStop();return}
  if(!stream&&!(await camOn()))return;
  b.classList.add('on');cap.textContent='Canlı analiz başlıyor…';cap.classList.add('on');
  liveT=setInterval(liveTick,4000);liveTick();
 };
}
})();

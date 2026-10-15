'use strict';
(() => {
const app = document.querySelector('#app');
const KEY = 'clf-practice-v1';
const bank = window.QUESTIONS;
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function validate(qs) {
 if (!Array.isArray(qs) || qs.length !== 20) return false;
 const ids = new Set(); const counts = [0,0,0,0]; let multi = 0;
 for (const q of qs) {
  if (!q || typeof q.id !== 'string' || ids.has(q.id) || !Number.isInteger(q.domain) || q.domain < 1 || q.domain > 4 || !['topic','stem','sourceUrl','provenance'].every(k => typeof q[k] === 'string' && q[k].trim()) || !/^https:\/\//.test(q.sourceUrl)) return false;
  ids.add(q.id); counts[q.domain-1]++;
  if (!Array.isArray(q.choices) || !q.choices.every(x => typeof x === 'string' && x.trim()) || !Array.isArray(q.correct) || ![1,2].includes(q.correct.length) || new Set(q.correct).size !== q.correct.length || !q.correct.every(i => Number.isInteger(i) && i>=0 && i<q.choices.length) || !Array.isArray(q.explanations) || q.explanations.length !== q.choices.length || !q.explanations.every(x => typeof x === 'string' && x.trim())) return false;
  if (q.correct.length === 2) {multi++; if(q.choices.length<5) return false;} else if(q.choices.length!==4) return false;
 }
 return multi===4 && counts.join() === '5,6,7,2';
}
if (!validate(bank)) { app.innerHTML='<p role="alert">Question bank unavailable or invalid. Practice cannot start. Please return when the reviewed bank is ready.</p>'; return; }
const signature = JSON.stringify(bank);
const fresh = () => ({version:1,bank:signature,started:false,deadline:null,submitted:false,submittedAt:null,reason:null,current:0,answers:bank.map(()=>[]),flags:bank.map(()=>false),confidence:bank.map(()=>null)});
let state = fresh();
function storageWarning(message) {const el=document.querySelector('#storage-warning');el.hidden=false;el.textContent=message;}
function save() { try {localStorage.setItem(KEY,JSON.stringify(state));} catch (_) {storageWarning('Storage is unavailable. This attempt works only while this page stays open; reload or closing may lose it. Export your results before leaving.');} }
function validState(s) {
 return s && s.version===1 && s.bank===signature && typeof s.started==='boolean' && typeof s.submitted==='boolean' && (!s.submitted || s.started) && (!s.started || Number.isFinite(s.deadline)) && Number.isInteger(s.current) && s.current>=0 && s.current<20 && Array.isArray(s.answers) && s.answers.length===20 && s.answers.every((a,i)=>Array.isArray(a) && a.length<=bank[i].correct.length && new Set(a).size===a.length && a.every(n=>Number.isInteger(n)&&n>=0&&n<bank[i].choices.length)) && Array.isArray(s.flags)&&s.flags.length===20&&s.flags.every(x=>typeof x==='boolean') && Array.isArray(s.confidence)&&s.confidence.length===20&&s.confidence.every(x=>[null,'sure','unsure'].includes(x));
}
try {const raw=localStorage.getItem(KEY);if(raw){const saved=JSON.parse(raw);if(validState(saved))state=saved;else storageWarning('Saved attempt is incompatible or damaged. A new attempt is ready.');}} catch(_){storageWarning('Saved data cannot be read. Persistence may be unavailable; keep this page open and export results.');}
const answered = () => state.answers.filter(a=>a.length).length;
const equal = (a,b) => a.length===b.length && a.every(x=>b.includes(x));
const correctAt = i => equal(state.answers[i],bank[i].correct);
const remaining = () => Math.max(0,Math.ceil((state.deadline-Date.now())/1000));
const timeText = n => `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
let confirmAction=null;
const dialog=document.querySelector('#confirm-dialog');
function confirm(title,message,action) {document.querySelector('#dialog-title').textContent=title;document.querySelector('#dialog-message').textContent=message;confirmAction=action;dialog.showModal();}
document.querySelector('#cancel-dialog').onclick=()=>{dialog.close();confirmAction=null;};
document.querySelector('#accept-dialog').onclick=()=>{const action=confirmAction;dialog.close();confirmAction=null;if(action)action();};
dialog.addEventListener('cancel',()=>{confirmAction=null;});
function submit(reason) {if(state.submitted)return;state.submitted=true;state.reason=reason;state.submittedAt=new Date().toISOString();if(dialog.open)dialog.close();confirmAction=null;save();render();window.scrollTo(0,0);}
function checkExpiry() {if(state.started&&!state.submitted&&remaining()===0){submit('expired');return true;}return false;}
function navTo(i) {if(checkExpiry())return;state.current=i;save();render();const panel=document.querySelector('#question-panel');panel.focus({preventScroll:true});panel.scrollIntoView({block:'start'});}
function render() {
 if(!state.started){
 app.innerHTML=`<section><h2>20 questions · 30 minutes</h2><p>Self-authored scenario practice, not an official AWS exam or exam dumps.</p><p>16 single-choice questions and 4 Choose TWO questions. This shortened practice is adapted, not a faithful 65-item simulation.</p><p>Practice mix: D1 5 (25%), D2 6 (30%), D3 7 (35%), D4 2 (10%). Official scored-content weights: 24% / 30% / 34% / 12%.</p><p>Our practice scoring: one point only for the exact complete answer set. Blanks and incomplete multiple responses are wrong. This is not a claim about AWS partial-credit policy. Raw scores do not predict scaled scores or passing probability.</p><p>Answers and explanations appear only after submission. Option order stays fixed. The timer starts only when you press Start and continues while backgrounded or closed.</p><div class="status"><span>0/20 answered</span><span>30:00</span></div><p class="note">Attempts stay in this browser's localStorage when permitted. No result upload, analytics, or tracking by this app. The static hosting provider receives normal page requests and may keep logs. Questions and answer keys are public client-side source, not secure high-stakes testing.</p><button class="primary" id="start">Start practice</button></section>`;
 document.querySelector('#start').onclick=()=>{state.started=true;state.deadline=Date.now()+30*60*1000;save();render();window.scrollTo(0,0);};return;
 }
 if(state.submitted){renderResult();return;}
 const i=state.current,q=bank[i],multi=q.correct.length===2;
 app.innerHTML=`<div class="status"><span id="count">${answered()}/20 answered</span><span role="timer" aria-label="Time remaining" id="timer">${timeText(remaining())}</span></div><section id="question-panel" tabindex="-1"><h2>Question ${i+1} of 20 · Domain ${q.domain}</h2><p id="question-stem">${esc(q.stem)}</p><p id="choice-rule">${multi?'Choose TWO answers.':'Choose ONE answer.'}</p><div role="group" aria-labelledby="question-stem" aria-describedby="choice-rule">${q.choices.map((c,j)=>`<label class="option"><input type="${multi?'checkbox':'radio'}" name="answer" value="${j}" ${state.answers[i].includes(j)?'checked':''}><span>${esc(c)}</span></label>`).join('')}</div><p id="selection-warning" role="status" ${multi&&state.answers[i].length===1?'':'hidden'}>${multi?'Choose TWO: this answer is incomplete.':''}</p><div class="controls"><label class="flag-label"><input type="checkbox" id="flag" ${state.flags[i]?'checked':''}>Flag for review</label><label>Confidence (optional) <select id="confidence"><option value="">Not recorded</option><option value="sure" ${state.confidence[i]==='sure'?'selected':''}>Sure</option><option value="unsure" ${state.confidence[i]==='unsure'?'selected':''}>Unsure</option></select></label></div><div class="actions"><button id="prev" ${i===0?'disabled':''}>Previous</button><button id="next" ${i===19?'disabled':''}>Next</button></div></section><nav aria-label="Question navigator"><p class="legend">✓ = answered (may be incomplete); ⚑ = flagged</p><div class="navigator">${bank.map((_,j)=>`<button data-nav="${j}" class="${state.answers[j].length?'answered':''}" aria-current="${i===j}" aria-label="Question ${j+1}${state.answers[j].length?', answered':''}${state.flags[j]?', flagged':''}">${j+1}${state.answers[j].length?' ✓':''}${state.flags[j]?' ⚑':''}</button>`).join('')}</div></nav><div class="actions"><button id="submit" class="primary">Submit practice</button><button id="reset">Reset attempt</button></div>`;
 document.querySelectorAll('input[name=answer]').forEach(input=>input.onchange=()=>{
  if(checkExpiry())return;
  const n=Number(input.value);const warning=document.querySelector('#selection-warning');
  if(multi){if(input.checked&&state.answers[i].length>=2){input.checked=false;warning.textContent='Maximum TWO answers. Uncheck one before selecting another.';warning.hidden=false;return;} state.answers[i]=input.checked?[...state.answers[i],n]:state.answers[i].filter(x=>x!==n);}
  else state.answers[i]=[n];
  save();warning.hidden=!multi||state.answers[i].length!==1;warning.textContent='Choose TWO: this answer is incomplete.';document.querySelector('#count').textContent=`${answered()}/20 answered`;const nav=document.querySelector(`[data-nav="${i}"]`);nav.classList.toggle('answered',!!state.answers[i].length);nav.textContent=`${i+1}${state.answers[i].length?' ✓':''}${state.flags[i]?' ⚑':''}`;nav.setAttribute('aria-label',`Question ${i+1}${state.answers[i].length?', answered':''}${state.flags[i]?', flagged':''}`);
 });
 document.querySelector('#flag').onchange=e=>{if(checkExpiry())return;state.flags[i]=e.target.checked;save();const nav=document.querySelector(`[data-nav="${i}"]`);nav.textContent=`${i+1}${state.answers[i].length?' ✓':''}${state.flags[i]?' ⚑':''}`;nav.setAttribute('aria-label',`Question ${i+1}${state.answers[i].length?', answered':''}${state.flags[i]?', flagged':''}`);};
 document.querySelector('#confidence').onchange=e=>{if(checkExpiry())return;state.confidence[i]=e.target.value||null;save();};
 document.querySelector('#prev').onclick=()=>navTo(i-1);document.querySelector('#next').onclick=()=>navTo(i+1);
 document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>navTo(Number(b.dataset.nav)));
 document.querySelector('#submit').onclick=()=>{if(checkExpiry())return;const incomplete=bank.filter((q,j)=>q.correct.length===2&&state.answers[j].length===1).length;confirm('Submit practice?',`${20-answered()} unanswered. ${incomplete} incomplete Choose TWO responses. Blanks and incomplete answers score zero in this practice. Submit anyway?`,()=>{if(!checkExpiry())submit('manual');});};
 document.querySelector('#reset').onclick=reset;
}
function reset(){confirm('Reset this attempt?','This removes the current attempt from this browser only. No remote data is deleted. A new timer starts only after you press Start.',()=>{state=fresh();save();render();window.scrollTo(0,0);});}
function resultData() {
 const domains=[1,2,3,4].map(domain=>({domain,correct:bank.filter((q,i)=>q.domain===domain&&correctAt(i)).length,total:bank.filter(q=>q.domain===domain).length}));
 const confidence=['sure','unsure'].map(confidence=>({confidence,correct:bank.filter((q,i)=>state.confidence[i]===confidence&&correctAt(i)).length,incorrect:bank.filter((q,i)=>state.confidence[i]===confidence&&!correctAt(i)).length}));
 return {format:'clf-practice-result-v1',submittedAt:state.submittedAt,reason:state.reason,deadline:new Date(state.deadline).toISOString(),score:bank.filter((_,i)=>correctAt(i)).length,total:20,scoring:'Practice exact-set all-or-nothing; not an AWS scoring prediction.',domains,confidence,questions:bank.map((q,i)=>({id:q.id,domain:q.domain,topic:q.topic,stem:q.stem,choices:q.choices,selectedIndices:state.answers[i],selectedText:state.answers[i].map(j=>q.choices[j]),correctIndices:q.correct,correctText:q.correct.map(j=>q.choices[j]),isCorrect:correctAt(i),confidence:state.confidence[i],flagged:state.flags[i],explanations:q.explanations,sourceUrl:q.sourceUrl,provenance:q.provenance}))};
}
function renderResult(){
 const r=resultData();
 app.innerHTML=`<section><h2 id="score">${r.score}/20 correct</h2><p>${state.reason==='expired'?'Time expired. Auto-submitted.':'Practice submitted.'} Raw practice score only; not an AWS scaled score or pass prediction.</p><p>Exact complete answer set required in this practice; blank and incomplete responses count as wrong.</p><h3>Domain breakdown</h3>${r.domains.map(d=>`<div class="summary-row">Domain ${d.domain}: ${d.correct}/${d.total}</div>`).join('')}<h3>Recorded confidence only</h3>${r.confidence.map(c=>`<div>${esc(c.confidence)}: ${c.correct} correct, ${c.incorrect} incorrect</div>`).join('')}<p>Not recorded: ${state.confidence.filter(x=>x===null).length}. No confidence inferred.</p><div class="actions"><button id="export">Export JSON</button><button id="copy">Copy result</button><button id="retry">Retry practice</button></div><p id="export-status" role="status"></p><div id="copy-fallback" hidden><label for="result-json">Copy manually: long-press the selected JSON, then Copy.</label><textarea id="result-json" class="export-area" readonly></textarea></div></section><section aria-label="Answer review"><h2>Answer review</h2>${bank.map((q,i)=>`<article class="review-card" data-review="${i}"><h3>Question ${i+1}: ${correctAt(i)?'Correct':'Incorrect'}</h3><p>${esc(q.stem)}</p><p>Domain ${q.domain} · ${esc(q.topic)} · Confidence: ${esc(state.confidence[i]||'Not recorded')}${state.flags[i]?' · Flagged':''}</p>${!state.answers[i].length?'<p>Unanswered</p>':''}${q.choices.map((c,j)=>`<div class="review-option ${q.correct.includes(j)?'correct':state.answers[i].includes(j)?'wrong':''}"><span class="marker">${state.answers[i].includes(j)?'Chosen · ':''}${q.correct.includes(j)?'Correct answer':'Not correct'}</span><span class="choice-text">${esc(c)}</span><p>${esc(q.explanations[j])}</p></div>`).join('')}<p><a href="${esc(q.sourceUrl)}" target="_blank" rel="noopener noreferrer">Official supporting source</a></p><p class="note">Provenance: ${esc(q.provenance)}</p></article>`).join('')}</section>`;
 const json=JSON.stringify(r,null,2);
 document.querySelector('#retry').onclick=reset;
 document.querySelector('#export').onclick=()=>{try{const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='clf-practice-result.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);document.querySelector('#export-status').textContent='JSON download requested. If your browser cannot save it, use Copy result.';}catch(_){fallback(json);}};
 document.querySelector('#copy').onclick=async()=>{try{if(!navigator.clipboard)throw Error();await navigator.clipboard.writeText(json);document.querySelector('#export-status').textContent='Result copied.';}catch(_){fallback(json);}};
}
function fallback(json){document.querySelector('#copy-fallback').hidden=false;const box=document.querySelector('#result-json');box.value=json;box.focus();box.select();box.setSelectionRange(0,json.length);document.querySelector('#export-status').textContent='Automatic copy unavailable. Copy the selected JSON manually.';}
if(!checkExpiry())render();
setInterval(()=>{if(!checkExpiry()&&state.started&&!state.submitted){const timer=document.querySelector('#timer');if(timer)timer.textContent=timeText(remaining());}},500);
document.addEventListener('visibilitychange',checkExpiry);window.addEventListener('pageshow',checkExpiry);
})();

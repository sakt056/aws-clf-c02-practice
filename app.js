'use strict';
(async () => {
  const KEY = 'toeic-reading-v1';
  const ASSET_VERSION = 'toeic-reading-20261016-1';
  const app = document.querySelector('#app');
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text = x => typeof x === 'string' && x.trim().length > 0;
  function validate(b) {
    if (!b || !text(b.title) || !['string','number'].includes(typeof b.version) || b.provenance == null || !Array.isArray(b.passages) || !Array.isArray(b.questions) || b.questions.length !== 20) return false;
    const passages = new Set();
    for (const p of b.passages) {
      if (!p || ![p.id,p.title,p.text].every(text) || passages.has(p.id)) return false;
      passages.add(p.id);
    }
    const ids = new Set();
    const counts = {5:0,6:0,7:0};
    for (const q of b.questions) {
      if (!q || ![q.id,q.topic,q.stem,q.evidence].every(text) || ids.has(q.id) || ![5,6,7].includes(q.part) || !(q.passageId === null || passages.has(q.passageId)) || (q.part !== 5 && !passages.has(q.passageId))) return false;
      if (!Array.isArray(q.options) || q.options.length !== 4 || !q.options.every(text) || new Set(q.options).size !== 4 || !Number.isInteger(q.correct) || q.correct < 0 || q.correct > 3 || !Array.isArray(q.rationales) || q.rationales.length !== 4 || !q.rationales.every(text)) return false;
      ids.add(q.id); counts[q.part]++;
    }
    return counts[5] === 12 && counts[6] === 4 && counts[7] === 4;
  }
  let bank;
  try {
    const response = await fetch(`./questions.json?v=${ASSET_VERSION}`, {cache:'no-store'});
    if (!response.ok) throw Error('Question bank unavailable');
    bank = await response.json();
    if (!validate(bank)) throw Error('Invalid question bank');
  } catch (_) {
    app.removeAttribute('aria-busy');
    app.innerHTML = '<p role="alert">Question bank unavailable or invalid. Practice cannot start. Please return when the reviewed bank is ready.</p><button id="reload">Try loading again</button>';
    $('#reload').onclick = () => location.reload();
    return;
  }
  app.removeAttribute('aria-busy');
  const qs = bank.questions;
  const signature = JSON.stringify(bank);
  const shuffled = () => {
    const order = [0,1,2,3];
    for (let i=3;i>0;i--) {const j=Math.floor(Math.random()*(i+1)); [order[i],order[j]]=[order[j],order[i]];}
    return order;
  };
  const fresh = () => ({version:1,bank:signature,started:false,deadline:null,submitted:false,submittedAt:null,reason:null,current:0,answers:qs.map(()=>null),flags:qs.map(()=>false),confidence:qs.map(()=>null),optionMap:qs.map(shuffled)});
  let state = fresh();
  function warning(message) {$('#storage-warning').hidden=false; $('#storage-warning').textContent=message;}
  function save() {
    try {localStorage.setItem(KEY,JSON.stringify(state));}
    catch (_) {warning('Storage is unavailable. Keep this page open: reload or closing may lose this attempt. Export or copy results before leaving.');}
  }
  function validState(s) {
    return s && s.version===1 && s.bank===signature && typeof s.started==='boolean' && typeof s.submitted==='boolean' && (!s.submitted || s.started) && (s.started ? Number.isFinite(s.deadline) && s.deadline>0 : s.deadline===null) && (!s.submitted || (['manual','expired'].includes(s.reason) && text(s.submittedAt) && Number.isFinite(Date.parse(s.submittedAt)))) && Number.isInteger(s.current) && s.current>=0 && s.current<20 && Array.isArray(s.answers) && s.answers.length===20 && s.answers.every(a=>a===null || Number.isInteger(a)&&a>=0&&a<4) && Array.isArray(s.flags) && s.flags.length===20 && s.flags.every(a=>typeof a==='boolean') && Array.isArray(s.confidence) && s.confidence.length===20 && s.confidence.every(a=>[null,'sure','unsure'].includes(a)) && Array.isArray(s.optionMap) && s.optionMap.length===20 && s.optionMap.every(a=>Array.isArray(a)&&a.length===4&&[0,1,2,3].every(n=>a.includes(n)));
  }
  try {
    const raw=localStorage.getItem(KEY);
    if(raw) {const saved=JSON.parse(raw); if(validState(saved)) state=saved; else warning('Saved practice is damaged or belongs to a different bank. A new attempt is ready.');}
  } catch (_) {warning('Saved data cannot be read. Persistence may be unavailable; keep this page open and export results.');}
  const answered = () => state.answers.filter(a=>a!==null).length;
  const correctAt = i => state.answers[i]!==null && state.optionMap[i][state.answers[i]]===qs[i].correct;
  const remaining = () => Math.max(0,Math.ceil((state.deadline-Date.now())/1000));
  const timeText = n => `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;
  const provenance = typeof bank.provenance==='string' ? bank.provenance : JSON.stringify(bank.provenance);
  const letter = n => 'ABCD'[n];
  let confirmAction = null;
  const dialog=$('#confirm-dialog');
  function confirm(title,message,action) {
    $('#dialog-title').textContent=title; $('#dialog-message').textContent=message; confirmAction=action; dialog.showModal(); $('#cancel-dialog').focus();
  }
  $('#cancel-dialog').onclick=()=>{dialog.close();confirmAction=null;};
  $('#accept-dialog').onclick=()=>{const action=confirmAction;dialog.close();confirmAction=null;if(action)action();};
  dialog.addEventListener('cancel',()=>{confirmAction=null;});
  function submit(reason) {
    if(state.submitted)return;
    state.submitted=true; state.reason=reason; state.submittedAt=new Date().toISOString();
    if(dialog.open)dialog.close(); confirmAction=null; save(); render(); window.scrollTo(0,0); $('#score').focus();
  }
  function checkExpiry() {
    if(state.started&&!state.submitted&&remaining()===0){submit('expired');return true;}
    return false;
  }
  function navTo(i) {
    if(checkExpiry())return;
    state.current=i;save();render();$('#question-panel').focus({preventScroll:true});$('#question-panel').scrollIntoView({block:'start'});
  }
  function passage(q) {
    const p=bank.passages.find(p=>p.id===q.passageId);
    return p ? `<aside class="passage" data-passage="${esc(p.id)}" aria-label="Associated passage"><h3>${esc(p.title)}</h3><div class="passage-text">${esc(p.text)}</div></aside>` : '';
  }
  function navButton(j) {
    return `<button data-nav="${j}" class="${state.answers[j]!==null?'answered':''}" aria-current="${state.current===j?'step':'false'}" aria-label="Question ${j+1}${state.answers[j]!==null?', answered':''}${state.flags[j]?', flagged':''}">${j+1}${state.answers[j]!==null?' ✓':''}${state.flags[j]?' ⚑':''}</button>`;
  }
  function refreshProgress() {
    $('#count').textContent=`${answered()}/20 answered`;
    $(`[data-nav="${state.current}"]`).outerHTML=navButton(state.current);
    const button=$(`[data-nav="${state.current}"]`);button.onclick=()=>navTo(state.current);
  }
  function render() {
    if (!state.started) {
      app.innerHTML=`<section><h2>20 reading questions · 20 minutes</h2><p>Part 5: 12 · Part 6: 4 · Part 7: 4</p><p>Self-authored targeted review, not an official TOEIC test or a full test simulation. Reading only; no Listening section.</p><p>Choose one answer per question. Answers and Thai explanations appear only after submission. Options are shuffled once per attempt and stay in the same order throughout that attempt.</p><p>The timer starts only when you press Start. It continues while this page is backgrounded or closed. เมื่อหมดเวลาจะส่งคำตอบอัตโนมัติ</p><div class="status"><span>0/20 answered</span><span>20:00</span></div><p class="note">Attempts stay in this browser when storage is permitted. No results upload, analytics, or tracking by this app. The static host receives normal page requests and may keep logs. Answer keys are public client-side data, not secure testing material.</p><p class="note">Bank: ${esc(bank.title)} · Version: ${esc(bank.version)}<br>Provenance: ${esc(provenance)}</p><button class="primary" id="start">Start practice</button></section>`;
      $('#start').onclick=()=>{state.started=true;state.deadline=Date.now()+20*60*1000;save();render();window.scrollTo(0,0);};
      return;
    }
    if(state.submitted){renderResult();return;}
    const i=state.current,q=qs[i];
    app.innerHTML=`<div class="status"><span id="count">${answered()}/20 answered</span><span role="timer" aria-label="Time remaining" id="timer">${timeText(remaining())}</span></div><section id="question-panel" tabindex="-1"><h2>Question ${i+1} of 20 · Part ${q.part}</h2>${passage(q)}<p id="question-stem">${esc(q.stem)}</p><p id="choice-rule">Choose ONE answer.</p><div role="radiogroup" aria-labelledby="question-stem" aria-describedby="choice-rule">${state.optionMap[i].map((original,j)=>`<label class="option"><input type="radio" name="answer" value="${j}" ${state.answers[i]===j?'checked':''}><span>${letter(j)}. ${esc(q.options[original])}</span></label>`).join('')}</div><div class="controls"><label class="flag-label"><input type="checkbox" id="flag" ${state.flags[i]?'checked':''}>Flag for review</label><label class="confidence-label">Confidence (optional)<select id="confidence"><option value="">Not recorded</option><option value="sure" ${state.confidence[i]==='sure'?'selected':''}>Sure</option><option value="unsure" ${state.confidence[i]==='unsure'?'selected':''}>Unsure</option></select></label></div><div class="actions"><button id="prev" ${i===0?'disabled':''}>Previous</button><button id="next" ${i===19?'disabled':''}>Next</button></div></section><nav aria-label="Question navigator"><p class="legend">✓ = answered · ⚑ = flagged</p><div class="navigator">${qs.map((_,j)=>navButton(j)).join('')}</div></nav><div class="actions"><button id="submit" class="primary">Submit practice</button><button id="reset">Reset attempt</button></div>`;
    document.querySelectorAll('input[name=answer]').forEach(input=>input.onchange=()=>{if(checkExpiry())return;state.answers[i]=Number(input.value);save();refreshProgress();});
    $('#flag').onchange=e=>{if(checkExpiry())return;state.flags[i]=e.target.checked;save();refreshProgress();};
    $('#confidence').onchange=e=>{if(checkExpiry())return;state.confidence[i]=e.target.value||null;save();};
    $('#prev').onclick=()=>navTo(i-1);$('#next').onclick=()=>navTo(i+1);
    document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>navTo(Number(b.dataset.nav)));
    $('#submit').onclick=()=>{if(checkExpiry())return;confirm('Submit practice?',`${20-answered()} unanswered. Unanswered questions count as incorrect. Submit this attempt?`,()=>{if(!checkExpiry())submit('manual');});};
    $('#reset').onclick=reset;
  }
  function reset() {
    confirm('Retry / reset this attempt?','This replaces only this reading practice attempt in this browser. Export your results first if needed. A new timer starts only after Start.',()=>{state=fresh();save();render();window.scrollTo(0,0);$('#start').focus();});
  }
  function resultData() {
    return {
      format:'toeic-reading-result-v1',optionIndexBase:0,optionOrder:'Displayed A/B/C/D order. optionMap maps displayed index to original bank index.',title:bank.title,bankVersion:bank.version,provenance:bank.provenance,
      submittedAt:state.submittedAt,reason:state.reason,deadline:new Date(state.deadline).toISOString(),
      score:qs.filter((_,i)=>correctAt(i)).length,total:20,scoring:'Raw practice count only; not a scaled score or pass prediction. Unanswered questions count as incorrect.',
      parts:[5,6,7].map(part=>({part,correct:qs.filter((q,i)=>q.part===part&&correctAt(i)).length,total:qs.filter(q=>q.part===part).length})),
      confidence:[null,'sure','unsure'].map(confidence=>({confidence,total:state.confidence.filter(c=>c===confidence).length,correct:qs.filter((_,i)=>state.confidence[i]===confidence&&correctAt(i)).length,incorrect:qs.filter((_,i)=>state.confidence[i]===confidence&&!correctAt(i)).length})),
      questions:qs.map((q,i)=>{
        const selected=state.answers[i],correct=state.optionMap[i].indexOf(q.correct);
        return {id:q.id,part:q.part,topic:q.topic,passageId:q.passageId,passage:bank.passages.find(p=>p.id===q.passageId)||null,stem:q.stem,optionMap:state.optionMap[i],options:state.optionMap[i].map(n=>q.options[n]),selected,correct,selectedText:selected===null?null:q.options[state.optionMap[i][selected]],correctText:q.options[q.correct],isCorrect:correctAt(i),confidence:state.confidence[i],flagged:state.flags[i],rationales:state.optionMap[i].map(n=>q.rationales[n]),evidence:q.evidence};
      })
    };
  }
  function renderResult() {
    const r=resultData();
    app.innerHTML=`<section><h2 id="score" tabindex="-1">${r.score}/20 correct</h2><p>${state.reason==='expired'?'Time expired. Auto-submitted.':'Practice submitted.'} Raw practice count only; not a scaled score or pass prediction. Unanswered questions count as incorrect.</p><h3>Part breakdown</h3>${r.parts.map(p=>`<div class="summary-row">Part ${p.part}: ${p.correct}/${p.total}</div>`).join('')}<h3>Recorded confidence</h3>${r.confidence.map(c=>`<div>${esc(c.confidence||'Not recorded')}: ${c.correct} correct, ${c.incorrect} incorrect (${c.total} total)</div>`).join('')}<p>No confidence inferred.</p><div class="actions"><button id="export">Export JSON</button><button id="copy">Copy result</button><button id="retry">Retry practice</button></div><p id="export-status" role="status"></p><div id="copy-fallback" hidden><label for="result-json">Copy manually: long-press the selected JSON, then Copy.</label><textarea id="result-json" class="export-area" readonly></textarea></div></section><section aria-label="Answer review"><h2>Answer review</h2>${r.questions.map((q,i)=>`<article class="review-card" data-review="${i}"><h3>Question ${i+1}: ${q.isCorrect?'Correct':'Incorrect'}</h3><p>Part ${q.part} · ${esc(q.topic)} · Confidence: ${esc(q.confidence||'Not recorded')}${q.flagged?' · Flagged':''}</p>${passage(qs[i])}<p>${esc(q.stem)}</p>${q.selected===null?'<p>Unanswered</p>':''}${q.options.map((option,j)=>`<div class="review-option ${q.correct===j?'correct':q.selected===j?'wrong':''}" data-option="${j}"><span class="marker">${q.selected===j?'Chosen · ':''}${q.correct===j?'Correct answer':'Not correct'}</span><span class="choice-text">${letter(j)}. ${esc(option)}</span><p lang="th">${esc(q.rationales[j])}</p></div>`).join('')}<p lang="th" class="evidence">${esc(q.evidence)}</p></article>`).join('')}</section>`;
    const json=JSON.stringify(r,null,2);
    $('#retry').onclick=reset;
    $('#export').onclick=()=>{
      try {
        const url=URL.createObjectURL(new Blob([json],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='toeic-reading-result.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
        $('#export-status').textContent='JSON download requested. If your browser cannot save it, use Copy result.';
      } catch (_) {fallback(json);}
    };
    $('#copy').onclick=async()=>{
      try {if(!navigator.clipboard)throw Error('Clipboard unavailable');await navigator.clipboard.writeText(json);$('#export-status').textContent='Result copied.';}
      catch (_) {fallback(json);}
    };
  }
  function fallback(json) {
    $('#copy-fallback').hidden=false;const box=$('#result-json');box.value=json;box.focus();box.select();box.setSelectionRange(0,json.length);$('#export-status').textContent='Automatic copy unavailable. Copy the selected JSON manually.';
  }
  if(!checkExpiry())render();
  setInterval(()=>{if(!checkExpiry()&&state.started&&!state.submitted&&$('#timer'))$('#timer').textContent=timeText(remaining());},250);
  document.addEventListener('visibilitychange',checkExpiry);
  window.addEventListener('pageshow',checkExpiry);
  window.addEventListener('focus',checkExpiry);
})();

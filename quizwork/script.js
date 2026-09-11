(function(){
  const questions = [
    {cat:"IT・雑学",text:"Webページの見た目（色・余白・文字サイズなど）を指定するために使う言語は、次のうちどれ？",choices:["HTML","CSS","PHP","Excel"],answer:1,fact:"CSS（Cascading Style Sheets）は、HTMLで作った構造に対して見た目を指定する言語です。"},
    {cat:"IT・雑学",text:"クリックやキー入力など、Webページに『動き』をつけるために使うプログラミング言語は？",choices:["JavaScript","フォトショップ","エクセル関数","HTML"],answer:0,fact:"JavaScriptはブラウザ上で動くプログラミング言語で、ボタンの動作や判定処理などに使われます。"},
    {cat:"雑学",text:"1分間で消費するカロリーが最も多いとされる運動は、次のうちどれ？",choices:["ウォーキング","なわとび","ストレッチ","昼寝"],answer:1,fact:"なわとびは短時間で心拍数が上がりやすく、消費カロリーの高い運動として知られています。"},
    {cat:"雑学",text:"人間の脳が最も多くのエネルギーを使うとされているのは、体全体の消費エネルギーの約何割？",choices:["約2割","約5割","約7割","ほぼ0割"],answer:0,fact:"脳は体重の約2%ほどの重さですが、全消費エネルギーの約20%を使うといわれています。"},
    {cat:"IT・雑学",text:"サーバー側でデータベースとやり取りし、問題データの管理や採点処理などに向いている言語は？",choices:["CSS","PHP","フォント","絵文字"],answer:1,fact:"PHPはサーバーサイドで動く言語で、データベース連携やスコア処理などバックエンド処理が得意です。"}
  ];

  let idx=-1,score=0,revealTimer=null,revealChars=0,buzzedAtFraction=1,answerTimerRAF=null;
  let roomCode='',playerId='',playerName='',rankTimer=null;
  const stage=document.getElementById('stage'),scoreView=document.getElementById('scoreView'),qCount=document.getElementById('qCount'),catTag=document.getElementById('catTag');
  const status=document.getElementById('roomStatus'),rankingPanel=document.getElementById('rankingPanel'),rankingList=document.getElementById('rankingList'),roomLabel=document.getElementById('roomLabel');

  async function api(action,data={}){
    const body=new URLSearchParams({action,...data});
    const res=await fetch('api.php',{method:'POST',body,cache:'no-store'});
    const json=await res.json(); if(!json.ok) throw new Error(json.message||'通信エラー'); return json;
  }
  function showRoomStatus(text){status.textContent=text;}
  function renderRanking(players=[]){
    rankingPanel.hidden=false;
    const title=document.getElementById('rankingTitle');
    if(roomCode){ title.textContent='ONLINE RANKING'; roomLabel.textContent='ROOM '+roomCode; }
    else { title.textContent='SCORE RANKING'; roomLabel.textContent='LOCAL'; }
    const sorted=[...players].sort((a,b)=>b.score-a.score);
    rankingList.innerHTML=sorted.map((p,i)=>`<div class="rank-row ${p.id===playerId?'me':''}"><span>${i+1}</span><span>${escapeHtml(p.name)}</span><b>${p.score}pt</b></div>`).join('')||'<div class="room-status">まだスコアがありません</div>';
  }
  function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  async function refreshRanking(){
    if(!roomCode)return;
    try{const r=await api('ranking',{code:roomCode});renderRanking(r.players);}catch(e){}
  }
  async function sendScore(){
    if(!roomCode||!playerId)return;
    try{const r=await api('score',{code:roomCode,playerId,name:playerName,score});renderRanking(r.players);}catch(e){showRoomStatus('ランキング送信に失敗しました。サーバーを確認してください。');}
  }

  document.getElementById('createRoomBtn').onclick=async()=>{
    try{playerName=document.getElementById('playerName').value.trim()||'ゲスト';const r=await api('create');roomCode=r.code;document.getElementById('roomCode').value=roomCode;const j=await api('join',{code:roomCode,name:playerName});playerId=j.playerId;renderRanking(j.players);showRoomStatus(`対戦ルーム「${roomCode}」を作成しました。ほかの人に合言葉を伝えてください。`);startRankPolling();}catch(e){showRoomStatus(e.message);}
  };
  document.getElementById('joinRoomBtn').onclick=async()=>{
    try{playerName=document.getElementById('playerName').value.trim()||'ゲスト';roomCode=document.getElementById('roomCode').value.trim().toUpperCase();if(!roomCode)throw new Error('合言葉を入力してください');const r=await api('join',{code:roomCode,name:playerName});playerId=r.playerId;renderRanking(r.players);showRoomStatus(`ルーム「${roomCode}」に参加しました。`);startRankPolling();}catch(e){showRoomStatus(e.message);}
  };
  function startRankPolling(){clearInterval(rankTimer);rankTimer=setInterval(refreshRanking,1000);}

  function renderStart(){catTag.textContent="脳トレ！早押しクイズ";stage.innerHTML=`<div class="start-panel"><div class="q-text display" style="font-size:22px;">早押しルール説明</div><div class="rules">問題文が少しずつ表示されます。わかった時点で早押しボタンを押しましょう。<br>早く押すほどボーナス得点が高くなります。押した後は制限時間内に選択肢から答えを選んでください。</div><button class="go-btn" id="startBtn">スタート</button></div>`;document.getElementById('startBtn').onclick=()=>nextQuestion();}
  function nextQuestion(){
    idx++; if(idx>=questions.length)return renderEnd(); qCount.textContent=idx+1;const q=questions[idx];catTag.textContent=q.cat;buzzedAtFraction=1;
    stage.innerHTML=`<div class="q-text" id="qText"><span id="qChars"></span><span class="cursor"></span></div><div class="buzz-wrap"><button class="buzz-btn display" id="buzzBtn">BUZZ !</button><div class="buzz-hint">わかったら押す（またはスペースキー）</div></div>`;
    const qChars=document.getElementById('qChars'),buzzBtn=document.getElementById('buzzBtn');revealChars=0;clearInterval(revealTimer);const full=q.text;
    revealTimer=setInterval(()=>{revealChars++;qChars.textContent=full.slice(0,revealChars);if(revealChars>=full.length){clearInterval(revealTimer);buzzedAtFraction=1;showChoices(q,1);}},55);
    const doBuzz=()=>{if(!buzzBtn.disabled){buzzedAtFraction=revealChars/full.length;clearInterval(revealTimer);showChoices(q,buzzedAtFraction);}};buzzBtn.onclick=doBuzz;window.onkeydown=e=>{if(e.code==='Space'){e.preventDefault();doBuzz();}};
  }
  function showChoices(q,fraction){
    const bonus=Math.max(0,Math.round(10*(1-fraction)));stage.innerHTML=`<div class="q-text" style="min-height:auto;margin-bottom:22px;">${escapeHtml(q.text)}</div><div class="timerbar"><i id="timerFill"></i></div><div class="choices" id="choicesWrap">${q.choices.map((c,i)=>`<button class="choice" data-i="${i}">${escapeHtml(c)}</button>`).join('')}</div><div class="feedback" id="feedback"></div>`;window.onkeydown=null;
    let timeLeft=5000;const fill=document.getElementById('timerFill'),startT=performance.now();function tick(now){const elapsed=now-startT,pct=Math.max(0,1-elapsed/timeLeft);fill.style.transform=`scaleX(${pct})`;if(pct<=0){lockChoices(q,-1,bonus);return;}answerTimerRAF=requestAnimationFrame(tick);}answerTimerRAF=requestAnimationFrame(tick);
    document.querySelectorAll('.choice').forEach(btn=>btn.onclick=()=>{cancelAnimationFrame(answerTimerRAF);lockChoices(q,parseInt(btn.dataset.i),bonus);});
  }
  function lockChoices(q,chosen,bonus){
    document.querySelectorAll('.choice').forEach(btn=>{const i=parseInt(btn.dataset.i);btn.disabled=true;btn.style.pointerEvents='none';if(i===q.answer)btn.classList.add('correct');else if(i===chosen)btn.classList.add('wrong');});
    const correct=chosen===q.answer,gained=correct?(10+bonus):0;score+=gained;scoreView.textContent=score;if(!roomCode)renderRanking([{id:'local',name:playerName||'あなた',score}]);sendScore();
    const fb=document.getElementById('feedback');fb.innerHTML=`<div class="verdict ${correct?'ok':'ng'} display">${chosen===-1?'⏱ 時間切れ…':(correct?`正解！ +${gained}pt`:'残念、不正解')}</div><div class="fact">${escapeHtml(q.fact)}</div><button class="next-btn" id="nextBtn">${idx<questions.length-1?'次の問題へ':'結果を見る'}</button>`;document.getElementById('nextBtn').onclick=nextQuestion;
  }
  function renderEnd(){catTag.textContent="脳トレ！早押しクイズ";let rank="初心者バズラー";if(score>=80)rank="早押しマスター";else if(score>=50)rank="なかなかの反射神経";else if(score>=25)rank="これから伸びるタイプ";sendScore();stage.innerHTML=`<div class="end-panel"><div class="display" style="color:var(--text-muted);letter-spacing:.2em;font-size:13px;">RESULT</div><div class="final-score mono">${score}</div><div class="rank display">${rank}</div><div class="rules">全5問終了！ランキングは同じ部屋の参加者とリアルタイムで共有されます。</div><button class="go-btn" id="retryBtn">もう一度遊ぶ</button></div>`;document.getElementById('retryBtn').onclick=()=>{idx=-1;score=0;scoreView.textContent=0;qCount.textContent=0;sendScore();nextQuestion();};}
  renderRanking([{id:'local',name:'あなた',score:0}]);
  renderStart();
})();

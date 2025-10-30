const Model = {
  arena: { left: 80, right: 560 },
  cup: { radius: 28, maxWater: 100 },
  roundTime: 30
};

class GameVM {
  constructor() {
    this.roundTime = 50;
    this.resultTime = 10;
    this.maxTerms = 3;
    this.currentTerm = 0;
    this.termWins = { p1:0, p2:0 };
    this.p1 = this.createPlayer(200, '#e74c3c');
    this.p2 = this.createPlayer(440, '#27ae60');
    this.timeLeft = this.roundTime;
    this.running = false;
    this.phase = 'play';
    this.lastTick = null;
    this.onUpdate = null;
    this.collisionCooldown = 0;
    this.typeMods = this.randomizeTypes();
  }

  start(){
    this.running = true;
    this.phase = 'play';
    this.timeLeft = this.roundTime;
    this.lastTick = performance.now();

    const loop = (now)=>{
      if(!this.running) return;
      const dt = (now - this.lastTick) / 1000;
      this.lastTick = now;

      this.step(dt);
      if(this.onUpdate) this.onUpdate();

      if(this.timeLeft > 0){
        requestAnimationFrame(loop);
      } else {
        this.running = false;
        this.phase = 'end';
        if(this.onUpdate) this.onUpdate();
      }
    };

    requestAnimationFrame(loop);
  }

  randomizeTypes() {
  // ゲームバランス調整―全部普通型にする場合
  return { p1: 'normal', p2: 'normal' };
  // 或いはランダム割当したい場合
  // const types = ['normal', 'sturdy'];
  // return { p1: types[Math.floor(Math.random()*types.length)], p2: types[Math.floor(Math.random()*types.length)] };
  }

  createPlayer(x, color){
    return {
    x, y: 0, vx:0, vy:0, angular:0, angularV:0,  // y, angular, angularV を追加
    water: Model.cup.maxWater, color,
    chargeTime: 0, charging:false, charged:false,
    blinkPhase: 0
  };
}

  step(dt){
    // === 移動 ===
    [this.p1, this.p2].forEach(p=>{
    p.x += p.vx * dt;
    p.y += p.vy * dt;              // 垂直方向も更新
    p.angular += p.angularV * dt;  // 回転更新
  });

    // === 摩擦減衰 ===
    this.p1.vx *= Math.pow(0.85, dt*60);
    this.p2.vx *= Math.pow(0.85, dt*60);
    [this.p1, this.p2].forEach(p=>{
      p.vy += 500 * dt;   // 重力加算（px/s^2）
      p.angularV *= Math.pow(0.85, dt*60); // 回転摩擦
  });

    // === チャージ処理 ===
    [this.p1, this.p2].forEach(p=>{
      if(p.charging){
        p.chargeTime += dt;
        if(p.chargeTime >= 3 && !p.charged){
          p.charged = true;
        }
      }
      if(p.charged){
        p.blinkPhase += dt * 8;
      }
    });

    // === 端での制限 ===
    const minX = Model.arena.left + Model.cup.radius;
    const maxX = Model.arena.right - Model.cup.radius;
    this.p1.x = Math.max(minX, Math.min(maxX, this.p1.x));
    this.p2.x = Math.max(minX, Math.min(maxX, this.p2.x));

    // === 衝突判定 ===
    const dist = Math.abs(this.p1.x - this.p2.x);
    const threshold = Model.cup.radius * 2 - 6;
    if(dist < threshold && this.collisionCooldown <= 0){
      const baseKnock = 220;
      const relativeSpeed = Math.abs(this.p1.vx - this.p2.vx);
      const speedFactor = 1 + relativeSpeed / 200;
      const knockback = baseKnock * speedFactor;

      this.p1.vx = -Math.abs(knockback);
      this.p2.vx = Math.abs(knockback);

      const overlap = threshold - dist;
      this.p1.x -= overlap/2;
      this.p2.x += overlap/2;

      const baseSpill = 8;
      this.p1.water = Math.max(0, this.p1.water - baseSpill);
      this.p2.water = Math.max(0, this.p2.water - baseSpill);
      this.collisionCooldown = 0.25;
    }

    const leftLimit = Model.arena.left + Model.cup.radius;
    const rightLimit = Model.arena.right - Model.cup.radius;

    // if(this.phase === 'play'){
    // this.p1.x = Math.max(leftLimit, Math.min(rightLimit, this.p1.x));
    // this.p2.x = Math.max(leftLimit, Math.min(rightLimit, this.p2.x));
    // }
    // p1 左端
    if(this.p1.x <= leftLimit){
        this.p1.x = leftLimit;
        this.p1.vx = -500;          // 左に吹っ飛ばす
        this.p1.vy = -200;          // 軽く跳ねる場合
        this.p1.angularV = -Math.PI*2;  // 角速度に変更
        this.phase = 'result';
        this.termWins.p2++;
        setTimeout(()=> this.startNextRound(), 800);
    }
    // // p1 右端
    // if(this.p1.x >= rightLimit){
    //     this.p1.x = rightLimit;
    //     this.p1.vx = 500;
    //     this.p1.vy = -200;
    //     this.p1.angular = Math.PI;
    //     this.phase = 'result';
    //     this.termWins.p1++;
    //     setTimeout(()=> this.startNextRound(), 800);
    // }
    // p2 左端
    // if(this.p2.x <= leftLimit){
    //     this.p2.x = leftLimit;
    //     this.p2.vx = -500;          // 左に吹っ飛ばす
    //     this.p2.vy = -200;          // 軽く跳ねる場合
    //     this.p2.angular = -Math.PI; // 回転用角度
    //     this.phase = 'result';       // 演出中として扱う
    //     this.termWins.p2++;
    //     setTimeout(()=> this.startNextRound(), 800);
    // }
    // p2 右端
    if(this.p2.x >= rightLimit){
        this.p2.x = rightLimit;
        this.p2.vx = 500;
        this.p2.vy = -200;
        this.p2.angularV = Math.PI*2;
        this.phase = 'result';
        this.termWins.p2++;
        setTimeout(()=> this.startNextRound(), 800);
    }

    this.collisionCooldown -= dt;
    this.timeLeft -= dt;
  }

  // === トントン ===
  pushLeft(isCharged=false){
    if(this.phase!=='play') return;
    const p = this.p1;
    const power = isCharged ? 240 : 160;
    p.vx += power;
    p.water = Math.max(0, p.water - (this.typeMods.p1==='sturdy'?0.3:0.6));
    p.charged = false;
    p.chargeTime = 0;
  }

  pushRight(isCharged=false){
    if(this.phase!=='play') return;
    const p = this.p2;
    const power = isCharged ? 240 : 160;
    p.vx -= power;
    p.water = Math.max(0, p.water - (this.typeMods.p2==='sturdy'?0.3:0.6));
    p.charged = false;
    p.chargeTime = 0;
  }

  // // === チャージ開始・解除 ===
  // startCharge(player){
  //   const p = this[player];
  //   if(!p.charging){
  //     p.charging = true;
  //     p.chargeTime = 0;
  //   }
  // }
  // releaseCharge(player){
  //   const p = this[player];
  //   if(p.charging){
  //     const isCharged = p.charged;
  //     p.charging = false;
  //     if(player==='p1') this.pushLeft(isCharged);
  //     else this.pushRight(isCharged);
  //   }
  // }
}

(function(){
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  const bgImg = new Image(); bgImg.src = "./assets/background.webp";
  const ramenLeftImg = new Image(); ramenLeftImg.src = "./assets/ramen_left.webp";
  const ramenRightImg = new Image(); ramenRightImg.src = "./assets/ramen_right.webp";

  const vm = new GameVM();

  const p1Fill = document.getElementById('p1Fill');
  const p2Fill = document.getElementById('p2Fill');
  const p1Water = document.getElementById('p1Water');
  const p2Water = document.getElementById('p2Water');
  const timeLeftEl = document.getElementById('timeLeft');
  document.getElementById('restartBtn').addEventListener('click', ()=>{ vm.start(); });

  vm.onUpdate = ()=>{
    timeLeftEl.textContent = Math.max(0, Math.ceil(vm.timeLeft));
    render();
    if(!vm.running && vm.phase==='end') renderEnd();

    p1Water.textContent = Math.floor(vm.p1.water);
    p2Water.textContent = Math.floor(vm.p2.water);
    p1Fill.style.width = Math.max(0, (vm.p1.water / Model.cup.maxWater) * 100) + '%';
    p2Fill.style.width = Math.max(0, (vm.p2.water / Model.cup.maxWater) * 100) + '%';
  };

  function render(){
    if (bgImg.complete && bgImg.naturalWidth > 0) ctx.drawImage(bgImg, 0, 0, w, h);
    else { ctx.fillStyle = '#f7e2c9'; ctx.fillRect(0, 0, w, h); }

    const cy = h/2 + 30;
    drawCup(vm.p1.x, cy, 'left', vm.p1);
    drawCup(vm.p2.x, cy, 'right', vm.p2);
  }

  function renderEnd(){
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0,0,w,h);
    ctx.fillStyle = '#fff';
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    const winner = vm.termWins.p1 > vm.termWins.p2 ? 'Player 1 の勝利！' :
                   vm.termWins.p2 > vm.termWins.p1 ? 'Player 2 の勝利！' : '引き分け！';
    ctx.fillText(winner, w/2, h/2 - 8);
    ctx.font = '16px sans-serif';
    ctx.fillText('リスタートボタンを押すと再戦できます', w/2, h/2 + 18);
    ctx.restore();
  }

  // === 回転描画対応 ===
  function drawCup(x, y, direction, player){
    ctx.save();
    const cupW = 72, cupH = 60;
    const centerX = x;
    const centerY = y + 30; // 元々のcy
    ctx.translate(centerX, centerY);
    ctx.rotate(player.angular);
    let alpha = 1.0;
    if(player.charged) alpha = 0.6 + 0.4 * Math.sin(player.blinkPhase);
    else if(player.charging) alpha = 0.8;
    ctx.globalAlpha = alpha;

    const img = direction === 'left' ? ramenLeftImg : ramenRightImg;
    if (img.complete && img.naturalWidth > 0) ctx.drawImage(img, -cupW/2, -cupH/2, cupW, cupH);
    else {
      ctx.fillStyle = player.color;
      ctx.fillRect(-cupW/2, -cupH/2, cupW, cupH);
    }
    ctx.restore();
  }

  window.addEventListener('keydown',(e)=>{
    if(e.code==='ShiftLeft'){ vm.pushLeft(); } 
    else if(e.code==='ShiftRight'){ vm.pushRight(); }
    if(e.code==='Space'){ if(!vm.running) vm.start(); }
  });

  document.getElementById('restartBtn').addEventListener('click', ()=>{
  // ゲーム状態を初期化
  vm.currentTerm = 0;
  vm.termWins = { p1:0, p2:0 };
  vm.p1 = vm.createPlayer(200, '#e74c3c');
  vm.p2 = vm.createPlayer(440, '#27ae60');
  vm.timeLeft = vm.roundTime;
  vm.phase = 'play';
  vm.running = false;
  vm.collisionCooldown = 0;

  // そのあとでゲームループをスタート
  vm.start();
  });
  
})();

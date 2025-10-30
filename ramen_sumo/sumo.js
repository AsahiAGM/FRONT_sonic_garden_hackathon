const Model = {
  arena: { left: 80, right: 560 },
  cup: { radius: 28, maxWater: 100 },
  roundTime: 30
};

class GameVM {
  constructor() {
    this.roundTime = 50;      // term本体時間
    this.resultTime = 10;     // 結果表示時間
    this.maxTerms = 3;        // 3本勝負
    this.currentTerm = 0;
    this.termWins = { p1:0, p2:0 };
    this.p1 = { x: 200, vx:0, water: Model.cup.maxWater, color: '#e74c3c' };
    this.p2 = { x: 440, vx:0, water: Model.cup.maxWater, color: '#27ae60' };
    this.timeLeft = this.roundTime;
    this.running = false;
    this.phase = 'play';      // 'play','result','end'
    this.lastTick = null;
    this.onUpdate = null;
    this.collisionCooldown = 0;
    this.typeMods = this.randomizeTypes();
  }

  randomizeTypes(){
    const types = [ 'balanced','sturdy','splashy' ];
    return { p1: types[Math.floor(Math.random()*types.length)], p2: types[Math.floor(Math.random()*types.length)] };
  }

  start(){
    this.currentTerm = 0;
    this.termWins = { p1:0, p2:0 };
    this.initTerm();
    this.running = true;
    this.lastTick = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  }

  initTerm(){
    this.p1.x = 200; this.p1.vx = 0; this.p1.water = Model.cup.maxWater;
    this.p2.x = 440; this.p2.vx = 0; this.p2.water = Model.cup.maxWater;
    this.timeLeft = this.roundTime;
    this.phase = 'play';
    this.collisionCooldown = 0;
    this.typeMods = this.randomizeTypes();
  }

  loop(now){
    if(!this.running) return;
    const dt = Math.min(0.05,(now - this.lastTick)/1000);
    this.lastTick = now;

    if(this.phase === 'play'){
      this.step(dt);
      if(this.timeLeft <= 0){
        this.phase = 'result';
        this.timeLeft = this.resultTime;

        if(this.p1.water > this.p2.water) this.termWins.p1++;
        else if(this.p2.water > this.p1.water) this.termWins.p2++;
      }
    } else if(this.phase === 'result'){
      this.timeLeft -= dt;
      if(this.timeLeft <= 0){
        this.currentTerm++;
        if(this.currentTerm < this.maxTerms){
          this.initTerm();
        } else {
          this.phase = 'end';
          this.running = false;
        }
      }
    }

    if(this.onUpdate) this.onUpdate();
    if(this.running || this.phase==='result') requestAnimationFrame(this.loop.bind(this));
  }

  step(dt){
    this.p1.x += this.p1.vx * dt;
    this.p2.x += this.p2.vx * dt;

    const minX = Model.arena.left + Model.cup.radius;
    const maxX = Model.arena.right - Model.cup.radius;
    this.p1.x = Math.max(minX, Math.min(maxX, this.p1.x));
    this.p2.x = Math.max(minX, Math.min(maxX, this.p2.x));

    this.p1.vx *= Math.pow(0.85, dt*60);
    this.p2.vx *= Math.pow(0.85, dt*60);

    const dist = Math.abs(this.p1.x - this.p2.x);
    const threshold = Model.cup.radius * 2 - 6;
    if(dist < threshold && this.collisionCooldown <= 0){
      const knockback = 160;
      this.p1.vx = -Math.abs(knockback);
      this.p2.vx = Math.abs(knockback);

      const overlap = threshold - dist;
      this.p1.x -= overlap/2;
      this.p2.x += overlap/2;

      const baseSpill = 8;
      const p1mod = this.typeMods.p1 === 'sturdy' ? 0.7 : this.typeMods.p1 === 'splashy' ? 1.2 : 1.0;
      const p2mod = this.typeMods.p2 === 'sturdy' ? 0.7 : this.typeMods.p2 === 'splashy' ? 1.2 : 1.0;
      this.p1.water = Math.max(0, this.p1.water - baseSpill*p1mod);
      this.p2.water = Math.max(0, this.p2.water - baseSpill*p2mod);

      this.collisionCooldown = 0.25;
    }
    this.collisionCooldown -= dt;
    this.timeLeft -= dt;
  }

  pushLeft(){
    if(this.phase!=='play') return;
    this.p1.vx += 120;
    this.p1.water = Math.max(0, this.p1.water - (this.typeMods.p1==='sturdy'?0.3:0.6));
  }

  pushRight(){
    if(this.phase!=='play') return;
    this.p2.vx -= 120;
    this.p2.water = Math.max(0, this.p2.water - (this.typeMods.p2==='sturdy'?0.3:0.6));
  }

  pushLeft(){
    if(!this.running) return;
    this.p1.vx += 120;
    this.p1.water = Math.max(0, this.p1.water - (this.typeMods.p1==='sturdy'?0.3:0.6));
  }
  pushRight(){
    if(!this.running) return;
    this.p2.vx -= 120;
    this.p2.water = Math.max(0, this.p2.water - (this.typeMods.p2==='sturdy'?0.3:0.6));
  }
}

(function(){
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  // === 画像の読み込み ===
  const bgImg = new Image();
  bgImg.src = "./assets/background.webp";
  const ramenLeftImg = new Image();
  ramenLeftImg.src = "./assets/ramen_left.webp";
  const ramenRightImg = new Image();
  ramenRightImg.src = "./assets/ramen_right.webp";

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

    if(!vm.running){
      p1Water.textContent = Math.floor(vm.p1.water);
      p2Water.textContent = Math.floor(vm.p2.water);
      p1Fill.style.width = Math.max(0, (vm.p1.water / Model.cup.maxWater) * 100) + '%';
      p2Fill.style.width = Math.max(0, (vm.p2.water / Model.cup.maxWater) * 100) + '%';
      renderEnd();
    } else {
      p1Fill.style.width = '0%';
      p2Fill.style.width = '0%';
      p1Water.textContent = '';
      p2Water.textContent = '';
    }
  };

  function render(){
    // === 背景画像 ===
    if (bgImg.complete && bgImg.naturalWidth > 0) {
      ctx.drawImage(bgImg, 0, 0, w, h);
    } else {
      ctx.fillStyle = '#f7e2c9';
      ctx.fillRect(0, 0, w, h);
    }

    const cx = w/2, cy = h/2 + 30;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(cx-2, cy-70, 4, 120);

    drawCup(vm.p1.x, cy, 'left');
    drawCup(vm.p2.x, cy, 'right');
  }

  function renderEnd(){
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0,0,w,h);
    ctx.fillStyle = '#fff';
    ctx.font = '28px sans-serif';
    ctx.textAlign = 'center';
    const winner = vm.p1.water > vm.p2.water ? 'Player 1 の勝ち！' :
                   vm.p2.water > vm.p1.water ? 'Player 2 の勝ち！' : '引き分け！';
    ctx.fillText(winner, w/2, h/2 - 8);
    ctx.font = '16px sans-serif';
    ctx.fillText('リスタートボタンを押すと再戦できます', w/2, h/2 + 18);
    ctx.restore();
  }

  // === ラーメン画像を描画する ===
  function drawCup(x, y, direction){
    ctx.save();
    const cupW = 72, cupH = 60;
    const left = x - cupW / 2;
    const top = y - cupH / 2 - 10;

    const img = direction === 'left' ? ramenLeftImg : ramenRightImg;
    if (img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, left, top, cupW, cupH);
    } else {
      ctx.fillStyle = direction === 'left' ? '#e74c3c' : '#27ae60';
      ctx.fillRect(left, top, cupW, cupH);
    }
    ctx.restore();
  }

  // === 操作 ===
  window.addEventListener('keydown',(e)=>{
    if(e.code==='ShiftLeft'){ vm.pushLeft(); } 
    else if(e.code==='ShiftRight'){ vm.pushRight(); }
    if(e.code==='Space'){ if(!vm.running) vm.start(); }
  });

  vm.start();
})();

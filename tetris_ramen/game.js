const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const TIME = 3;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('scoreDisplay');

canvas.width = 500;
canvas.height = 700;

const FIELD_OFFSET_X = 100;
const FIELD_OFFSET_Y = 100;

const field = [];
for (let y = 0; y < ROWS; y++) {
    field[y] = [];
    for (let x = 0; x < COLS; x++) {
        field[y][x] = 0;
    }
}

let gameIntervalId;
let score = 0;
const GAME_TIME_LIMIT_MS = TIME * 60 * 1000;
const GAME_SPEED_MS = 500;
const TOTAL_TICKS = GAME_TIME_LIMIT_MS / GAME_SPEED_MS;

let waterLevel = ROWS;
const waterRiseAmount = ROWS / TOTAL_TICKS;
const WATER_COLOR = 'rgba(255, 100, 0, 0.7)';
const WATER_COLOR_FIELD = 'rgba(255, 100, 0, 0.5)';

const INGREDIENT_BONUS_PER_BLOCK = 50;
let comboMessage = "";
let comboMessageExpireTime = 0;

// ★湯気用変数
let steamClearTime = 0;
let steamClearCooldown = 0;
const STEAM_MAX_OPACITY = 0.6;
const STEAM_START_PERCENT = 0.166;

const assets = {};

const assetSources = {
    'noodleBlock': 'noodle-block',
    'meatBlock': 'meat-block', 'eggBlock': 'egg-block', 'shrimpBlock': 'shrimp-block', 'leekBlock': 'leek-block',
};

let assetsLoadedCount = 0;
const totalAssets = Object.keys(assetSources).length;

function loadAssets() {
    return new Promise((resolve, reject) => {
        let assetsToLoad = Object.keys(assetSources).length;
        if (assetsToLoad === 0) {
            resolve();
            return;
        }

        let assetsLoaded = 0;
        let errors = [];

        for (const key in assetSources) {
            const elementId = assetSources[key];
            const imgElement = document.getElementById(elementId);

            if (!imgElement) {
                const errorMsg = `アセットエラー: HTMLに <img id="${elementId}"> が見つかりません。`;
                console.error(errorMsg);
                errors.push(errorMsg);
                assetsToLoad--;
                continue;
            }
            
            if (!imgElement.src || imgElement.src === window.location.href || imgElement.src.endsWith("#")) {
                const errorMsg = `アセットエラー: <img id="${elementId}"> の src 属性が空か不正です。`;
                console.error(errorMsg);
                errors.push(errorMsg);
                assetsToLoad--;
                continue;
            }

            const img = new Image();
            img.src = imgElement.src;

            img.onload = () => {
                assets[key] = img;
                assetsLoaded++;
                if (assetsLoaded === assetsToLoad) {
                    if (errors.length > 0) {
                        reject(new Error("いくつかのアセット読み込みに失敗:\n" + errors.join('\n')));
                    } else {
                        resolve();
                    }
                }
            };

            img.onerror = () => {
                const errorMsg = `アセットエラー: <img id="${elementId}"> (URL: ${imgElement.src}) の読み込みに失敗しました。`;
                console.error(errorMsg);
                errors.push(errorMsg);
                assetsLoaded++;
                if (assetsLoaded === assetsToLoad) {
                    reject(new Error("いくつかのアセット読み込みに失敗:\n" + errors.join('\n')));
                }
            };
        }
    });
}

// --- 2. ブロックの定義 ---
const MINO_SHAPES_DATA = [
    { shape: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]], color: 'cyan', assetKey: 'noodleBlock', type: 'noodle' },
    { shape: [[1, 1], [1, 1]], color: 'yellow', assetKey: 'noodleBlock', type: 'noodle' },
    { shape: [[0, 1, 0], [1, 1, 1], [0, 0, 0]], color: 'purple', assetKey: 'noodleBlock', type: 'noodle' },
    { shape: [[0, 1, 1], [1, 1, 0], [0, 0, 0]], color: 'green', assetKey: 'noodleBlock', type: 'noodle' },
    { shape: [[1, 1, 0], [0, 1, 1], [0, 0, 0]], color: 'red', assetKey: 'noodleBlock', type: 'noodle' },
    { shape: [[1, 0, 0], [1, 1, 1], [0, 0, 0]], color: 'blue', assetKey: 'noodleBlock', type: 'noodle' },
    { shape: [[0, 0, 1], [1, 1, 1], [0, 0, 0]], color: 'orange', assetKey: 'noodleBlock', type: 'noodle' },
    { shape: [[1, 1], [1, 0]], color: '#d46a00', assetKey: 'meatBlock', type: 'meat' },
    { shape: [[0, 1], [1, 1]], color: '#ffdd00', assetKey: 'eggBlock', type: 'egg' },
    { shape: [[1]], color: '#ff8c00', assetKey: 'shrimpBlock', type: 'shrimp' },
    { shape: [[1, 1], [0, 1]], color: '#00cc00', assetKey: 'leekBlock', type: 'leek' }
];

let currentMinoData, currentMino, currentColor, currentAssetKey, currentType, currentX, currentY, nextMinoData;

// gameOver
function gameOver(isTimeUp) {
    clearInterval(gameIntervalId);
    const message = isTimeUp ? "TIME'S UP!" : "GAME OVER";
    const subMessage = isTimeUp ? "カップ麺 完成！" : "ブロックが詰まった！";
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, canvas.height / 2 - 60, canvas.width, 120);
    ctx.fillStyle = 'white';
    ctx.font = '40px "MS Gothic"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(message, canvas.width / 2, canvas.height / 2 - 20);
    ctx.font = '20px "MS Gothic"';
    ctx.fillText(subMessage, canvas.width / 2, canvas.height / 2 + 20);
    alert(`${message}\n${subMessage}\nFinal Score: ${score}`);
}

// spawnNewMino
function spawnNewMino() {
    currentMinoData = nextMinoData;
    const typeIndex = Math.floor(Math.random() * MINO_SHAPES_DATA.length);
    nextMinoData = MINO_SHAPES_DATA[typeIndex];
    currentMino = currentMinoData.shape;
    currentColor = currentMinoData.color;
    currentAssetKey = currentMinoData.assetKey;
    currentType = currentMinoData.type;
    currentX = Math.floor(COLS / 2) - Math.floor(currentMino[0].length / 2);
    currentY = 0;
    if (checkCollision(currentMino, currentX, currentY)) {
        gameOver(false);
    }
}

// --- 3. 描画関数 (★大幅修正) ---
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // テトリスフィールドの背景は「描画しない」 (Canvasの白をそのまま使う)
    
    // 3. 水位によってフィールドに描画される水
    const waterY = Math.floor(waterLevel) * BLOCK_SIZE + FIELD_OFFSET_Y;
    const waterHeight = (ROWS - Math.floor(waterLevel)) * BLOCK_SIZE;
    ctx.fillStyle = WATER_COLOR_FIELD;
    ctx.fillRect(FIELD_OFFSET_X, waterY, COLS * BLOCK_SIZE, waterHeight);
    
    // 4. 固定されたブロックを描画
    for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
            if (field[y][x]) {
                const b = field[y][x];
                const dX = x * BLOCK_SIZE + FIELD_OFFSET_X, dY = y * BLOCK_SIZE + FIELD_OFFSET_Y;
                if (assets[b.assetKey]) ctx.drawImage(assets[b.assetKey], dX, dY, BLOCK_SIZE, BLOCK_SIZE);
                else { ctx.fillStyle = b.color; ctx.fillRect(dX, dY, BLOCK_SIZE, BLOCK_SIZE); }
            }
        }
    }
    
    // 5. 現在落ちているミノを描画
    for (let y = 0; y < currentMino.length; y++) {
        for (let x = 0; x < currentMino[y].length; x++) {
            if (currentMino[y][x]) {
                const dX = (currentX + x) * BLOCK_SIZE + FIELD_OFFSET_X, dY = (currentY + y) * BLOCK_SIZE + FIELD_OFFSET_Y;
                if (assets[currentAssetKey]) ctx.drawImage(assets[currentAssetKey], dX, dY, BLOCK_SIZE, BLOCK_SIZE);
                else { ctx.fillStyle = currentColor; ctx.fillRect(dX, dY, BLOCK_SIZE, BLOCK_SIZE); }
            }
        }
    }

    // 6. 湯気エフェクト
    if (Date.now() > steamClearTime) {
        const percentFull = (ROWS - waterLevel) / ROWS;
        let steamOpacity = 0;
        
        if (percentFull > STEAM_START_PERCENT) {
            const steamRange = 1.0 - STEAM_START_PERCENT;
            const currentSteamPercent = (percentFull - STEAM_START_PERCENT) / steamRange;
            steamOpacity = currentSteamPercent * STEAM_MAX_OPACITY;
        }

        if (steamOpacity > 0.01) {
            ctx.fillStyle = `rgba(255, 255, 255, ${steamOpacity})`;
            ctx.fillRect(FIELD_OFFSET_X, FIELD_OFFSET_Y, COLS * BLOCK_SIZE, ROWS * BLOCK_SIZE);
        }
    }

    const GAUGE_X = 415, GAUGE_WIDTH = 55, GAUGE_MAX_HEIGHT = 200;
    const GAUGE_TOP_Y = 340;
    const GAUGE_Y_START = GAUGE_TOP_Y + GAUGE_MAX_HEIGHT; 

    // (A) ゲージの背景 (Canvasが白なので、少し色をつける)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'; // 薄いグレー
    ctx.fillRect(GAUGE_X, GAUGE_TOP_Y, GAUGE_WIDTH, GAUGE_MAX_HEIGHT);

    // (B) ゲージのテキスト
    ctx.fillStyle = '#000000'; // 黒い文字
    ctx.font = '12px "Courier New"';
    ctx.textAlign = 'center';
    const textX = GAUGE_X + GAUGE_WIDTH / 2;
    ctx.fillText("FULL", textX, GAUGE_TOP_Y - 5);
    ctx.fillText("START", textX, GAUGE_Y_START + 15);

    // (C) 現在の水位
    const percentFull = (ROWS - waterLevel) / ROWS;
    const gaugeHeight = percentFull * GAUGE_MAX_HEIGHT;
    const gaugeY = GAUGE_Y_START - gaugeHeight;
    ctx.fillStyle = WATER_COLOR;
    ctx.fillRect(GAUGE_X, gaugeY, GAUGE_WIDTH, gaugeHeight);

    // 9. Nextブロック
    if (nextMinoData) {
        const NEXT_BG_X = 400; 
        const NEXT_BG_Y = 150;
        const NEXT_BG_WIDTH = 80;
        const NEXT_BG_HEIGHT = 100;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'; // 薄いグレー
        ctx.fillRect(NEXT_BG_X, NEXT_BG_Y, NEXT_BG_WIDTH, NEXT_BG_HEIGHT);

        // Nextブロック自体の描画
        const NEXT_BLOCK_SIZE = 25;
        const mino = nextMinoData.shape, assetKey = nextMinoData.assetKey, color = nextMinoData.color;
        const offsetX = NEXT_BG_X + (NEXT_BG_WIDTH - mino[0].length * NEXT_BLOCK_SIZE) / 2; 
        const offsetY = NEXT_BG_Y + (NEXT_BG_HEIGHT - mino.length * NEXT_BLOCK_SIZE) / 2;

        for (let y = 0; y < mino.length; y++) {
            for (let x = 0; x < mino[y].length; x++) {
                if (mino[y][x]) {
                    const dX = offsetX + x * NEXT_BLOCK_SIZE;
                    const dY = offsetY + y * NEXT_BLOCK_SIZE;
                    if (assets[assetKey]) ctx.drawImage(assets[assetKey], dX, dY, NEXT_BLOCK_SIZE, NEXT_BLOCK_SIZE);
                    else { ctx.fillStyle = color; ctx.fillRect(dX, dY, NEXT_BLOCK_SIZE, NEXT_BLOCK_SIZE); }
                }
            }
        }
    }

    // 10. コンボメッセージ
    if (Date.now() < comboMessageExpireTime) {
        ctx.fillStyle = '#FFFF00';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.font = '30px "MS Gothic", sans-serif';
        ctx.textAlign = 'center';
        const textX = FIELD_OFFSET_X + (COLS * BLOCK_SIZE) / 2;
        const textY = FIELD_OFFSET_Y + (ROWS * BLOCK_SIZE) / 2;
        ctx.strokeText(comboMessage, textX, textY);
        ctx.fillText(comboMessage, textX, textY);
    }

    // 11. 湯気クリアメッセージ
    if (Date.now() < steamClearTime) {
        ctx.fillStyle = '#FFFFFF';
        ctx.strokeStyle = '#3333FF';
        ctx.lineWidth = 4;
        ctx.font = '30px "MS Gothic", sans-serif';
        ctx.textAlign = 'center';
        const textX = FIELD_OFFSET_X + (COLS * BLOCK_SIZE) / 2;
        const textY = FIELD_OFFSET_Y + 40;
        
        ctx.strokeText("Fuu Fuu!", textX, textY);
        ctx.fillText("Fuu Fuu!", textX, textY);
    }
    
    scoreEl.textContent = score;
}

// --- 4. 衝突判定 ---
function checkCollision(mino, x, y) {
    for (let row = 0; row < mino.length; row++) {
        for (let col = 0; col < mino[row].length; col++) {
            if (mino[row][col]) {
                let newX = x + col, newY = y + row;
                if (newX < 0 || newX >= COLS) return true;
                if (newY >= Math.floor(waterLevel)) return true;
                if (newY >= 0 && field[newY] && field[newY][newX]) return true;
            }
        }
    }
    return false;
}

// --- 5. ブロック固定 ---
function fixMino() {
    for (let y = 0; y < currentMino.length; y++) {
        for (let x = 0; x < currentMino[y].length; x++) {
            if (currentMino[y][x]) {
                let fieldX = currentX + x, fieldY = currentY + y;
                if (fieldY >= 0 && fieldY < ROWS && fieldX >= 0 && fieldX < COLS) {
                    field[fieldY][fieldX] = {
                        color: currentColor, assetKey: currentAssetKey, type: currentType
                    };
                }
            }
        }
    }
}

// --- 6. ライン消去 ---
function checkLines() {
    let linesCleared = 0;
    let ingredientBlocksInClear = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
        const isLineFull = field[y].every(cell => cell !== 0);
        if (isLineFull) {
            linesCleared++;
            for (let x = 0; x < COLS; x++) {
                if (field[y][x].type !== 'noodle') {
                    ingredientBlocksInClear++;
                }
            }
            field.splice(y, 1);
            field.unshift(new Array(COLS).fill(0));
            y++;
        }
    }
    if (linesCleared > 0) {
        const SCORE_MAP = [0, 100, 300, 500, 800]; 
        let lineScore = SCORE_MAP[linesCleared];
        score += lineScore;
        if (ingredientBlocksInClear > 0) {
            let comboBonus = ingredientBlocksInClear * INGREDIENT_BONUS_PER_BLOCK;
            score += comboBonus;
            comboMessage = `INGREDIENT COMBO x${ingredientBlocksInClear}!`;
            comboMessageExpireTime = Date.now() + 2000;
        }
        scoreEl.textContent = score;
    }
}

// --- 7. ブロック回転 ---
function rotate(mino) {
    let m = mino.length;
    let transposedMino = mino[0].map((_, c) => mino.map(r => r[c]));
    let rotatedMino = transposedMino.map(row => row.reverse());
    return rotatedMino;
}

// --- 8. ゲームロジック ---
function drop() {
    if (!checkCollision(currentMino, currentX, currentY + 1)) {
        currentY++;
    } else {
        fixMino(); 
        checkLines();
        spawnNewMino(); 
    }
}

function gameLoop() {
    waterLevel -= waterRiseAmount; 
    if (waterLevel <= 0) {
        waterLevel = 0;
        draw(); 
        gameOver(true);
        return;
    }
    drop();
    draw();
}

// --- キーボード操作 ---
document.addEventListener('keydown', (e) => {
    if (!gameIntervalId) return;

    const gameKeys = ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Space'];

    if (!gameKeys.includes(e.code)) {
        return;
    }
    e.preventDefault();

    if (e.code === 'ArrowLeft') {
        if (!checkCollision(currentMino, currentX - 1, currentY)) currentX--;
    } else if (e.code === 'ArrowRight') {
        if (!checkCollision(currentMino, currentX + 1, currentY)) currentX++;
    } else if (e.code === 'ArrowDown') {
        drop();
    } else if (e.code === 'ArrowUp') {
        const rotatedMino = rotate(currentMino);
        if (!checkCollision(rotatedMino, currentX, currentY)) currentMino = rotatedMino;
        else if (!checkCollision(rotatedMino, currentX - 1, currentY)) { currentMino = rotatedMino; currentX--; }
        else if (!checkCollision(rotatedMino, currentX + 1, currentY)) { currentMino = rotatedMino; currentX++; }
    } else if (e.code === 'Space') {
        if (Date.now() > steamClearCooldown) {
            console.log("Fuu Fuu! Steam Clear!");
            steamClearTime = Date.now() + 2000;
            steamClearCooldown = Date.now() + 5000;
        }
    }
    
    draw();
});

// --- 9. ゲーム開始 ---
alert("1分経過すると湯気が出始めます。「スペースバー」で湯気を晴らしましょう！（5秒に1回）");

loadAssets().then(() => {
    console.log("Assets loaded.");
    const typeIndex = Math.floor(Math.random() * MINO_SHAPES_DATA.length);
    nextMinoData = MINO_SHAPES_DATA[typeIndex];
    spawnNewMino(); 
    gameIntervalId = setInterval(gameLoop, GAME_SPEED_MS); 
    draw();
}).catch(err => {
    console.error("アセット読み込みの致命的エラー:", err);
    alert("アセットの読み込みに失敗しました。\n\n詳細:\n" + err.message + "\n\nHTMLのimgタグのIDとSRC属性を確認してください。");
    
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'red';
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText("アセット読み込みエラー", canvas.width / 2, canvas.height / 2);
});

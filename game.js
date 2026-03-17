// Lấy các phần tử từ HTML
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Cấu hình game ---
const plr_size = 70;
const canvas_width = canvas.width;
const canvas_height = canvas.height;

const ground_height = 120; 
const plr_y0 = canvas_height - ground_height - plr_size + 7; // Đảm bảo nhân vật đứng trên mặt đất xanh
const plr_speed = 8;
const FIXED_UPDATE_STEP = 1000 / 60; // 60 FPS cho logic game
// --- Jump Physic ---
const gravity = 0.5;
const jump_power = -12; 

// --- Thông số Vật phẩm Object ---
const star_size = 70;
const flag_width = 70; const flag_height = 80;
const min_respawn_distance = 150; 
const gameover_ui_width = canvas_width / 1.8 + 70 ; const gameover_ui_height = canvas_height / 2.25;

// --- Trạng thái Vật phẩm Object ---
let star = {
    x: 0, y: 0,
    active: false,
    width: star_size,
    height: star_size,
};

let flag = {
    x: 0, y: plr_y0 + plr_size - flag_height , 
    active: false,
    width: flag_width,
    height: flag_height,
};

let gameOverUI = {
    x: canvas_width / 2 - gameover_ui_width / 2,
    y: canvas_height / 2 - gameover_ui_height / 2 - 20,
    width: gameover_ui_width,
    height: gameover_ui_height,
};
// Hàm random số nguyên
function getRandom(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Đối tượng người chơi (Player)
let player = {
    x: canvas_width / 2 - plr_size / 2, y: plr_y0, 
    width: plr_size,
    height: plr_size,
    dx: 0, // Hướng di chuyển ngang (-1: Trái, 1: Phải, 0: Đứng yên)
    dy: 0, // Nhảy hoặc rơi
    isOnGround: true, 
    state: 'stand',
    direction: 'right', 
};


const keysPressed = {}; 
let isAssetsLoaded = false;
const asset = {};

const IMAGE_SOURCES = { 
    // Ảnh nhân vật
    player_stand: 'Asset/Stand.png', player_right: 'Asset/Right.png', player_left: 'Asset/Left.png',  
    player_jump: 'Asset/Jump.png', player_on_air: 'Asset/OnAir.png',   
    player_happy : 'Asset/Happy.png', player_over: 'Asset/GameOver.png',
    // Ảnh Vật phẩm Object
    flag: 'Asset/Flag.png',
    star: 'Asset/Star.png',
    shield: 'Asset/Shield.png', 

    // Ảnh particle
    star_particle: 'Asset/StarParticle.png',

    // Ảnh vật phẩm Buff

    // Ảnh vật Danger
    rock1: 'Asset/Rock1.png', rock2: 'Asset/Rock2.png', rock3: 'Asset/Rock3.png', 
    boulder: 'Asset/Boulder.png',
    spike1: 'Asset/Spike1.png', spike2: 'Asset/Spike2.png',

    // Ảnh Ground
    ground: 'Asset/Ground.png', 

    // Ảnh UI khác 
    game_over_ui: 'Asset/GameOverGUI.png',
};

// Config Đá rời
let rockSpawnTimer = 50; // Kích hoạt spawn ngay lần đầu
let wave = 1; let score = 0; let highscore = 0;
const rocks = []; let alive = true;

const rock_types = {
    'light_gray_rock': { 
        chance: 60, size: 75, 
        assetKey: 'rock1' 
    }, 
    'dark_gray_rock': { 
        chance: 30, size: 75, 
        assetKey: 'rock2' 
    }, 
    'brown_rock': { 
        chance: 10, size: 65, 
        assetKey: 'rock3' 
    }, 
};

// --- Hàm khởi tạo Vật phẩm Object ---
function spawnStar() {
    star.active = true;
    star.x = getRandom(20, canvas_width - star_size - 20); 
    
    const minStarY = plr_y0 - star_size - 25; 
    const maxStarY = plr_y0 - star_size - 70; 
    star.y = getRandom(maxStarY, minStarY); 
}

function spawnFlag() {
    flag.active = true;
    let zoneX;
    const zoneMin = player.x - min_respawn_distance;
    const zoneMax = player.x + player.width + min_respawn_distance;

    // Lặp cho đến khi tìm được vị trí đủ xa player
    do {
        zoneX = getRandom(20, canvas_width - flag_width - 20);
        let isTooClose = false ;
        if (zoneX < zoneMax && (zoneX + flag_width) > zoneMin) { 
            isTooClose = true ; }
        if (!isTooClose) { break ; }
    } while (true);   
    flag.x = zoneX;
}

// Khởi tạo Vật phẩm Object
function generateItems() {
    spawnStar();
    spawnFlag();
    console.log("Items initialized : Vật phẩm đã được khởi tạo");
}

// --- Hàm hiệu ứng hạt ---
const particles = []; // Table lưu trữ các hạt
function createParticle(x, y, config = {}, count = 1) {
    const newParticles = []; // Table lưu trữ các hạt mới
    const particleType = config.type || 'bloom'; // Mặc định là type bloom

    // Hàm tạo một hạt đơn
    const createOneParticle = () => {
        const angle = Math.random() * Math.PI * 2;
        const baseSpeed = config.speed !== undefined ? config.speed : 4; 
        const life = config.life !== undefined ? config.life : 60; 
        
        let p = {
            x: x, y: y,
            life: life, maxLife: life,
            type: particleType, 
        };
        
        let currentSpeed = baseSpeed;
        let radius;
        
        // Cấu hình dựa trên type
        if (particleType === 'bloom') { 
            // Hiệu ứng bloom (hạt nhỏ, tốc độ ngẫu nhiên)
            currentSpeed = Math.random() * 3 + 1; 
            radius = Math.random() * 4 + 2;
            p.radius = radius;
            p.color = config.color !== undefined ? config.color : `rgba(255, 255, 0, 1)`;
        } else if (particleType === 'image') {
            // Mảnh vỡ, có giảm tốc độ dọc 
            const verticalMultiplier = config.verticalMultiplier !== undefined ? config.verticalMultiplier : 0.5; 
            p.imageKey = config.imageKey;
            p.startScale = config.startScale !== undefined ? config.startScale : 0.5;
            p.endScale = config.endScale !== undefined ? config.endScale : 0.0;
        } else {
             // Các loại hạt khác như smoke, fire
             radius = config.radius !== undefined ? config.radius : (Math.random() * 4 + 2); 
             p.radius = radius;
             p.color = config.color !== undefined ? config.color : `rgba(255, 255, 255, 1)`;
        }

        if (p.dx === undefined) {
             const verticalMultiplier = 1.0; 
             p.dx = Math.cos(angle) * currentSpeed;
             p.dy = Math.sin(angle) * currentSpeed * verticalMultiplier;
        }
        
        return p;
    };
    for (let i = 0; i < count; i++) {
        newParticles.push(createOneParticle());
    } 
    return newParticles;
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.dx; p.y += p.dy;
        p.life = p.life - 1;

        const progress = 1 - (p.life / p.maxLife); 

        if (p.type === 'image') {
            p.scale = p.startScale + (p.endScale - p.startScale) * progress;
            p.opacity = 1 - progress; 
        } else if (p.type === 'bloom') {
            const opacity = p.life / p.maxLife; 
            const g = Math.min(255, Math.floor(255 * opacity + 165 * (1 - opacity))); // Từ vàng sang cam 
            p.color = `rgba(255, ${g}, 0, ${opacity})`;
        } else {
            // Logic update chung hoặc cho các loại hạt khác
            p.opacity = p.life / p.maxLife;
        }
        
        if (p.life <= 0) {
            particles.splice(i, 1); // Xóa hạt
        }
    }
}

function drawParticle(p) {
    // Reset shadow để đảm bảo các hạt không bị ảnh hưởng bởi shadow của nhau
    ctx.shadowBlur = 0; 
    ctx.shadowColor = 'transparent';

    if (p.type === 'bloom') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();

    } else if (p.type === 'image') {
        const img = asset[p.imageKey];
        if (img) {
            ctx.globalAlpha = p.opacity || 1;
            const size = (p.scale || 1) * star_size; 
            const x = p.x - size / 2;
            const y = p.y - size / 2;
            ctx.drawImage(img, x, y, size, size);
            ctx.globalAlpha = 1; 
        }
    } else {
        // --- Hạt mặc định (Hình tròn đơn giản) ---
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius || 3, 0, Math.PI * 2);
        ctx.fillStyle = p.color || `rgba(255, 255, 255, ${p.opacity || 1})`;
        ctx.fill();
    }
}

function drawParticles() {
    ctx.save();
     // Đảm bảo không có shadow toàn cục ảnh hưởng đến hạt
    ctx.shadowBlur = 0; 
    ctx.shadowColor = 'transparent';

    for (const p of particles) {
        drawParticle(p);
    }
    // Đặt lại các thuộc tính 
    ctx.restore();
}

function drawGameOver() {
        const gameOverImg = asset.game_over_ui;
        if (gameOverImg && gameOverImg.complete) {
            ctx.drawImage(gameOverImg, gameOverUI.x, gameOverUI.y, gameOverUI.width, gameOverUI.height);
        }
}

function getRockType() {
    const roll = Math.random() * 100;
    if (roll < rock_types.light_gray_rock.chance) {
        return 'light_gray_rock'; 
    } else if (roll < rock_types.light_gray_rock.chance + rock_types.dark_gray_rock.chance) {
        return 'dark_gray_rock';
    } else {
        return 'brown_rock';
    }
}

let lastNum = 0; // Tránh trùng lặp vị trí 
function spawnRockWave() {
    const rocksToSpawn = Math.floor(1 + wave * 0.5); 
    console.log(`Bắt đầu Wave ${wave}: Thả ${rocksToSpawn} viên đá.`);
    for (let i = 0; i < rocksToSpawn; i++) {
        setTimeout(() => {} , 3000 - wave * 100) // 
        const rockTypeKey = getRockType(); 
        const rockConfig = rock_types[rockTypeKey];
        const size = rockConfig.size + getRandom(-2, 2) ;
        const xdivide = (canvas_width - player.width * 2) / 7 ; 
        let numDivide = getRandom(0,6);
        if (numDivide === lastNum) {
            if (numDivide === 0 || numDivide === 6) {
                numDivide = getRandom(1,5);
            } else { numDivide = lastNum + 1; }
            }
        lastNum = numDivide;

        const rock = {
            x: numDivide * xdivide + getRandom(- xdivide/5 , xdivide/5) + player.width * 1.5 , 
            y: -size - getRandom(0,300),
            width: size, height: size * (148/135),
            type: rockTypeKey,
            assetKey: rockConfig.assetKey,
            angle: getRandom(0,10) * 0.1 * Math.PI * 2, 
            rotationSpeed: 0.02,
            yspeed: 2,
        };
        rocks.push(rock);
    }
}

function updateRocks() {
    for (let i = rocks.length - 1; i >= 0; i--) {
        const rock = rocks[i];
        rock.y += rock.yspeed + wave * 0.2;

        if (rock.rotationSpeed) {
            rock.angle += rock.rotationSpeed;
            if (rock.angle > Math.PI * 2) {
                rock.angle -= Math.PI * 2;
            } else if (rock.angle < 0) {
                rock.angle += Math.PI * 2;
            }
        }
        // Kiểm tra va chạm (Tạm thời chưa xử lý va chạm với player)
        if (checkCollision(player, rock) && rock.y + rock.height < player.y + player.height/1.5) { 
            alive = false;
        }

        if (rock.y > canvas_height + rock.height) {
            rocks.splice(i, 1); // Xóa đá rơi
        }
    }
}

function drawRock(rock) {
    const rockImg = asset[rock.assetKey];
    ctx.save();
    
    // Dịch chuyển tâm canvas về trung tâm của viên đá
    const centerX = rock.x + rock.width / 2;
    const centerY = rock.y + rock.height / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate(rock.angle);
    
    // Dịch chuyển ngược lại để vẽ hình ảnh từ góc trên bên trái (-width/2, -height/2)
    const drawX = -rock.width / 2;
    const drawY = -rock.height / 2;

    if (rockImg && rockImg.complete) {
        ctx.drawImage(rockImg, drawX, drawY, rock.width, rock.height);
    } else {
        ctx.fillStyle = rock.type === 'light_gray_rock' ? '#B0B0B0' : 
                        rock.type === 'dark_gray_rock' ? '#36454F' : 
                        '#A0522D';
        ctx.fillRect(drawX, drawY, rock.width, rock.height);
    }
    ctx.restore();
}

function drawRocks() {
    for (const rock of rocks) {
        drawRock(rock);
    }
}
// --- Hàm kiểm tra va chạm ---
function checkCollision(objA, objB) {
    return objA.x < objB.x + objB.width &&
           objA.x + objA.width > objB.x &&
           objA.y < objB.y + objB.height &&
           objA.y + objA.height > objB.y;
}

// --- Hàm thu thập Vật phẩm Object ---
function itemsCollect() {
    if (star.active && checkCollision(player, star)) {
         // 1. Kích hoạt hiệu ứng Particle Bloom
        const centerX = star.x + star.width / 2;
        const centerY = star.y + star.height / 2;

        // Tạo particle
        const newParticles = createParticle( centerX, centerY, { type: 'image', life: 70, color: 'yellow', speed: 2,
        startScale: 0.7, endScale: 0.0, 
        imageKey: 'star_particle' }, getRandom(4, 10) );
        particles.push(...newParticles);
        star.active = false;
        setTimeout(spawnStar, 3000); 
        score += 10;
    }

    if (flag.active && checkCollision(player, flag)) { 
        //flag.active = false;
        //spawnFlag(); 
    }
}


// --- Tải Asset ---
function loadAssets() {
    let assetsToLoad = Object.keys(IMAGE_SOURCES).length;
    let assetsLoaded = 0;

    for (const name in IMAGE_SOURCES) {
        const img = new Image();
        img.onload = () => {
            assetsLoaded++;
            asset[name] = img;
            if (assetsLoaded === assetsToLoad) {
                isAssetsLoaded = true;
                console.log("Assets đã tải xong. Bắt đầu game.");
                generateItems()
                requestAnimationFrame(gameLoop);
            }
        };
        img.onerror = () => {
             // Thêm cảnh báo để dễ debug nếu hình ảnh không tải được
             console.error(`Lỗi tải hình ảnh: ${IMAGE_SOURCES[name]}. `);
             assetsLoaded++;
             asset[name] = null; // Đặt null nếu lỗi
             if (assetsLoaded === assetsToLoad) {
                isAssetsLoaded = true;
                generateItems()
                requestAnimationFrame(gameLoop);
             }
        };
        img.src = IMAGE_SOURCES[name];
    }
}

// --- Hàm vẽ cho game ---
let hasMoved = false; 
function drawGround() {
    const groundImg = asset.ground;
    if (groundImg && groundImg.complete) {
        // Vẽ Ground lấp đầy chiều rộng, cố định chiều cao
        ctx.drawImage(groundImg, 0, canvas_height - ground_height, canvas_width, ground_height);
    } else {
        // Vẽ khối màu xanh lá nếu asset chưa tải hoặc lỗi
        ctx.fillStyle = 'green';
        ctx.fillRect(0, canvas_height - ground_height, canvas_width, ground_height);
        ctx.fillStyle = 'brown';
        ctx.fillRect(0, canvas_height - ground_height / 1.5, canvas_width, ground_height / 1.5);
    }
}

function drawPlayer() {
    let assetKey = '';

    // Logic chọn ảnh dựa trên state và direction
    if (player.state === 'stand') {
        assetKey = 'player_stand';
    } else if (player.state === 'left') {
        assetKey = 'player_left';
    } else if (player.state === 'right') {
        assetKey = 'player_right';
    } else if (player.state === 'jump') {
        assetKey = 'player_jump';
    } else if (player.state === 'on_air') {  
        assetKey = 'player_on_air';
    } else if (player.state === 'happy') {  
        assetKey = 'player_happy';
    } else if (player.state === 'game_over') {
        assetKey = 'player_over';
    } else {
        // Trạng thái khác chưa rõ , sử dụng ảnh di chuyển theo hướng cuối cùng
        assetKey = player.direction === 'left' ? 'player_left' : 'player_right';
    }

    const playerImg = asset[assetKey];
    if (playerImg && playerImg.complete) {
        ctx.drawImage(playerImg, player.x, player.y, player.width, player.height);
    } else {
        // Vẽ khối màu xanh nếu asset chưa tải hoặc lỗi
        ctx.fillStyle = '#3498db';
        ctx.fillRect(player.x, player.y, player.width, player.height);
    }
}

function drawItems() {
    if (star.active && asset.star) {
        ctx.drawImage(asset.star, star.x, star.y, star.width, star.height);
    } 
    //if (flag.active && asset.flag) { ctx.drawImage(asset.flag, flag.x, flag.y, flag.width, flag.height); }
}

function drawWaveInfo() {
    ctx.save(); ctx.font = 'bold 33px Arial'; ;
    ctx.fillStyle = 'rgba(12, 12, 12, 0.9)';
    ctx.strokeStyle = 'white'; ctx.lineWidth = 2;
    ctx.textAlign = "center";

    const text = `Wave: ${wave}`;
    const x = 90; const y = 50;
    
    ctx.strokeText(text, x, y); ctx.fillText(text, x, y); 
    ctx.restore();
}

function drawScore() {
    ctx.save(); ctx.font = `bold 33px Arial`;
    ctx.textAlign = "center";
    ctx.fillStyle = 'rgba(16, 16, 16, 0.9)';
    ctx.strokeStyle = 'white'; ctx.lineWidth = 2;

    const text = `Score: ${score}`;
    const x = canvas_width - 90; const y = 50;
    
    ctx.strokeText(text, x, y); ctx.fillText(text, x, y); 
    ctx.restore();
}

function drawScore2() {
    ctx.save(); ctx.font = `bold 40px Arial`;
    ctx.fillStyle = 'rgba(5, 5, 5, 0.98)';
    ctx.textAlign = "center";
    let text = `000`;
    if (score < 100) { text = `0${score}`; 
    } else { text = `${score}`; }
    const x = canvas_width / 2 - 140; const y = canvas_height / 2 + 70;
    
    ctx.fillText(text, x, y); 
    ctx.restore();
}

function drawHighScore() {
    ctx.save(); ctx.font = `bold 40px Arial`;
    ctx.fillStyle = 'rgba(5, 5, 5, 0.98)';
    ctx.textAlign = "center";
    let text = `000`;
    if (highscore < 100) { text = `0${highscore}`; 
    } else { text = `${highscore}`; }
    const x = canvas_width / 2 + 125; const y = canvas_height / 2 + 70;
    
    ctx.fillText(text, x, y); 
    ctx.restore();
}

function draw() { //Vẽ toàn khung hình
    ctx.clearRect(0, 0, canvas_width, canvas_height);
    drawItems(); drawRocks(); drawGround();
    drawPlayer(); drawParticles();
    drawWaveInfo(); drawScore();

    if (!alive) { drawGameOver(); 
        drawScore2(); 
        if (score > highscore) {
            highscore = score;
        }
        drawHighScore(); 
    }
}

// --- Update Function ---
function updatePlayer() {
    // Di chuyển ngang (dx) và rơi tự do (dy)
    player.x += player.dx * plr_speed;
    player.dy += gravity ;
    player.y += player.dy;

    if (alive) { // Kiểm tra nếu player còn sống 
    // Kiểm tra nhảy và chạm đất
    if (player.dy > 0 && !player.isOnGround) {
        player.state = 'stand';
    }
    if (player.y >= plr_y0) {
        player.y = plr_y0; 
        player.dy = 0; // Dừng rơi
        player.isOnGround = true;

        if (player.dx === 0) {
            // Giữ nguyên trạng thái stand nếu chưa di chuyển
            if (!hasMoved) {
                player.state = 'stand';
            } 
        } else {
            player.state = player.direction; 
        }
    } else {  
        player.isOnGround = false;
        if (player.dy > 0 && !player.isOnGround) {
            player.state = 'on_air';
        } else { player.state = 'jump'; }
    } } else {
        player.dx = 0;
        player.state = 'game_over';
    } 

    // Giới hạn di chuyển ngang (không ra khỏi biên canvas)
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas_width) player.x = canvas_width - player.width;
}

function waveUpdate() {
    // Cập nhật logic wave ở đây
    if (score >= 0) {
        wave = Math.floor(score / 50) + 1;
    }
}

function updateGame() {
    updatePlayer(); updateParticles();
    itemsCollect(); updateRocks();
    waveUpdate();
}

// --- Loop và sự kiện ---
let lastTime = 0;
let accumulator = 0;

function gameLoop(currentTime) {
    if (!isAssetsLoaded) {
        return; 
    }

    // Logic điều chỉnh tốc độ khung hình (Fixed Time Step)
    if (lastTime === 0) lastTime = currentTime;
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    accumulator += deltaTime;
    // Giới hạn accumulator để tránh quá tải
    let steps = 0;
    while (accumulator >= FIXED_UPDATE_STEP && steps < 10) {
        updateGame();
        rockSpawnTimer += FIXED_UPDATE_STEP;
        if (rockSpawnTimer >= 3000) {
            setTimeout(spawnRockWave, 10);
            rockSpawnTimer = 0;
            //wave = wave + 1;
        } 
        accumulator -= FIXED_UPDATE_STEP; steps++ ; 
    }
    if (accumulator > FIXED_UPDATE_STEP) { accumulator = FIXED_UPDATE_STEP; }

    draw();
    requestAnimationFrame(gameLoop);
}

function actionJump() {
    if (player.isOnGround) {
        player.dy = jump_power; 
        player.isOnGround = false;
        player.state = 'jump'; 
        hasMoved = true; 
    }
}

// --- Xử lí Input ---
function updateMovementAndDirection() {
if (alive) { 
    if (!player.isOnGround) {
        player.dx = 0;
        return; // Không thay đổi hướng khi đang nhảy
    }
    const isMoving = keysPressed['left'] || keysPressed['right'];
    if (keysPressed['left'] && keysPressed['right']) {
        player.dx = 0; 
        player.state = 'stand'; 
    } else if (keysPressed['left']) {
        player.dx = -1;
        player.direction = 'left'; 
        player.state = 'left'; 
        hasMoved = true; 
    } else if (keysPressed['right']) {
        player.dx = 1;
        player.direction = 'right'; 
        player.state = 'right'; 
        hasMoved = true;
    } else {
        player.dx = 0; 
        if (!hasMoved) {
            player.state = 'stand'; 
        }
    }

    if (isMoving) {
        player.state = player.direction;
    } else if (player.dx === 0) {
        if (!hasMoved) {
            player.state = 'stand';
        }
    } 
} else { if (keysPressed['r']) { // Nhấn R để restart game
        // Reset trạng thái game
        player.x = canvas_width / 2 - plr_size / 2;
        player.y = plr_y0; score = 0; wave = 1; alive = true; hasMoved = false;
        rocks.length = 0; 
        generateItems(); 
    } 
}    
}

document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key === 'arrowleft' || key === 'a') {
        keysPressed['left'] = true;
    } else if (key === 'arrowright' || key === 'd') {
        keysPressed['right'] = true;
    } else if (key === ' ' || key === 'arrowup' || key === 'w') {
        if (!keysPressed['jump']) { // Tránh nhảy liên tục nếu giữ phím
            actionJump();
        }
        keysPressed['jump'] = true; }
    if (key === 'r') {
        keysPressed['r'] = true; }

    // Cập nhật hướng di chuyển sau khi nhấn phím
    updateMovementAndDirection();
});

document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();

    if (key === 'arrowleft' || key === 'a') {
        keysPressed['left'] = false;
    } else if (key === 'arrowright' || key === 'd') {
        keysPressed['right'] = false;
    } else if (key === 'arrowup' || key === 'w' || key === ' ') {
        keysPressed['jump'] = false;
    } 
    if (key === 'r') {
        keysPressed['r'] = false; }
        
    // Cập nhật hướng di chuyển sau khi nhả phím
    updateMovementAndDirection();
});

// Khởi động
window.onload = loadAssets;
const physics = new PhysicsEngine();

const state = {
    isDragging: false,
    dragStart: null,
    pointer: {x: 0, y: 0},
    spawnType: 'earth',
    simTime: 0,
    speedExp: 0,
    running: true
};

const ui = {
    time: document.getElementById('ui-time'),
    bodies: document.getElementById('ui-bodies'),
    speedVal: document.getElementById('ui-speed-val'),
    speedSlider: document.getElementById('ui-speed'),
    btnPlay: document.getElementById('btn-play'),
    btnClear: document.getElementById('btn-clear'),
    btnRecenter: document.getElementById('btn-recenter'),
    spawnBtns: document.querySelectorAll('.spawn-btn'),
    chkTrails: document.getElementById('ui-trails'),
    chkBloom: document.getElementById('ui-bloom'),
    chkLighting: document.getElementById('ui-lighting'),
    selInfo: document.getElementById('selected-info'),
    btnCloseInfo: document.getElementById('btn-close-info'),
    selName: document.getElementById('sel-name'),
    selType: document.getElementById('sel-type'),
    selMass: document.getElementById('sel-mass'),
    selRadius: document.getElementById('sel-radius'),
    selTemp: document.getElementById('sel-temp'),
    selVel: document.getElementById('sel-vel'),
    btnDeleteSel: document.getElementById('btn-delete-sel'),
    toast: document.getElementById('toast-container')
};

let selectedBodyId = null;
let renderer;

function init() {
    const gameCanvas = document.getElementById('gameCanvas');
    const bgCanvas = document.getElementById('bgCanvas');
    renderer = new Renderer(gameCanvas, bgCanvas);
    
    bindEvents(gameCanvas);
    
    // Initial Solar System
    physics.addBody('star', 0, 0, 0, 0, 333000, 10.0, '#ffcc00'); // Sun
    physics.addBody('earth', 400, 0, 0, 25, 1.0, 3.0, '#5c9eff'); // Earth
    physics.addBody('rock', 150, 0, 0, 45, 0.05, 1.5, '#aaaaaa'); // Mercury
    physics.addBody('gas', 1200, 0, 0, 15, 318.0, 6.0, '#d4a373'); // Jupiter
    
    requestAnimationFrame(loop);
}

function bindEvents(canvas) {
    ui.speedSlider.addEventListener('input', (e) => {
        state.speedExp = parseFloat(e.target.value);
        if (state.speedExp === 0) {
            ui.speedVal.textContent = "1 day/s";
        } else if (state.speedExp > 0) {
            ui.speedVal.textContent = `${Math.round(Math.pow(10, state.speedExp))} days/s`;
        } else {
            ui.speedVal.textContent = `1/${Math.round(Math.pow(10, Math.abs(state.speedExp)))} days/s`;
        }
    });

    ui.btnPlay.addEventListener('click', () => {
        state.running = !state.running;
        ui.btnPlay.textContent = state.running ? "▶ Pause" : "⏸ Resume";
        ui.btnPlay.classList.toggle('active', state.running);
    });

    ui.btnClear.addEventListener('click', () => {
        physics.clear();
        state.simTime = 0;
        selectedBodyId = null;
        ui.selInfo.classList.add('hidden');
    });

    ui.btnRecenter.addEventListener('click', () => {
        renderer.camera.x = 0;
        renderer.camera.y = 0;
        renderer.camera.zoom = 10;
    });

    ui.spawnBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            ui.spawnBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.spawnType = btn.dataset.type;
        });
    });

    ui.chkTrails.addEventListener('change', e => renderer.settings.trails = e.target.checked);
    ui.chkBloom.addEventListener('change', e => renderer.settings.bloom = e.target.checked);
    ui.chkLighting.addEventListener('change', e => renderer.settings.lighting = e.target.checked);

    ui.btnCloseInfo.addEventListener('click', () => {
        selectedBodyId = null;
        ui.selInfo.classList.add('hidden');
    });

    ui.btnDeleteSel.addEventListener('click', () => {
        if (selectedBodyId !== null) {
            const idx = physics.bodies.findIndex(b => b.id === selectedBodyId);
            if (idx !== -1) {
                physics.spawnExplosion(physics.bodies[idx].x, physics.bodies[idx].y, physics.bodies[idx].color, 40);
                physics.bodies.splice(idx, 1);
            }
            selectedBodyId = null;
            ui.selInfo.classList.add('hidden');
        }
    });

    // Canvas Interactions
    canvas.addEventListener('pointerdown', e => {
        const wx = renderer.screenToWorld(e.clientX, e.clientY).x;
        const wy = renderer.screenToWorld(e.clientX, e.clientY).y;
        
        // Check selection
        let clickedBody = null;
        for (const b of physics.bodies) {
            const dist = Math.hypot(b.x - wx, b.y - wy);
            if (dist < b.radius * 2 || dist * renderer.camera.zoom < 15) {
                clickedBody = b.id;
                break;
            }
        }

        if (clickedBody) {
            selectedBodyId = clickedBody;
            ui.selInfo.classList.remove('hidden');
        } else {
            // Start spawning
            state.isDragging = true;
            state.dragStart = { x: e.clientX, y: e.clientY };
            state.pointer = { x: e.clientX, y: e.clientY };
        }
    });

    canvas.addEventListener('pointermove', e => {
        if (state.isDragging) {
            state.pointer = { x: e.clientX, y: e.clientY };
        }
    });

    canvas.addEventListener('pointerup', e => {
        if (state.isDragging) {
            state.isDragging = false;
            const wStart = renderer.screenToWorld(state.dragStart.x, state.dragStart.y);
            const wEnd = renderer.screenToWorld(e.clientX, e.clientY);
            
            // Velocity vector
            const vx = (wStart.x - wEnd.x) * 0.1;
            const vy = (wStart.y - wEnd.y) * 0.1;

            let mass, radius, color;
            if (state.spawnType === 'earth') { mass = 1.0; radius = 3.0; color = '#5c9eff'; }
            else if (state.spawnType === 'gas') { mass = 100.0; radius = 6.0; color = '#d4a373'; }
            else if (state.spawnType === 'star') { mass = 330000.0; radius = 10.0; color = '#ff8800'; }
            else { mass = 0.05; radius = 1.5; color = '#aaaaaa'; }

            physics.addBody(state.spawnType, wStart.x, wStart.y, vx, vy, mass, radius, color);
            window.showToast("Spawned new body!");
        }
    });

    canvas.addEventListener('wheel', e => {
        const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
        renderer.camera.zoom = Math.max(0.1, Math.min(200, renderer.camera.zoom * zoomDelta));
    });
}

function updateUI() {
    ui.time.textContent = `${(state.simTime / 365).toFixed(1)} yrs`;
    ui.bodies.textContent = physics.bodies.length;

    if (selectedBodyId !== null) {
        const b = physics.bodies.find(x => x.id === selectedBodyId);
        if (b) {
            ui.selName.textContent = `Body ${b.id}`;
            ui.selType.textContent = b.type.toUpperCase();
            ui.selMass.textContent = b.mass >= 1000 ? `${(b.mass/333000).toFixed(2)} M☉` : `${b.mass.toFixed(2)} M⊕`;
            ui.selRadius.textContent = `${Math.round(b.radius * 2000)} km`;
            ui.selTemp.textContent = `${Math.round(b.temperature)} K`;
            ui.selVel.textContent = `${Math.hypot(b.vx, b.vy).toFixed(1)} km/s`;
        } else {
            selectedBodyId = null;
            ui.selInfo.classList.add('hidden');
        }
    }
}

window.showToast = function(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    ui.toast.appendChild(t);
    setTimeout(() => { if(t.parentNode) t.parentNode.removeChild(t); }, 3000);
};

let lastTime = performance.now();
function loop(time) {
    const dtReal = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    if (state.running) {
        let dtScale = 0;
        if (state.speedExp === 0) dtScale = 1;
        else if (state.speedExp > 0) dtScale = Math.pow(10, state.speedExp);
        else dtScale = 1 / Math.pow(10, Math.abs(state.speedExp));

        // Substepping for physics stability
        const steps = Math.min(Math.ceil(dtScale), 20); // max 20 substeps
        const stepDt = dtScale / steps;
        
        for (let i = 0; i < steps; i++) {
            physics.step(stepDt);
        }
        
        state.simTime += dtScale;
    }

    updateUI();
    renderer.render(physics, state);
    requestAnimationFrame(loop);
}

window.onload = init;

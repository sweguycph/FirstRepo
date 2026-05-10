// UI Elements
const startMenu = document.getElementById('start-menu');
const startBtn = document.getElementById('start-btn');
const speedDisplay = document.getElementById('speed-display');
const altDisplay = document.getElementById('alt-display');

// Game State
let gameState = 'START'; // START, PLAYING
let animationId;

// Three.js Core Variables
let scene, camera, renderer;

// Player Variables
let playerShip;
let playerSpeed = 0;
const MAX_SPEED = 200;
const ACCELERATION = 50; // units per second
const DECELERATION = 20;

// Input State
const keys = {
    W: false,
    S: false,
    A: false,
    D: false
};

// Mouse State
let mouseX = 0;
let mouseY = 0;
const MOUSE_SENSITIVITY = 0.002;

// Timing
const clock = new THREE.Clock();

function initThreeJS() {
    // 1. Scene
    scene = new THREE.Scene();
    // Add some slight fog to blend objects into the dark distance
    scene.fog = new THREE.FogExp2(0x030014, 0.00025);

    // 2. Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 10000);
    // Camera is attached to the player ship later

    // 3. Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.body.appendChild(renderer.domElement);

    // 4. Lighting
    const ambientLight = new THREE.AmbientLight(0x222233);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(200, 500, 300);
    dirLight.castShadow = true;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 1500;
    dirLight.shadow.camera.left = -500;
    dirLight.shadow.camera.right = 500;
    dirLight.shadow.camera.top = 500;
    dirLight.shadow.camera.bottom = -500;
    scene.add(dirLight);

    // Add a glowing distant sun
    const sunGeometry = new THREE.SphereGeometry(100, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xffddaa });
    const sun = new THREE.Mesh(sunGeometry, sunMaterial);
    sun.position.copy(dirLight.position);
    scene.add(sun);

    // 5. Environment (Starfield)
    createStarfield();

    // 6. Environment (Asteroids)
    createAsteroids();

    // 7. Player Ship
    createPlayerShip();

    // Handle Window Resize
    window.addEventListener('resize', onWindowResize, false);

    // Event Listeners for Input
    setupInput();

    // Start render loop
    animate();
}

function createStarfield() {
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 10000;
    const posArray = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i++) {
        // Spread stars in a huge sphere
        posArray[i] = (Math.random() - 0.5) * 8000;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const starMaterial = new THREE.PointsMaterial({
        size: 2,
        color: 0xffffff,
        transparent: true,
        opacity: 0.8
    });

    const starMesh = new THREE.Points(starGeometry, starMaterial);
    scene.add(starMesh);
}

function createAsteroids() {
    const asteroidGeometry = new THREE.DodecahedronGeometry(10, 1);
    const asteroidMaterial = new THREE.MeshStandardMaterial({
        color: 0x555555,
        roughness: 0.8,
        metalness: 0.2
    });

    for (let i = 0; i < 500; i++) {
        const mesh = new THREE.Mesh(asteroidGeometry, asteroidMaterial);
        
        // Random size
        const scale = Math.random() * 5 + 1;
        mesh.scale.set(scale, scale, scale);

        // Random position within a large area
        mesh.position.set(
            (Math.random() - 0.5) * 4000,
            (Math.random() - 0.5) * 4000,
            (Math.random() - 0.5) * 4000
        );

        // Random rotation
        mesh.rotation.set(
            Math.random() * Math.PI,
            Math.random() * Math.PI,
            Math.random() * Math.PI
        );

        mesh.castShadow = true;
        mesh.receiveShadow = true;

        scene.add(mesh);
    }
}

function createPlayerShip() {
    // Create a group so we can attach camera and ship body
    playerShip = new THREE.Group();

    // Ship Body Geometry (A sleek elongated pyramid)
    const geometry = new THREE.ConeGeometry(2, 10, 4);
    // Rotate geometry so it points along the Z axis (forward)
    geometry.rotateX(Math.PI / 2);
    geometry.rotateY(Math.PI / 4); // give it a diamond shape

    const material = new THREE.MeshStandardMaterial({
        color: 0x00f3ff,
        emissive: 0x004455,
        roughness: 0.3,
        metalness: 0.8
    });

    const body = new THREE.Mesh(geometry, material);
    body.castShadow = true;
    playerShip.add(body);

    // Engine Glow
    const engineGeo = new THREE.SphereGeometry(0.8, 16, 16);
    const engineMat = new THREE.MeshBasicMaterial({ color: 0xff00ea });
    const engineGlow = new THREE.Mesh(engineGeo, engineMat);
    engineGlow.position.set(0, 0, 5); // back of ship
    playerShip.add(engineGlow);

    // Point Light for engine
    const engineLight = new THREE.PointLight(0xff00ea, 1, 50);
    engineLight.position.set(0, 0, 6);
    playerShip.add(engineLight);

    // Attach Camera slightly behind and above the ship (Third Person)
    camera.position.set(0, 4, 20);
    // Look slightly ahead of the ship
    camera.lookAt(new THREE.Vector3(0, 0, -50));
    playerShip.add(camera);

    scene.add(playerShip);
}

function setupInput() {
    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyW') keys.W = true;
        if (e.code === 'KeyS') keys.S = true;
        if (e.code === 'KeyA') keys.A = true;
        if (e.code === 'KeyD') keys.D = true;
    });

    window.addEventListener('keyup', (e) => {
        if (e.code === 'KeyW') keys.W = false;
        if (e.code === 'KeyS') keys.S = false;
        if (e.code === 'KeyA') keys.A = false;
        if (e.code === 'KeyD') keys.D = false;
    });

    // Pointer Lock for Mouse Control
    document.body.addEventListener('mousemove', (e) => {
        if (gameState !== 'PLAYING') return;
        if (document.pointerLockElement === document.body) {
            mouseX = e.movementX || 0;
            mouseY = e.movementY || 0;
        }
    });

    startBtn.addEventListener('click', () => {
        gameState = 'PLAYING';
        startMenu.classList.remove('active');
        // Request pointer lock
        document.body.requestPointerLock();
    });

    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement !== document.body && gameState === 'PLAYING') {
            // Paused or lost focus
            gameState = 'START';
            startMenu.classList.add('active');
        }
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function updatePlayer(dt) {
    if (gameState !== 'PLAYING') return;

    // Throttle
    if (keys.W) {
        playerSpeed += ACCELERATION * dt;
    } else if (keys.S) {
        playerSpeed -= ACCELERATION * dt;
    } else {
        // Natural deceleration
        if (playerSpeed > 0) {
            playerSpeed -= DECELERATION * dt;
            if (playerSpeed < 0) playerSpeed = 0;
        } else if (playerSpeed < 0) {
            playerSpeed += DECELERATION * dt;
            if (playerSpeed > 0) playerSpeed = 0;
        }
    }

    // Clamp speed
    if (playerSpeed > MAX_SPEED) playerSpeed = MAX_SPEED;
    if (playerSpeed < -MAX_SPEED / 3) playerSpeed = -MAX_SPEED / 3;

    // Move forward/backward along local Z axis
    playerShip.translateZ(-playerSpeed * dt);

    // Steering (Pitch and Yaw via Mouse)
    if (document.pointerLockElement === document.body) {
        // Pitch (up/down)
        playerShip.rotateX(-mouseY * MOUSE_SENSITIVITY);
        // Yaw (left/right)
        playerShip.rotateY(-mouseX * MOUSE_SENSITIVITY);
        
        // Reset mouse delta so we don't spin infinitely if mouse stops moving
        mouseX = 0;
        mouseY = 0;
    }

    // Roll via A/D
    if (keys.A) {
        playerShip.rotateZ(1.5 * dt);
    }
    if (keys.D) {
        playerShip.rotateZ(-1.5 * dt);
    }

    // Update HUD
    speedDisplay.innerText = Math.round(playerSpeed);
    // Fake altitude based on Y position distance from 0
    altDisplay.innerText = Math.round(Math.abs(playerShip.position.y));
}

function animate() {
    animationId = requestAnimationFrame(animate);

    const dt = clock.getDelta();

    updatePlayer(dt);

    // Slowly rotate asteroids in the background
    scene.children.forEach(child => {
        if (child.geometry instanceof THREE.DodecahedronGeometry) {
            child.rotation.x += 0.5 * dt;
            child.rotation.y += 0.3 * dt;
        }
    });

    renderer.render(scene, camera);
}

// Ensure Three.js is loaded before initializing
window.onload = () => {
    if (typeof THREE !== 'undefined') {
        initThreeJS();
    } else {
        console.error("Three.js not loaded.");
    }
};

import { loadSound, getInput } from './utils.js';
import { Marketplace } from './marketplace.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const { width, height } = canvas;
let lastTime;
let laserSound;
let marketplace;

// Track input state to prevent continuous triggering
const inputState = {
  canPlaySound: true,
  lastDpadPress: 0,
  dpadCooldown: 200, // milliseconds
};

function update(elapsedTime) {
  const [p1] = getInput();

  // Handle sound effect
  // if (p1.BUTTON_SOUTH.pressed && inputState.canPlaySound) {
  //   playSound(laserSound);
  //   inputState.canPlaySound = false;
  // } else if (!p1.BUTTON_SOUTH.pressed) {
  //   inputState.canPlaySound = true;
  // }

  // Add cooldown for input to prevent too rapid actions
  const now = performance.now();
  if (now - inputState.lastDpadPress > inputState.dpadCooldown) {
    if (p1.DPAD_UP.pressed || p1.DPAD_DOWN.pressed || p1.BUTTON_EAST.pressed || p1.BUTTON_SOUTH.pressed) {
      inputState.lastDpadPress = now;
      marketplace.update(p1);
    }
  }
}

function draw() {
  marketplace.draw();
}

function gameLoop() {
  const deltaTime = performance.now() - lastTime;
  update(deltaTime);
  draw();
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

async function launch() {
  // Create marketplace instance
  marketplace = new Marketplace(canvas);

  // Start game loop immediately to show loading screen
  lastTime = performance.now();
  gameLoop();

  // Load sound effect
  laserSound = await loadSound('sounds/laser.mp3');

  // Fetch marketplace items from GitHub first, with fallback to local file
  try {
    // Set a timeout of 4 seconds for the remote fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    
    // Replace this URL with your actual GitHub registry URL when you have it
    const githubUrl = 'https://raw.githubusercontent.com/knulli/jsgames-registry/main/registry.json';
    
    await marketplace.fetchItems(githubUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    console.log('Successfully loaded registry from GitHub');
  } catch (error) {
    console.warn('Failed to fetch from GitHub, falling back to local registry:', error);
    // Fallback to local registry
    await marketplace.fetchItems('./registry.json');
  }
}

// Helper function to play sound (moved from utils import)
function playSound(audioBuffer, loop = false) {
  if (!audioBuffer) {
    return;
  }
  const audioContext = new AudioContext();
  const bufferSource = audioContext.createBufferSource();
  bufferSource.buffer = audioBuffer;

  bufferSource.connect(audioContext.destination);
  if (loop) {
    bufferSource.loop = true;
  }
  bufferSource.start();
  bufferSource.onended = () => {
    bufferSource.disconnect();
  };
  return bufferSource;
}

launch();

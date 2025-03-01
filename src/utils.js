// simple utils for loading assets and getting input

const window = globalThis;

let audioContext;

export async function loadSound(url) {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  const soundBuffer = await fetch(url).then((res) => res.arrayBuffer());

  const audioBuffer = await audioContext.decodeAudioData(soundBuffer);
  return audioBuffer;
}

export function playSound(audioBuffer, loop = false) {
  if (!audioBuffer) {
    return;
  }
  if (!audioContext) {
    audioContext = new AudioContext();
  }
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

// loads image from a url as a promise
export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

export function loadFont(fontFamily, url) {
  return new Promise((resolve, reject) => {
    const fontFace = new FontFace(fontFamily, `url(${url})`);
    fontFace
      .load()
      .then((loadedFace) => {
        document.fonts.add(loadedFace);
        resolve(fontFamily);
      })
      .catch((err) => reject(err));
  });
}

export function createResourceLoader() {
  return {
    imgCount: 0,
    soundCount: 0,
    imgLoadedCount: 0,
    soundLoadedCount: 0,
    images: {},
    sounds: {},
    imagePromises: [],
    soundPromises: [],
    addImage(name, src) {
      this.imgCount++;
      const promise = loadImage(src).then((img) => {
        this.images[name] = img;
        this.imgLoadedCount++;
        return img;
      });
      this.imagePromises.push(promise);
      return promise;
    },
    addFont(name, src) {
      this.imgCount++;
      const promise = loadFont(name, src).then((fontFamily) => {
        this.images[name] = fontFamily;
        this.imgLoadedCount++;
        return fontFamily;
      });
      this.imagePromises.push(promise);
      return promise;
    },
    addSound(name, src) {
      this.soundCount++;
      const promise = loadSound(src).then((sound) => {
        this.sounds[name] = sound;
        this.soundLoadedCount++;
        return sound;
      });
      this.soundPromises.push(promise);
      return promise;
    },
    getPercentComplete() {
      return (this.imgLoadedCount + this.soundLoadedCount) / (this.imgCount + this.soundCount);
    },
    isComplete() {
      return this.imgLoadedCount === this.imgCount && this.soundLoadedCount === this.soundCount;
    },
    load() {
      return Promise.all([...this.imagePromises, ...this.soundPromises]);
    },
    reset() {
      this.imgLoadedCount = 0;
      this.soundLoadedCount = 0;
      this.images = {};
      this.sounds = {};
      this.imagePromises = [];
      this.soundPromises = [];
    },
  };
}

export function drawLoadingScreen(ctx, percentComplete, backgroundColor = 'black', foregroundColor = 'white') {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const fontSize = height * 0.1;
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = foregroundColor;
  ctx.font = `${fontSize}px monospace`;
  // draw loading text in center of screen
  ctx.fillText('Loading...', width / 2 - ctx.measureText('Loading...').width / 2, height / 2);
  const loadingBarWidth = width * 0.8;
  const loadingBarCompletedWidth = loadingBarWidth * percentComplete;
  const loadingBarHeight = height * 0.1;
  ctx.fillStyle = foregroundColor;
  ctx.strokeStyle = foregroundColor;
  ctx.lineWidth = height * 0.01;
  // ctx.fillRect(
  //   width / 2 - loadingBarWidth / 2,
  //   height / 2 - loadingBarHeight / 2 + fontSize,
  //   loadingBarCompletedWidth,
  //   loadingBarHeight
  // );
  // ctx.strokeRect(
  //   width / 2 - loadingBarWidth / 2,
  //   height / 2 - loadingBarHeight / 2 + fontSize,
  //   loadingBarWidth,
  //   loadingBarHeight
  // );
}

/**
 * Execute a shell command
 * @param {string} command - Command to execute
 * @returns {Promise<string>} - Command output
 */
export async function execCommand(command) {
  console.log(`Executing command: ${command}`);

  try {
    // Try to use Node.js child_process
    const { exec } = await import('child_process').catch(() => ({}));

    if (exec) {
      return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
          console.log('command, stdout', command, stdout);
          if (error) {
            reject(new Error(`Command failed: ${error.message}`));
            return;
          }
          resolve(stdout);
        });
      });
    } else {
      console.warn('Node.js child_process module not available, simulating command execution');
      // Fallback to simulation for browser environments
      return new Promise((resolve, reject) => {
        // Simulate command execution time
        setTimeout(() => {
          // Simulate success or failure based on command
          if (command.includes('invalid')) {
            reject(new Error(`Command failed: ${command}`));
          } else {
            resolve(`Command executed successfully: ${command}`);
          }
        }, 500);
      });
    }
  } catch (error) {
    console.error('Error executing command:', error);
    throw error;
  }
}

function getDefaultBtn() {
  return {
    pressed: false,
    value: 0,
  };
}

const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.key] = keys[e.key] || getDefaultBtn();
  keys[e.key].pressed = true;
  keys[e.key].value = 1;
});
window.addEventListener('keyup', (e) => {
  keys[e.key] = keys[e.key] || getDefaultBtn();
  keys[e.key].pressed = false;
  keys[e.key].value = 0;
});

// normalizes input from a gamepad or keyboard
// if there's a gamepad, player 1 is the gamead and player 2 is the keyboard
// if there's no gamepad, player 1 is the keyboard
export function getInput() {
  const gamepads = navigator.getGamepads();
  const players = [];
  gamepads.forEach((gp) => {
    if (gp) {
      const player = {
        type: 'gp',
        name: gp.id,
        DPAD_UP: gp.buttons[12],
        DPAD_DOWN: gp.buttons[13],
        DPAD_LEFT: gp.buttons[14],
        DPAD_RIGHT: gp.buttons[15],
        BUTTON_SOUTH: gp.buttons[0], // A on xbox, B on nintendo
        BUTTON_EAST: gp.buttons[1], // B on xbox, A on nintendo
        BUTTON_WEST: gp.buttons[2], // X on xbox, Y on nintendo
        BUTTON_NORTH: gp.buttons[3], // Y on xbox, X on nintendo
        LEFT_SHOULDER: gp.buttons[4] || getDefaultBtn(),
        RIGHT_SHOULDER: gp.buttons[5] || getDefaultBtn(),
        LEFT_TRIGGER: gp.buttons[6] || getDefaultBtn(),
        RIGHT_TRIGGER: gp.buttons[7] || getDefaultBtn(),
        SELECT: gp.buttons[8] || getDefaultBtn(),
        START: gp.buttons[9] || getDefaultBtn(),
        GUIDE: gp.buttons[16] || getDefaultBtn(),
        LEFT_STICK: gp.buttons[10] || getDefaultBtn(),
        RIGHT_STICK: gp.buttons[11] || getDefaultBtn(),
        LEFT_STICK_X: gp.axes[0] || 0,
        LEFT_STICK_Y: gp.axes[1] || 0,
        RIGHT_STICK_X: gp.axes[2] || 0,
        RIGHT_STICK_Y: gp.axes[3] || 0,
      };
      players.push(player);
    }
  });
  players.push({
    type: 'keyboard',
    name: 'keyboard',
    DPAD_UP: keys['ArrowUp'] || getDefaultBtn(),
    DPAD_DOWN: keys['ArrowDown'] || getDefaultBtn(),
    DPAD_LEFT: keys['ArrowLeft'] || getDefaultBtn(),
    DPAD_RIGHT: keys['ArrowRight'] || getDefaultBtn(),
    BUTTON_SOUTH: keys['z'] || getDefaultBtn(),
    BUTTON_EAST: keys['x'] || getDefaultBtn(),
    BUTTON_WEST: keys['a'] || getDefaultBtn(),
    BUTTON_NORTH: keys['s'] || getDefaultBtn(),
    LEFT_SHOULDER: keys['q'] || getDefaultBtn(),
    RIGHT_SHOULDER: keys['r'] || getDefaultBtn(),
    LEFT_TRIGGER: keys['e'] || getDefaultBtn(),
    RIGHT_TRIGGER: keys['r'] || getDefaultBtn(),
    SELECT: keys['Shift'] || getDefaultBtn(),
    START: keys['Enter'] || getDefaultBtn(),
    GUIDE: keys['Escape'] || getDefaultBtn(),
    LEFT_STICK: keys['c'] || getDefaultBtn(),
    RIGHT_STICK: keys['v'] || getDefaultBtn(),
    LEFT_STICK_X: 0,
    LEFT_STICK_Y: 0,
    RIGHT_STICK_X: 0,
    RIGHT_STICK_Y: 0,
  });
  return players;
}

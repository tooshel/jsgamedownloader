import { createResourceLoader, drawLoadingScreen, execCommand } from './utils.js';

// Constants for marketplace display
const ITEM_HEIGHT = 80;
const ITEMS_PER_PAGE = 5;
const PADDING = 20;
const TITLE_HEIGHT = 60;
const DESCRIPTION_OFFSET = 30;
const ICON_SIZE = 60;
const ICON_PADDING = 10;

export class Marketplace {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = canvas.width;
    this.height = canvas.height;
    this.items = [];
    this.selectedIndex = 0;
    this.scrollOffset = 0;
    this.loading = true;
    this.fontsLoaded = false;
    this.resourceLoader = createResourceLoader();
    this.showConfirmation = false;
    this.installing = false;
    this.installProgress = 0;
    this.installStatus = '';
    this.installComplete = false;
    this.installFailed = false;
    this.installedGamePath = null;
    this.errorMessage = '';
  }

  async getFolders(directory) {
    try {
      const fs = await import('fs').catch(() => null);
      const entries = await fs.promises.readdir(directory, { withFileTypes: true });
      console.log('Entries JASON', entries, directory);
      return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
    } catch (error) {
      console.error('Error reading directory:', error);
      return ['ERROR']; // Return empty array on error
    }
  }

  async loadFonts() {
    if (this.fontsLoaded) return;

    await Promise.all([
      this.resourceLoader.addFont('Roboto', 'fonts/Roboto-Regular.ttf'),
      this.resourceLoader.addFont('NotoEmoji', 'fonts/NotoEmoji-Regular.ttf'),
    ]);

    this.fontsLoaded = true;
  }

  /**
   * Check if a directory exists
   * @param {string} path - Path to check
   * @returns {Promise<boolean>} - True if directory exists and is accessible
   */
  async checkDirectoryExists(path) {
    try {
      console.log(`Checking if directory exists: ${path}`);

      try {
        // Try to use Node.js fs module
        const fs = await import('fs').catch(() => null);

        if (fs) {
          try {
            await fs.promises.access(path, fs.constants.R_OK | fs.constants.W_OK);
            console.log(`Directory ${path} exists and is accessible`);
            return true;
          } catch (error) {
            console.log(`Directory ${path} does not exist or is not accessible`);
            return false;
          }
        }
      } catch (error) {
        console.warn('Node.js fs module not available, using simulation');
      }

      // Fallback to simulation for browser environments
      // For testing, we'll only check one path as requested
      const commonPaths = ['./games'];

      const exists = commonPaths.includes(path);
      console.log(`[SIMULATION] Directory ${path} ${exists ? 'exists' : 'does not exist'}`);
      return exists;
    } catch (error) {
      console.error(`Error checking directory ${path}:`, error);
      return false;
    }
  }

  async fetchItems(url) {
    this.loading = true;
    try {
      // Make sure fonts are loaded first
      await this.loadFonts();

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }

      const items = await response.json();
      this.items = items;

      // Preload all item icons
      const iconPromises = items.filter((item) => item.icon).map((item) => this.resourceLoader.addImage(item.name, item.icon));

      await Promise.all(iconPromises);
      this.loading = false;
    } catch (error) {
      console.error('Error fetching marketplace items:', error);
      this.items = [];
      this.loading = false;
    }
  }

  update(input) {
    if (this.loading) return;

    if (this.installing) {
      // During installation, no input is processed
      return;
    } else if (this.installComplete) {
      // After installation is complete, any button returns to the list
      if (input.BUTTON_SOUTH.pressed || input.BUTTON_EAST.pressed) {
        this.installComplete = false;
        this.showConfirmation = false;
      }
    } else if (this.installFailed) {
      // Handle failed installation screen input
      if (input.BUTTON_SOUTH.pressed) {
        // Cancel and go back to list
        this.installFailed = false;
        this.showConfirmation = false;
      } else if (input.BUTTON_EAST.pressed) {
        // Retry installation
        this.installFailed = false;
        this.installSelectedGame();
      }
    } else if (this.showConfirmation) {
      // Handle confirmation screen input
      if (input.BUTTON_SOUTH.pressed) {
        // Cancel and go back to list
        this.showConfirmation = false;
      } else if (input.BUTTON_EAST.pressed) {
        // Confirm selection and install game
        this.installSelectedGame();
      }
    } else {
      // Handle list navigation
      const prevIndex = this.selectedIndex;

      if (input.DPAD_DOWN.pressed) {
        this.selectedIndex = Math.min(this.selectedIndex + 1, this.items.length - 1);
      } else if (input.DPAD_UP.pressed) {
        this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
      } else if (input.BUTTON_EAST.pressed) {
        // Show confirmation screen
        this.showConfirmation = true;
      }

      // Adjust scroll if selection changed
      if (prevIndex !== this.selectedIndex) {
        // Calculate which page the selected item should be on
        const targetPage = Math.floor(this.selectedIndex / ITEMS_PER_PAGE);
        this.scrollOffset = targetPage * ITEMS_PER_PAGE;

        // If selected item is at the bottom of the page, scroll down one more
        if (this.selectedIndex % ITEMS_PER_PAGE === ITEMS_PER_PAGE - 1 && this.selectedIndex < this.items.length - 1) {
          this.scrollOffset += 1;
        }

        // If selected item is at the top of the page, scroll up one more
        if (this.selectedIndex % ITEMS_PER_PAGE === 0 && this.selectedIndex > 0) {
          this.scrollOffset -= 1;
        }

        // Ensure scroll offset is valid
        this.scrollOffset = Math.max(0, Math.min(this.scrollOffset, this.items.length - ITEMS_PER_PAGE));
      }
    }
  }

  draw() {
    const { ctx, width, height } = this;

    // Clear background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    // Draw header (consistent across all screens)
    ctx.fillStyle = '#0f3460';
    ctx.fillRect(0, 0, width, TITLE_HEIGHT);

    ctx.font = '24px Roboto';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText('JS Game Downloader', width / 2, TITLE_HEIGHT / 2 + 8);

    if (this.loading) {
      drawLoadingScreen(ctx, this.resourceLoader.getPercentComplete(), '#1a1a2e', '#e94560');
      return;
    }

    if (this.installing) {
      this.drawInstallationScreen();
      return;
    }

    if (this.installComplete) {
      this.drawInstallCompleteScreen();
      return;
    }

    if (this.installFailed) {
      this.drawInstallFailedScreen();
      return;
    }

    if (this.showConfirmation) {
      this.drawConfirmationScreen();
      return;
    }

    // Header is now drawn at the beginning of the draw method

    if (this.items.length === 0) {
      ctx.font = '20px Roboto';
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.fillText('No items available', width / 2, height / 2);
      return;
    }

    // Draw visible items
    const startIndex = this.scrollOffset;
    const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, this.items.length);

    for (let i = startIndex; i < endIndex; i++) {
      const item = this.items[i];
      const isSelected = i === this.selectedIndex;
      const y = TITLE_HEIGHT + (i - startIndex) * ITEM_HEIGHT;

      // Draw item background
      ctx.fillStyle = isSelected ? '#e94560' : '#16213e';
      ctx.fillRect(PADDING, y, width - PADDING * 2, ITEM_HEIGHT - 5);

      // Draw item icon if available
      if (item.icon && this.resourceLoader.images[item.name]) {
        ctx.drawImage(
          this.resourceLoader.images[item.name],
          PADDING + ICON_PADDING,
          y + (ITEM_HEIGHT - ICON_SIZE) / 2,
          ICON_SIZE,
          ICON_SIZE
        );
      }

      const textX = PADDING + ICON_SIZE + ICON_PADDING * 2;

      // Draw item name
      ctx.font = 'bold 18px Roboto';
      ctx.fillStyle = 'white';
      ctx.textAlign = 'left';
      ctx.fillText(item.name, textX, y + 25);

      // Draw item description
      ctx.font = '14px Roboto';
      ctx.fillStyle = isSelected ? 'white' : '#cccccc';

      // Truncate description if too long
      let description = item.description || '';
      if (description.length > 50) {
        description = description.substring(0, 47) + '...';
      }

      ctx.fillText(description, textX, y + DESCRIPTION_OFFSET + 15);
    }

    // Draw scroll indicators if needed
    if (this.scrollOffset > 0) {
      // Draw up arrow indicator
      ctx.font = '20px NotoEmoji';
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.fillText('⬆️', width / 2, TITLE_HEIGHT + 20);
    }

    if (endIndex < this.items.length) {
      // Draw down arrow indicator
      ctx.font = '20px NotoEmoji';
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.fillText('⬇️', width / 2, height - 40);
    }

    // Draw instructions at the bottom of the screen
    ctx.font = '14px Roboto, NotoEmoji';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText('Use ⬆️/⬇️ to navigate, 🅰️ to select', width / 2, height - 10);
  }

  drawConfirmationScreen() {
    const { ctx, width, height } = this;
    const item = this.getSelectedItem();
    if (!item) return;

    // Header is now drawn at the beginning of the draw method

    // Draw content area
    const contentY = TITLE_HEIGHT + 20;
    const contentHeight = height - contentY - 60; // Leave space for buttons

    // Draw item icon if available
    if (item.icon && this.resourceLoader.images[item.name]) {
      const iconSize = 100;
      ctx.drawImage(this.resourceLoader.images[item.name], width / 2 - iconSize / 2, contentY, iconSize, iconSize);
    }

    // Draw item name
    const nameY = contentY + 120;
    ctx.font = 'bold 24px Roboto';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText(item.name, width / 2, nameY);

    // Draw item description
    const descY = nameY + 40;
    ctx.font = '16px Roboto';
    ctx.fillStyle = '#cccccc';
    ctx.textAlign = 'center';

    // Word wrap description
    const description = item.description || '';
    const words = description.split(' ');
    const maxWidth = width - PADDING * 4;
    let line = '';
    let lineY = descY;

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && i > 0) {
        ctx.fillText(line, width / 2, lineY);
        line = words[i] + ' ';
        lineY += 25;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, width / 2, lineY);

    // Draw URL
    const urlY = lineY + 40;
    ctx.font = '14px Roboto';
    ctx.fillStyle = '#e94560';
    ctx.fillText(`Repository: ${item.url}`, width / 2, urlY);

    // Draw warning
    const warningY = urlY + 30;
    ctx.fillStyle = '#ffcc00';
    ctx.font = '14px Roboto';
    ctx.fillText('Warning: This will override any existing game with the same name.', width / 2, warningY);

    // Draw buttons
    const buttonY = height - 50;
    const buttonWidth = 150;
    const buttonHeight = 40;
    const buttonPadding = 20;

    // Cancel button
    ctx.fillStyle = '#16213e';
    ctx.fillRect(width / 2 - buttonWidth - buttonPadding, buttonY, buttonWidth, buttonHeight);
    ctx.font = '16px Roboto, NotoEmoji';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText('Cancel (🅱️)', width / 2 - buttonWidth / 2 - buttonPadding, buttonY + buttonHeight / 2 + 5);

    // Confirm button
    ctx.fillStyle = '#e94560';
    ctx.fillRect(width / 2 + buttonPadding, buttonY, buttonWidth, buttonHeight);
    ctx.fillStyle = 'white';
    ctx.fillText('Install (🅰️)', width / 2 + buttonWidth / 2 + buttonPadding, buttonY + buttonHeight / 2 + 5);
  }

  drawInstallationScreen() {
    const { ctx, width, height } = this;
    const item = this.getSelectedItem();
    if (!item) return;

    const contentY = TITLE_HEIGHT + 40;

    // Draw item name
    ctx.font = 'bold 20px Roboto';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText(`Installing ${item.name}...`, width / 2, contentY);

    // Draw progress bar
    const barWidth = width * 0.7;
    const barHeight = 30;
    const barX = (width - barWidth) / 2;
    const barY = contentY + 50;

    // Draw progress bar background
    ctx.fillStyle = '#16213e';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Draw progress
    ctx.fillStyle = '#e94560';
    ctx.fillRect(barX, barY, barWidth * this.installProgress, barHeight);

    // Draw progress percentage
    ctx.font = '16px Roboto';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(this.installProgress * 100)}%`, width / 2, barY + barHeight / 2 + 5);

    // Draw status message
    ctx.font = '16px Roboto';
    ctx.fillStyle = '#cccccc';
    ctx.textAlign = 'center';
    ctx.fillText(this.installStatus, width / 2, barY + barHeight + 40);

    // Check if we're in simulation mode and show a notice

    if (globalThis._jsg) {
      // console.log(`REAL Mode ROMDIR: ${globalThis._jsg.rom.romDir.substring(0, globalThis._jsg.rom.romDir.lastIndexOf('/'))}`);
      ctx.font = '12px Roboto';
      ctx.fillStyle = '#ffcc00';
      ctx.textAlign = 'center';
      ctx.fillText(
        `REAL Mode ROMDIR: ${globalThis._jsg.rom.romDir.substring(0, globalThis._jsg.rom.romDir.lastIndexOf('/'))}`,
        width / 2,
        height - 20
      );
    } else {
      ctx.font = '12px Roboto';
      ctx.fillStyle = '#ffcc00';
      ctx.textAlign = 'center';
      ctx.fillText('Simulation Mode - actual installation requires fs access', width / 2, height - 20);
    }

    try {
      const fs = require('fs');
    } catch (error) {
      // If we can't require fs, we're in browser mode
    }
  }

  drawInstallCompleteScreen() {
    const { ctx, width, height } = this;
    const item = this.getSelectedItem();
    if (!item) return;

    const contentY = TITLE_HEIGHT + 60;

    // Draw success icon
    ctx.font = '60px NotoEmoji';
    ctx.fillStyle = '#4CAF50';
    ctx.textAlign = 'center';
    ctx.fillText('✅', width / 2, contentY);

    // Draw success message
    ctx.font = 'bold 24px Roboto';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText('Installation Complete!', width / 2, contentY + 80);

    // Draw game name
    ctx.font = '18px Roboto';
    ctx.fillStyle = '#cccccc';
    ctx.textAlign = 'center';
    ctx.fillText(`${item.name} has been installed successfully.`, width / 2, contentY + 120);

    // Draw installation path
    const gameSlug = item.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
    ctx.font = '16px Roboto';
    ctx.fillStyle = '#e94560';
    ctx.textAlign = 'center';
    ctx.fillText(`Installed to: ${this.installedGamePath || `./games/${gameSlug}`}`, width / 2, contentY + 150);

    // Reminder to refresh games
    ctx.font = '18px Roboto';
    ctx.fillStyle = '#cccccc';
    ctx.textAlign = 'center';
    ctx.fillText(`Remember to refresh your games list!`, width / 2, contentY + 190);

    // Draw button prompt
    const buttonY = height - 60;
    ctx.fillStyle = '#16213e';
    ctx.fillRect(width / 2 - 100, buttonY, 200, 40);
    ctx.font = '16px Roboto, NotoEmoji';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText('Continue (🅰️ or 🅱️)', width / 2, buttonY + 25);
  }

  async installSelectedGame() {
    const item = this.getSelectedItem();
    if (!item) return;

    console.log(`Installing game from: ${item.url}`);

    this.installing = true;
    this.installProgress = 0;
    this.installStatus = 'Preparing installation...';

    try {
      // Step 1: Start
      await this.updateInstallProgress(0.05, 'Starting installation...', 500);

      console.log('ROMDIR', globalThis._jsg.rom.romDir.substring(0, globalThis._jsg.rom.romDir.lastIndexOf('/')));
      let installDir = '../';

      if (globalThis._jsg) {
        installDir = globalThis._jsg.rom.romDir.substring(0, globalThis._jsg.rom.romDir.lastIndexOf('/')) + '/';
      }
      console.log('installDir', installDir);

      // This will never throw but it's an example of how to get an error to pop up
      if (!installDir) {
        throw new Error("No valid installation directory found. Please create a 'jsgames' folder.");
      }

      // Step 2: Prepare installation
      await this.updateInstallProgress(0.1, 'Preparing installation...', 800);

      // Create a slug from the game name for the folder name
      const randomString = Math.random().toString(36).substring(2, 15);
      const gameSlug = item.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-');
      const gameDir = `${installDir}${gameSlug}`;
      const tempDir = `./temp-${randomString}`;
      const zipFile = `new-${gameSlug}.zip`;

      //This is a convention of how github zips the repo
      // const extractFolder = `${gameSlug}-main`;
      //But instead we are going to extact to a folder and then do getFolders
      let extractFolder = ``;

      //won't know this till later on when I unzip the file with "getFolders"
      // Check if game directory already exists
      const gameExists = await this.checkDirectoryExists(gameDir);
      if (gameExists) {
        console.log(`Game directory already exists: ${gameDir}`);
        await this.updateInstallProgress(0.15, 'Preparing to update existing game...', 500);
      }

      // Step 3: Download repository
      await this.updateInstallProgress(0.3, 'Downloading repository...', 1500);

      try {
        // Check if URL is valid
        if (!item.url || !item.url.startsWith('http')) {
          throw new Error('Invalid repository URL');
        }

        let usingNodeJs = false;

        try {
          // Try to use Node.js modules
          const fs = await import('fs').catch(() => null);

          if (fs) {
            usingNodeJs = true;
            console.log('Using Node.js');

            // First try git clone if it's a git repository
            if (item.url.includes('github.com') || item.url.includes('gitlab.com')) {
              try {
                // Make sure temp directory doesn't exist
                try {
                  await execCommand(`rm -rf ${tempDir}`);
                } catch (e) {
                  // Ignore errors if directory doesn't exist
                }

                console.log('Creating temp directory:', tempDir);

                await fs.promises.mkdir(tempDir, { recursive: true });

                await this.updateInstallProgress(0.35, 'Downloading the git zip ...', 500);

                // Add timeout to git clone command to prevent hanging

                console.log('Running curl: ', `curl -o ${tempDir}/${zipFile} -L "${item.url}" `);
                let timeoutId;
                const clonePromise = execCommand(`curl -o ${tempDir}/${zipFile} -L "${item.url}" `);
                const timeoutPromise = new Promise(
                  (_, reject) => (timeoutId = setTimeout(() => reject(new Error('Git clone timed out after 50 seconds')), 50000))
                );

                // The timeoutPromise is crashing the game and needs to be rethought
                await Promise.race([clonePromise], [timeoutPromise]);
                clearTimeout(timeoutId);
                console.log(`Successfully downloaded zip to ${zipFile}`);
              } catch (gitError) {
                console.warn('Git clone failed, falling back to direct download:', gitError);
                throw gitError; // Force fallback to direct download
              }
            } else {
              throw new Error('Not a git repository URL'); // Force fallback to direct download
            }
          }
        } catch (error) {
          // If git clone failed or we're in a browser, try direct download
          if (usingNodeJs) {
            console.log('Falling back to a mock direct download that is completely untested');
            await this.updateInstallProgress(0.4, 'Downloading zip file...', 800);

            // For Node.js, we can use fetch and fs
            const fs = await import('fs');

            // Add timeout to fetch to prevent hanging
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            try {
              const response = await fetch(item.url, {
                signal: controller.signal,
              });

              clearTimeout(timeoutId);

              if (!response.ok) {
                throw new Error(`Failed to download: ${response.status}`);
              }

              const arrayBuffer = await response.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
            } catch (fetchError) {
              if (fetchError.name === 'AbortError') {
                throw new Error('Download timed out after 10 seconds');
              }
              throw fetchError;
            }

            // Create temp directory if it doesn't exist
            await fs.promises.mkdir(tempDir, { recursive: true });

            // Write zip file
            const zipPath = `${tempDir}.zip`;
            await fs.promises.writeFile(zipPath, buffer);

            // Extract zip file
            await execCommand(`unzip ${zipPath}`);
          } else {
            // For browser, simulate download
            console.log(`Simulating download from: ${item.url}`);
            await this.updateInstallProgress(0.4, 'Downloading (simulated)...', 1000);
          }
        }
      } catch (error) {
        throw new Error(`Failed to download repository: ${error.message}`);
      }

      // Step 4: Extract files
      await this.updateInstallProgress(0.5, 'Extracting files...', 1000);

      try {
        let usingNodeJs = false;

        try {
          // Try to use Node.js modules
          const fs = await import('fs').catch(() => null);

          if (fs) {
            usingNodeJs = true;

            // Create game directory if it doesn't exist

            //delete the old game if it's there
            await execCommand(`rm -rf ${gameDir}`);
            console.log('Creating game directory:', gameDir);
            await fs.promises.mkdir(gameDir, { recursive: true });

            // Copy files from temp directory to game directory
            if (process.platform === 'win32') {
              // Windows
              // await execCommand(`xcopy /E /I /Y "${tempDir}\\*" "${gameDir}"`);
              await execCommand(`cd ${tempDir};unzip -o ${zipFile}; cd ..`);
            } else {
              // Unix-like
              await execCommand(`cd ${tempDir}; unzip -o ${zipFile}; cd ..`);
            }

            extractFolder = await this.getFolders(`${tempDir}`);

            // console.log(`extractFolder tempdir ${extractFolder}  ${tempDir}`);
            // console.log(`extractFolder tempdir ${extractFolder} ${extractFolder[0]}  ${tempDir}`);

            await execCommand(`mv -f ${tempDir}/${extractFolder}/* ${gameDir}`);
            console.log(`Hopefully successfully copied ${extractFolder} to ${gameDir}`);
            await execCommand(`rm -rf ${tempDir}`);
            console.log(`Hopefully sucessfully removed ${tempDir}`);
          }
        } catch (error) {
          if (usingNodeJs) {
            throw error; // Re-throw if we're using Node.js but it failed
          }

          // For browser, simulate extraction
          console.log(`Simulating extraction to because I have no acces to the file system: ${gameDir}`);
        }
      } catch (error) {
        throw new Error(`Failed to extract files: ${error.message}`);
      }

      // Step 5: Install dependencies
      await this.updateInstallProgress(0.7, 'Installing dependencies...', 1200);

      try {
        const hasPackageJson = await fs.promises
          .access(`${gameDir}/package.json`)
          .then(() => true)
          .catch(() => false);

        if (hasPackageJson) {
          await execCommand(`cd ${gameDir} && npm install`);
        }

        console.log(`Tried installing dependencies in: ${gameDir}`);
      } catch (error) {
        // Non-critical error - log but continue
        console.log(`Skipped npm install: ${error.message}`);
      }

      // Step 6: Configure game
      await this.updateInstallProgress(0.9, 'Configuring game...', 800);

      try {
        console.log(`Here we might add images to the right folders and update gamelists for: ${gameDir}`);
      } catch (error) {
        console.warn(`Warning: Failed to configure game: ${error.message}`);
      }

      // Step 7: Finishing up
      await this.updateInstallProgress(1.0, 'Installation complete!', 500);

      try {
        let usingNodeJs = false;

        try {
          // Try to use Node.js modules
          const fs = await import('fs').catch(() => null);

          if (fs) {
            usingNodeJs = true;

            // Clean up temporary files
            if (process.platform === 'win32') {
              // Windows
              await execCommand(`rmdir /S /Q "${tempDir}"`);

              // Remove zip file if it exists
              try {
                await fs.promises.access(`${zipFile}.zip`);
                await fs.promises.unlink(`${zipFile}.zip`);
              } catch (e) {
                // Ignore if file doesn't exist
              }
            } else {
              // Unix-like
              await execCommand(`rm -rf ${extractFolder}`);
            }

            console.log(`Successfully cleaned up temporary files`);
          }
        } catch (error) {
          if (usingNodeJs) {
            throw error; // Re-throw if we're using Node.js but it failed
          }

          // For browser, simulate cleanup
          console.log(`Simulating cleanup of: ${tempDir}`);
        }
      } catch (error) {
        // Non-critical error - log but continue
        console.warn(`Warning: Failed to clean up temporary files: ${error.message}`);
      }

      // Store the installation path for the completion screen
      this.installedGamePath = gameDir;
      console.log(`Game installed successfully to ${gameDir}`);

      // Show completion screen
      this.installing = false;
      this.installComplete = true;
    } catch (error) {
      console.error('Installation failed:', error);
      this.installStatus = 'Installation failed: ' + error.message;

      // Show error screen with retry option
      this.installProgress = 1.0; // Fill progress bar
      this.installing = false;
      this.installFailed = true;
      this.installComplete = false;
    }
  }

  drawInstallFailedScreen() {
    const { ctx, width, height } = this;
    const item = this.getSelectedItem();
    if (!item) return;

    const contentY = TITLE_HEIGHT + 60;

    // Draw error icon
    ctx.font = '60px NotoEmoji';
    ctx.fillStyle = '#e74c3c';
    ctx.textAlign = 'center';
    ctx.fillText('❌', width / 2, contentY);

    // Draw error message
    ctx.font = 'bold 24px Roboto';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText('Installation Failed', width / 2, contentY + 80);

    // Draw game name
    ctx.font = '18px Roboto';
    ctx.fillStyle = '#cccccc';
    ctx.textAlign = 'center';
    ctx.fillText(`Could not install ${item.name}`, width / 2, contentY + 120);

    // Draw error details
    ctx.font = '16px Roboto';
    ctx.fillStyle = '#e94560';
    ctx.textAlign = 'center';

    // Word wrap error message
    const errorMsg = this.installStatus || 'Unknown error occurred';
    const words = errorMsg.split(' ');
    const maxWidth = width - PADDING * 4;
    let line = '';
    let lineY = contentY + 160;

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && i > 0) {
        ctx.fillText(line, width / 2, lineY);
        line = words[i] + ' ';
        lineY += 25;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, width / 2, lineY);

    // Draw buttons
    const buttonY = height - 60;
    const buttonWidth = 150;
    const buttonHeight = 40;
    const buttonPadding = 20;

    // Cancel button
    ctx.fillStyle = '#16213e';
    ctx.fillRect(width / 2 - buttonWidth - buttonPadding, buttonY, buttonWidth, buttonHeight);
    ctx.font = '16px Roboto, NotoEmoji';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText('Cancel (🅱️)', width / 2 - buttonWidth / 2 - buttonPadding, buttonY + buttonHeight / 2 + 5);

    // Retry button
    ctx.fillStyle = '#e94560';
    ctx.fillRect(width / 2 + buttonPadding, buttonY, buttonWidth, buttonHeight);
    ctx.fillStyle = 'white';
    ctx.fillText('Retry (🅰️)', width / 2 + buttonWidth / 2 + buttonPadding, buttonY + buttonHeight / 2 + 5);
  }

  updateInstallProgress(progress, status, delay) {
    this.installProgress = progress;
    this.installStatus = status;

    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  getSelectedItem() {
    if (this.loading || this.items.length === 0) {
      return null;
    }
    return this.items[this.selectedIndex];
  }
}

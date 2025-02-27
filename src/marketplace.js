import { createResourceLoader, drawLoadingScreen } from "./utils.js";
import { fs } from "fs";

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
    this.ctx = canvas.getContext("2d");
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
    this.installStatus = "";
    this.installComplete = false;
  }

  async loadFonts() {
    if (this.fontsLoaded) return;

    await Promise.all([
      this.resourceLoader.addFont("Roboto", "fonts/Roboto-Regular.ttf"),
      this.resourceLoader.addFont("NotoEmoji", "fonts/NotoEmoji-Regular.ttf"),
    ]);

    this.fontsLoaded = true;
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
      const iconPromises = items
        .filter((item) => item.icon)
        .map((item) => this.resourceLoader.addImage(item.name, item.icon));

      await Promise.all(iconPromises);
      this.loading = false;
    } catch (error) {
      console.error("Error fetching marketplace items:", error);
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
        this.selectedIndex = Math.min(
          this.selectedIndex + 1,
          this.items.length - 1
        );
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
        if (
          this.selectedIndex % ITEMS_PER_PAGE === ITEMS_PER_PAGE - 1 &&
          this.selectedIndex < this.items.length - 1
        ) {
          this.scrollOffset += 1;
        }

        // If selected item is at the top of the page, scroll up one more
        if (
          this.selectedIndex % ITEMS_PER_PAGE === 0 &&
          this.selectedIndex > 0
        ) {
          this.scrollOffset -= 1;
        }

        // Ensure scroll offset is valid
        this.scrollOffset = Math.max(
          0,
          Math.min(this.scrollOffset, this.items.length - ITEMS_PER_PAGE)
        );
      }
    }
  }

  draw() {
    const { ctx, width, height } = this;

    // Clear background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, width, height);

    // Draw header (consistent across all screens)
    ctx.fillStyle = "#0f3460";
    ctx.fillRect(0, 0, width, TITLE_HEIGHT);

    ctx.font = "24px Roboto";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText("JS Game Downloader", width / 2, TITLE_HEIGHT / 2 + 8);

    if (this.loading) {
      drawLoadingScreen(
        ctx,
        this.resourceLoader.getPercentComplete(),
        "#1a1a2e",
        "#e94560"
      );
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

    if (this.showConfirmation) {
      this.drawConfirmationScreen();
      return;
    }

    // Header is now drawn at the beginning of the draw method

    if (this.items.length === 0) {
      ctx.font = "20px Roboto";
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.fillText("No items available", width / 2, height / 2);
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
      ctx.fillStyle = isSelected ? "#e94560" : "#16213e";
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
      ctx.font = "bold 18px Roboto";
      ctx.fillStyle = "white";
      ctx.textAlign = "left";
      ctx.fillText(item.name, textX, y + 25);

      // Draw item description
      ctx.font = "14px Roboto";
      ctx.fillStyle = isSelected ? "white" : "#cccccc";

      // Truncate description if too long
      let description = item.description || "";
      if (description.length > 50) {
        description = description.substring(0, 47) + "...";
      }

      ctx.fillText(description, textX, y + DESCRIPTION_OFFSET + 15);
    }

    // Draw scroll indicators if needed
    if (this.scrollOffset > 0) {
      // Draw up arrow indicator
      ctx.font = "20px NotoEmoji";
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.fillText("⬆️", width / 2, TITLE_HEIGHT + 20);
    }

    if (endIndex < this.items.length) {
      // Draw down arrow indicator
      ctx.font = "20px NotoEmoji";
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.fillText("⬇️", width / 2, height - 40);
    }

    // Draw instructions at the bottom of the screen
    ctx.font = "14px Roboto, NotoEmoji";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText("Use ⬆️/⬇️ to navigate, 🅱️ to select", width / 2, height - 10);
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
      ctx.drawImage(
        this.resourceLoader.images[item.name],
        width / 2 - iconSize / 2,
        contentY,
        iconSize,
        iconSize
      );
    }

    // Draw item name
    const nameY = contentY + 120;
    ctx.font = "bold 24px Roboto";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText(item.name, width / 2, nameY);

    // Draw item description
    const descY = nameY + 40;
    ctx.font = "16px Roboto";
    ctx.fillStyle = "#cccccc";
    ctx.textAlign = "center";

    // Word wrap description
    const description = item.description || "";
    const words = description.split(" ");
    const maxWidth = width - PADDING * 4;
    let line = "";
    let lineY = descY;

    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + " ";
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && i > 0) {
        ctx.fillText(line, width / 2, lineY);
        line = words[i] + " ";
        lineY += 25;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line, width / 2, lineY);

    // Draw URL
    const urlY = lineY + 40;
    ctx.font = "14px Roboto";
    ctx.fillStyle = "#e94560";
    ctx.fillText(`Repository: ${item.url}`, width / 2, urlY);

    // Draw warning
    const warningY = urlY + 30;
    ctx.fillStyle = "#ffcc00";
    ctx.font = "14px Roboto";
    ctx.fillText(
      "Warning: This will override any existing game with the same name.",
      width / 2,
      warningY
    );

    // Draw buttons
    const buttonY = height - 50;
    const buttonWidth = 150;
    const buttonHeight = 40;
    const buttonPadding = 20;

    // Cancel button
    ctx.fillStyle = "#16213e";
    ctx.fillRect(
      width / 2 - buttonWidth - buttonPadding,
      buttonY,
      buttonWidth,
      buttonHeight
    );
    ctx.font = "16px Roboto, NotoEmoji";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText(
      "Cancel (🅰️)",
      width / 2 - buttonWidth / 2 - buttonPadding,
      buttonY + buttonHeight / 2 + 5
    );

    // Confirm button
    ctx.fillStyle = "#e94560";
    ctx.fillRect(width / 2 + buttonPadding, buttonY, buttonWidth, buttonHeight);
    ctx.fillStyle = "white";
    ctx.fillText(
      "Install (🅱️)",
      width / 2 + buttonWidth / 2 + buttonPadding,
      buttonY + buttonHeight / 2 + 5
    );
  }

  drawInstallationScreen() {
    const { ctx, width, height } = this;
    const item = this.getSelectedItem();
    if (!item) return;

    const contentY = TITLE_HEIGHT + 40;

    // Draw item name
    ctx.font = "bold 20px Roboto";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText(`Installing ${item.name}...`, width / 2, contentY);

    // Draw progress bar
    const barWidth = width * 0.7;
    const barHeight = 30;
    const barX = (width - barWidth) / 2;
    const barY = contentY + 50;

    // Draw progress bar background
    ctx.fillStyle = "#16213e";
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Draw progress
    ctx.fillStyle = "#e94560";
    ctx.fillRect(barX, barY, barWidth * this.installProgress, barHeight);

    // Draw progress percentage
    ctx.font = "16px Roboto";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText(
      `${Math.round(this.installProgress * 100)}%`,
      width / 2,
      barY + barHeight / 2 + 5
    );

    // Draw status message
    ctx.font = "16px Roboto";
    ctx.fillStyle = "#cccccc";
    ctx.textAlign = "center";
    ctx.fillText(this.installStatus, width / 2, barY + barHeight + 40);
  }

  drawInstallCompleteScreen() {
    const { ctx, width, height } = this;
    const item = this.getSelectedItem();
    if (!item) return;

    const contentY = TITLE_HEIGHT + 60;

    // Draw success icon
    ctx.font = "60px NotoEmoji";
    ctx.fillStyle = "#4CAF50";
    ctx.textAlign = "center";
    ctx.fillText("✅", width / 2, contentY);

    // Draw success message
    ctx.font = "bold 24px Roboto";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText("Installation Complete!", width / 2, contentY + 80);

    // Draw game name
    ctx.font = "18px Roboto";
    ctx.fillStyle = "#cccccc";
    ctx.textAlign = "center";
    ctx.fillText(
      `${item.name} has been installed successfully.`,
      width / 2,
      contentY + 120
    );

    // Reminder to refresh games
    ctx.font = "18px Roboto";
    ctx.fillStyle = "#cccccc";
    ctx.textAlign = "center";
    ctx.fillText(
      `Remember to refresh your games list in EmulationStation!`,
      width / 2,
      contentY + 160
    );

    // Draw button prompt
    const buttonY = height - 60;
    ctx.fillStyle = "#16213e";
    ctx.fillRect(width / 2 - 100, buttonY, 200, 40);
    ctx.font = "16px Roboto, NotoEmoji";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText("Continue (🅰️ or 🅱️)", width / 2, buttonY + 25);
  }

  async installSelectedGame() {
    const item = this.getSelectedItem();
    if (!item) return;

    console.log(`Installing game from: ${item.url}`);

    this.installing = true;
    this.installProgress = 0;
    this.installStatus = "Preparing installation...";

    // Simulate installation process with artificial delays
    try {
      // Step 1: Preparing
      await this.updateInstallProgress(0.1, "Preparing installation...", 800);

      // Step 2: Downloading repository
      await this.updateInstallProgress(0.3, "Downloading repository...", 1500);

      // Step 3: Extracting files
      await this.updateInstallProgress(0.5, "Extracting files...", 1000);

      // Step 4: Installing dependencies
      await this.updateInstallProgress(0.7, "Installing dependencies...", 1200);

      // Step 5: Configuring game
      await this.updateInstallProgress(0.9, "Configuring game...", 800);

      // Step 6: Finishing up
      await this.updateInstallProgress(1.0, "Installation complete!", 500);

      // TODO: Actual implementation would go here
      // const gameSlug = item.name.toLowerCase().replace(/\s+/g, '-');
      // const tempDir = `./temp-${gameSlug}`;
      //
      // 1. Clone repository
      // await execCommand(`git clone ${item.url} ${tempDir}`);
      //
      // 2. Install game
      // await execCommand(`mkdir -p ./games/${gameSlug}`);
      // await execCommand(`cp -r ${tempDir}/* ./games/${gameSlug}/`);
      //
      // 3. Clean up
      // await execCommand(`rm -rf ${tempDir}`);

      // Show completion screen
      this.installing = false;
      this.installComplete = true;
    } catch (error) {
      console.error("Installation failed:", error);
      this.installStatus = "Installation failed: " + error.message;
      // After a delay, go back to confirmation screen
      setTimeout(() => {
        this.installing = false;
      }, 3000);
    }
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

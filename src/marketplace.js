import { createResourceLoader, drawLoadingScreen } from "./utils.js";

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
    this.resourceLoader = createResourceLoader();
    this.loadFont();
  }

  async loadFont() {
    await this.resourceLoader.addFont("Roboto", "fonts/Roboto-Regular.ttf");
  }

  async fetchItems(url) {
    this.loading = true;
    try {
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

    const prevIndex = this.selectedIndex;

    if (input.DPAD_DOWN.pressed) {
      this.selectedIndex = Math.min(
        this.selectedIndex + 1,
        this.items.length - 1
      );
    } else if (input.DPAD_UP.pressed) {
      this.selectedIndex = Math.max(this.selectedIndex - 1, 0);
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
      if (this.selectedIndex % ITEMS_PER_PAGE === 0 && this.selectedIndex > 0) {
        this.scrollOffset -= 1;
      }

      // Ensure scroll offset is valid
      this.scrollOffset = Math.max(
        0,
        Math.min(this.scrollOffset, this.items.length - ITEMS_PER_PAGE)
      );
    }
  }

  draw() {
    const { ctx, width, height } = this;

    // Clear background
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, width, height);

    // Draw header
    ctx.fillStyle = "#0f3460";
    ctx.fillRect(0, 0, width, TITLE_HEIGHT);

    ctx.font = "24px Roboto";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText("Game Marketplace", width / 2, TITLE_HEIGHT / 2 + 8);

    if (this.loading) {
      drawLoadingScreen(
        ctx,
        this.resourceLoader.getPercentComplete(),
        "#1a1a2e",
        "#e94560"
      );
      return;
    }

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
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.moveTo(width / 2 - 10, TITLE_HEIGHT + 10);
      ctx.lineTo(width / 2 + 10, TITLE_HEIGHT + 10);
      ctx.lineTo(width / 2, TITLE_HEIGHT + 20);
      ctx.fill();
    }

    if (endIndex < this.items.length) {
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.moveTo(width / 2 - 10, height - 20);
      ctx.lineTo(width / 2 + 10, height - 20);
      ctx.lineTo(width / 2, height - 10);
      ctx.fill();
    }

    // Draw instructions
    ctx.font = "14px Roboto";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText("Use ↑/↓ to navigate", width / 2, height - 30);
  }

  getSelectedItem() {
    if (this.loading || this.items.length === 0) {
      return null;
    }
    return this.items[this.selectedIndex];
  }
}

import * as Phaser from "phaser";
import {
  ASSET_KEYS,
  CARD_HEIGHT,
  CARD_WIDTH,
  FONT_KEYS,
  NAME_LIST,
  SCENE_KEYS,
} from "../utils/common";

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.PRELOAD });
  }

  public preload(): void {
    this.load.spritesheet(
      ASSET_KEYS.CARDS,
      "assets/images/cardsLarge_tilemap_packed.png",
      {
        frameWidth: CARD_WIDTH,
        frameHeight: CARD_HEIGHT,
      }
    );
    this.load.bitmapFont(
      FONT_KEYS.MONO,
      "assets/bitmap.png",
      "assets/bitmap.xml"
    );
  }

  public create(): void {
    let player = NAME_LIST[Math.floor(Math.random() * NAME_LIST.length)];
    this.registry.set("playerName", player);
    this.scene.start(SCENE_KEYS.MAIN_MENU);
  }
}

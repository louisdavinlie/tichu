import * as Phaser from "phaser";
import { PreloadScene } from "./scenes/preload";
import { MainMenuScene } from "./scenes/main-menu";
import { GameStartScene } from "./scenes/game-start";
import { HandScene } from "./scenes/hand";

const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  pixelArt: true,
  width: 680,
  height: 360,
  scale: {
    parent: "game-container",
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  backgroundColor: "#387F3C",
  scene: [PreloadScene, MainMenuScene, GameStartScene, HandScene],
};

var game = new Phaser.Game(gameConfig);

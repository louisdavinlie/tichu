import * as Phaser from "phaser";
import { ASSET_KEYS, FONT_KEYS, SCENE_KEYS, STATE } from "../utils/common";
import io, { Socket } from "socket.io-client";

export class MainMenuScene extends Phaser.Scene {
  socket: Socket | undefined;
  constructor() {
    super({ key: SCENE_KEYS.MAIN_MENU });
  }

  public create(): void {
    let playerName = this.registry.get("playerName");
    const tichuText = this.add.bitmapText(14, 10, FONT_KEYS.MONO, "TICHU", 20);
    const nameText = this.add.bitmapText(
      14,
      50,
      FONT_KEYS.MONO,
      `you are ${playerName}`,
      17
    );

    const newGameButtonText = this.add.bitmapText(
      14,
      10,
      FONT_KEYS.MONO,
      "+ new game",
      17
    );
    const newGameButtonBox = this.add
      .rectangle(0, 0, 130, 40)
      .setOrigin(0)
      .setStrokeStyle(2, 0x000000, 0.5);
    const newGameButtonContainer = this.add
      .container(520, 20)
      .add([newGameButtonBox, newGameButtonText])
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(0, 0, 130, 40),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      });

    newGameButtonContainer.on("pointerover", () => {
      newGameButtonBox.setFillStyle(0x000000, 0.1);
    });

    newGameButtonContainer.on("pointerout", () => {
      newGameButtonBox.setFillStyle(0x000000, 0);
    });

    this.#fetchGames();

    this.socket = io("http://localhost:8081");
  }

  #createPlayerBox(
    name: string,
    points: string,
    player: number,
    gameId: string
  ) {
    let isPlayerAvailable = name == "";
    const nameText = this.add.bitmapText(
      12,
      4,
      FONT_KEYS.MONO,
      isPlayerAvailable ? "join" : name.substring(0, 5),
      12
    );
    const pointsText = this.add.bitmapText(
      0,
      -20,
      FONT_KEYS.MONO,
      `points: ${points}`,
      12
    );
    const playerBox = this.add
      .rectangle(0, 0, 60, 20)
      .setOrigin(0)
      .setStrokeStyle(2, 0x000000, 0.5)
      .setFillStyle(0x000000, isPlayerAvailable ? 0 : 0.1);
    const playerContainer = this.add
      .container(40 + 130 * (player - 1), 40)
      .add([playerBox, nameText, pointsText]);
    if (isPlayerAvailable) {
      playerContainer.setInteractive({
        hitArea: new Phaser.Geom.Rectangle(0, 0, 60, 20),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      });
    } else {
      playerContainer.disableInteractive();
    }

    playerContainer.on("pointerover", () => {
      playerBox.setFillStyle(0x000000, 0.1);
    });

    playerContainer.on("pointerout", () => {
      if (isPlayerAvailable) {
        playerBox.setFillStyle(0x000000, 0);
      }
    });

    playerContainer.on("pointerdown", async () => {
      if (isPlayerAvailable) {
        this.registry.set("gameId", gameId);
        this.registry.set("playerNumber", player);
        const dataToSend = {
          playerName: this.registry.get("playerName"),
          playerNumber: player,
        };
        await fetch(`http://localhost:8081/game/${gameId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(dataToSend),
        }).then(async (resp) => {
          if (resp.status == 200) {
            if (!resp.ok) {
              throw new Error(`HTTP error! status: ${resp.status}`);
            }

            const game = await resp.json();

            if (Object.keys(game).length == 0) {
              throw new Error(`Game not found! ID is ${gameId}`);
            }

            let isHandInProgress = false;
            let lastHandId;
            if (game.gameHands.length > 0) {
              lastHandId = game.gameHands.at(-1);
              const handResp = await fetch(
                `http://localhost:8081/hand/${lastHandId}`
              );

              if (!handResp.ok) {
                throw new Error(`HTTP error! status: ${handResp.status}`);
              }
              const hand = await handResp.json();

              if (Object.keys(hand).length == 0) {
                throw new Error(`Hand not found! ID is ${lastHandId}`);
              }

              if (hand.handState != STATE.COMPLETED) {
                isHandInProgress = true;
              }
            }

            this.socket?.emit(
              "playerJoinGame",
              gameId,
              player,
              this.socket.id,
              this.registry.get("playerName")
            );

            if (isHandInProgress) {
              this.registry.set("handId", lastHandId);
              this.scene.start(SCENE_KEYS.HAND);
            } else {
              this.scene.start(SCENE_KEYS.GAME);
            }
          }
        });
      }
    });

    this.socket?.on(
      "playerJoinGame",
      (receivedGameId, receivedPlayer, receivedPlayerName) => {
        if (receivedGameId == gameId && receivedPlayer == player) {
          playerBox.setFillStyle(0x000000, 0.1);
          playerContainer.disableInteractive();
          nameText.setText(receivedPlayerName.substring(0, 5));
          isPlayerAvailable = false;
        }
      }
    );

    this.socket?.on("playerLeftGame", (receivedGameId, receivedPlayer) => {
      if (receivedGameId == gameId && receivedPlayer == player) {
        playerBox.setFillStyle(0x000000, 0);
        playerContainer.setInteractive({
          hitArea: new Phaser.Geom.Rectangle(0, 0, 60, 20),
          hitAreaCallback: Phaser.Geom.Rectangle.Contains,
          useHandCursor: true,
        });
        nameText.setText("join");
        isPlayerAvailable = true;
      }
    });

    return playerContainer;
  }

  async #fetchGames() {
    const apiUrl = "http://localhost:8081/games";

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const games = await response.json(); // Or response.text() if it's not JSON

      console.log("Fetched data:", games);

      for (var i = 0; i < games.length; i++) {
        const game = games[i];

        const gamePlayersText = this.add.bitmapText(
          540,
          10,
          FONT_KEYS.MONO,
          `hands: ${game.gameHands.length}/20`,
          12
        );
        const gameStateText = this.add.bitmapText(
          490,
          35,
          FONT_KEYS.MONO,
          `status: ${game.gameState.replace("_", " ")}`,
          12
        );
        const gameIdText = this.add.bitmapText(
          410,
          60,
          FONT_KEYS.MONO,
          `game id: ${game.gameId}`,
          12
        );

        // Player 1
        const p1Container = this.#createPlayerBox(
          game.p1Name,
          game.p1Points,
          1,
          game.gameId
        );

        // Player 2
        const p2Container = this.#createPlayerBox(
          game.p2Name,
          game.p2Points,
          2,
          game.gameId
        );

        // Player 3
        const p3Container = this.#createPlayerBox(
          game.p3Name,
          game.p3Points,
          3,
          game.gameId
        );

        const gameBox = this.add
          .rectangle(0, 0, 640, 80)
          .setOrigin(0)
          .setStrokeStyle(2, 0x000000, 0.5);
        const gameContainer = this.add
          .container(20, 100)
          .add([
            gameBox,
            gameIdText,
            gameStateText,
            gamePlayersText,
            p1Container,
            p2Container,
            p3Container,
          ]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }

  #destroy() {
    this.socket?.removeAllListeners("playerJoinGame");
    this.socket?.removeAllListeners("playerLeftGame");
  }
}

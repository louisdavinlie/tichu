import { io, Socket } from "socket.io-client";
import { ASSET_KEYS, FONT_KEYS, SCENE_KEYS, STATE } from "../utils/common";

export class GameStartScene extends Phaser.Scene {
  socket: Socket | undefined;
  constructor() {
    super({ key: SCENE_KEYS.GAME });
  }

  public create(): void {
    let gameId = this.registry.get("gameId");
    this.#fetchGame(gameId);
    this.socket = io("http://localhost:8081");
  }

  async #fetchGame(gameId: string) {
    const apiUrl = `http://localhost:8081/game/${gameId}`;

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const game = await response.json();

      if (Object.keys(game).length == 0) {
        throw new Error(`Game not found! ID is ${gameId}`);
      }

      let isHandInProgress = false;
      if (game.gameHands.length > 0) {
        const lastHandId = game.gameHands.at(-1);
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

      if (!isHandInProgress) {
        this.#createDeckImage();

        const playerNumber = this.registry.get("playerNumber");
        const playerName = this.registry.get("playerName");

        for (var i = 1; i < 4; i++) {
          const playerPoints =
            i == 1 ? game.p1Points : i == 2 ? game.p2Points : game.p3Points;
          if (i == playerNumber) {
            this.#createPlayerBox(
              280,
              280,
              playerNumber,
              playerName,
              playerPoints
            );
            continue;
          }

          const otherPlayerName =
            i == 1 ? game.p1Name : i == 2 ? game.p2Name : game.p3Name;

          this.#createPlayerBox(
            (playerNumber + 1) % 3 == i % 3 ? 10 : 570,
            150,
            i,
            otherPlayerName,
            playerPoints
          );
        }

        let playersCount = this.#createPlayerCount(
          game.p1Name,
          game.p2Name,
          game.p3Name
        );

        if (playerNumber == 1) {
          this.#createStartHandButton(playersCount, gameId);
        }
      }

      this.socket?.once(
        "startHand",
        (receivedGameId, receivedHandId, receivedSocketId) => {
          if (receivedGameId == gameId && receivedSocketId != this.socket?.id) {
            console.log("TEST");
            this.registry.set("handId", receivedHandId);
            this.scene.start(SCENE_KEYS.HAND);
          }
        }
      );
    } catch (e) {
      console.error("Error fetching data:", e);
    }
  }

  #createStartHandButton(playersCount: number, gameId: string) {
    let allPlayersReady = playersCount == 3;
    const startHandButtonText = this.add.bitmapText(
      14,
      10,
      FONT_KEYS.MONO,
      "start hand",
      17
    );
    const startHandButtonBox = this.add
      .rectangle(0, 0, 130, 40)
      .setOrigin(0)
      .setStrokeStyle(2, 0x000000, 0.5)
      .setFillStyle(0x000000, allPlayersReady ? 0 : 0.1);
    const startHandButtonContainer = this.add
      .container(520, 20)
      .add([startHandButtonBox, startHandButtonText])
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(0, 0, 130, 40),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      });

    startHandButtonContainer.on("pointerover", () => {
      startHandButtonBox.setFillStyle(0x000000, 0.1);
    });

    startHandButtonContainer.on("pointerout", () => {
      if (allPlayersReady) {
        startHandButtonBox.setFillStyle(0x000000, 0);
      }
    });

    startHandButtonContainer.on("pointerdown", async () => {
      if (allPlayersReady) {
        console.log("IM CLICKED");
        await fetch(`http://localhost:8081/game/${gameId}/start_hand`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }).then(async (resp) => {
          if (resp.status == 200) {
            let hand = await resp.json();
            this.registry.set("handId", hand.handId);
            this.socket?.emit("startHand", gameId, hand.handId);
            this.scene.start(SCENE_KEYS.HAND);
          }
        });
      }
    });

    this.socket?.on(
      "playerJoinGame",
      (receivedGameId, receivedPlayer, receivedPlayerName) => {
        playersCount += 1;
        if (playersCount == 3) {
          startHandButtonBox.setFillStyle(0x000000, 0);
          startHandButtonContainer.setInteractive({
            hitArea: new Phaser.Geom.Rectangle(0, 0, 130, 40),
            hitAreaCallback: Phaser.Geom.Rectangle.Contains,
            useHandCursor: true,
          });
          allPlayersReady = true;
        }
      }
    );

    this.socket?.on("playerLeftGame", (receivedGameId, receivedPlayer) => {
      playersCount -= 1;
      if (3 > playersCount) {
        startHandButtonBox.setFillStyle(0x000000, 0.1);
        startHandButtonContainer.disableInteractive();
        allPlayersReady = false;
      }
    });
  }

  #createDeckImage() {
    for (var i = 0; i < 3; i++) {
      this.add.image(
        this.cameras.main.width / 2 + i,
        this.cameras.main.height / 2,
        ASSET_KEYS.CARDS,
        27
      );
    }
  }

  #createPlayerBox(
    x: number,
    y: number,
    playerNumber: number,
    name: string,
    points: number
  ) {
    const playerText = this.add.bitmapText(
      x,
      y,
      FONT_KEYS.MONO,
      `player ${playerNumber}:`,
      17
    );
    const playerNameText = this.add.bitmapText(
      x,
      y + 20,
      FONT_KEYS.MONO,
      `${name}${
        playerNumber == this.registry.get("playerNumber") ? " (you)" : ""
      }`,
      17
    );
    const playerPointsText = this.add.bitmapText(
      x,
      y + 40,
      FONT_KEYS.MONO,
      `${points} points`,
      17
    );

    this.socket?.on(
      "playerJoinGame",
      (receivedGameId, receivedPlayer, receivedPlayerName) => {
        if (receivedPlayer == playerNumber) {
          playerNameText.setText(receivedPlayerName);
        }
      }
    );

    this.socket?.on("playerLeftGame", (receivedGameId, receivedPlayer) => {
      if (receivedPlayer == playerNumber) {
        playerNameText.setText("");
      }
    });
  }

  #createPlayerCount(p1Name: string, p2Name: string, p3Name: string) {
    let count = 0;
    if (p1Name != "") {
      count += 1;
    }
    if (p2Name != "") {
      count += 1;
    }
    if (p3Name != "") {
      count += 1;
    }
    let countText = this.add.bitmapText(
      10,
      30,
      FONT_KEYS.MONO,
      `${count}/3 player(s) are in the game`,
      17
    );

    this.socket?.on(
      "playerJoinGame",
      (receivedGameId, receivedPlayer, receivedPlayerName) => {
        count += 1;
        countText.setText(`${count}/3 player(s) are in the game`);
      }
    );

    this.socket?.on("playerLeftGame", (receivedGameId, receivedPlayer) => {
      count -= 1;
      countText.setText(`${count}/3 player(s) are in the game`);
    });

    return count;
  }

  #destroy() {
    this.socket?.removeAllListeners("playerJoinGame");
    this.socket?.removeAllListeners("playerLeftGame");
  }
}

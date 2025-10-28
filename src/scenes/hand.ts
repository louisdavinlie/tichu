import { io, type Socket } from "socket.io-client";
import {
  ASSET_KEYS,
  FONT_KEYS,
  HAND_ACTION,
  SCENE_KEYS,
  STATE,
  type State,
} from "../utils/common";

export class HandScene extends Phaser.Scene {
  socket: Socket | undefined;
  constructor() {
    super({ key: SCENE_KEYS.HAND });
  }

  public create(): void {
    this.socket = io("http://3.25.63.217:8081");
    let handId = this.registry.get("handId");
    this.#fetchHand(handId);

    this.socket?.on("playerWin", (receivedHandId, _receivedPlayerNumber) => {
      if (handId == receivedHandId) {
        this.scene;
        this.scene.start(SCENE_KEYS.GAME);
      }
    });
  }

  async #fetchHand(handId: string) {
    const apiUrl = `http://3.25.63.217:8081/hand/${handId}`;

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const hand = await response.json();
      console.log(hand);

      if (Object.keys(hand).length == 0) {
        throw new Error(`Hand not found! ID is ${handId}`);
      }

      const playerNumber = this.registry.get("playerNumber");

      let playerCards =
        playerNumber == 1
          ? hand.p1Cards
          : playerNumber == 2
          ? hand.p2Cards
          : hand.p3Cards;

      let selected = new Set<any>();
      let cardImages = [];

      for (let i = 0; i < playerCards.length; i++) {
        let card = this.add
          .image(80 + i * 25, 300, ASSET_KEYS.CARDS, playerCards[i].imageIndex)
          .setInteractive({
            hitArea: new Phaser.Geom.Rectangle(10, 0, 64, 64),
            hitAreaCallback: Phaser.Geom.Rectangle.Contains,
            useHandCursor: true,
          });
        cardImages.push(card);
        card.on("pointerdown", () => {
          if (selected.has(playerCards[i])) {
            card.setY(300);
            selected.delete(playerCards[i]);
          } else {
            card.setY(280);
            selected.add(playerCards[i]);
          }
        });
      }

      for (var i = 1; i < 4; i++) {
        if (i == playerNumber) {
          continue;
        }
        this.#createOtherPlayerBox(
          (playerNumber + 1) % 3 == i % 3 ? 10 : 600,
          80,
          i,
          hand
        );
      }

      this.#createPointBox(hand.runningPoint, hand.handState);
      this.#createActionButtons(
        hand.turn,
        hand.handId,
        hand.handState as State,
        playerNumber,
        selected
      );
      this.#createCardHistory(
        Object.keys(hand.cardHistory).map((key) => hand.cardHistory[key])
      );

      this.socket?.on(
        "cardsPlayed",
        (
          receivedHandId,
          receivedPlayerNumber,
          receivedSelectedCards,
          _receivedCardHistory
        ) => {
          if (
            receivedHandId == handId &&
            receivedPlayerNumber == playerNumber
          ) {
            for (let i = 0; i < receivedSelectedCards.length; i++) {
              for (let j = 0; j < playerCards.length; j++) {
                let receivedSelectedCard = receivedSelectedCards[i];
                let card = playerCards[j];
                if (card.imageIndex == receivedSelectedCard.imageIndex) {
                  cardImages[j].setVisible(false);
                }
              }
            }
          }
        }
      );

      this.socket?.on(
        "displayBankCardsToBanker",
        (receivedHandId, receivedBankerNumber) => {
          if (
            handId == receivedHandId &&
            playerNumber == receivedBankerNumber
          ) {
            playerCards.push(...hand.bankCards);
            for (
              let i = playerCards.length - hand.bankCards.length;
              i < playerCards.length;
              i++
            ) {
              let card = this.add
                .image(
                  80 + i * 25,
                  300,
                  ASSET_KEYS.CARDS,
                  playerCards[i].imageIndex
                )
                .setInteractive({
                  hitArea: new Phaser.Geom.Rectangle(10, 0, 64, 64),
                  hitAreaCallback: Phaser.Geom.Rectangle.Contains,
                  useHandCursor: true,
                });
              cardImages.push(card);
              card.on("pointerdown", () => {
                if (selected.has(playerCards[i])) {
                  card.setY(300);
                  selected.delete(playerCards[i]);
                } else {
                  card.setY(280);
                  selected.add(playerCards[i]);
                }
              });
            }
          }
        }
      );
    } catch (e) {
      console.error("Error fetching data:", e);
    }
  }

  #createOtherPlayerBox(x: number, y: number, playerNumber: number, hand: any) {
    let handState = hand.handState as State;
    const playerText = this.add.bitmapText(
      x,
      y,
      FONT_KEYS.MONO,
      `${hand.banker == playerNumber ? "banker" : "player"} ${playerNumber}`,
      13
    );

    const turnText = this.add
      .bitmapText(x, y + 12, FONT_KEYS.MONO, "(action)", 13)
      .setVisible(hand.turn == playerNumber);

    let card1 = this.add.image(x + 30, y + 50, ASSET_KEYS.CARDS, 27);
    card1.angle = 90;

    let card2ImgIdx = 27;
    if (handState == STATE.PRE_ROUND) {
      let playerCards: Array<any> =
        playerNumber == 1
          ? hand.p1Cards
          : playerNumber == 2
          ? hand.p2Cards
          : hand.p3Cards;

      for (let i = 0; i < playerCards.length; i++) {
        let card = playerCards[i];
        if (
          card.value == hand.revealedCard.value &&
          card.suit == hand.revealedCard.suit
        ) {
          card2ImgIdx = card.imageIndex;
          continue;
        }
      }
    }

    let card2 = this.add.image(x + 30, y + 70, ASSET_KEYS.CARDS, card2ImgIdx);
    card2.angle = 90;

    this.socket?.on(
      "handAction",
      (receivedHandId, receivedPlayerNumber, _c, _d, receivedBanker) => {
        if (receivedHandId == hand.handId) {
          turnText.setVisible(playerNumber == receivedPlayerNumber);
          if (playerNumber == receivedBanker) {
            playerText.setText(`banker ${playerNumber}`);
          } else {
            playerText.setText(`player ${playerNumber}`);
          }
        }
      }
    );
  }

  #createPointBox(points: number, handState: State) {
    const pointText = this.add.bitmapText(
      10,
      30,
      FONT_KEYS.MONO,
      `points: ${points}`,
      13
    );
    const handStateText = this.add.bitmapText(
      10,
      50,
      FONT_KEYS.MONO,
      `${handState.replace("_", " ").toLowerCase()}`,
      13
    );

    this.socket?.on(
      "handAction",
      (receivedHandId, _b, receivedHandState, receivedRunningPoints, _e) => {
        if (this.registry.get("handId") == receivedHandId) {
          pointText.setText(`points: ${receivedRunningPoints}`);
          handStateText.setText(
            `${receivedHandState.replace("_", " ").toLowerCase()}`
          );
        }
      }
    );
  }

  #createActionButtons(
    turn: number,
    handId: string,
    handState: State,
    playerNumber: number,
    selected: Set<any>
  ) {
    let currentHandState = handState;
    const undoText = this.add.bitmapText(12, 4, FONT_KEYS.MONO, "undo", 12);
    const undoBox = this.add
      .rectangle(0, 0, 55, 20)
      .setOrigin(0)
      .setStrokeStyle(2, 0x000000, 0.5)
      .setFillStyle(0x000000, 0);
    const undoContainer = this.add
      .container(200, 220)
      .add([undoBox, undoText])
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(0, 0, 55, 20),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      });
    undoContainer.on("pointerover", () => {
      undoBox.setFillStyle(0x000000, 0.1);
    });

    undoContainer.on("pointerout", () => {
      undoBox.setFillStyle(0x000000, 0);
    });

    const passText = this.add.bitmapText(12, 4, FONT_KEYS.MONO, "pass", 12);
    const passBox = this.add
      .rectangle(0, 0, 55, 20)
      .setOrigin(0)
      .setStrokeStyle(2, 0x000000, 0.5)
      .setFillStyle(0x000000, 0);
    const passContainer = this.add
      .container(300, 220)
      .add([passBox, passText])
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(0, 0, 55, 20),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      });
    passContainer.on("pointerover", () => {
      passBox.setFillStyle(0x000000, 0.1);
    });
    passContainer.on("pointerout", () => {
      passBox.setFillStyle(0x000000, 0);
    });
    passContainer.on("pointerdown", () => {
      this.socket?.emit(
        "handAction",
        this.registry.get("gameId"),
        handId,
        playerNumber,
        [],
        HAND_ACTION.PASS
      );
    });

    // Call/Raise Action
    const callText = this.add.bitmapText(12, 4, FONT_KEYS.MONO, "call", 12);
    const callBox = this.add
      .rectangle(0, 0, 55, 20)
      .setOrigin(0)
      .setStrokeStyle(2, 0x000000, 0.5)
      .setFillStyle(0x000000, 0);
    const callContainer = this.add
      .container(400, 220)
      .add([callBox, callText])
      .setInteractive({
        hitArea: new Phaser.Geom.Rectangle(0, 0, 55, 20),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true,
      });
    callContainer.on("pointerover", () => {
      callBox.setFillStyle(0x000000, 0.1);
    });
    callContainer.on("pointerout", () => {
      callBox.setFillStyle(0x000000, 0);
    });
    callContainer.on("pointerdown", () => {
      if (selected.size > 0 || currentHandState != STATE.IN_PROGRESS) {
        this.socket?.emit(
          "handAction",
          this.registry.get("gameId"),
          handId,
          playerNumber,
          [...selected],
          HAND_ACTION.CALL
        );
        if (currentHandState == STATE.IN_PROGRESS) {
          selected.clear();
        }
      }
    });

    // undoContainer.setVisible(turn == playerNumber);
    undoContainer.setVisible(false);
    passContainer.setVisible(turn == playerNumber);
    callContainer.setVisible(turn == playerNumber);

    this.socket?.on(
      "handAction",
      (receivedHandId, receivedPlayerNumber, receivedHandState, _d, _e) => {
        if (receivedHandId == handId) {
          //   undoContainer.setVisible(receivedPlayerNumber == playerNumber);
          passContainer.setVisible(receivedPlayerNumber == playerNumber);
          callContainer.setVisible(receivedPlayerNumber == playerNumber);
          currentHandState = receivedHandState;
        }
      }
    );
  }

  #createCardHistory(cardHistory: Array<Array<any>>) {
    let cardImages = [];
    for (
      let i = cardHistory.length - Math.min(5, cardHistory.length);
      i < cardHistory.length;
      i++
    ) {
      for (let j = 0; j < cardHistory[i].length; j++) {
        let card = cardHistory[i][j];
        let cardImage = this.add.image(
          200 + j * 25,
          50 + (i - cardHistory.length + Math.min(5, cardHistory.length)) * 20,
          ASSET_KEYS.CARDS,
          card.imageIndex
        );
        cardImages.push(cardImage);
      }
    }

    this.socket?.on(
      "cardsPlayed",
      (receivedHandId, _b, _c, receivedCardHistory) => {
        if (receivedHandId == this.registry.get("handId")) {
          for (let i = 0; i < cardImages.length; i++) {
            cardImages[i].destroy();
          }

          for (
            let i =
              receivedCardHistory.length -
              Math.min(5, receivedCardHistory.length);
            i < receivedCardHistory.length;
            i++
          ) {
            for (let j = 0; j < receivedCardHistory[i].length; j++) {
              let card = receivedCardHistory[i][j];
              let cardImage = this.add.image(
                200 + j * 25,
                50 +
                  (i -
                    receivedCardHistory.length +
                    Math.min(5, receivedCardHistory.length)) *
                    20,
                ASSET_KEYS.CARDS,
                card.imageIndex
              );
              cardImages.push(cardImage);
            }
          }
        }
      }
    );
  }
}

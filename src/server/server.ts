import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { Game } from "../lib/game.ts";
import supabase from "./supabase.ts";
import { CARD_SUIT, HAND_ACTION, STATE, type State } from "../utils/common.ts";
import { Hand } from "../lib/hand.ts";
import { Card } from "../lib/card.ts";
import { Deck } from "../lib/deck.ts";

const corsOptions = {
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE", // Allowed HTTP methods
  credentials: true, // Allow sending cookies and authorization headers
};

var app = express();
var server = createServer(app);
var io = new Server(server, {
  cors: {
    methods: ["GET", "POST"],
  },
});

app.use(cors(corsOptions));
app.use(express.json());

server.listen(8081, () => {
  console.log("Listening on 8081");
});

app.post("/new_game", async (_req, _res) => {
  let game = new Game();
  await game.save();
});

app.get("/games", async (_req, res) => {
  const { data } = await supabase
    .from("games")
    .select("*")
    .eq("gameState", "IN_PROGRESS");

  let games: Array<Game> = [];

  data?.forEach((game) => {
    games.push(
      new Game(
        game.gameId,
        game.p1Name,
        game.p1Points,
        game.p2Name,
        game.p2Points,
        game.p3Name,
        game.p3Points,
        game.gameHands,
        game.gameState
      )
    );
  });

  res.send(games);
});

app.get("/game/:gameId", async (req, res) => {
  const gameId = req.params.gameId;
  res.send(await getGame(gameId));
});

app.post("/game/:gameId", async (req, res) => {
  const playerNumber = req.body.playerNumber as number;
  const playerName = req.body.playerName;
  const gameId = req.params.gameId;

  let game = (await getGame(gameId)) as Game;

  if (playerNumber == 1) {
    game.p1Name = playerName;
  } else if (playerNumber == 2) {
    game.p2Name = playerName;
  } else if (playerNumber == 3) {
    game.p3Name = playerName;
  }

  await game.update();

  res.status(200).send(game);
});

app.post("/game/:gameId/start_hand", async (req, res) => {
  const gameId = req.params.gameId;
  let game = (await getGame(gameId)) as Game;

  let lastHandId = game.getLastHandId();

  if (lastHandId) {
    let lastHand = (await getHand(lastHandId)) as Hand;
    if (lastHand.handState != STATE.COMPLETED) {
      console.log(`There is a hand in progress ${lastHandId}`);
      return;
    }
  }

  let hand = await game.startHand();

  res.status(200).send(hand.toJSON());
});

app.get("/hand/:handId", async (req, res) => {
  const handId = req.params.handId;
  res.send(await getHand(handId));
});

async function getGame(gameId: string): Promise<Game | void> {
  const { data } = await supabase
    .from("games")
    .select("*")
    .eq("gameId", gameId);

  let game = data != null ? data[0] : null;

  if (game == null) {
    console.error(`Game ID ${gameId} is not found on DB`);
    return;
  }

  return new Game(
    game.gameId,
    game.p1Name,
    game.p1Points,
    game.p2Name,
    game.p2Points,
    game.p3Name,
    game.p3Points,
    game.gameHands,
    game.gameState
  );
}

async function getHand(handId: string): Promise<Hand | void> {
  const { data } = await supabase
    .from("hands")
    .select("*")
    .eq("handId", handId);

  let hand = data != null ? data[0] : null;

  if (hand == null) {
    console.error(`Hand ID ${handId} is not found on DB`);
    return;
  }

  // Initial Deck
  const initialDeckCards = hand.initialDeck.cards;
  let initialDeck = [];
  for (let i = 0; i < initialDeckCards.length; i++) {
    let card = initialDeckCards[i];
    initialDeck.push(
      new Card(card.suit, card.value, card.imageIndex, card.faceUp)
    );
  }
  let initialDeckObj = new Deck(initialDeck);

  // P1 Cards
  let p1Cards = [];
  for (let i = 0; i < hand.p1Cards.length; i++) {
    let card = hand.p1Cards[i];
    p1Cards.push(new Card(card.suit, card.value, card.imageIndex, card.faceUp));
  }

  // P2 Cards
  let p2Cards = [];
  for (let i = 0; i < hand.p2Cards.length; i++) {
    let card = hand.p2Cards[i];
    p2Cards.push(new Card(card.suit, card.value, card.imageIndex, card.faceUp));
  }

  // P3 Cards
  let p3Cards = [];
  for (let i = 0; i < hand.p3Cards.length; i++) {
    let card = hand.p3Cards[i];
    p3Cards.push(new Card(card.suit, card.value, card.imageIndex, card.faceUp));
  }

  // Bank Cards
  let bankCards = [];
  for (let i = 0; i < hand.bankCards.length; i++) {
    let card = hand.bankCards[i];
    bankCards.push(
      new Card(card.suit, card.value, card.imageIndex, card.faceUp)
    );
  }

  // Revealed Card
  let revealedCard = new Card(
    hand.revealedCard.suit,
    hand.revealedCard.value,
    hand.revealedCard.imageIndex,
    hand.revealedCard.faceUp
  );

  // Card History
  let cardHistory = [];
  for (let i = 0; i < Object.keys(hand.cardHistory).length; i++) {
    let cards = [];
    for (let j = 0; j < hand.cardHistory[i].length; j++) {
      let card = hand.cardHistory[i][j];
      cards.push(new Card(card.suit, card.value, card.imageIndex, card.faceUp));
    }
    cardHistory.push(cards);
  }

  return new Hand(
    hand.handId,
    initialDeckObj,
    p1Cards,
    p2Cards,
    p3Cards,
    bankCards,
    revealedCard,
    cardHistory,
    hand.banker,
    hand.initialBanker,
    hand.lastRaiser,
    hand.runningPoint,
    hand.handState,
    hand.winner,
    hand.turn
  );
}

function getNextPlayer(currentPlayer: number): number {
  return currentPlayer + 1 > 3 ? (currentPlayer + 1) % 3 : currentPlayer + 1;
}

var allClients = new Map();
io.on("connection", (socket) => {
  socket.on("playerJoinGame", (gameId, player, socketId, name) => {
    allClients.set(socketId, { gameId: gameId, player: player });
    socket.broadcast.emit("playerJoinGame", gameId, player, name);
  });

  socket.on("startHand", (gameId, handId) => {
    console.log("START HAND")
    socket.broadcast.emit("startHand", gameId, handId, socket.id);
  });

  socket.on(
    "handAction",
    async (gameId, handId, playerNumber, selectedCards, handAction) => {
      let hand = (await getHand(handId)) as Hand;
      hand.turn = getNextPlayer(playerNumber);
      if (hand.handState == STATE.PRE_ROUND) {
        if (handAction == HAND_ACTION.CALL) {
          hand.runningPoint = hand.runningPoint * 2;
          hand.banker = playerNumber;
          if (
            (hand.revealedCard.suit != CARD_SUIT.RED_JOKER &&
              hand.runningPoint == 16) ||
            (hand.revealedCard.suit == CARD_SUIT.RED_JOKER &&
              hand.runningPoint == 32)
          ) {
            hand.handState = STATE.IN_PROGRESS as State;
            hand.addCards(hand.banker, hand.bankCards);
            hand.turn = hand.banker;
            io.emit("displayBankCardsToBanker", handId, hand.banker);
          }
          hand.lastRaiser = playerNumber;
        } else if (handAction == HAND_ACTION.PASS) {
          if (getNextPlayer(playerNumber) == hand.lastRaiser) {
            hand.banker = getNextPlayer(playerNumber);
            hand.handState = STATE.IN_PROGRESS as State;
            hand.addCards(hand.banker, hand.bankCards);
            hand.turn = hand.banker;
            io.emit("displayBankCardsToBanker", handId, hand.banker);
          }
        }
      } else if (hand.handState == STATE.IN_PROGRESS) {
        if (handAction == HAND_ACTION.CALL) {
          let cards: Array<Card> = selectedCards.map(
            (card: any) =>
              new Card(card.suit, card.value, card.imageIndex, card.faceUp)
          );
          const hasPlayedAllCards = hand.removeCards(playerNumber, cards);
          hand.addToCardHistory(cards);
          if (
            Hand.isBomb(cards) ||
            (hasPlayedAllCards && cards.some((card) => card.value == 3))
          ) {
            hand.runningPoint = hand.runningPoint * 2;
          }
          io.emit(
            "cardsPlayed",
            handId,
            playerNumber,
            selectedCards,
            hand.cardHistory.map((cards) => cards.map((card) => card.toJSON()))
          );

          if (hasPlayedAllCards) {
            let game = (await getGame(gameId)) as Game;
            hand.turn = playerNumber;
            hand.handState = STATE.COMPLETED as State;
            hand.winner = playerNumber;
            if (hand.winner == hand.banker) {
              if (hand.winner == 1) {
                game.p1Points = game.p1Points + hand.runningPoint * 2;
                game.p2Points = game.p2Points - hand.runningPoint;
                game.p3Points = game.p3Points - hand.runningPoint;
              } else if (hand.winner == 2) {
                game.p1Points = game.p1Points - hand.runningPoint;
                game.p2Points = game.p2Points + hand.runningPoint * 2;
                game.p3Points = game.p3Points - hand.runningPoint;
              } else if (hand.winner == 3) {
                game.p1Points = game.p1Points - hand.runningPoint;
                game.p2Points = game.p2Points - hand.runningPoint;
                game.p3Points = game.p3Points + hand.runningPoint * 2;
              }
            } else {
              if (hand.banker == 1) {
                game.p1Points = game.p1Points - hand.runningPoint * 2;
                game.p2Points = game.p2Points + hand.runningPoint;
                game.p3Points = game.p3Points + hand.runningPoint;
              } else if (hand.banker == 2) {
                game.p1Points = game.p1Points + hand.runningPoint;
                game.p2Points = game.p2Points - hand.runningPoint * 2;
                game.p3Points = game.p3Points + hand.runningPoint;
              } else if (hand.banker == 3) {
                game.p1Points = game.p1Points + hand.runningPoint;
                game.p2Points = game.p2Points + hand.runningPoint;
                game.p3Points = game.p3Points - hand.runningPoint * 2;
              }
            }
            await game.update();
            io.emit("playerWin", handId, playerNumber);
          }
        }
      }
      await hand.update();
      io.emit(
        "handAction",
        handId,
        hand.turn,
        hand.handState,
        hand.runningPoint,
        hand.banker
      );
    }
  );

  socket.on("disconnect", async () => {
    if (allClients.has(socket.id)) {
      let playerInfo = allClients.get(socket.id);
      let game = (await getGame(playerInfo.gameId)) as Game;
      if (playerInfo.player == 1) {
        game.p1Name = "";
      } else if (playerInfo.player == 2) {
        game.p2Name = "";
      } else if (playerInfo.player == 3) {
        game.p3Name = "";
      }
      await game.update();
      socket.broadcast.emit(
        "playerLeftGame",
        playerInfo.gameId,
        playerInfo.player
      );
    }
  });
});

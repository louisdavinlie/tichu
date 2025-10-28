import { nanoid } from "nanoid";
import { CARD_SUIT, STATE, type State } from "../utils/common.ts";
import type { Card } from "./card.ts";
import { Deck } from "./deck.ts";
import supabase from "../server/supabase.ts";

export class Hand {
  #id: string;
  #initialDeck: Deck;
  #p1Cards: Array<Card>;
  #p2Cards: Array<Card>;
  #p3Cards: Array<Card>;
  #bankCards: Array<Card>;
  revealedCard: Card;
  #cardHistory: Array<Array<Card>>;
  runningPoint: number;
  handState: State;
  winner?: number;
  turn: number;
  banker: number;
  #initialBanker: number;
  lastRaiser: number;

  constructor(
    id: string,
    initialDeck: Deck,
    p1Cards: Array<Card>,
    p2Cards: Array<Card>,
    p3Cards: Array<Card>,
    bankCards: Array<Card>,
    revealedCard: Card,
    cardHistory: Array<Array<Card>>,
    banker: number,
    initialBanker: number,
    lastRaiser: number,
    runningPoint?: number,
    handState?: State,
    winner?: number,
    turn?: number
  ) {
    this.#id = id;
    this.#initialDeck = initialDeck;
    this.#p1Cards = p1Cards;
    this.#p2Cards = p2Cards;
    this.#p3Cards = p3Cards;
    this.#bankCards = bankCards;
    this.revealedCard = revealedCard;
    this.#cardHistory = cardHistory;
    this.banker = banker;
    this.#initialBanker = initialBanker;
    this.lastRaiser = lastRaiser;
    this.runningPoint = runningPoint ?? 2;
    this.handState = handState ?? (STATE.PRE_ROUND as State);
    this.winner = winner;
    this.turn = turn ?? 1; // Default first to be dealt
  }

  get id(): string {
    return this.#id;
  }

  get initialBanker(): number {
    return this.#initialBanker;
  }

  get bankCards(): Array<Card> {
    return this.#bankCards;
  }

  static async startHand(turn: number = 1): Promise<Hand> {
    let runningDeck = new Deck();
    const initialDeck = runningDeck.copy();
    const revealedCard =
      runningDeck.cards[
        Math.floor(Math.random() * (runningDeck.cards.length - 15))
      ];
    const cards: Array<Array<Card>> = [[], [], [], []];

    // First 12 cards
    cards[(turn - 1) % 4].push(...Hand.#drawThreeCards(runningDeck));
    cards[turn % 4].push(...Hand.#drawThreeCards(runningDeck));
    cards[(turn + 1) % 4].push(...Hand.#drawThreeCards(runningDeck));
    cards[(turn + 2) % 4].push(...Hand.#drawThreeCards(runningDeck));

    // Next 36 cards
    for (let i = 0; i < 4; i++) {
      cards[(turn - 1) % 3].push(...Hand.#drawThreeCards(runningDeck));
      cards[turn % 3].push(...Hand.#drawThreeCards(runningDeck));
      cards[(turn + 1) % 3].push(...Hand.#drawThreeCards(runningDeck));
    }

    // Last 6 cards
    for (let i = 0; i < 2; i++) {
      let card = runningDeck.draw();
      if (card) {
        cards[(turn - 1) % 3].push(card);
      }
      card = runningDeck.draw();
      if (card) {
        cards[turn % 3].push(card);
      }
      card = runningDeck.draw();
      if (card) {
        cards[(turn + 1) % 3].push(card);
      }
    }
    let banker = 0;
    // Check whose turn is next
    for (let i = 1; i < 4; i++) {
      let playerCards = cards[i - 1];
      for (let j = 0; j < playerCards.length; j++) {
        if (revealedCard.isEqual(playerCards[j])) {
          banker = i;
          turn = i + 1 > 3 ? (i + 1) % 3 : i + 1;
        }
      }
    }

    for (let i = 0; i < cards.length; i++) {
      cards[i].sort((a, b) => a.value - b.value);
    }

    let newHand = new Hand(
      nanoid(),
      initialDeck,
      cards[0],
      cards[1],
      cards[2],
      cards[3],
      revealedCard,
      [],
      banker,
      banker,
      banker,
      revealedCard.suit == CARD_SUIT.RED_JOKER ? 4 : 2,
      STATE.PRE_ROUND as State,
      undefined,
      turn
    );

    await newHand.save();

    return newHand;
  }

  public async save(): Promise<void> {
    await supabase.from("hands").insert([this.toJSON()]);
  }

  public async update(): Promise<void> {
    await supabase
      .from("hands")
      .update(this.toJSON())
      .eq("handId", this.#id);
  }

  static #drawThreeCards(runningDeck: Deck): Array<Card> {
    let cards = [];
    for (let i = 0; i < 3; i++) {
      let card = runningDeck.draw();
      if (card) {
        cards.push(card);
      }
    }

    return cards;
  }

  public removeCards(playerNumber: number, cards: Array<Card>): boolean {
    let playerCards =
      playerNumber == 1
        ? this.#p1Cards
        : playerNumber == 2
        ? this.#p2Cards
        : this.#p3Cards;

    for (let i = 0; i < cards.length; i++) {
      for (let j = 0; j < playerCards.length; j++) {
        let card = cards[i];
        let playerCard = playerCards[j];
        if (card.isEqual(playerCard)) {
          playerCards.splice(j, 1);
        }
      }
    }

    return playerCards.length == 0;
  }

  public addCards(playerNumber: number, cards: Array<Card>) {
    let playerCards =
      playerNumber == 1
        ? this.#p1Cards
        : playerNumber == 2
        ? this.#p2Cards
        : this.#p3Cards;

    playerCards.push(...cards);
  }

  get cardHistory(): Array<Array<Card>> {
    return this.#cardHistory;
  }

  public addToCardHistory(cards: Array<Card>) {
    this.#cardHistory.push(cards);
  }

  static isBomb(cards: Array<Card>): boolean {
    if (cards.length == 0) {
      return false;
    }
    const firstValue = cards[0].value;
    return (
      (cards.length == 4 && cards.every((card) => card.value == firstValue)) ||
      (cards.length == 2 && firstValue == 0 && cards[1].value == 0)
    );
  }

  public toJSON(): object {
    let cardHistory = new Map();
    for (let i = 0; i < this.#cardHistory.length; i++) {
      cardHistory.set(i, this.#cardHistory[i]);
    }
    return {
      handId: this.#id,
      initialDeck: this.#initialDeck.toJSON(),
      p1Cards: this.#p1Cards.map((card) => card.toJSON()),
      p2Cards: this.#p2Cards.map((card) => card.toJSON()),
      p3Cards: this.#p3Cards.map((card) => card.toJSON()),
      bankCards: this.#bankCards.map((card) => card.toJSON()),
      revealedCard: this.revealedCard.toJSON(),
      cardHistory: Object.fromEntries(cardHistory),
      banker: this.banker,
      initialBanker: this.#initialBanker,
      runningPoint: this.runningPoint,
      lastRaiser: this.lastRaiser,
      handState: this.handState,
      winner: this.winner,
      turn: this.turn,
    };
  }
}

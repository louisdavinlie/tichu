import { CARD_SUIT, SUITS_ORDER, type CardValue } from "../utils/common.ts";
import { Card } from "./card.ts";

export class Deck {
  #cards: Array<Card>;

  constructor(cards?: Array<Card>) {
    this.#cards = cards ?? this.#createDeck();
  }

  get cards(): Array<Card> {
    return this.#cards;
  }

  public draw(): Card | undefined {
    return this.#cards.pop();
  }

  public copy(): Deck {
    let cards = [];
    for (let i = 0; i < this.#cards.length; i++) {
      cards.push(this.#cards[i].copy());
    }
    return new Deck(cards);
  }

  #shuffle(deck: Array<Card>) {
    let currentIndex = deck.length;
    // While there remain elements to shuffle...
    while (currentIndex != 0) {
      // Pick a remaining element...
      let randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      // And swap it with the current element.
      [deck[currentIndex], deck[randomIndex]] = [
        deck[randomIndex],
        deck[currentIndex],
      ];
    }
  }

  #createDeck(): Array<Card> {
    let deck = [];

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 13; j++) {
        deck.push(new Card(SUITS_ORDER[i], (j + 1) as CardValue, i * 14 + j));
      }
    }

    deck.push(new Card(CARD_SUIT.BLACK_JOKER, 0 as CardValue, 55));
    deck.push(new Card(CARD_SUIT.RED_JOKER, 0 as CardValue, 41));

    this.#shuffle(deck);

    return deck;
  }
  public toJSON(): object {
    return {
      cards: this.#cards,
    };
  }
}

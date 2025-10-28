import {
  CARD_SUIT_TO_COLOR,
  type CardSuit,
  type CardSuitColor,
  type CardValue,
} from "../utils/common.ts";

export class Card {
  #suit: CardSuit;
  #value: CardValue;
  #faceUp: boolean;
  #imageIndex: number;

  constructor(
    suit: CardSuit,
    value: CardValue,
    imageIndex: number,
    isFaceUp = false
  ) {
    this.#suit = suit;
    this.#value = value;
    this.#imageIndex = imageIndex;
    this.#faceUp = isFaceUp;
  }

  get suit(): CardSuit {
    return this.#suit;
  }

  get value(): CardValue {
    return this.#value;
  }

  get imageIndex(): number {
    return this.#imageIndex;
  }

  get isFaceUp(): boolean {
    return this.#faceUp;
  }

  get color(): CardSuitColor {
    return CARD_SUIT_TO_COLOR[this.#suit];
  }

  public flip(): void {
    this.#faceUp = !this.#faceUp;
  }

  public copy(): Card {
    const suit = this.#suit;
    const value = this.#value;
    const faceUp = this.#faceUp;
    const imageIndex = this.#imageIndex;
    return new Card(suit, value, imageIndex, faceUp);
  }

  public toJSON(): object {
    return {
      value: this.#value,
      suit: this.#suit,
      faceUp: this.#faceUp,
      imageIndex: this.#imageIndex,
    };
  }

  public isEqual(card: Card): boolean {
    return this.#value == card.value && this.#suit == card.suit;
  }
}

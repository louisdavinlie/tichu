import { nanoid } from "nanoid";
import supabase from "../server/supabase.ts";
import { STATE, type State } from "../utils/common.ts";
import { Hand } from "./hand.ts";

export class Game {
  #id: string;
  p1Name?: string;
  p1Points: number;
  p2Name?: string;
  p2Points: number;
  p3Name?: string;
  p3Points: number;
  #gameHands: Array<string>;
  #gameState: State;

  constructor(
    id?: string,
    p1Name?: string,
    p1Points?: number,
    p2Name?: string,
    p2Points?: number,
    p3Name?: string,
    p3Points?: number,
    gameHands?: Array<string>,
    gameState?: State
  ) {
    this.#id = id ?? nanoid();
    this.p1Name = p1Name;
    this.p1Points = p1Points ?? 0;
    this.p2Name = p2Name;
    this.p2Points = p2Points ?? 0;
    this.p3Name = p3Name;
    this.p3Points = p3Points ?? 0;
    this.#gameHands = gameHands ?? [];
    this.#gameState = gameState ?? (STATE.IN_PROGRESS as State);
  }

  public getLastHandId(): string | undefined {
    return this.#gameHands.at(-1);
  }

  public async addHand(handId: string): Promise<void> {
    this.#gameHands.push(handId);
    await this.update();
  }

  public async save(): Promise<void> {
    await supabase.from("games").insert([this.toJSON()]);
  }

  public async update(): Promise<void> {
    await supabase.from("games").update(this.toJSON()).eq("gameId", this.#id);
  }

  public async startHand(): Promise<Hand> {
    let hand = await Hand.startHand();
    await this.addHand(hand.id);
    return hand;
  }

  public toJSON(): object {
    return {
      gameId: this.#id,
      p1Name: this.p1Name,
      p1Points: this.p1Points,
      p2Name: this.p2Name,
      p2Points: this.p2Points,
      p3Name: this.p3Name,
      p3Points: this.p3Points,
      gameHands: this.#gameHands,
      gameState: this.#gameState,
    };
  }
}

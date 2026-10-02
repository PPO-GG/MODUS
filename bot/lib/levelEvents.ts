/**
 * In-process level-up notifications. xp.ts emits when it detects a level-up
 * at message time (before the buffered DB flush); other modules (autoroles)
 * subscribe without xp.ts having to know about them. Same-process only —
 * a guild is owned by exactly one shard, so no cross-shard bus is needed.
 */
import { EventEmitter } from "node:events";

export interface LevelUpEvent {
  guildId: string;
  userId: string;
  level: number;
}

const emitter = new EventEmitter();
const EVENT = "levelUp";

export function emitLevelUp(event: LevelUpEvent): void {
  emitter.emit(EVENT, event);
}

export function onLevelUp(handler: (event: LevelUpEvent) => void): () => void {
  emitter.on(EVENT, handler);
  return () => {
    emitter.off(EVENT, handler);
  };
}

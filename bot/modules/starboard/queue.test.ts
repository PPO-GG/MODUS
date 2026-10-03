import { describe, expect, it } from "vitest";
import { KeyedCoalescer } from "./queue";

function makeClock(start = 1_000_000) {
  let t = start;
  const sleeps: number[] = [];
  return {
    now: () => t,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      t += ms;
    },
    sleeps,
  };
}

describe("KeyedCoalescer", () => {
  it("runs fn once for a lone call without sleeping", async () => {
    const clock = makeClock();
    const q = new KeyedCoalescer({ minIntervalMs: 3000, now: clock.now, sleep: clock.sleep });
    let calls = 0;
    await q.run("k", async () => {
      calls++;
    });
    expect(calls).toBe(1);
    expect(clock.sleeps).toEqual([]);
  });

  it("coalesces overlapping calls into exactly one follow-up run", async () => {
    const clock = makeClock();
    const q = new KeyedCoalescer({ minIntervalMs: 3000, now: clock.now, sleep: clock.sleep });
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fn = async () => {
      calls++;
      if (calls === 1) await gate;
    };
    const first = q.run("k", fn);
    const rest = [q.run("k", fn), q.run("k", fn), q.run("k", fn)];
    await Promise.all(rest);
    expect(calls).toBe(1);
    release();
    await first;
    expect(calls).toBe(2);
  });

  it("makes the follow-up wait out the remaining min interval", async () => {
    const clock = makeClock();
    const q = new KeyedCoalescer({ minIntervalMs: 3000, now: clock.now, sleep: clock.sleep });
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fn = async () => {
      calls++;
      if (calls === 1) await gate;
    };
    const first = q.run("k", fn);
    void q.run("k", fn);
    release();
    await first;
    expect(clock.sleeps).toEqual([3000]);
  });

  it("throttles a later separate run that starts inside the interval", async () => {
    const clock = makeClock();
    const q = new KeyedCoalescer({ minIntervalMs: 3000, now: clock.now, sleep: clock.sleep });
    await q.run("k", async () => undefined);
    await q.run("k", async () => undefined);
    expect(clock.sleeps).toEqual([3000]);
  });

  it("keeps different keys independent", async () => {
    const clock = makeClock();
    const q = new KeyedCoalescer({ minIntervalMs: 3000, now: clock.now, sleep: clock.sleep });
    const order: string[] = [];
    await Promise.all([
      q.run("a", async () => void order.push("a")),
      q.run("b", async () => void order.push("b")),
    ]);
    expect(order.sort()).toEqual(["a", "b"]);
    expect(clock.sleeps).toEqual([]);
  });
});

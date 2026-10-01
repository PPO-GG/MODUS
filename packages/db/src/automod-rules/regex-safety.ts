import { createContext, runInContext } from "node:vm";
import { LIMITS } from "./catalog";

const PROBE_INPUTS = [
  "a".repeat(LIMITS.regexProbeLength),
  "a ".repeat(LIMITS.regexProbeLength / 2),
  "ab!".repeat(Math.ceil(LIMITS.regexProbeLength / 3)),
];

/**
 * Run the pattern the way the bot does (flags "gi", sync `test`) against
 * message-length adversarial inputs, inside a vm with a wall-clock timeout so a
 * slow pattern is interrupted instead of freezing this process. Legitimate
 * patterns finish in a few milliseconds; anything worse than quadratic on a
 * 2000-character message does not.
 */
function runsQuickly(pattern: string): boolean {
  try {
    runInContext(
      'const re = new RegExp(pattern, "gi"); for (const s of inputs) { re.lastIndex = 0; re.test(s); }',
      createContext({ pattern, inputs: PROBE_INPUTS }),
      { timeout: LIMITS.regexProbeMs },
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * `test()` is unanchored, so a leading or trailing `.*` (or `.*?`) never changes
 * whether a message matches, but it can turn a linear pattern into a quadratic
 * one (`.*free.*nitro.*` vs `free.*nitro`). Strip them; keep the original if
 * nothing else would be left.
 */
export function normalizeRegex(pattern: string): string {
  let out = pattern;
  for (;;) {
    const before = out;
    out = out.replace(/^\.\*\??/, "");
    // The trailing `.` must not be escaped: only an even run of backslashes may precede it.
    out = out.replace(/(^|[^\\])((?:\\\\)*)\.\*\??$/, "$1$2");
    if (out === before) break;
  }
  return out === "" ? pattern : out;
}

interface Quantifier {
  end: number;
  unbounded: boolean;
}

function readQuantifier(pattern: string, index: number): Quantifier | null {
  const c = pattern.charAt(index);
  if (c === "*" || c === "+") return { end: index + 1, unbounded: true };
  if (c === "?") return { end: index + 1, unbounded: false };
  if (c === "{") {
    const m = /^\{(\d+)(,(\d*))?\}/.exec(pattern.slice(index));
    if (m) {
      return {
        end: index + m[0].length,
        unbounded: m[2] !== undefined && m[3] === "",
      };
    }
  }
  return null;
}

/**
 * Heuristic screen for regexes the bot will run against every message.
 * Returns a human-readable problem, or null when the pattern looks safe.
 * It rejects patterns that do not compile, backreferences, unbounded-repeat
 * groups that contain alternation or another unbounded repeat (the classic
 * `(a+)+` shape), and patterns with too many unbounded repeats overall.
 */
export function checkRegexSafety(pattern: string): string | null {
  if (pattern.length === 0) return "regex is empty";
  if (pattern.length > LIMITS.regexMax) {
    return `regex is longer than ${LIMITS.regexMax} characters`;
  }
  try {
    new RegExp(pattern);
  } catch {
    return "regex does not compile";
  }
  if (/\\[1-9]|\\k</.test(pattern)) return "regex backreferences are not allowed";

  let unbounded = 0;
  let inClass = false;
  const stack: { risky: boolean }[] = [];

  for (let i = 0; i < pattern.length; i++) {
    const c = pattern.charAt(i);
    if (c === "\\") {
      i++;
      continue;
    }
    if (inClass) {
      if (c === "]") inClass = false;
      continue;
    }
    if (c === "[") {
      inClass = true;
      continue;
    }
    if (c === "(") {
      stack.push({ risky: false });
      continue;
    }
    if (c === "|") {
      const top = stack[stack.length - 1];
      if (top) top.risky = true;
      continue;
    }
    if (c === ")") {
      const group = stack.pop();
      const q = readQuantifier(pattern, i + 1);
      const parent = stack[stack.length - 1];
      if (group?.risky && q?.unbounded) {
        return "regex has a repeated group that could backtrack catastrophically";
      }
      if (group?.risky && parent) parent.risky = true;
      if (q) {
        if (q.unbounded) {
          unbounded++;
          if (parent) parent.risky = true;
        }
        i = q.end - 1;
      }
      continue;
    }
    const q = readQuantifier(pattern, i);
    if (q) {
      if (q.unbounded) {
        unbounded++;
        const top = stack[stack.length - 1];
        if (top) top.risky = true;
      }
      i = q.end - 1;
    }
  }

  if (unbounded > LIMITS.maxUnboundedQuantifiers) {
    return `regex has too many unbounded repeats (max ${LIMITS.maxUnboundedQuantifiers})`;
  }
  if (!runsQuickly(pattern)) {
    return "regex is too slow on long messages (possible catastrophic backtracking)";
  }
  return null;
}

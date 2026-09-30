import { describe, expect, it } from "vitest";
import { extractJsonObject } from "./json-extract";

describe("extractJsonObject", () => {
  it("parses a bare object", () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips code fences and leading prose", () => {
    const text = 'Here you go:\n```json\n{"a":{"b":[1,2]}}\n```\nHope that helps!';
    expect(extractJsonObject(text)).toEqual({ a: { b: [1, 2] } });
  });

  it("is not fooled by braces inside strings", () => {
    expect(extractJsonObject('{"msg":"use {user} and } here"}')).toEqual({
      msg: "use {user} and } here",
    });
  });

  it("returns only the first object when several are present", () => {
    expect(extractJsonObject('{"a":1} {"b":2}')).toEqual({ a: 1 });
  });

  it.each([
    ["empty string", ""],
    ["no object", "sorry, I cannot do that"],
    ["truncated object", '{"a":{"b":1'],
    ["invalid json", "{a: 1}"],
  ])("returns null for %s", (_label, text) => {
    expect(extractJsonObject(text)).toBeNull();
  });
});

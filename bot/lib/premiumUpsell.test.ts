import { describe, expect, it } from "vitest";
import { describePremiumStatus, premiumComponents } from "./premiumUpsell";

describe("premiumComponents", () => {
  it("is empty when no SKU is configured", () => {
    expect(premiumComponents(undefined)).toEqual([]);
    expect(premiumComponents("")).toEqual([]);
  });

  it("is one row with a native Premium button for the SKU", () => {
    const rows = premiumComponents("123456789");
    expect(rows).toHaveLength(1);
    expect(rows[0].toJSON()).toEqual({
      type: 1,
      components: [{ type: 2, style: 6, sku_id: "123456789" }],
    });
  });
});

describe("describePremiumStatus", () => {
  it("describes a free server", () => {
    expect(
      describePremiumStatus({ premium: false, source: null, subscriptionEndsAt: null }),
    ).toContain("Free");
  });

  it("describes a manual grant without mentioning a subscription", () => {
    const text = describePremiumStatus({ premium: true, source: "manual", subscriptionEndsAt: null });
    expect(text).toContain("Premium");
    expect(text).not.toMatch(/subscri/i);
  });

  it("shows when a subscription ends", () => {
    const endsAt = new Date("2026-11-01T00:00:00Z");
    const text = describePremiumStatus({ premium: true, source: "subscription", subscriptionEndsAt: endsAt });
    expect(text).toContain(`<t:${endsAt.getTime() / 1000}:D>`);
  });

  it("describes an open-ended subscription", () => {
    const text = describePremiumStatus({ premium: true, source: "subscription", subscriptionEndsAt: null });
    expect(text).toMatch(/subscri/i);
    expect(text).not.toContain("<t:");
  });
});

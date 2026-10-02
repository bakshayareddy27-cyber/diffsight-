import type { PullRequest } from "./types";

export const SAMPLE_PR: PullRequest = {
  title: "Add multi-currency totals and rename tax parameter",
  files: [
    {
      path: "billing/pricing.py",
      base: `def compute_total(items, tax_rate):
    subtotal = sum(i["price"] * i["qty"] for i in items)
    return round(subtotal * (1 + tax_rate), 2)


def apply_discount(total, code):
    return total * 0.9 if code == "SAVE10" else total


def legacy_round(value):
    return round(value, 2)
`,
      head: `def compute_total(items, tax_rate, currency: str):
    subtotal = sum(i["price"] * i["qty"] for i in items)
    return {"amount": round(subtotal * (1 + tax_rate), 2), "currency": currency}


def apply_discount(total, code, *, strict: bool = False):
    if strict and code != "SAVE10":
        raise ValueError(code)
    return total * 0.9 if code == "SAVE10" else total
`,
    },
    {
      path: "billing/checkout.py",
      base: `from billing.pricing import apply_discount, compute_total, legacy_round


def place_order(cart, rate):
    total = compute_total(cart, rate)
    total = apply_discount(total, "SAVE10")
    return legacy_round(total)
`,
      head: `from billing.pricing import apply_discount, compute_total, legacy_round


def place_order(cart, tax_rate):
    total = compute_total(cart, tax_rate)
    total = apply_discount(total, "SAVE10")
    return legacy_round(total)
`,
    },
    {
      path: "api/orders.py",
      base: `from billing import checkout


def submit(cart):
    return checkout.place_order(cart, rate=0.2)
`,
      head: `from billing import checkout


def submit(cart):
    return checkout.place_order(cart, rate=0.2)
`,
    },
    {
      path: "api/reports.py",
      base: `from billing.pricing import apply_discount


def discounted(total):
    return apply_discount(total, "SAVE10")
`,
      head: `from billing.pricing import apply_discount


def discounted(total):
    return apply_discount(total, "SAVE10")
`,
    },
  ],
};

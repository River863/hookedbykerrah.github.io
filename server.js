require("dotenv").config();

const express = require("express");
const cors = require("cors");
const Stripe = require("stripe");

const app = express();

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("Missing STRIPE_SECRET_KEY in .env");
  process.exit(1);
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

app.use(cors());
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ ok: true, message: "HookedByKerrah checkout server is running." });
});

app.post("/create-checkout-session", async (req, res) => {
  try {
    const cart = Array.isArray(req.body.cart) ? req.body.cart : [];

    if (!cart.length) {
      return res.status(400).json({ error: "Cart is empty." });
    }

    const line_items = cart.map((item) => {
      const unitPrice = Number(item.unitPrice);
      const quantity = Number(item.qty);

      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        throw new Error(`Invalid unit price for ${item.name || "item"}.`);
      }

      if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new Error(`Invalid quantity for ${item.name || "item"}.`);
      }

      const description = item.options && typeof item.options === "object"
        ? Object.entries(item.options).map(([k, v]) => `${k}: ${v}`).join(", ")
        : "No options selected";

      return {
        quantity,
        price_data: {
          currency: "usd",
          unit_amount: Math.round(unitPrice * 100),
          product_data: {
            name: item.name || "HookedByKerrah Item",
            description
          }
        }
      };
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items,
      success_url: process.env.SUCCESS_URL,
      cancel_url: process.env.CANCEL_URL,
      billing_address_collection: "auto",
      allow_promotion_codes: true
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    res.status(500).json({ error: error.message || "Could not create checkout session." });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Checkout server running on port ${port}`);
});

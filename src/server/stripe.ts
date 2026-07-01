import Stripe from "stripe";
import { config, paymentsEnabled } from "./config.js";
import type { Job } from "./jobs.js";

let client: Stripe | null = null;

function stripe(): Stripe {
  if (!client) {
    if (!config.stripe.secretKey) throw new Error("Stripe is not configured");
    client = new Stripe(config.stripe.secretKey);
  }
  return client;
}

export { paymentsEnabled };

export interface CheckoutInfo {
  url: string;
  sessionId: string;
}

/** Create a Checkout Session for a single converted file. */
export async function createCheckoutSession(job: Job): Promise<CheckoutInfo> {
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: config.stripe.priceCurrency,
          unit_amount: config.stripe.priceAmount,
          product_data: {
            name: `File conversion: ${job.from.toUpperCase()} → ${job.to.toUpperCase()}`,
            description: job.fileName,
          },
        },
      },
    ],
    metadata: { jobId: job.id },
    success_url: `${config.publicBaseUrl}/?session_id={CHECKOUT_SESSION_ID}&job=${job.id}`,
    cancel_url: `${config.publicBaseUrl}/?canceled=1`,
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  return { url: session.url, sessionId: session.id };
}

/** Confirm a checkout session has been paid. */
export async function isSessionPaid(sessionId: string): Promise<boolean> {
  const session = await stripe().checkout.sessions.retrieve(sessionId);
  return session.payment_status === "paid";
}

/** Verify and parse a Stripe webhook event. */
export function constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
  if (!config.stripe.webhookSecret) throw new Error("Webhook secret not configured");
  return stripe().webhooks.constructEvent(rawBody, signature, config.stripe.webhookSecret);
}

export function priceLabel(): string {
  const amount = (config.stripe.priceAmount / 100).toFixed(2);
  return `${amount} ${config.stripe.priceCurrency.toUpperCase()}`;
}

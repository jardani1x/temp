import express, { type Request, type Response } from "express";
import { constructWebhookEvent, paymentsEnabled } from "../stripe.js";
import { getJob, findJobBySession } from "../jobs.js";

const router = express.Router();

/**
 * Stripe webhook. Mounted with a raw body parser so the signature can be
 * verified. Marks the matching job as paid on successful checkout.
 */
router.post("/webhook", express.raw({ type: "application/json" }), (req: Request, res: Response) => {
  if (!paymentsEnabled()) return res.status(400).send("Payments disabled");

  const signature = req.headers["stripe-signature"];
  if (!signature || typeof signature !== "string") {
    return res.status(400).send("Missing signature");
  }

  let event;
  try {
    event = constructWebhookEvent(req.body as Buffer, signature);
  } catch (err) {
    return res.status(400).send(`Webhook signature verification failed: ${(err as Error).message}`);
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as { id: string; metadata?: { jobId?: string } };
    const job =
      (session.metadata?.jobId ? getJob(session.metadata.jobId) : undefined) ??
      findJobBySession(session.id);
    if (job) job.paid = true;
  }

  return res.json({ received: true });
});

export default router;

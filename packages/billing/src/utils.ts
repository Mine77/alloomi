import type Stripe from "stripe";

/**
 * Get the application base URL.
 * Override via setBaseUrlFactory() for app-specific behavior.
 */
let _baseUrlFactory: (() => string) | null = null;

export function setBaseUrlFactory(factory: () => string) {
  _baseUrlFactory = factory;
}

export function getApplicationBaseUrl(): string {
  if (_baseUrlFactory) {
    return _baseUrlFactory();
  }
  // Default fallback for non-browser environments or when not configured
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:3415";
}

const ACTIVE_SUBSCRIPTION_STATUSES: Array<Stripe.Subscription.Status> = [
  "active",
  "trialing",
  "past_due",
];

export function isSubscriptionStatusActive(status: Stripe.Subscription.Status) {
  return ACTIVE_SUBSCRIPTION_STATUSES.includes(status);
}

export function stripeTimestampToDate(value?: number | null) {
  return typeof value === "number" ? new Date(value * 1000) : null;
}

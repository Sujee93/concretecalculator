/**
 * Meta (Facebook) Pixel — Contact event for the interest-free campaign.
 *
 * The calculator is iframe-embedded on the WordPress landing page and the Pixel
 * lives on that *parent* page, so `fbq` is not reachable from in here. Per the
 * Ads brief we postMessage a marker to the parent, where a small listener calls
 * `fbq('track', 'Contact')`. The parent-side snippet is in DEPLOYMENT_NOTES.md.
 *
 * Only the Contact event is required, and it must fire at most once per page
 * load (on the first valid contact-details submit).
 */

export const META_CONTACT_EVENT = "META_CONTACT_EVENT";

let contactFired = false;

/** Fire the Meta `Contact` event once per page load. */
export function trackMetaContact(): void {
  if (contactFired) return;
  contactFired = true;
  try {
    window.parent?.postMessage({ type: META_CONTACT_EVENT }, "*");
  } catch {
    // Cross-origin restrictions or no parent — nothing else to do.
  }
}

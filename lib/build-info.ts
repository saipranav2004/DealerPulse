/**
 * Which build is being served, and which data it was built from.
 *
 * The index route once served a cached copy of an older build than every
 * query-param URL of the same deploy, and nothing on the page said so. A
 * visible stamp turns that from an invisible failure into an obvious one:
 * if two URLs disagree, their stamps disagree too.
 *
 * Resolved at build time. Vercel injects the commit SHA; a local build falls
 * back to `dev`.
 */

const sha =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.GIT_COMMIT_SHA ??
  process.env.NEXT_PUBLIC_COMMIT_SHA ??
  '';

/** Short commit SHA, or `dev` when building outside CI. */
export const BUILD_SHA = sha ? sha.slice(0, 7) : 'dev';

/** The date the dataset is current to. Single source for the whole product. */
export const DATA_CURRENT_AS_OF = '31 Dec 2025';

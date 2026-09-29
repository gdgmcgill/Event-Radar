/** Only this named database rule is safe to show. Other SQL errors retain the
 * route's generic failure response; SQLSTATE alone is not a public contract. */
export const EVENT_DUPLICATE_REVIEW_MESSAGE = 'Review possible duplicates in discovery metadata before approving this event';
export function isEventDuplicateReviewRequired(error: { code?: string; message?: string }): boolean {
  return error.code === '22023' && error.message === EVENT_DUPLICATE_REVIEW_MESSAGE;
}

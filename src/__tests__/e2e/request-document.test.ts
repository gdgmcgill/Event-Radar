import { belongsToReplacedDocument } from '../../../e2e/helpers/requestDocument';
const original = 'http://localhost:3000/settings';
const destination = 'http://localhost:3000/profile?tab=settings';
it('retires a late fetch from the exact replaced streamed document', () => {
  expect(belongsToReplacedDocument(original, original, destination)).toBe(true);
});
it.each([destination, undefined, 'invalid URL', 'http://localhost:3000/other', 'https://external.example/settings'])('keeps destination or unattributed requests subject to settlement: %s', referer => {
  expect(belongsToReplacedDocument(referer, original, destination)).toBe(false);
});
it('does not retire requests if navigation did not replace the document', () => {
  expect(belongsToReplacedDocument(original, original, original)).toBe(false);
});
it('does not treat a cross-origin navigation as a trusted alias replacement', () => {
  expect(belongsToReplacedDocument(original, original, 'https://external.example/profile')).toBe(false);
});

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FormErrorSummary,
  defaultFieldId,
  flattenFieldErrors,
} from '@/components/forms/FormErrorSummary';
import { renderToHtml } from './helpers/render';

test('flattens nested and array errors into dotted paths, in order', () => {
  const errors = {
    amount: { type: 'min', message: 'Amount must be positive' },
    recipient: { address: { type: 'pattern', message: 'Enter a valid Stellar address' } },
    legs: [undefined, { asset: { type: 'required', message: 'Pick an asset' } }],
    memo: { type: 'maxLength' },
  };

  assert.deepEqual(flattenFieldErrors(errors), [
    { name: 'amount', message: 'Amount must be positive' },
    { name: 'recipient.address', message: 'Enter a valid Stellar address' },
    { name: 'legs.1.asset', message: 'Pick an asset' },
  ]);
});

test('returns an empty list for a valid form', () => {
  assert.deepEqual(flattenFieldErrors({}), []);
  assert.deepEqual(flattenFieldErrors(undefined), []);
});

test('derives input ids from field paths', () => {
  assert.equal(defaultFieldId('legs.1.asset'), 'field-legs-1-asset');
});

test('renders an empty live region when there are no errors', () => {
  const html = renderToHtml(<FormErrorSummary errors={{}} />);
  assert.match(html, /role="alert"/);
  assert.match(html, /aria-live="assertive"/);
  assert.doesNotMatch(html, /<li>/);
});

test('renders one focus link per error with its label', () => {
  const html = renderToHtml(
    <FormErrorSummary
      errors={{ amount: { message: 'Amount must be positive' }, memo: { message: 'Too long' } }}
      labels={{ amount: 'Amount' }}
    />,
  );
  assert.match(html, /There is a problem with this form/);
  assert.match(html, /href="#field-amount"[^>]*>Amount: Amount must be positive</);
  assert.match(html, /href="#field-memo"[^>]*>Too long</);
  assert.equal((html.match(/<li>/g) ?? []).length, 2);
});

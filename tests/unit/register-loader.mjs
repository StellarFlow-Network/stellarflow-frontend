/**
 * Registers the repository's TSX module hooks before the `node:test` files run.
 *
 * Usage: `node --import ./tests/unit/register-loader.mjs --test <spec files>`
 * (wired up through `npm run test:unit`).
 */
import { register } from 'node:module';

register('./loader-hooks.mjs', import.meta.url);

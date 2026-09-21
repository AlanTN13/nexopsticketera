// Use the same WHATWG parser without WebIDL wrappers, which inspect constructor
// prototypes unavailable in the n8n Cloud task runner. No runtime module access.
// eslint-disable-next-line @typescript-eslint/no-require-imports -- Static require is bundled, never resolved by n8n.
const { URL } = require('./runtime-url.cjs');
export { URL };
export const structuredClone = value => JSON.parse(JSON.stringify(value));

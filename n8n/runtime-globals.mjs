// WHATWG implementation is bundled at build time; n8n Cloud permits crypto only.
export { URL } from 'whatwg-url';
export const structuredClone = value => JSON.parse(JSON.stringify(value));

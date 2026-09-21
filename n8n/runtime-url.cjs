/* eslint-disable @typescript-eslint/no-require-imports -- Bundled CommonJS avoids sandbox-blocked interop descriptors. */
const parser = require('whatwg-url/lib/url-state-machine.js');
const form = require('whatwg-url/lib/urlencoded.js');

// Only the URL surface used by the editorial engine. Parsing and serialization
// remain WHATWG implementations; do not replace security checks with a regex.
class URL {
  constructor(input) {
    this.record = parser.basicURLParse(String(input));
    if (!this.record) throw new TypeError('Invalid URL');
    this.searchParams = {
      keys: () => form.parseUrlencodedString(this.record.query ?? '').map(([key]) => key).values(),
      delete: (name) => {
        const remaining = form.parseUrlencodedString(this.record.query ?? '').filter(([key]) => key !== String(name));
        this.record.query = form.serializeUrlencoded(remaining) || null;
      },
    };
  }
  get protocol() { return `${this.record.scheme}:`; }
  get hostname() { return this.record.host === null ? '' : parser.serializeHost(this.record.host); }
  get username() { return this.record.username; }
  get password() { return this.record.password; }
  set hash(value) {
    const fragment = String(value);
    if (!fragment) { this.record.fragment = null; return; }
    this.record.fragment = '';
    parser.basicURLParse(fragment.replace(/^#/, ''), { url: this.record, stateOverride: 'fragment' });
  }
  toString() { return parser.serializeURL(this.record); }
}

module.exports = { URL };

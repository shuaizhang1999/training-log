export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing environment variable ${name}. Set it in .env.local (dev) or Vercel project settings (prod).`
    );
  }
  return v;
}

/**
 * The service-account private key, tolerant of every common paste format: the
 * raw PEM with real newlines, the JSON value with literal "\n", surrounding
 * quotes, a trailing comma from the JSON file, or even the whole
 * `"private_key": "..."` line. The PEM block is extracted from whatever was
 * pasted; anything without one fails loudly instead of confusing OpenSSL.
 */
export function getPrivateKey(): string {
  const unescaped = requireEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
  const pem = unescaped.match(
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----/
  );
  if (!pem) {
    throw new Error(
      "GOOGLE_PRIVATE_KEY does not contain a PEM block (-----BEGIN PRIVATE KEY----- …). " +
        "Paste the full private_key value from the service-account JSON file."
    );
  }
  return pem[0] + "\n";
}

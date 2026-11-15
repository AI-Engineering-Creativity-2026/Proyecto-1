const allowedHosts = new Set(["localhost", "127.0.0.1", "::1"]);
const realFetch = globalThis.fetch;

globalThis.fetch = async (input, init) => {
  const requestUrl = input instanceof Request
    ? input.url
    : input instanceof URL
      ? input.href
      : input;
  const hostname = new URL(requestUrl).hostname;

  if (!allowedHosts.has(hostname)) {
    throw new Error(`Red externa bloqueada en pruebas: ${hostname}`);
  }

  return realFetch(input, init);
};

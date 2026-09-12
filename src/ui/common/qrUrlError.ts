/** A printed QR destination must be reachable beyond the scanner's own device. */
export const qrUrlError = (value: string): string => {
  if (!value) return "";
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (host === "localhost" || host.endsWith(".localhost") || /^127\./.test(host) ||
        host === "0.0.0.0" || host === "[::]" || host === "[::1]" || host.startsWith("[::ffff:7f")) {
      return "Cannot generate a QR code for localhost. Open the portal using its public hostname and try again.";
    }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error();
    return "";
  } catch {
    return "Cannot generate a QR code for an invalid URL.";
  }
};

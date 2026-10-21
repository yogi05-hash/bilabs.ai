/* Config values in this project have arrived carrying surrounding quotes, real
 * trailing newlines, and literal backslash-n text — the last of which trim()
 * cannot see and which only failed in production. Everything reads env through
 * here so a sloppy value can never reach an API call again. */
export function env(name: string, fallback = ""): string {
  const raw = process.env[name] ?? fallback;
  return raw
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/(\\[rn])+$/g, "")
    .trim();
}

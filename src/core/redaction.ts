const SECRET_PATTERNS: RegExp[] = [
  /\b(Bearer)\s+[A-Za-z0-9._~+/-]{16,}\b/gi,
  /\b(sk-[A-Za-z0-9]{16,})\b/g,
  /\b(ghp_[A-Za-z0-9]{20,})\b/g,
  /\b(xox[baprs]-[A-Za-z0-9-]{10,})\b/g,
  /\b(password|passwd|pwd)\s*[:=]\s*([^\s,;]+)/gi,
  /\b(token|api[_-]?key|secret)\s*[:=]\s*([^\s,;]+)/gi
];

function maskValue(value: string): string {
  if (value.length <= 8) return "***REDACTED***";
  return `${value.slice(0, 4)}***REDACTED***${value.slice(-4)}`;
}

export function redactSensitiveText(value: string | undefined): string | undefined {
  if (!value) return value;
  let redacted = value;
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, (match, p1, p2) => {
      if (typeof p2 === "string") return `${p1}=***REDACTED***`;
      if (typeof p1 === "string" && match.startsWith(p1)) return `${p1} ${maskValue(match.slice(p1.length).trim())}`;
      return "***REDACTED***";
    });
  }
  return redacted;
}

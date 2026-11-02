/** An email address that may wrap only after the @ (never mid-word) when the line is narrow. */
export function EmailText({ value }: { value: string }) {
  const at = value.indexOf('@')
  if (at < 0) return <>{value}</>
  return <>{value.slice(0, at + 1)}<wbr />{value.slice(at + 1)}</>
}

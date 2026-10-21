// Stored amounts are integer minor units; the ISO currency exponent decides the scale.

export function currencyFractionDigits(currencyCode: string): number | null {
  const currency = currencyCode.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) return null
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2
  } catch {
    return null
  }
}

export function formatMinorUnits(amountMinor: number, currencyCode: string, locale = 'en') {
  const currency = currencyCode.trim().toUpperCase()
  const formatter = new Intl.NumberFormat(locale, { style: 'currency', currency })
  const fractionDigits = formatter.resolvedOptions().maximumFractionDigits ?? 2
  return formatter.format(amountMinor / (10 ** fractionDigits))
}

// Display label for an optional stored amount. A missing amount is never shown as zero,
// and an unrecognised currency code is shown as raw minor units rather than guessed.
export function formatMoneyLabel(amountMinor: unknown, currencyCode: unknown, missing = 'Amount unavailable') {
  if (amountMinor === null || amountMinor === undefined || amountMinor === '') return missing
  const minor = Number(amountMinor)
  if (!Number.isSafeInteger(minor)) return missing
  const currency = String(currencyCode ?? '').trim().toUpperCase()
  if (currencyFractionDigits(currency) === null) {
    return `${minor.toLocaleString('en')} minor units${currency ? ` (${currency})` : ''}`
  }
  return formatMinorUnits(minor, currency)
}

// Exact decimal text -> integer minor units, without floating-point arithmetic.
// Precision beyond the currency exponent is rejected instead of rounded.
export function decimalToMinorUnits(input: string, currencyCode: string): number {
  const currency = currencyCode.trim().toUpperCase()
  const digits = currencyFractionDigits(currency)
  if (digits === null) throw new Error('Choose a valid ISO currency code.')
  const value = input.trim()
  const match = /^(-)?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?$/.exec(value)
  if (!match) throw new Error(digits ? `Enter an amount such as 125.${'0'.repeat(digits)}.` : 'Enter a whole amount such as 125.')
  const [, sign, wholeText, fraction = ''] = match
  if (fraction.length > digits) {
    throw new Error(digits ? `${currency} amounts allow at most ${digits} decimal place${digits === 1 ? '' : 's'}.` : `${currency} amounts have no decimal places.`)
  }
  const minorText = `${wholeText.replaceAll(',', '')}${fraction.padEnd(digits, '0')}`.replace(/^0+(?=\d)/, '')
  const minor = Number(minorText)
  if (!Number.isSafeInteger(minor)) throw new Error('The amount is too large.')
  return sign && minor !== 0 ? -minor : minor
}

export function minorUnitsToDecimal(amountMinor: number, currencyCode: string): string {
  const digits = currencyFractionDigits(currencyCode)
  if (digits === null || !Number.isSafeInteger(amountMinor)) return String(amountMinor)
  const negative = amountMinor < 0
  const text = String(Math.abs(amountMinor)).padStart(digits + 1, '0')
  const whole = digits ? text.slice(0, -digits) : text
  const fraction = digits ? `.${text.slice(-digits)}` : ''
  return `${negative ? '-' : ''}${whole}${fraction}`
}

const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine',
  MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
}

/** City and state read from the office's saved address ("Portland, ME 04101"); null when it is not in that form. */
export function officeLocality(address: string[]): { city: string; state: string } | null {
  for (const line of [...address].reverse()) {
    const match = /^\s*([^,]+?),\s*([A-Za-z]{2})\b/.exec(line)
    if (match) {
      const code = match[2].toUpperCase()
      return { city: match[1].trim(), state: US_STATES[code] ?? code }
    }
  }
  return null
}

/** "Maine, 1996" → "Maine 1996": the first admission line, as written by the firm. */
export function firstAdmission(admissions: string[]) {
  const line = admissions[0]?.trim()
  return line ? line.replace(/,\s*(\d{4})$/, ' $1') : null
}

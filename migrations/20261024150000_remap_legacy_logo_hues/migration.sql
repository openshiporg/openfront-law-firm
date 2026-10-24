-- Logo colour presets saved before 2026-10-24 stored absolute hues (Green = 120), but the
-- value is applied as a hue-rotate offset to marks drawn at 260 degrees. Remap each old
-- preset to the offset that shows its named colour. No schema change.
UPDATE "Firm" SET "logoColor" = CASE "logoColor"
  WHEN '30' THEN '150'
  WHEN '60' THEN '190'
  WHEN '120' THEN '245'
  WHEN '180' THEN '290'
  WHEN '270' THEN '45'
  WHEN '330' THEN '85'
  ELSE "logoColor"
END
WHERE "logoColor" IN ('30', '60', '120', '180', '270', '330');

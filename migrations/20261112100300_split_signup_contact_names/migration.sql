-- Storefront sign-ups stored the whole name in firstName. Split person contacts with an empty
-- lastName and a multi-word firstName: the last word becomes the surname.
UPDATE "Contact"
SET "lastName" = regexp_replace(btrim("firstName"), '^.*\s', ''),
    "firstName" = regexp_replace(btrim("firstName"), '\s+\S+$', '')
WHERE "contactType" = 'person'
  AND "lastName" = ''
  AND btrim("firstName") ~ '\s';

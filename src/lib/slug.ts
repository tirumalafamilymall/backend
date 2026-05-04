export function generateSlug(name: string, productCode: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')   // remove special chars
    .replace(/\s+/g, '-')            // spaces to hyphens
    .replace(/-+/g, '-')             // collapse multiple hyphens
    .substring(0, 60)                // max 60 chars

  // Append product code to ensure uniqueness
  return `${base}-${productCode.toLowerCase()}`
}
import * as XLSX from 'xlsx'

// Maps flexible/messy Excel column names → our product schema
// Handles variations like "Product Name", "product_name", "Name", "PRODUCT NAME"
const COLUMN_MAP: Record<string, string> = {
  // product_code
  'product_code': 'product_code',
  'code':         'product_code',
  'product code': 'product_code',
  'sku':          'product_code',
  'item code':    'product_code',

  // name
  'name':         'name',
  'product name': 'name',
  'product_name': 'name',
  'item name':    'name',
  'item':         'name',

  // category
  'category':     'category',
  'cat':          'category',
  'type':         'category',

  // subcategory
  'subcategory':  'subcategory',
  'sub category': 'subcategory',
  'sub_category': 'subcategory',
  'sub':          'subcategory',

  // brand
  'brand':        'brand',
  'brand name':   'brand',
  'brand_name':   'brand',
  'company':      'brand',

  // base_price
  'base_price':   'base_price',
  'price':        'base_price',
  'base price':   'base_price',
  'mrp':          'base_price',
  'rate':         'base_price',
  'amount':       'base_price',

  // stock
  'stock':        'stock',
  'quantity':     'stock',
  'qty':          'stock',
  'stock quantity': 'stock',

  // color
  'color':        'color',
  'colour':       'color',

  // size
  'size':         'size',

  // barcode
  'barcode':      'barcode',
  'bar code':     'barcode',
  'barcode no':   'barcode',
  'barcode number': 'barcode',
}

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function parseExcelBuffer(buffer: Buffer): {
  products: any[]
  errors: string[]
} {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  // Convert sheet to JSON — raw rows
  const rows: any[] = XLSX.utils.sheet_to_json(sheet, {
    defval: null,     // empty cells = null
    raw: false,       // all values as strings first (we cast below)
  })

  if (rows.length === 0) {
    return { products: [], errors: ['Excel sheet is empty'] }
  }

  const products: any[] = []
  const errors: string[] = []

  rows.forEach((row, index) => {
    const rowNum = index + 2 // +2 because row 1 is header

    // Normalize all keys in this row
    const normalized: Record<string, any> = {}
    for (const rawKey of Object.keys(row)) {
      const mappedKey = COLUMN_MAP[normalizeKey(rawKey)]
      if (mappedKey) {
        normalized[mappedKey] = row[rawKey]
      }
    }

    // Validate required fields
    const missing = []
    if (!normalized.name)       missing.push('name')
    if (!normalized.category)   missing.push('category')
    if (!normalized.base_price) missing.push('base_price / price')

    if (missing.length > 0) {
      errors.push(`Row ${rowNum}: Missing required fields — ${missing.join(', ')}`)
      return
    }

    // Cast types
    const base_price = parseFloat(normalized.base_price)
    if (isNaN(base_price)) {
      errors.push(`Row ${rowNum}: Invalid price — "${normalized.base_price}"`)
      return
    }

    const stock = normalized.stock !== null
      ? parseInt(normalized.stock)
      : 0

    products.push({
      product_code: normalized.product_code
        ? String(normalized.product_code).trim()
        : null,
      name:         String(normalized.name).trim(),
      category:     String(normalized.category).trim(),
      subcategory:  normalized.subcategory ? String(normalized.subcategory).trim() : null,
      brand:        normalized.brand        ? String(normalized.brand).trim()        : null,
      base_price,
      stock:        isNaN(stock) ? 0 : stock,
      color:        normalized.color   ? String(normalized.color).trim()   : null,
      size:         normalized.size    ? String(normalized.size).trim()    : null,
      barcode:      normalized.barcode ? String(normalized.barcode).trim() : null,
      images:       [],
    })
  })

  return { products, errors }
}
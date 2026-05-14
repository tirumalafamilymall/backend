import * as XLSX from 'xlsx'

// Maps flexible/messy Excel column names → our product schema
const COLUMN_MAP: Record<string, string> = {
  'product_code': 'product_code',
  'code':         'product_code',
  'product code': 'product_code',
  
  // New Department map
  'department':   'department',
  'gender':       'department',
  'partition':    'department',

  'name':         'name',
  'product name': 'name',
  'item name':    'name',

  'category':     'category',
  'cat':          'category',

  'subcategory':  'subcategory',
  'sub category': 'subcategory',

  'brand':        'brand',
  'brand name':   'brand',

  'base_price':   'base_price',
  'price':        'base_price',
  'mrp':          'base_price',

  'stock':        'stock',
  'quantity':     'stock',
  'qty':          'stock',

  'color':        'color',
  'colour':       'color',

  'size':         'size',

  'sku':          'sku', 
  'barcode':      'barcode',

  // 🔥 FIX 1: Teach the parser how to read image columns
  'image':        'image',
  'image_url':    'image',
  'img':          'image',
  'photo':        'image',
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

  const rows: any[] = XLSX.utils.sheet_to_json(sheet, {
    defval: null,
    raw: false,
  })

  if (rows.length === 0) {
    return { products: [], errors: ['Excel sheet is empty'] }
  }

  const products: any[] = []
  const errors: string[] = []

  rows.forEach((row, index) => {
    const rowNum = index + 2 // +2 because row 1 is header

    const normalized: Record<string, any> = {}
    for (const rawKey of Object.keys(row)) {
      const mappedKey = COLUMN_MAP[normalizeKey(rawKey)]
      if (mappedKey) {
        normalized[mappedKey] = row[rawKey]
      }
    }

    // Validate required fields (Code and Department are now mandatory!)
    const missing = []
    if (!normalized.product_code) missing.push('product_code')
    if (!normalized.name)         missing.push('name')
    if (!normalized.department)   missing.push('department')
    if (!normalized.category)     missing.push('category')
    if (!normalized.base_price)   missing.push('base_price')

    if (missing.length > 0) {
      errors.push(`Row ${rowNum}: Missing required fields — ${missing.join(', ')}`)
      return
    }

    // Validate Department Enum
    const deptRaw = String(normalized.department).trim().toUpperCase()
    if (!['WOMEN', 'MEN', 'KIDS'].includes(deptRaw)) {
      errors.push(`Row ${rowNum}: Invalid department "${deptRaw}". Must be WOMEN, MEN, or KIDS.`)
      return
    }

    // Cast types
    const base_price = parseFloat(normalized.base_price)
    if (isNaN(base_price)) {
      errors.push(`Row ${rowNum}: Invalid price — "${normalized.base_price}"`)
      return
    }

    const stock = normalized.stock !== null ? parseInt(normalized.stock) : 0

    products.push({
      product_code: String(normalized.product_code).trim(),
      department:   deptRaw,
      name:         String(normalized.name).trim(),
      category:     String(normalized.category).trim(),
      subcategory:  normalized.subcategory ? String(normalized.subcategory).trim() : null,
      brand:        normalized.brand       ? String(normalized.brand).trim()       : null,
      base_price,
      stock:        isNaN(stock) ? 0 : stock,
      color:        normalized.color   ? String(normalized.color).trim()   : null,
      size:         normalized.size    ? String(normalized.size).trim()    : null,
      sku:          normalized.sku     ? String(normalized.sku).trim()     : null,
      barcode:      normalized.barcode ? String(normalized.barcode).trim() : null,
      
      // 🔥 FIX 2: Push the image URL into the output array
      image:        normalized.image   ? String(normalized.image).trim()   : null,
    })
  })

  return { products, errors }
}
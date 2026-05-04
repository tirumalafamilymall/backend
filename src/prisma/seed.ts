// src/prisma/seed.ts
import { prisma } from '../lib/prisma'

async function main() {
  await prisma.user.updateMany({
    where: { email: 'tirumalafamilymall@gmail.com' },
    data:  { role: 'ADMIN' },
  })
  console.log('Admin role assigned')
}

main()
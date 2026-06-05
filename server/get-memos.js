const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const memos = await prisma.memo.findMany({
    include: {
      sender: true,
      recipient: {
        include: {
          staffProfile: true
        }
      }
    }
  });
  console.log('Memos in DB:', JSON.stringify(memos, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

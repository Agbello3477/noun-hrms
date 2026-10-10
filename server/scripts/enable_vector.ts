import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const connectionUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: connectionUrl
    }
  }
});

async function main() {
  console.log('🏛️ Connecting to PostgreSQL to enable pgvector extension...');
  console.log(`🔗 Target: ${connectionUrl ? connectionUrl.replace(/:[^:@]+@/, ':****@') : 'UNDEFINED'}\n`);

  try {
    // 1. Enable extension in public schema
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;`);
    console.log('✅ pgvector extension enabled successfully in "public" schema!');
  } catch (err: any) {
    try {
      // 2. Fallback without explicit schema
      await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`);
      console.log('✅ pgvector extension enabled successfully!');
    } catch (innerErr: any) {
      console.error('❌ Failed to enable pgvector automatically:', innerErr.message);
      console.log('\n💡 SUPABASE MANUAL RESOLUTION (Takes 10 seconds):');
      console.log('1. Go to your Supabase Project Dashboard');
      console.log('2. Navigate to "SQL Editor" in the left sidebar');
      console.log('3. Paste and run this command:');
      console.log('   CREATE EXTENSION IF NOT EXISTS vector;\n');
      console.log('OR navigate to Database -> Extensions -> search "vector" -> click Enable.');
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

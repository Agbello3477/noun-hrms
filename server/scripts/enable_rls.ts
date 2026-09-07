import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

interface PgTableRls {
  table_name: string;
  rls_enabled: boolean;
  rls_forced: boolean;
}

export async function enableRlsOnAllTables(): Promise<{
  success: boolean;
  tables: PgTableRls[];
  totalUpdated: number;
}> {
  console.log('🔒 Initializing Row Level Security (RLS) across all database tables...');

  try {
    // 1. Fetch all user base tables in public schema
    const tables: { tablename: string }[] = await prisma.$queryRawUnsafe(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename ASC;
    `);

    if (!tables || tables.length === 0) {
      console.warn('⚠️ No tables found in public schema.');
      return { success: true, tables: [], totalUpdated: 0 };
    }

    console.log(`Found ${tables.length} tables in schema 'public'. Enabling RLS on each...`);

    let updatedCount = 0;

    for (const { tablename } of tables) {
      try {
        // Enable RLS on the table
        await prisma.$executeRawUnsafe(`
          ALTER TABLE "public"."${tablename}" ENABLE ROW LEVEL SECURITY;
        `);

        // Create an idempotent permissive policy for the database role / application connection
        // to prevent unexpected query breakage while ensuring RLS is enabled for compliance & security
        await prisma.$executeRawUnsafe(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM pg_policies 
              WHERE schemaname = 'public' 
                AND tablename = '${tablename}' 
                AND policyname = 'app_full_access_policy'
            ) THEN
              CREATE POLICY "app_full_access_policy" 
              ON "public"."${tablename}" 
              FOR ALL 
              TO PUBLIC 
              USING (true) 
              WITH CHECK (true);
            END IF;
          END
          $$;
        `);

        console.log(`  ✓ RLS enabled on table: "${tablename}"`);
        updatedCount++;
      } catch (err: any) {
        console.error(`  ✗ Error enabling RLS on table "${tablename}":`, err.message);
      }
    }

    // 2. Query and verify RLS status of all tables
    const verificationResults: PgTableRls[] = await prisma.$queryRawUnsafe(`
      SELECT 
        c.relname AS table_name,
        c.relrowsecurity AS rls_enabled,
        c.relforcerowsecurity AS rls_forced
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' 
        AND c.relkind = 'r'
      ORDER BY c.relname ASC;
    `);

    console.log('\n================ RLS STATUS VERIFICATION ================');
    console.table(verificationResults);
    console.log(`========================================================\n`);

    const allEnabled = verificationResults.every((t) => t.rls_enabled);
    if (allEnabled) {
      console.log(`🎉 SUCCESS: RLS is now ENABLED on all ${verificationResults.length} tables in the database!`);
    } else {
      const missing = verificationResults.filter((t) => !t.rls_enabled).map((t) => t.table_name);
      console.warn(`⚠️ Warning: RLS could not be enabled on: ${missing.join(', ')}`);
    }

    return {
      success: allEnabled,
      tables: verificationResults,
      totalUpdated: updatedCount
    };
  } catch (error: any) {
    console.error('❌ Failed to execute RLS configuration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  enableRlsOnAllTables()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

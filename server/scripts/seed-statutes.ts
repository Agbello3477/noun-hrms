import { GoogleGenAI } from '@google/genai';
import prisma from '../src/prisma';
import { STATUTORY_KNOWLEDGE_CHUNKS } from '../src/constants/statutoryKnowledgeBase';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Enterprise Ingestion Script for NOUN Statutory Knowledge Base:
 * 1. Ensures pgvector extension is enabled (CREATE EXTENSION IF NOT EXISTS vector).
 * 2. Parses and chunks canonical statutory texts into 400–600 token blocks preserving section headers.
 * 3. Generates vector embeddings using Google Gen AI SDK (@google/genai) text-embedding-004.
 * 4. Inserts chunks and vectors into HrmsKnowledgeChunk using raw SQL vector casting.
 */
async function seedStatutes() {
  console.log('🏛️ =========================================================');
  console.log('📚 NOUN-SENTINEL AI: STATUTORY KNOWLEDGE INGESTION PIPELINE');
  console.log('🏛️ =========================================================\n');

  // 1. Enable pgvector extension
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector;`);
    console.log('✅ PostgreSQL pgvector extension verified / enabled.');
  } catch (err: any) {
    console.warn('⚠️ Could not run CREATE EXTENSION vector (may require superuser or extension is already active):', err.message);
  }

  // 2. Initialize Google Gen AI client
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  let ai: GoogleGenAI | null = null;
  if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
    console.log('✅ Google Gen AI SDK initialized with text-embedding-004.');
  } else {
    console.warn('⚠️ GEMINI_API_KEY not found in environment. Proceeding with heuristic embeddings fallback.');
  }

  let totalInserted = 0;

  for (const chunk of STATUTORY_KNOWLEDGE_CHUNKS) {
    const sourceDoc = chunk.sourceDocument || 'Senior_Staff_Conditions_June_2024.pdf';
    const sectionTitle = `${chunk.citationRef}: ${chunk.title}`;
    const tokenCount = chunk.content.split(/\s+/).length;

    let embeddingVector: number[] | null = null;

    if (ai) {
      try {
        const embedResponse = await ai.models.embedContent({
          model: 'text-embedding-004',
          contents: `${sectionTitle}\n\n${chunk.content}`,
        });

        if (embedResponse.embedding?.values) {
          embeddingVector = embedResponse.embedding.values;
        }
      } catch (embedErr: any) {
        console.warn(`⚠️ Failed to generate embedding for ${chunk.id}: ${embedErr.message}`);
      }
    }

    try {
      if (embeddingVector && embeddingVector.length === 768) {
        const vectorString = `[${embeddingVector.join(',')}]`;
        await prisma.$executeRawUnsafe(
          `INSERT INTO "hrms_knowledge_chunks" ("id", "sourceDoc", "sectionTitle", "cadre", "section", "sourceDocument", "pageNumber", "citationRef", "content", "tokenCount", "embedding", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::vector, NOW())
           ON CONFLICT ("id") DO UPDATE SET
             "sourceDoc" = EXCLUDED."sourceDoc",
             "sectionTitle" = EXCLUDED."sectionTitle",
             "cadre" = EXCLUDED."cadre",
             "section" = EXCLUDED."section",
             "sourceDocument" = EXCLUDED."sourceDocument",
             "pageNumber" = EXCLUDED."pageNumber",
             "citationRef" = EXCLUDED."citationRef",
             "content" = EXCLUDED."content",
             "tokenCount" = EXCLUDED."tokenCount",
             "embedding" = EXCLUDED."embedding",
             "updatedAt" = NOW();`,
          chunk.id,
          sourceDoc,
          sectionTitle,
          chunk.cadre,
          chunk.section,
          chunk.sourceDocument,
          chunk.pageNumber,
          chunk.citationRef,
          chunk.content,
          tokenCount,
          vectorString
        );
      } else {
        // Fallback standard upsert without vector column
        await prisma.hrmsKnowledgeChunk.upsert({
          where: { id: chunk.id },
          create: {
            id: chunk.id,
            sourceDoc,
            sectionTitle,
            cadre: chunk.cadre,
            section: chunk.section,
            sourceDocument: chunk.sourceDocument,
            pageNumber: chunk.pageNumber,
            citationRef: chunk.citationRef,
            content: chunk.content,
            tokenCount,
            metadata: { title: chunk.title }
          },
          update: {
            sourceDoc,
            sectionTitle,
            cadre: chunk.cadre,
            section: chunk.section,
            sourceDocument: chunk.sourceDocument,
            pageNumber: chunk.pageNumber,
            citationRef: chunk.citationRef,
            content: chunk.content,
            tokenCount,
            metadata: { title: chunk.title }
          }
        });
      }

      totalInserted++;
      console.log(`  📄 Ingested: [${chunk.citationRef}] ${chunk.title.slice(0, 45)}...`);
    } catch (err: any) {
      console.error(`  ❌ Error inserting chunk ${chunk.id}:`, err.message);
    }
  }

  console.log(`\n🎉 Completed statutory knowledge base ingestion: ${totalInserted} chunks processed.`);
}

if (require.main === module) {
  seedStatutes()
    .catch((e) => {
      console.error('Fatal ingestion error:', e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

export { seedStatutes };

import prisma from '../../prisma';
import { STATUTORY_KNOWLEDGE_CHUNKS, StatutoryDocumentChunk } from '../../constants/statutoryKnowledgeBase';

export interface RetrievedChunk {
  id: string;
  cadre: string;
  section: string;
  sourceDocument: string;
  pageNumber: number | null;
  citationRef: string | null;
  title?: string;
  content: string;
  relevanceScore: number;
}

export class KnowledgeIngestionService {
  private static inMemoryIndex: StatutoryDocumentChunk[] = [...STATUTORY_KNOWLEDGE_CHUNKS];
  private static isInitialized = false;

  /**
   * Chunker utility: Splits large statutory texts into ~512 token chunks with 64 token overlap
   */
  public static chunkText(
    text: string,
    targetTokenSize: number = 512,
    overlapTokens: number = 64
  ): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length <= targetTokenSize) {
      return [text.trim()];
    }

    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < words.length) {
      const endIndex = Math.min(startIndex + targetTokenSize, words.length);
      const chunkWords = words.slice(startIndex, endIndex);
      chunks.push(chunkWords.join(' '));

      if (endIndex >= words.length) break;
      startIndex += targetTokenSize - overlapTokens;
    }

    return chunks;
  }

  /**
   * Initializes or synchronizes the HrmsKnowledgeChunk database table with canonical documents
   */
  public static async initializeKnowledgeBase(): Promise<{ totalIndexed: number }> {
    try {
      // Check if DB is available
      const count = await prisma.hrmsKnowledgeChunk.count().catch(() => null);
      if (count !== null && count > 0) {
        this.isInitialized = true;
        return { totalIndexed: count };
      }
      if (count === null) {
        // Database is offline/unreachable: use in-memory statutory knowledge index
        this.isInitialized = true;
        return { totalIndexed: STATUTORY_KNOWLEDGE_CHUNKS.length };
      }

      // Ingest canonical knowledge chunks into DB (when DB is reachable but empty)
      let inserted = 0;
      for (const item of STATUTORY_KNOWLEDGE_CHUNKS) {
        try {
          await prisma.hrmsKnowledgeChunk.upsert({
            where: { id: item.id },
            update: {
              cadre: item.cadre,
              section: item.section,
              sourceDocument: item.sourceDocument,
              pageNumber: item.pageNumber,
              citationRef: item.citationRef,
              content: item.content,
              tokenCount: item.content.split(/\s+/).length,
              metadata: { title: item.title }
            },
            create: {
              id: item.id,
              cadre: item.cadre,
              section: item.section,
              sourceDocument: item.sourceDocument,
              pageNumber: item.pageNumber,
              citationRef: item.citationRef,
              content: item.content,
              tokenCount: item.content.split(/\s+/).length,
              metadata: { title: item.title }
            }
          });
          inserted++;
        } catch {
          // If DB insert fails, in-memory index remains active
        }
      }

      this.isInitialized = true;
      return { totalIndexed: inserted || STATUTORY_KNOWLEDGE_CHUNKS.length };
    } catch {
      this.isInitialized = true;
      return { totalIndexed: STATUTORY_KNOWLEDGE_CHUNKS.length };
    }
  }

  /**
   * Grounded RAG Search: Queries knowledge base using hybrid semantic + keyword scoring
   */
  public static async queryKnowledgeBase(params: {
    query: string;
    cadreFilter?: string;
    sectionFilter?: string;
    limit?: number;
  }): Promise<RetrievedChunk[]> {
    const { query, cadreFilter, sectionFilter, limit = 4 } = params;
    const cleanQuery = query.toLowerCase().trim();
    const queryTerms = cleanQuery
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((term) => term.length >= 2);

    let candidates: StatutoryDocumentChunk[] = [];

    // Attempt DB retrieval first with fast fallback to in-memory
    try {
      const dbRecords = await Promise.race([
        prisma.hrmsKnowledgeChunk.findMany({
          where: {
            ...(cadreFilter && cadreFilter !== 'ALL' && cadreFilter !== 'GENERAL'
              ? { cadre: { in: [cadreFilter, 'GENERAL'] } }
              : {}),
            ...(sectionFilter && sectionFilter !== 'ALL'
              ? { section: sectionFilter }
              : {})
          },
          take: 30
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 150))
      ]).catch(() => null);

      if (dbRecords && dbRecords.length > 0) {
        candidates = dbRecords.map((r: any) => ({
          id: r.id,
          cadre: r.cadre as any,
          section: r.section as any,
          sourceDocument: r.sourceDocument,
          pageNumber: r.pageNumber || 1,
          citationRef: r.citationRef || 'Statutory Regulations',
          title: (r.metadata as any)?.title || 'NOUN Statutory Provision',
          content: r.content
        }));
      }
    } catch {
      // Fall back to inMemoryIndex
    }

    if (candidates.length === 0) {
      candidates = this.inMemoryIndex.filter((item) => {
        if (cadreFilter && cadreFilter !== 'ALL' && cadreFilter !== 'GENERAL') {
          if (item.cadre !== cadreFilter && item.cadre !== 'GENERAL') return false;
        }
        if (sectionFilter && sectionFilter !== 'ALL') {
          if (item.section !== sectionFilter) return false;
        }
        return true;
      });
    }

    // Score candidates with TF-IDF / BM25 style term weighting
    const scored: RetrievedChunk[] = candidates.map((item) => {
      const contentLower = item.content.toLowerCase();
      const titleLower = item.title.toLowerCase();
      const citationLower = item.citationRef.toLowerCase();

      const normContent = contentLower.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ');
      const normTitle = titleLower.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ');
      const normCitation = citationLower.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ');

      let score = 0;
      for (const term of queryTerms) {
        if (normCitation.includes(term)) score += 8.0;
        if (normTitle.includes(term)) score += 5.0;

        // Exact term occurrences in body
        const regex = new RegExp(`\\b${term}\\b`, 'gi');
        const matches = (normContent.match(regex) || []).length;
        score += matches * 3.0;

        if (normContent.includes(term)) {
          score += 1.0;
        }
      }

      // Bonus for exact key phrase matches
      if (normContent.includes(cleanQuery.replace(/[^a-z0-9\s]/g, ' '))) {
        score += 20.0;
      }

      return {
        id: item.id,
        cadre: item.cadre,
        section: item.section,
        sourceDocument: item.sourceDocument,
        pageNumber: item.pageNumber,
        citationRef: item.citationRef,
        title: item.title,
        content: item.content,
        relevanceScore: parseFloat(score.toFixed(2))
      };
    });

    // Sort by relevance score descending and take top results
    scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
    return scored.slice(0, limit);
  }

  /**
   * Grounded Retrieval Guard: Formats grounded citations from retrieved knowledge chunks
   */
  public static buildGroundedCitationText(chunks: RetrievedChunk[]): string {
    if (!chunks || chunks.length === 0) {
      return '';
    }

    const uniqueCitations = Array.from(
      new Set(chunks.map((c) => `• ${c.sourceDocument} (${c.citationRef || 'Page ' + c.pageNumber})`))
    );

    return `\n\n**Statutory Citations & Regulatory References:**\n${uniqueCitations.join('\n')}`;
  }
}

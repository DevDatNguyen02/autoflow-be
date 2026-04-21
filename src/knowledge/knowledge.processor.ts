import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { TaskType } from '@google/generative-ai';
import pdf from 'pdf-parse';
import * as mammoth from 'mammoth';
import { KnowledgeJobData } from './types';

@Processor('knowledge-queue')
export class KnowledgeProcessor extends WorkerHost {
  private readonly logger = new Logger(KnowledgeProcessor.name);
  private embeddings: GoogleGenerativeAIEmbeddings;

  constructor(
    @Inject(DATABASE_CONNECTION)
    private db: NodePgDatabase<typeof schema>,
  ) {
    super();
    // Khởi tạo Gemini Embeddings
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GEMINI_API_KEY,
      model: 'text-embedding-004', // Model 768 dims
      taskType: TaskType.RETRIEVAL_DOCUMENT,
    });
  }

  async process(job: Job<KnowledgeJobData>): Promise<{ success: boolean }> {
    const { documentId, contentType, content } = job.data;
    this.logger.log(`Processing document: ${documentId} (${contentType})`);

    try {
      let rawText = '';
      const buffer = Buffer.from(content, 'base64');

      if (contentType === 'pdf') {
        // Casting through unknown to avoid "error typed" issues if types are misaligned
        const data = (await (pdf as unknown as (b: Buffer) => Promise<{ text: string }>)(buffer));
        rawText = data.text;
      } else if (contentType === 'docx') {
        const result = await mammoth.extractRawText({ buffer });
        rawText = result.value;
      } else {
        rawText = buffer.toString('utf-8');
      }

      // 1. Tách văn bản thành các đoạn nhỏ (Chunking)
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      const chunks = await splitter.splitText(rawText);
      this.logger.log(
        `Generated ${chunks.length} chunks for document ${documentId}`,
      );

      // 2. Generate Embeddings & Save to DB
      for (const chunkText of chunks) {
        const vector = await this.embeddings.embedQuery(chunkText);

        await this.db.insert(schema.documentChunks).values({
          documentId,
          chunkText,
          embedding: vector,
        });
      }

      this.logger.log(`Successfully vectorized document: ${documentId}`);
      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to process document ${documentId}: ${errorMessage}`,
      );
      throw error;
    }
  }
}

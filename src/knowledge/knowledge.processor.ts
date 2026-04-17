import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database.module';
import * as schema from '../database/schema';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { TaskType } from '@google/generative-ai';
import * as pdf from 'pdf-parse';

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

  async process(job: Job<any, any, string>): Promise<any> {
    const { documentId, contentType, content } = job.data;
    this.logger.log(`Processing document: ${documentId} (${contentType})`);

    try {
      let rawText = '';
      const buffer = Buffer.from(content, 'base64');

      if (contentType === 'pdf') {
        const data = await pdf(buffer);
        rawText = data.text;
      } else {
        rawText = buffer.toString('utf-8');
      }

      // 1. Tách văn bản thành các đoạn nhỏ (Chunking)
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });

      const chunks = await splitter.splitText(rawText);
      this.logger.log(`Generated ${chunks.length} chunks for document ${documentId}`);

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
    } catch (error) {
      this.logger.error(`Failed to process document ${documentId}: ${error.message}`);
      throw error;
    }
  }
}

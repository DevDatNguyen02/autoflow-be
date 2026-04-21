import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DatabaseService } from '../database/database.service';
import { knowledgeDocuments, profiles } from '../database/schema';
import { desc, sql } from 'drizzle-orm';

@Injectable()
export class KnowledgeService {
  constructor(
    private readonly db: DatabaseService,
    @InjectQueue('knowledge-queue')
    private knowledgeQueue: Queue,
  ) {}

  async uploadDocument(file: Express.Multer.File) {
    // 1. Lưu thông tin document vào DB
    const [doc] = await this.db.conn
      .insert(knowledgeDocuments)
      .values({
        filename: file.originalname,
        contentType: file.mimetype.includes('pdf') ? 'pdf' : 'txt',
      })
      .returning();

    // 2. Đẩy job vào BullMQ để xử lý (Vectorization)
    // Lưu ý: BullMQ khuyên không nên truyền buffer trực tiếp nếu file lớn,
    // nhưng với bản MVP này ta sẽ truyền buffer dạng string/base64 hoặc xử lý đơn giản.
    await this.knowledgeQueue.add('process-document', {
      documentId: doc.id,
      filename: file.originalname,
      contentType: doc.contentType,
      content: file.buffer.toString('base64'), // Chuyển buffer sang base64 để truyền qua Redis
    });

    return {
      id: doc.id,
      status: 'processing',
      filename: doc.filename,
    };
  }

  async getDocuments(limit = 100) {
    const data = await this.db.conn
      .select()
      .from(knowledgeDocuments)
      .orderBy(desc(knowledgeDocuments.createdAt))
      .limit(limit);
    return { data };
  }
}

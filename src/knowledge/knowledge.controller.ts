import {
  Controller,
  Post,
  Get,
  UploadedFile,
  UseInterceptors,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Body,
  Param,
  Inject,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KnowledgeService } from './knowledge.service';
import { DATABASE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { desc, eq, sql } from 'drizzle-orm';

@Controller('api/knowledge')
export class KnowledgeController {
  constructor(
    private readonly knowledgeService: KnowledgeService,
    @Inject(DATABASE_CONNECTION)
    private db: NodePgDatabase<typeof schema>,
  ) {}

  @Get('documents')
  async getDocuments() {
    return this.knowledgeService.getDocuments();
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // Giới hạn 10MB
          new FileTypeValidator({ fileType: '.(pdf|txt|docx)' }), // Nhận PDF, TXT hoặc DOCX
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    return this.knowledgeService.uploadDocument(file);
  }

  @Post('feedback')
  async feedback(
    @Body() body: { messageId: string; isLike: boolean; comment?: string },
  ) {
    const { messageId, isLike, comment } = body;
    const [result] = await this.db
      .insert(schema.feedbacks)
      .values({
        messageId,
        isLike: isLike ? 1 : 0,
        comment,
      })
      .returning();
    return result;
  }

  @Post('history/sessions')
  async getSessions() {
    return this.db
      .select({
        id: schema.chatSessions.id,
        anonymousId: schema.chatSessions.anonymousId,
        needsAgent: schema.chatSessions.needsAgent,
        createdAt: schema.chatSessions.createdAt,
      })
      .from(schema.chatSessions)
      .orderBy(desc(schema.chatSessions.createdAt));
  }

  @Post('history/messages/:sessionId')
  async getMessagesBySession(@Param('sessionId') sessionId: string) {
    return this.db
      .select()
      .from(schema.chatMessages)
      .where(eq(schema.chatMessages.sessionId, sessionId))
      .orderBy(schema.chatMessages.createdAt);
  }

  @Post('stats/feedback')
  async getFeedbackStats() {
    const total = await this.db.select({ count: sql`count(*)` }).from(schema.feedbacks);
    const likes = await this.db
      .select({ count: sql`count(*)` })
      .from(schema.feedbacks)
      .where(eq(schema.feedbacks.isLike, 1));
    const dislikes = await this.db
      .select({ count: sql`count(*)` })
      .from(schema.feedbacks)
      .where(eq(schema.feedbacks.isLike, 0));

    return {
      total: Number(total[0].count),
      likes: Number(likes[0].count),
      dislikes: Number(dislikes[0].count),
      dislikeRate: total[0].count ? (Number(dislikes[0].count) / Number(total[0].count)) * 100 : 0,
    };
  }
}

import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database.module';
import * as schema from '../database/schema';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { GoogleGenerativeAIEmbeddings, ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { cosineDistance, desc, sql } from 'drizzle-orm';

@Injectable()
export class ChatService {
  private embeddings: GoogleGenerativeAIEmbeddings;
  private model: ChatGoogleGenerativeAI;

  constructor(
    @Inject(DATABASE_CONNECTION)
    private db: NodePgDatabase<typeof schema>,
  ) {
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GEMINI_API_KEY,
      model: 'text-embedding-004',
    });

    this.model = new ChatGoogleGenerativeAI({
      apiKey: process.env.GEMINI_API_KEY || '',
      model: 'gemini-1.5-flash',
      maxOutputTokens: 1000,
    });
  }

  async chat(message: string, sessionId?: string) {
    // 1. Tạo vector từ câu hỏi của user
    const queryVector = await this.embeddings.embedQuery(message);

    // 2. Tìm kiếm similarity (cosine distance) trong DB
    // Chúng ta sử dụng sql template để tính toán khoảng cách vector
    // Chú ý: Drizzle hỗ trợ helper cosineDistance cho pgvector
    const similarity = sql`1 - (${schema.documentChunks.embedding} <=> ${JSON.stringify(queryVector)}::vector)`;

    const relevantChunks = await this.db
      .select({
        content: schema.documentChunks.chunkText,
        score: similarity,
      })
      .from(schema.documentChunks)
      .orderBy(t => desc(t.score))
      .limit(5);

    // 3. Xây dựng prompt kèm context
    const context = relevantChunks.map(c => c.content).join('\n\n');
    
    const systemPrompt = `Bạn là một trợ lý ảo thông minh của hệ thống AutoFlow. 
Dưới đây là thông tin kiến thức bổ sung được trích xuất từ tài liệu của công ty:
---------------------
${context}
---------------------
Hãy dựa vào thông tin trên để trả lời câu hỏi của người dùng. 
Nếu thông tin không có trong tài liệu, hãy trả lời rằng bạn không biết và gợi ý họ liên hệ nhân viên hỗ trợ.
Trả lời bằng ngôn ngữ mà người dùng đang sử dụng.`;

    const response = await this.model.invoke([
      ['system', systemPrompt],
      ['user', message],
    ]);

    return {
      answer: response.content,
      sources: relevantChunks.filter(c => (c.score as unknown as number) > 0.6).length > 0 ? 'based on knowledge base' : 'general knowledge',
    };
  }
}

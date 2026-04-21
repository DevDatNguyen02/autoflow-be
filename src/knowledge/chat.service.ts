import { Injectable, Inject } from '@nestjs/common';
import { DATABASE_CONNECTION } from '../database/database.constants';
import * as schema from '../database/schema';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  GoogleGenerativeAIEmbeddings,
  ChatGoogleGenerativeAI,
} from '@langchain/google-genai';
import { desc, sql, eq } from 'drizzle-orm';

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

  private async getOrCreateSession(sessionId?: string) {
    if (sessionId) {
      const [session] = await this.db
        .select()
        .from(schema.chatSessions)
        .where(eq(schema.chatSessions.id, sessionId));
      if (session) return session.id;
    }

    const [newSession] = await this.db
      .insert(schema.chatSessions)
      .values({
        anonymousId: 'anonymous',
      })
      .returning();
    return newSession.id;
  }

  async chatStream(message: string, sessionId?: string) {
    // 0. Khởi tạo/Lấy session và lưu tin nhắn user
    const finalSessionId = await this.getOrCreateSession(sessionId);

    const [userMsg] = await this.db
      .insert(schema.chatMessages)
      .values({
        sessionId: finalSessionId,
        role: 'user',
        content: message,
      })
      .returning();

    // 1. Tìm kiếm context
    const queryVector = await this.embeddings.embedQuery(message);
    const similarity = sql`1 - (${schema.documentChunks.embedding} <=> ${JSON.stringify(queryVector)}::vector)`;

    const relevantChunks = await this.db
      .select({
        content: schema.documentChunks.chunkText,
        score: similarity,
      })
      .from(schema.documentChunks)
      .orderBy((t) => desc(t.score))
      .limit(3);

    const avgScore =
      relevantChunks.length > 0
        ? relevantChunks.reduce((acc, c) => acc + (c.score as number), 0) /
          relevantChunks.length
        : 0;

    // 2. Xử lý Hand-off nếu độ tin cậy thấp
    let handoffNotification = '';
    if (avgScore < 0.7 && relevantChunks.length > 0) {
      await this.db
        .update(schema.chatSessions)
        .set({ needsAgent: 1 })
        .where(eq(schema.chatSessions.id, finalSessionId));
      handoffNotification =
        '\n\n*(Thông báo: Tôi không tìm thấy thông tin chắc chắn trong tài liệu, đang kết nối bạn với chuyên viên hỗ trợ...)*';
    }

    const context = relevantChunks.map((c) => c.content).join('\n\n');

    const systemPrompt = `Bạn là một trợ lý ảo thông minh của hệ thống AutoFlow. 
Dưới đây là thông tin kiến thức bổ sung được trích xuất từ tài liệu của công ty:
---------------------
${context}
---------------------
Hãy dựa vào thông tin trên để trả lời câu hỏi của người dùng. 
Nếu thông tin không có trong tài liệu, hãy trả lời rằng bạn không biết và gợi ý họ liên hệ nhân viên hỗ trợ.
Trả lời bằng ngôn ngữ mà người dùng đang sử dụng.`;

    const stream = await this.model.stream([
      ['system', systemPrompt],
      ['user', message],
    ]);

    // 3. Tạo ID cho tin nhắn bot trước (để trả về FE)
    const botMessageId = crypto.randomUUID();

    // Do stream chạy bất đồng bộ, chúng ta sẽ lưu tin nhắn sau khi stream kết thúc
    // Ở đây ta dùng một hàm bọc để không block kết quả trả về
    const saveBotMessage = async (fullContent: string) => {
      await this.db.insert(schema.chatMessages).values({
        id: botMessageId,
        sessionId: finalSessionId,
        role: 'bot',
        content: fullContent + handoffNotification,
        confidenceScore: Math.round(avgScore * 100),
      });
    };

    // Chúng ta cần wrap stream để bắt dữ liệu cuối cùng
    const self = this;
    async function* wrappedStream() {
      let fullContent = '';
      for await (const chunk of stream) {
        fullContent += chunk.content;
        yield chunk;
      }
      // Thêm thông báo handoff vào cuối stream nếu có
      if (handoffNotification) {
        yield { content: handoffNotification };
      }
      await saveBotMessage(fullContent);
    }

    return {
      stream: wrappedStream(),
      messageId: botMessageId,
      sessionId: finalSessionId,
    };
  }

  async chat(message: string) {
    // Giữ nguyên hàm chat gốc hoặc cập nhật nếu cần, 
    // nhưng hiện tại FE chủ yếu dùng chatStream
    const { stream } = await this.chatStream(message);
    let fullText = '';
    for await (const chunk of stream) {
      fullText += chunk.content;
    }
    return { answer: fullText };
  }
}

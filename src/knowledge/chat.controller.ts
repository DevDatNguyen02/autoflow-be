import { Controller, Post, Body, Res } from '@nestjs/common';
import { ChatService } from './chat.service';
import * as express from 'express';

@Controller('api/knowledge')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('chat')
  async chat(
    @Body() body: { message: string; sessionId?: string },
    @Res() res: express.Response,
  ) {
    // Nếu request yêu cầu stream (hoặc mặc định cho bản mới)
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    const { stream, messageId, sessionId } = await this.chatService.chatStream(
      body.message,
      body.sessionId,
    );

    // Gửi sessionId và messageId trong header để FE lưu lại
    res.setHeader('x-session-id', sessionId);
    res.setHeader('x-message-id', messageId);

    for await (const chunk of stream) {
      if (chunk.content) {
        res.write(chunk.content);
      }
    }

    res.end();
  }
}

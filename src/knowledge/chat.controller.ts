import { Controller, Post, Body } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('api/knowledge')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('chat')
  async chat(@Body() body: { message: string; sessionId?: string }) {
    return this.chatService.chat(body.message, body.sessionId);
  }
}

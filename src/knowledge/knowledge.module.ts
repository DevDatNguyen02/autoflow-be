import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { KnowledgeController } from './knowledge.controller';
import { ChatController } from './chat.controller';
import { KnowledgeService } from './knowledge.service';
import { ChatService } from './chat.service';
import { KnowledgeProcessor } from './knowledge.processor';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({
      name: 'knowledge-queue',
    }),
  ],
  controllers: [KnowledgeController, ChatController],
  providers: [KnowledgeService, ChatService, KnowledgeProcessor],
  exports: [KnowledgeService, ChatService],
})
export class KnowledgeModule {}

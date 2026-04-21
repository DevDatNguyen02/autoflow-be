import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { workflowConsumer } from './workflow.consumer';
import { WorkflowParser } from './workflow.parser';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'automation-engine',
    }),
    DatabaseModule,
    // Tránh vòng lặp phụ thuộc nếu cần thiết
  ],
  providers: [workflowConsumer, WorkflowParser],
  exports: [BullModule, WorkflowParser],
})
export class AutomationEngineModule {}

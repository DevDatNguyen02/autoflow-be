import { Module } from '@nestjs/common';
import { AutomationService } from './automation.service';
import { AutomationController } from './automation.controller';
import { DatabaseModule } from '../database/database.module';
import { WorkflowParser } from './engine/workflow.parser';

@Module({
  imports: [DatabaseModule],
  controllers: [AutomationController],
  providers: [AutomationService, WorkflowParser],
  exports: [AutomationService],
})
export class AutomationModule {}

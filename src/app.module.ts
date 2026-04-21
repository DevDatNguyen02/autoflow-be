import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { QueueModule } from './queue/queue.module';
import { TrackingModule } from './tracking/tracking.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AutomationModule } from './automation/automation.module';
import { AutomationEngineModule } from './automation/engine/automation-engine.module';
import { SegmentsModule } from './segments/segments.module';
import { CustomersModule } from './customers/customers.module';

@Module({
  imports: [
    DatabaseModule,
    QueueModule,
    TrackingModule,
    KnowledgeModule,
    DashboardModule,
    AutomationModule,
    AutomationEngineModule,
    SegmentsModule,
    CustomersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }

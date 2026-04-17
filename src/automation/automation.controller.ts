import { Controller, Post, Get, Body } from '@nestjs/common';
import { AutomationService } from './automation.service';

@Controller('automation')
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Post('workflows')
  async createWorkflow(@Body() data: { name: string; graph: any }) {
    return this.automationService.createWorkflow(data);
  }

  @Get('workflows')
  async getAllWorkflows() {
    return this.automationService.getAllWorkflows();
  }
}

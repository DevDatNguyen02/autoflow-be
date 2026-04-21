import { Controller, Post, Get, Body, Param, Patch } from '@nestjs/common';
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

  @Get('workflows/:id')
  async getWorkflow(@Param('id') id: string) {
    return this.automationService.getWorkflowById(id);
  }

  @Patch('workflows/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: 'draft' | 'active',
  ) {
    return this.automationService.updateWorkflowStatus(id, status);
  }

  @Post('workflows/:id/test')
  async testWorkflow(@Param('id') id: string, @Body() mockPayload: any) {
    return this.automationService.dryRunWorkflow(id, mockPayload);
  }
}

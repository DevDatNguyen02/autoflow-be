import { Controller, Post, Get, Body } from '@nestjs/common';
import { SegmentsService } from './segments.service';

@Controller('api/v1/segments')
export class SegmentsController {
  constructor(private readonly segmentsService: SegmentsService) {}

  @Get()
  async getSegments() {
    return { data: await this.segmentsService.getSegments() };
  }

  @Post()
  async createSegment(@Body() body: any) {
    return { data: await this.segmentsService.createSegment(body) };
  }

  @Post('preview')
  async previewSegment(@Body() body: any) {
    return { data: await this.segmentsService.getSegmentPreview(body) };
  }
}

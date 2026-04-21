import { Controller, Post, Get, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { TrackingService } from './tracking.service';

@Controller('api/v1/track')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Get('profiles')
  async getProfiles() {
    return this.trackingService.getProfiles();
  }

  @Get('event-names')
  async getEventNames() {
    return { data: await this.trackingService.getUniqueEventNames() };
  }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED) // Return 202 Accepted immediately
  async track(@Body() payload: any) {
    await this.trackingService.enqueueTrack(payload);
    return { status: 'queued' };
  }
}

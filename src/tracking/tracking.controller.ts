import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { TrackingService } from './tracking.service';

@Controller('api/v1/track')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) { }

  @Post()
  @HttpCode(HttpStatus.ACCEPTED) // Return 202 Accepted immediately
  async track(@Body() payload: any) {
    await this.trackingService.enqueueTrack(payload);
    return { status: 'queued' };
  }
}

export interface TrackingJobData {
  eventName: string;
  anonymousId?: string;
  profileId?: string;
  properties?: Record<string, unknown>;
  url?: string;
  source?: string;
  campaign?: string;
  email?: string;
  userId?: string;
  name?: string;
  timestamp?: string | number | Date;
}

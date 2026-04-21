import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { profiles, events, chatSessions, chatMessages } from '../database/schema';
import { eq, desc, sql } from 'drizzle-orm';

@Injectable()
export class CustomersService {
  constructor(private readonly db: DatabaseService) {}

  async getCustomer360(id: string, userRole: string = 'marketer') {
    // 1. Lấy thông tin Profile
    const [profile] = await this.db.conn
      .select()
      .from(profiles)
      .where(eq(profiles.id, id));

    if (!profile) {
      throw new NotFoundException('Customer profile not found');
    }

    // 2. Lấy 50 Tracking Events gần nhất
    const recentEvents = await this.db.conn
      .select()
      .from(events)
      .where(eq(events.profileId, id))
      .orderBy(desc(events.timestamp))
      .limit(50);

    // 3. Lấy 50 Chat Messages gần nhất (Nếu Profile có liên kết với anonymousId)
    let recentChats: any[] = [];
    if (profile.userId || profile.properties?.['anonymousId']) {
      const anonId = profile.properties?.['anonymousId'];
      
      // Tìm các sessions của user này
      const sessions = await this.db.conn
        .select({ id: chatSessions.id })
        .from(chatSessions)
        .where(eq(chatSessions.anonymousId, anonId));

      if (sessions.length > 0) {
        const sessionIds = sessions.map(s => s.id);
        recentChats = await this.db.conn
          .select()
          .from(chatMessages)
          .where(sql`${chatMessages.sessionId} IN ${sessionIds}`)
          .orderBy(desc(chatMessages.createdAt))
          .limit(50);
      }
    }

    // 4. Gộp và tạo Timeline (Giới hạn 50 bản ghi gộp)
    const timeline = [
      ...recentEvents.map(e => ({
        type: 'event',
        id: e.id,
        label: e.eventName,
        content: `User visited ${e.url || 'website'} via ${e.source || 'direct'}`,
        timestamp: e.timestamp,
        metadata: e.properties,
      })),
      ...recentChats.map(c => ({
        type: 'chat',
        id: c.id,
        label: c.role === 'user' ? 'Customer asked' : 'AI responded',
        content: c.content,
        timestamp: c.createdAt,
        metadata: { confidenceScore: c.confidenceScore },
      })),
    ]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 50);

    // 5. Áp dụng PII Masking (Che toàn bộ nếu không phải Admin)
    const finalProfile = userRole === 'admin' ? profile : this.maskProfile(profile);

    return {
      profile: finalProfile,
      timeline,
    };
  }

  private maskProfile(profile: any) {
    return {
      ...profile,
      email: profile.email ? '**********' : null,
      name: profile.name ? profile.name.split(' ').map(n => n[0] + '***').join(' ') : 'Anonymous Customer',
      // Có thể che thêm các properties nhạy cảm khác nếu cần
    };
  }
}

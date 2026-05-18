const prisma = require('../../config/prisma');

class AnnouncementService {
  /*
  |--------------------------------------------------------------------------
  | GET USER ANNOUNCEMENTS (CORE ENGINE)
  |--------------------------------------------------------------------------
  */
  async getUserAnnouncements(user) {
    const now = new Date();

    /*
    |--------------------------------------------------------------------------
    | STEP 1: FETCH ACTIVE ANNOUNCEMENTS
    |--------------------------------------------------------------------------
    */
    const announcements = await prisma.announcement.findMany({
      where: {
        AND: [
          {
            OR: [{ startAt: null }, { startAt: { lte: now } }],
          },
          {
            OR: [{ endAt: null }, { endAt: { gte: now } }],
          },
        ],
      },
      include: {
        countries: true,
        packages: true,
        segments: true,
        reads: {
          where: {
            userId: user.id,
          },
        },
      },
    });

    /*
    |--------------------------------------------------------------------------
    | STEP 2: FILTER PER USER
    |--------------------------------------------------------------------------
    */
    const filtered = announcements.filter((a) => {
      /*
      |--------------------------------------------------------------------------
      | EMERGENCY OVERRIDE
      |--------------------------------------------------------------------------
      */
      if (a.isEmergency) return true;

      /*
      |--------------------------------------------------------------------------
      | COUNTRY FILTER
      |--------------------------------------------------------------------------
      */
      if (a.countries.length > 0) {
        const match = a.countries.some((c) => c.countryCode === user.country);
        if (!match) return false;
      }

      /*
      |--------------------------------------------------------------------------
      | PACKAGE FILTER
      |--------------------------------------------------------------------------
      */
      if (a.packages.length > 0) {
        const match = a.packages.some((p) => p.packageId === user.packageId);
        if (!match) return false;
      }

      /*
      |--------------------------------------------------------------------------
      | SEGMENT FILTER (BASIC)
      |--------------------------------------------------------------------------
      */
      if (a.segments.length > 0) {
        const segmentMatch = a.segments.some((s) => {
          if (s.segmentType === 'NEW_USERS') {
            return user.isNewUser;
          }

          if (s.segmentType === 'INACTIVE') {
            return user.lastLoginDays >= (s.rules?.days || 30);
          }

          return true;
        });

        if (!segmentMatch) return false;
      }

      /*
      |--------------------------------------------------------------------------
      | DISMISS CHECK
      |--------------------------------------------------------------------------
      */
      const read = a.reads[0];

      if (read?.dismissedAt && !a.isEmergency) {
        return false;
      }

      return true;
    });

    /*
    |--------------------------------------------------------------------------
    | STEP 3: SORTING
    |--------------------------------------------------------------------------
    */
    const sorted = filtered.sort((a, b) => {
      if (a.isEmergency && !b.isEmergency) return -1;
      if (!a.isEmergency && b.isEmergency) return 1;

      const priorityMap = {
        CRITICAL: 4,
        HIGH: 3,
        MEDIUM: 2,
        LOW: 1,
      };

      return priorityMap[b.priority] - priorityMap[a.priority];
    });

    /*
    |--------------------------------------------------------------------------
    | STEP 4: LIMIT + FORMAT
    |--------------------------------------------------------------------------
    */
    return sorted.slice(0, 20).map((a) => {
      const read = a.reads[0];

      return {
        id: a.id,
        title: a.title,
        message: a.message,
        priority: a.priority,
        placement: a.placement,
        eventType: a.eventType,
        isEmergency: a.isEmergency,
        seen: !!read?.seenAt,
        dismissed: !!read?.dismissedAt,
        createdAt: a.createdAt,
      };
    });
  }

  /*
  |--------------------------------------------------------------------------
  | MARK AS READ
  |--------------------------------------------------------------------------
  */
  async markAsRead(announcementId, userId) {
    return prisma.announcementRead.upsert({
      where: {
        announcementId_userId: {
          announcementId,
          userId,
        },
      },
      update: {
        seenAt: new Date(),
      },
      create: {
        announcementId,
        userId,
        seenAt: new Date(),
      },
    });
  }

  /*
  |--------------------------------------------------------------------------
  | DISMISS ANNOUNCEMENT
  |--------------------------------------------------------------------------
  */
  async dismissAnnouncement(announcementId, userId) {
    return prisma.announcementRead.upsert({
      where: {
        announcementId_userId: {
          announcementId,
          userId,
        },
      },
      update: {
        dismissedAt: new Date(),
      },
      create: {
        announcementId,
        userId,
        dismissedAt: new Date(),
      },
    });
  }
}

module.exports = new AnnouncementService();

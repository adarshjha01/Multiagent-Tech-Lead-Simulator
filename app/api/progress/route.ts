import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware, getCurrentUserId } from 'lyzr-architect';
import getProgressModel from '@/models/Progress';

export const dynamic = 'force-dynamic';

export const GET = authMiddleware(async (req: NextRequest) => {
  try {
    const Progress = await getProgressModel();
    const userId = getCurrentUserId();
    let progress = await Progress.findOne({ user_id: userId }).lean();
    if (!progress) {
      progress = await Progress.create({
        user_id: userId,
        owner_user_id: userId,
        total_completed: 0,
        avg_score: 0,
        easy_count: 0,
        medium_count: 0,
        hard_count: 0,
        last_active: new Date(),
      });
    }
    return NextResponse.json({ success: true, data: progress });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const PUT = authMiddleware(async (req: NextRequest) => {
  try {
    const Progress = await getProgressModel();
    const userId = getCurrentUserId();
    const body = await req.json();

    const progress = await Progress.findOneAndUpdate(
      { user_id: userId },
      {
        $set: {
          ...body,
          last_active: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    return NextResponse.json({ success: true, data: progress });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

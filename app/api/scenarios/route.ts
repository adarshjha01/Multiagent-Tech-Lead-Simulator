import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware, getCurrentUserId } from 'lyzr-architect';
import getScenarioModel from '@/models/Scenario';

export const dynamic = 'force-dynamic';

export const GET = authMiddleware(async (req: NextRequest) => {
  try {
    const Scenario = await getScenarioModel();
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = parseInt(searchParams.get('skip') || '0');
    const search = searchParams.get('search') || '';

    const query: any = {};
    if (search) {
      query.ticket_title = { $regex: search, $options: 'i' };
    }

    const scenarios = await Scenario.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    const total = await Scenario.countDocuments(query);

    return NextResponse.json({ success: true, data: scenarios, total });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const POST = authMiddleware(async (req: NextRequest) => {
  try {
    const Scenario = await getScenarioModel();
    const body = await req.json();
    const userId = getCurrentUserId();
    const scenario = await Scenario.create({ ...body, owner_user_id: userId });
    return NextResponse.json({ success: true, data: scenario });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

export const DELETE = authMiddleware(async (req: NextRequest) => {
  try {
    const Scenario = await getScenarioModel();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ success: false, error: 'ID required' }, { status: 400 });
    await Scenario.findByIdAndDelete(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
});

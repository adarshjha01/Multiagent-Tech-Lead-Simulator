import { initDB, createModel } from 'lyzr-architect';
let _model: any = null;
export default async function getProgressModel() {
  if (!_model) {
    await initDB();
    _model = createModel('Progress', {
      user_id: { type: String, required: true, unique: true },
      total_completed: { type: Number, default: 0 },
      avg_score: { type: Number, default: 0 },
      easy_count: { type: Number, default: 0 },
      medium_count: { type: Number, default: 0 },
      hard_count: { type: Number, default: 0 },
      last_active: { type: Date, default: Date.now },
    });
  }
  return _model;
}

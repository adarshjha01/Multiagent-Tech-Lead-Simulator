import { initDB, createModel } from 'lyzr-architect';
let _model: any = null;
export default async function getScenarioModel() {
  if (!_model) {
    await initDB();
    _model = createModel('Scenario', {
      user_id: { type: String, required: true },
      difficulty: { type: String, required: true },
      ticket_title: { type: String, required: true },
      original_code: { type: String, required: true },
      user_fix: { type: String, default: '' },
      review_score: { type: Number, default: 0 },
      feedback_md: { type: String, default: '' },
      review_data: { type: String, default: '' },
      mentor_data: { type: String, default: '' },
      ticket_description: { type: String, default: '' },
      priority: { type: String, default: '' },
      acceptance_criteria: { type: String, default: '' },
      completed_at: { type: Date },
    });
  }
  return _model;
}

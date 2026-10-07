-- horário de estudo (período) de cada item do cronograma; planned_minutes passa a ser derivado dele quando informado
ALTER TABLE schedule_items ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE schedule_items ADD COLUMN IF NOT EXISTS end_time TIME;
CREATE INDEX IF NOT EXISTS idx_schedule_topic ON schedule_items(topic_id);

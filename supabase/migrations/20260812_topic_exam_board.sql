ALTER TABLE topics ADD COLUMN exam_board_id UUID REFERENCES exam_boards(id) ON DELETE SET NULL;

ALTER TABLE subjects
  ADD COLUMN IF NOT EXISTS archetype text
    CHECK (
      archetype IS NULL OR archetype IN (
        'dynamic_causal',
        'decision_incentive',
        'spatial_pattern',
        'procedural_structural',
        'sequential_process'
      )
    );

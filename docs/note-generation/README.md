# Flexible ABA Note Generation

The current note pipeline intentionally keeps only four server-owned invariants:

1. The locked opening.
2. One ABC paragraph per session hour.
3. The exact app-selected replacement program and percentage for each hour.
4. The locked closing, performance, and next-session sequence.

The model writes the ABC paragraphs using the client profile, sanitized assessment, and the sample
style guide. See `ABC-FORMAT-INSTRUCTIONS.md` and `SAMPLE-NOTE-REFERENCE.md`.

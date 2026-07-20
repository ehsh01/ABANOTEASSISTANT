# Complete Note Generation Contract

## Inputs

- session facts;
- one explicit replacement-program assignment per hour;
- one manually selected percentage for every assigned program;
- the client profile and uploaded assessment.

## Output

1. Current locked two-sentence opening.
2. Exactly one model-written ABC paragraph per session hour.
3. Current locked closing paragraph.
4. Current server-built performance sentence.
5. Current server-built next-session sentence.

Each ABC paragraph must reproduce its hour's program and percentage exactly. The model chooses the
activity, behavior, and intervention details from the supplied client context.

## Removed legacy policies

There is no behavior rotation, program auto-fill, behavior-function remapping, intervention assignment,
intervention-count rule, safety-chain injection, topography rewrite, subjective-word blacklist,
acquisition-only prose branch, or deterministic ABC sentence template.

Generation remains fail-open. Structural problems are returned as warnings and audit telemetry.

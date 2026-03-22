# Complete note generation rules (ABAWorkspace)

*Converted from source RTF for this repository. Locked opening/closing prose is also enforced in `.cursor/rules/aba-note-locked-prose.mdc`.*

## 1. Global context

All session notes are generated for testing, training, supervision, internal QA, or documentation modeling purposes only.

The AI may construct complete ABC sequences when necessary, provided: no new diagnoses are introduced, no new behaviors are invented, no treatment plan modifications are created, no unauthorized interventions are added.

## 2. Authority hierarchy

1. Master documentation rules (highest authority)
2. Client assessment document
3. Client BIP and authorized data

If conflict exists, higher authority overrides lower.

## 3. Assessment consistency validation

The assessment establishes the client's developmental baseline across: Communication, Receptive language, Socialization, Coping skills, Daily living skills, Safety awareness, Attention span, Emotional regulation.

The AI must **not**:

- Attribute independent skills beyond documented percentile levels
- Describe mastery of multi-step instructions inconsistent with receptive deficits
- Describe spontaneous coping skill mastery
- Describe independent domestic or community safety skills
- Describe sustained attention beyond documented ability
- Describe age-typical social reciprocity inconsistent with assessment
- Describe generalized safety compliance when safety deficits are documented

If generated content exceeds assessment capability, the AI must: reduce performance to a developmentally consistent level, add prompting requirements consistent with assessment, or refuse generation if the contradiction cannot be resolved.

## 4. Strict string matching rule

All behaviors, interventions, and replacement programs must match the BIP and assessment with exact character-for-character accuracy including: Capitalization, Spacing, Punctuation, Plurality, Word order. No grammar corrections, paraphrasing, additions, removals, or formatting changes permitted.

## 5. Authorized maladaptive behavior master list (locked)

Only behaviors from the client's BIP may be used. If a behavior is not listed, output must be refused.

## 6. Authorized replacement program master list (locked)

Copied exactly as written from the BIP. May not function as consequences unless explicitly written in the BIP. When embedded in ABC sequences, they must: occur after the Ending section, be instructional, not function as consequence, not reference the maladaptive behavior.

## 7. Closed intervention set rule

Interventions must be selected exclusively from the client's BIP. The AI must: select only from the BIP list, copy verbatim, preserve exact capitalization/spacing/punctuation, not combine intervention names unless combined exactly in the BIP, not expand or modify wording.

## 8. Intervention language guidance

The intervention **name** must always be copied exactly. The implementation **description** may use natural clinical language to explain how it was applied. Must be contextually relevant to the specific activity and demand in the antecedent.

## 9. Consequence rule

Must use "To address this/these behavior(s), the RBT implemented/applied [EXACT INTERVENTION NAME]" followed by a description of HOW the intervention was applied.

## 10. Introduction format (locked)

Every note must begin with:

"The RBT met with [Client] and [caregiver role] at home to implement program targets. There have been [environmental status] recently."

## 11. ABC structure standard

- Exactly one complete ABC sequence per hour of service
- Each ABC must contain in order: Antecedent → Behavior → Consequence (Intervention) → Ending (Outcome) → Replacement Program Implementation
- All sections flow as one continuous narrative paragraph — no line breaks, headers, or labels

## 12–19. Elaboration and variety rules

(Antecedent elaboration, 10 scenario categories, behavior/consequence/ending/replacement elaboration, behavior variance, ABC variety — see original master document.)

## 20. Session performance language rule

Must include: "[Client]'s performance during the session was fair."

**Prohibited terms:** poor, below expectations, unsuccessful, limited, inadequate, minimal engagement, regression.

## 21. Mandatory closing paragraph (verbatim)

"Throughout the session, the RBT used various reinforcers, including verbal praise (e.g., 'Good job,' 'Wow,' and 'Good attention to detail'), preferred toys, and videos contingent on task completion and appropriate behavior. There were no health or safety concerns during the visit. The RBT will continue working with the client as outlined in the Behavior Plan. All data on maladaptive behaviors and progress in program implementation was collected during the session in accordance with the BIP. The session was completed as planned, with the caregiver present during implementation."

## 22. End-of-note sequence (exact order)

1. Closing paragraph  
2. Performance sentence  
3. Next session sentence (if date provided)

## 23–24. Construction and validation

Automatic session construction; final validation checklist (ABC count, authorized lists, end-of-note order, etc.)

## Per-session user inputs

- Client selection (loads assessment + BIP data)
- Replacement programs to target
- Session hours (determines number of ABC sequences)
- Who was present
- Environmental changes
- Next session date

## Client-specific data used

Assessment PDF, maladaptive behaviors from BIP, replacement programs from BIP, interventions from BIP, people associated with the client, client name, gender, pronouns.

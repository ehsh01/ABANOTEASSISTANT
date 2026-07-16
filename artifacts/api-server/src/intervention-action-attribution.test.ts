import { describe, expect, it } from "vitest";
import {
  attributeActionClauseToRbt,
  gerundActionToPast,
  normalizeClinicalBodyInterventionActionAttribution,
} from "./note-normalization";

describe("gerundActionToPast", () => {
  it("converts silent-e, doubling, regular, and consonant+y gerunds", () => {
    expect(gerundActionToPast("moving")).toBe("moved");
    expect(gerundActionToPast("reducing")).toBe("reduced");
    expect(gerundActionToPast("placing")).toBe("placed");
    expect(gerundActionToPast("requiring")).toBe("required");
    expect(gerundActionToPast("providing")).toBe("provided");
    expect(gerundActionToPast("arranging")).toBe("arranged");
    expect(gerundActionToPast("blocking")).toBe("blocked");
    expect(gerundActionToPast("prompting")).toBe("prompted");
    expect(gerundActionToPast("presenting")).toBe("presented");
    expect(gerundActionToPast("delivering")).toBe("delivered");
    expect(gerundActionToPast("modeling")).toBe("modeled");
    expect(gerundActionToPast("redirecting")).toBe("redirected");
    expect(gerundActionToPast("reinforcing")).toBe("reinforced");
    expect(gerundActionToPast("stopping")).toBe("stopped");
  });

  it("handles irregular RBT-action gerunds", () => {
    expect(gerundActionToPast("withholding")).toBe("withheld");
    expect(gerundActionToPast("keeping")).toBe("kept");
    expect(gerundActionToPast("holding")).toBe("held");
  });

  it("preserves leading capitalization", () => {
    expect(gerundActionToPast("Requiring")).toBe("Required");
  });

  it("returns null for non-gerund tokens", () => {
    expect(gerundActionToPast("cleanup")).toBeNull();
    expect(gerundActionToPast("the")).toBeNull();
    expect(gerundActionToPast("materials")).toBeNull();
  });
});

describe("attributeActionClauseToRbt", () => {
  it("adds the RBT and past-tenses a single action (Premack contingency)", () => {
    expect(attributeActionClauseToRbt("requiring cleanup before access to the tablet.")).toBe(
      "the RBT required cleanup before access to the tablet.",
    );
    expect(
      attributeActionClauseToRbt(
        "requiring completion of the table activity before access to spinning toy play.",
      ),
    ).toBe(
      "the RBT required completion of the table activity before access to spinning toy play.",
    );
  });

  it("past-tenses every action in a coordinated environmental-arrangement list", () => {
    expect(
      attributeActionClauseToRbt(
        "moving task materials closer, reducing extra items on the table, and placing sensory toys within view as part of the environmental arrangement.",
      ),
    ).toBe(
      "the RBT moved task materials closer, reduced extra items on the table, and placed sensory toys within view as part of the environmental arrangement.",
    );
  });

  it("does not reattribute client behavior in a trailing subordinate clause", () => {
    expect(
      attributeActionClauseToRbt(
        "providing reinforcement when the client transitioned to the work area without engaging in hand flapping.",
      ),
    ).toBe(
      "the RBT provided reinforcement when the client transitioned to the work area without engaging in hand flapping.",
    );
  });

  it("leaves clauses that already have a subject unchanged", () => {
    expect(
      attributeActionClauseToRbt("the RBT blocked further contact with the client's arm."),
    ).toBe("the RBT blocked further contact with the client's arm.");
    expect(
      attributeActionClauseToRbt(
        "attention was withheld during the maladaptive response and brief praise was delivered.",
      ),
    ).toBe("attention was withheld during the maladaptive response and brief praise was delivered.");
  });
});

describe("normalizeClinicalBodyInterventionActionAttribution", () => {
  it("fixes subjectless action detail inside a full paragraph", () => {
    const body =
      'While this work was underway, the client manifested Task Refusal by moving task materials away. To address this behavior, the RBT implemented Premack principle. Following this intervention, requiring cleanup before access to the tablet. The client returned the materials after prompting.';
    const out = normalizeClinicalBodyInterventionActionAttribution(body);
    expect(out).toContain("Following this intervention, the RBT required cleanup before access to the tablet.");
    // The client-response sentence is untouched.
    expect(out).toContain("The client returned the materials after prompting.");
  });

  it("handles the 'Following these interventions' plural lead", () => {
    const body =
      "Following these interventions, providing reinforcement when the client stayed at the table.";
    expect(normalizeClinicalBodyInterventionActionAttribution(body)).toBe(
      "Following these interventions, the RBT provided reinforcement when the client stayed at the table.",
    );
  });

  it("is a no-op when the action already names the RBT", () => {
    const body = "Following this intervention, the RBT re-presented the task.";
    expect(normalizeClinicalBodyInterventionActionAttribution(body)).toBe(body);
  });
});

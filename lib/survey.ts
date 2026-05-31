export type SectionId = "context" | "demand" | "classification" | "governance";

export const sections: Array<{ id: SectionId; label: string; shortLabel: string }> = [
  { id: "context", label: "A. Participant context", shortLabel: "Context" },
  { id: "demand", label: "B. Responsible-use demand ratings", shortLabel: "Demand" },
  { id: "classification", label: "C. Design-space classification", shortLabel: "Classification" },
  { id: "governance", label: "D. Optional governance feedback", shortLabel: "Governance" }
];

export const roles = [
  "Instructor / faculty",
  "Educational developer",
  "Researcher",
  "Student",
  "Administrator",
  "Other"
];

export const contexts = [
  "Undergraduate teaching",
  "Graduate teaching",
  "Professional / continuing education",
  "Research methods",
  "Program or curriculum design",
  "Other"
];

export const disciplines = [
  "Computer science / software engineering",
  "Engineering",
  "Science",
  "Health sciences",
  "Social sciences",
  "Humanities",
  "Business",
  "Interdisciplinary / other"
];

export const policyContexts = [
  "No formal policy",
  "Instructor-specific guidance",
  "Department or program policy",
  "Institution-wide policy",
  "Policy under development",
  "Unsure"
];

export const demandScenarios = [
  {
    id: "s1_full_solution_pre_attempt",
    title: "S1",
    prompt: "Students can ask ChatGPT for a full solution before attempting a programming assignment.",
    expectedDemand: "Very high"
  },
  {
    id: "s2_ide_integrated_assistant",
    title: "S2",
    prompt: "Students use an IDE-integrated assistant such as Copilot during a project.",
    expectedDemand: "Moderate to high"
  },
  {
    id: "s3_post_attempt_hints",
    title: "S3",
    prompt: "Students receive AI-generated hints only after they have made an initial attempt.",
    expectedDemand: "Low to moderate"
  },
  {
    id: "s4_revision_feedback",
    title: "S4",
    prompt: "Students submit a draft of their code and receive AI-generated feedback for revision.",
    expectedDemand: "Low to moderate"
  },
  {
    id: "s5_critique_buggy_ai_code",
    title: "S5",
    prompt: "Students critique, test, and correct buggy AI-generated code.",
    expectedDemand: "Low / structurally protective"
  }
];

export const classificationScenarios = [
  {
    id: "lab_autocomplete",
    title: "In-lab assistant",
    prompt: "Students work on a lab while an AI tool gives inline hints, code completions, and short explanations."
  },
  {
    id: "critique_ai_answer",
    title: "Critique an AI answer",
    prompt: "Students receive an AI-generated solution and must identify defects, assumptions, and improvements."
  },
  {
    id: "post_submission_feedback",
    title: "Post-submission feedback",
    prompt: "After submitting an assignment, students receive AI feedback to guide reflection and revision."
  }
];

export const aiEntryTiming = ["Pre-attempt", "Concurrent", "Post-attempt", "Unclear/depends"];

export const aiOutputScope = [
  "Full solution",
  "Partial solution",
  "Feedback/evaluation",
  "Material for critique",
  "Unclear/depends"
];

export const safeguards = [
  "Transparent disclosure",
  "Prompt / transcript submission",
  "Reflection on AI use",
  "Human review checkpoint",
  "Assessment redesign",
  "Tool restrictions",
  "No single safeguard fits"
];

export const taxonomyUsefulness = ["Not useful", "Slightly useful", "Moderately useful", "Very useful", "Essential"];

export const sectionOrder = sections.map((section) => section.id);

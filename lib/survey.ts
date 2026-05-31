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
    id: "debugging",
    title: "Debugging support",
    prompt: "A learner asks GenAI to explain an error and suggest debugging steps for their own code."
  },
  {
    id: "full_solution",
    title: "Full solution generation",
    prompt: "A learner asks GenAI to generate a complete solution before attempting the task."
  },
  {
    id: "test_design",
    title: "Test design",
    prompt: "A learner asks GenAI to propose tests for code they already wrote."
  },
  {
    id: "concept_explanation",
    title: "Concept explanation",
    prompt: "A learner asks GenAI to explain a programming concept using examples."
  },
  {
    id: "code_review",
    title: "Code review",
    prompt: "A learner asks GenAI to critique their code for readability, correctness, and maintainability."
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

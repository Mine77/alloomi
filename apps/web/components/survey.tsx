export interface SurveyAnswers {
  industry: string;
  roles: string[];
  otherRole: string;
  size: string;
  communicationTools: string[];
  dailyMessages: string;
  challenges: string[];
  workDescription?: string;
}

export async function submitSurvey(answers: SurveyAnswers) {
  try {
    const payload = {
      ...answers,
      role: answers.roles[0] ?? "",
      roles: answers.roles,
      otherRole: answers.otherRole?.trim() || undefined,
      workDescription: answers.workDescription?.trim()
        ? answers.workDescription.trim()
        : undefined,
    };

    const response = await fetch("/api/survey", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      credentials: "include",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to submit survey");
    }

    return {
      success: true,
      surveyId: data.surveyId,
    };
  } catch (error) {
    console.error("Survey submission error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

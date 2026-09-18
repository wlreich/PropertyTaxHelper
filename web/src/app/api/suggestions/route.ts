import { handleSuggestion } from "@/lib/suggestion-request";
import { databaseClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  return handleSuggestion(request, async ({ submissionId, category, message }) => {
    const { data, error } = await databaseClient().rpc("submit_feature_suggestion", {
      p_submission_id: submissionId, p_category: category, p_message: message,
    });
    if (error || data !== true) throw new Error("Suggestion not saved");
  });
}

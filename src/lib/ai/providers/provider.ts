import {
  GeneratedShortsProject,
  GenerateScriptInput,
  RecommendationInput,
  TopicRecommendation,
} from "@/types";

export interface ScriptProvider {
  generateScript(input: GenerateScriptInput, requestId?: string): Promise<GeneratedShortsProject>;
}

export interface RecommendationProvider {
  generateRecommendations(input: RecommendationInput, requestId?: string): Promise<TopicRecommendation[]>;
}

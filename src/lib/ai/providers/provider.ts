import {
  GeneratedShortsProject,
  GenerateScriptInput,
  RecommendationInput,
  TopicRecommendation,
} from "@/types";

export interface ScriptProvider {
  generateScript(input: GenerateScriptInput): Promise<GeneratedShortsProject>;
}

export interface RecommendationProvider {
  generateRecommendations(input: RecommendationInput): Promise<TopicRecommendation[]>;
}

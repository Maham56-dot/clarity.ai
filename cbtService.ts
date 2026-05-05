import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface CBTScenario {
  id: string;
  situation: string;
  emotion: string;
  distortedThought: string;
  distortions: string[];
  reframedThoughts: {
    text: string;
    type: string;
    isCorrect: boolean;
    explanation: string;
  }[];
  explanation: string;
}

const COMMON_DISTORTIONS = [
  "All-or-Nothing Thinking",
  "Overgeneralization",
  "Mental Filter",
  "Discounting the Positive",
  "Mind Reading",
  "Fortune Telling",
  "Magnification/Minimization",
  "Emotional Reasoning",
  "Should Statements",
  "Labeling",
  "Personalization"
];

export async function generateScenario(level: number = 1, recentScenarios: string[] = []): Promise<CBTScenario> {
  const levelDescriptions = {
    1: "Simple daily decisions and minor inconveniences (e.g., choosing what to wear, a small social slight, minor work task).",
    2: "Emotional or confusing scenarios involving relationships, self-worth, or moderate stress.",
    3: "Complex thinking situations involving major life decisions, career paths, or deep-seated cognitive patterns."
  };

  const types = ["emotional confusion", "decision making", "overthinking"];
  const selectedType = types[Math.floor(Math.random() * types.length)];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a CBT (Cognitive Behavioral Therapy) expert. 
      Generate a realistic scenario for a game called "Clarity Training".
      
      CURRENT LEVEL: ${level}
      LEVEL FOCUS: ${levelDescriptions[level as keyof typeof levelDescriptions]}
      SCENARIO TYPE: ${selectedType}
      
      RECENT SCENARIOS TO AVOID (DO NOT REPEAT TOPICS):
      ${recentScenarios.join(", ")}

      Respond with EXACTLY a JSON object:
      {
        "id": "random-unique-id",
        "situation": "A short, relatable scenario appropriate for Level ${level} focus.",
        "emotion": "A single word emotion (e.g., Anxious, Defeated, Angry).",
        "distortedThought": "The primary automatic negative or distorted thought.",
        "distortions": ["The identified cognitive distortion(s) from: ${COMMON_DISTORTIONS.join(", ")}"],
        "reframedThoughts": [
          { "text": "Balanced, realistic, and logical thought.", "type": "Clear", "isCorrect": true, "explanation": "Why this is healthier and logical." },
          { "text": "Emotional or impulsive reaction thought.", "type": "Impulsive", "isCorrect": false, "explanation": "Why this reaction is too fast and unhelpful." },
          { "text": "Distorted or purely negative thought.", "type": "Negative", "isCorrect": false, "explanation": "Why this thought is self-defeating." }
        ],
        "explanation": "A supportive explanation of how identifying the distortion moves the user from confusion to clarity."
      }`,
      config: {
        responseMimeType: "application/json"
      }
    });

    const scenario = JSON.parse(response.text);
    return scenario;
  } catch (error) {
    console.error("CBT Scenario Error:", error);
    return {
      id: "fallback",
      situation: "You see a group of friends laughing together at a party, but no one has come over to talk to you yet.",
      emotion: "Insecure",
      distortedThought: "Everyone here thinks I'm boring and no one actually wants me here.",
      distortions: ["Mind Reading", "Personalization"],
      reframedThoughts: [
        { text: "They are probably just caught up in their own conversations; I can be the one to go say hi to someone.", type: "Clear", isCorrect: true, explanation: "It shifts from mind-reading others' thoughts to taking personal action." },
        { text: "I'll just wait here; if they liked me, they would come over eventually.", type: "Impulsive", isCorrect: false, explanation: "This still assumes their lack of approach is a judgment of your value." },
        { text: "I'm obviously not their type of person, I should just leave.", type: "Negative", isCorrect: false, explanation: "This is labeling yourself as 'not their type' without evidence." }
      ],
      explanation: "Personalization happens when we take events personally that may have nothing to do with us."
    };
  }
}

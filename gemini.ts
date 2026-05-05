import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function getWeather(location: string) {
  try {
    const res = await fetch(`https://wttr.in/${encodeURIComponent(location)}?format=3`);
    return await res.text();
  } catch (e) {
    return "Weather data unavailable.";
  }
}

const TOOLS = [
  { googleSearch: {} },
  {
    functionDeclarations: [
      {
        name: "get_weather",
        description: "Get the current weather for a specific location to help user decide if they should go outside or plan outdoor tasks.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            location: { type: Type.STRING, description: "The city or location name" }
          },
          required: ["location"]
        }
      },
      {
        name: "get_current_time",
        description: "Get the current local time to help with time-related decisions.",
        parameters: {
          type: Type.OBJECT,
          properties: {}
        }
      }
    ]
  }
];

export async function getClarity(problem: string, context?: { previousProblem?: string; previousSuggestion?: string; followUp?: string; category?: string; history?: string[] }, userProfile?: { name?: string; bio?: string }) {
  if (!problem.trim()) {
    throw new Error("Please describe your problem.");
  }

  const isShortFollowUp = problem.split(" ").length <= 4;

  try {
    const systemPrompt = `You are Clarity AI. 
    ${userProfile?.name ? `User: ${userProfile.name}.` : ""}
    ${userProfile?.bio ? `Bio: ${userProfile.bio}.` : ""}
    Time: ${new Date().toLocaleString()}.
    Category: "${context?.category || "General"}".
    
    CONVERSATION:
    ${context?.history ? context.history.map((h, i) => `[Interaction ${i+1}]: ${h}`).join("\n") : ""}
    ${context?.previousProblem ? `- Last Topic: "${context.previousProblem}"` : ""}
    ${context?.previousSuggestion ? `- Last Resp: "${context.previousSuggestion}"` : ""}
    
    STRICT RESPONSE RULES:
    1. ADAPTIVE FORMAT:
       - DECISION (what to choose, who to ask): 2-3 bullet points. Max 30 words. Short and clear.
       - HOW-TO (how to do/cook/study): 4-6 numbered steps. Practical actions only.
       - PLANNING (study plan, routine): Max 5 structured points (bullets with time or order).
    2. NO EXTRAS: No greetings, no motivational text, no explanations, no theory, no background, no follow-up questions.
    3. LANGUAGE: Match user language (Roman Urdu or English). Simple and direct.
    
    Example Formats:
    [Decision]
    - Option A: use for X
    - Option B: use for Y
    
    [How-to]
    1. First action
    2. Next action
    3. Final action
    
    [Planning]
    - Morning: Task 1
    - Evening: Task 2
    
    QUERY LINKING:
    - Current message: "${problem}". 
    - If this message is very short or incomplete, link it to the previous topic: "${context?.previousProblem || (context?.history && context?.history[0])}".`;

    let response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: systemPrompt,
      config: {
        tools: TOOLS,
        toolConfig: { includeServerSideToolInvocations: true }
      }
    });

    // Handle tool calls (supports up to 2 rounds if needed)
    let rounds = 0;
    while (response.functionCalls && response.functionCalls.length > 0 && rounds < 2) {
      const toolResults = [];
      for (const call of response.functionCalls) {
        if (call.name === "get_weather") {
          const weather = await getWeather((call.args as any).location);
          toolResults.push({
            callId: call.id,
            result: { weather }
          });
        } else if (call.name === "get_current_time") {
          toolResults.push({
            callId: call.id,
            result: { time: new Date().toLocaleString() }
          });
        }
      }

      const previousContents = [
        { role: 'user', parts: [{ text: problem }] },
        response.candidates[0].content,
        {
          role: 'model', // Usually should be model for tool response parts
          parts: toolResults.map(tr => ({
            functionResponse: {
              name: response.functionCalls!.find(fc => fc.id === tr.callId)!.name,
              response: tr.result
            }
          }))
        }
      ] as any; // Cast for simplified multi-part

      response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: previousContents,
        config: { 
          tools: TOOLS, 
          toolConfig: { includeServerSideToolInvocations: true } 
        }
      });
      rounds++;
    }

    return response.text;
  } catch (error) {
    console.error("Clarity AI Error:", error);
    throw new Error("The fog remains. Please try again later.");
  }
}

export async function decideForMe(problem: string, context?: { previousProblem?: string; history?: string[] }, userProfile?: { name?: string; bio?: string }) {
  if (!problem.trim()) {
    throw new Error("Please tell me what you're deciding between.");
  }

  const isShortFollowUp = problem.split(" ").length <= 4;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are Clarity AI. 
      Topic: "${problem}". 
      Memory: "${context?.previousProblem || context?.history?.[0]}".

      STRICT RULES:
      - ONLY use bullet points (max 2-3).
      - Max 30 words total.
      - No greetings. Just the decision and why.
      - Direct answer only.
      - Match user language.

      Example:
      - Selection: Option A
      - Reason: Best quality for cost.`,
    });

    return response.text;
  } catch (error) {
    console.error("Decide Error:", error);
    throw new Error("Even I can't decide right now. Try again.");
  }
}

export async function getMinimalClarity(userProfile?: { name?: string; bio?: string }) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are Clarity AI. User is lazy or unmotivated.
      
      STRICT RULES:
      - ONE bullet point only.
      - Max 10 words.
      - No greetings. No emotion.
      - Match user language.
      
      Example:
      - Wash your face now.`
    });

    return response.text;
  } catch (error) {
    console.error("Minimal Clarity Error:", error);
    throw new Error("It's okay to do nothing right now. Take a breath.");
  }
}

export async function getOverthinkingClarity(userProfile?: { name?: string; bio?: string }) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are Clarity AI. User is overthinking.
      
      STRICT RULES:
      - ONE bullet point only.
      - Max 10 words.
      - No greetings. No fluff.
      - Match user language.
      
      Example:
      - Open the laptop.`
    });

    return response.text;
  } catch (error) {
    console.error("Overthinking Error:", error);
    throw new Error("Just do the first thing you see. Now.");
  }
}

export async function getStudyClarity(problem: string, context?: { previousProblem?: string; history?: string[] }, userProfile?: { name?: string; bio?: string }) {
  const isShortFollowUp = problem.split(" ").length <= 4;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are Clarity AI. Study context: "${problem}". Memory: "${context?.previousProblem}".
      
      STRICT RULES:
      - ONLY numbered steps (4-6 steps).
      - No survival/emergency talk. No greetings.
      - Match user language.
      - Each step must be a practical action.
      
      Example:
      1. Open notes for chapter 1.
      2. Set timer for 25 minutes.
      3. Solve task A.
      4. Note down blockers.
      5. Review solved tasks.
      6. Start now.`
    });

    return response.text;
  } catch (error) {
    console.error("Study Error:", error);
    throw new Error("Focus. Open your notes. Read the first paragraph now.");
  }
}

export async function getNoTimeClarity(userProfile?: { name?: string; bio?: string }) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are Clarity AI. User has no time.
      
      STRICT RULES:
      - ONE bullet point only.
      - Max 10 words.
      - No greetings. No background.
      - Match user language.
      
      Example:
      - Quick stretch (2 mins)`
    });

    return response.text;
  } catch (error) {
    console.error("No Time Error:", error);
    throw new Error("Just take 2 minutes for yourself right now.");
  }
}

export async function getCookingClarity(ingredients: string, context?: { previousProblem?: string; history?: string[] }, userProfile?: { name?: string; bio?: string }) {
  if (!ingredients.trim()) {
    throw new Error("Please tell me what ingredients or options you have.");
  }

  const isShortFollowUp = ingredients.split(" ").length <= 4;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are Clarity AI. Cooking context: "${ingredients}". Memory: "${context?.previousProblem}".
      
      STRICT RULES:
      - ONLY numbered steps (4-6 steps).
      - No recipes/theory. Direct choice and steps only.
      - Match user language.
      
      Example:
      1. Choose Dal Chawal.
      2. Boil rice for 10 minutes.
      3. Fry onions in oil.
      4. Add spices and lentils.
      5. Simmer for 15 minutes.
      6. Serve hot.`
    });

    return response.text;
  } catch (error) {
    console.error("Cooking Error:", error);
    throw new Error("I'm stuck in the pantry. Try again.");
  }
}

export async function planMyDay(tasks: string, context?: { previousProblem?: string; history?: string[] }, userProfile?: { name?: string; bio?: string }) {
  if (!tasks.trim()) {
    throw new Error("Please tell me what you need to do today.");
  }

  const isShortFollowUp = tasks.split(" ").length <= 4;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are Clarity AI. Planning task: "${tasks}". Memory: "${context?.previousProblem}".
      
      STRICT RULES:
      - ONLY bullet points (max 5 points).
      - Structured plan using time or order.
      - Max 5 points total.
      - No greetings. No motivational lines.
      - Match user language.
      
      Example:
      - 09:00: Finish report
      - 11:30: Call team
      - 13:00: Lunch break
      - 14:00: Solve task A
      - 16:00: Email sweep`
    });

    return response.text;
  } catch (error) {
    console.error("Plan Day Error:", error);
    throw new Error("I couldn't plan the day. Let's just start with one small thing.");
  }
}

export async function getNextStep(problem: string, context: string, sessionContext?: { history?: string[] }) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are Clarity AI. Problem: "${problem}". Context: "${context}".
      
      STRICT RULES:
      - ONE bullet point only.
      - Max 15 words.
      - Match user language.
      
      Example:
      - Add salt now.`
    });

    return response.text;
  } catch (error) {
    console.error("Next Step Error:", error);
    return "Take a deep breath and reassess.";
  }
}

export async function getStuckTask(problem?: string, sessionContext?: { history?: string[] }) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are Clarity AI. User stuck on: "${problem}".
      
      STRICT RULES:
      - ONE bullet point only.
      - Max 15 words.
      - No greetings.
      - Match user language.
      
      Example:
      - Stand up for 30s.`
    });

    return response.text;
  } catch (error) {
    console.error("Stuck Task Error:", error);
    return "Take a sip of water and just look away from the screen for a moment.";
  }
}

export async function getDifferentApproach(problem: string, previousSuggestion: string, sessionContext?: { history?: string[] }) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are Clarity AI. Previous failed: "${previousSuggestion}". Topic: "${problem}".
      
      STRICT RULES:
      - ONE bullet point only.
      - Max 20 words.
      - No greetings.
      - Match user language.
      
      Example:
      - Try drawing it instead.`
    });

    return response.text;
  } catch (error) {
    console.error("Different Approach Error:", error);
    return "Let's pivot. Close your eyes for 30 seconds and let the noise settle before we try another way.";
  }
}

export async function getFollowUpQuestion(problem: string, suggestion: string, sessionContext?: { history?: string[] }) {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are Clarity AI. Suggested: "${suggestion}". Topic: "${problem}".
      
      STRICT RULES:
      - ONE bullet point question.
      - Max 10 words.
      - Match user language.
      
      Example:
      - Any deadlines?`
    });

    return response.text;
  } catch (error) {
    console.error("Follow-up Error:", error);
    return "What is the very first thing you need to do to start?";
  }
}

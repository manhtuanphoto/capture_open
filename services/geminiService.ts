import { GoogleGenAI, Part } from "@google/genai";

// Ensure API key is present; in a real app, we'd handle this more gracefully in the UI
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Analyzes an image to provide a description and tags.
 */
export const analyzeImage = async (base64Image: string): Promise<{ description: string; tags: string[] }> => {
  try {
    const model = 'gemini-2.5-flash';
    const prompt = "Analyze this image. Provide a short, professional description (max 2 sentences) and a list of 5 relevant tags suitable for a photo library.";
    
    // Construct the parts properly
    const imagePart: Part = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Image
      }
    };
    
    const textPart: Part = {
      text: prompt
    };

    const response = await ai.models.generateContent({
      model,
      contents: { parts: [imagePart, textPart] },
      config: {
        // We'll ask for JSON to make parsing easier
        responseMimeType: 'application/json',
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    const result = JSON.parse(text);
    return {
      description: result.description || result.Description || "No description available.",
      tags: result.tags || result.Tags || []
    };
  } catch (error) {
    console.error("Error analyzing image:", error);
    return { description: "Could not analyze image.", tags: [] };
  }
};

/**
 * Edits an image based on a text prompt using generative AI.
 */
export const generateEditedImage = async (base64Image: string, prompt: string): Promise<string | null> => {
  try {
    const model = 'gemini-2.5-flash-image'; // Using the image editing model
    
    const imagePart: Part = {
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Image
      }
    };

    const textPart: Part = {
      text: prompt
    };

    const response = await ai.models.generateContent({
      model,
      contents: { parts: [imagePart, textPart] },
      // Note: responseMimeType/Schema is not supported for this model as per instructions
    });

    // Extract the image from the response parts
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error("Error generating edited image:", error);
    throw error;
  }
};

/**
 * Helper to convert a URL to base64 for the API
 */
export const urlToBase64 = async (url: string): Promise<string> => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // Remove the data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64Content = base64String.split(',')[1];
      resolve(base64Content);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};
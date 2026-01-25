
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export type AITask = 'translate' | 'grammar' | 'suggest' | 'uniToBijoy' | 'bijoyToUni' | 'style' | 'dictionary' | 'handwriting' | 'emojiSearch';

export interface AIOptions {
  language?: string;
  from?: string;
  to?: string;
  styleVariant?: string;
  imageData?: string; // base64 string
  mimeType?: string;
}

export const getAIAssistance = async (text: string, task: AITask, options?: AIOptions) => {
  if (!text.trim() && task !== 'suggest' && task !== 'handwriting' && task !== 'emojiSearch') return "";
  
  const prompts = {
    translate: `You are a professional translator. Translate the following text from ${options?.from || 'its original language'} to ${options?.to || 'English'}. 
      Text to translate: "${text}"
      Requirements:
      - Maintain the original tone and context.
      - If the target is Bangla, use standard Unicode characters.
      - Return ONLY the translated text without quotes or explanations.`,
    grammar: `Correct the grammar of the following text (detecting if it is Bangla, Arabic, or English): "${text}". Return only the corrected text.`,
    suggest: `You are an intelligent predictive text engine for a keyboard. 
      The user is typing in ${options?.language || 'English'}.
      Current text context: "${text}"
      Task: Predict the completion of the current word being typed OR the next 3 most likely words/short phrases.
      Return ONLY 3 suggestions separated by commas.`,
    uniToBijoy: `Convert the following Bengali Unicode text to Bijoy (ANSI) equivalent character mapping: "${text}"`,
    bijoyToUni: `Convert the following Bengali Bijoy (ANSI) text to standard Unicode: "${text}"`,
    style: `Rewrite the following text in a ${options?.styleVariant || 'fancy'} style. 
      If 'fancy unicode' is requested, use mathematical alphanumeric symbols or similar fancy unicode characters.
      Text: "${text}"
      Return ONLY the rewritten text.`,
    dictionary: `Act as a comprehensive English Dictionary. For the word "${text}", provide:
      1. Part of speech and Phonetic spelling.
      2. Clear and concise definition.
      3. 2-3 common Synonyms.
      4. An example sentence.
      Format the output clearly using Markdown-like structure but keep it compact for a mobile-sized keyboard screen.`,
    handwriting: `You are an expert OCR and handwriting recognition engine. Analyze the provided image and extract the text. 
      The handwritten script is in ${options?.language || 'Bengali, English, or Arabic'}. 
      Return ONLY the recognized characters or words. Preserve spaces between words. 
      Do NOT add any conversational filler, quotes, or explanations. 
      If the text is in Bengali, use standard Unicode characters. 
      If it is in Arabic, use standard Arabic script.`,
    emojiSearch: `You are an emoji search engine. Given the search query "${text}", return a string containing 30-40 relevant emojis. 
      Return ONLY the emojis with no spaces, text, or explanations. If no relevant emojis exist, return a few general popular ones.`
  };

  try {
    let contents: any;
    if (task === 'handwriting' && options?.imageData) {
      contents = {
        parts: [
          {
            inlineData: {
              data: options.imageData,
              mimeType: options.mimeType || 'image/png'
            }
          },
          { text: prompts[task] }
        ]
      };
    } else {
      contents = prompts[task];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: contents,
      config: {
        temperature: 0.2,
      }
    });
    return response.text || "";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "";
  }
};

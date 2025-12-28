
import { GoogleGenAI, Type } from "@google/genai";
import { Staff, VisitWithStaff } from "@/lib/types";

// Ensure API key is available.
const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

interface SuggestionInput {
    patientName: string;
    patientAddress: string;
    durationMinutes: number;
    timeRangeStart: string;
    timeRangeEnd: string;
    startDate: string; // Search start date
    targetDays: number[]; // 0=Sun, 1=Mon...
    candidateStaff: Staff[];
    existingVisits: VisitWithStaff[]; // Only visits for candidate staff in the target date range
}

export const suggestSchedule = async (input: SuggestionInput) => {
    if (!apiKey) throw new Error("APIキー未設定: 管理者に連絡してください。");

    // Optimize payload size: minimize fields sent to AI
    const staffInfo = input.candidateStaff.map(s => ({ id: s.id, name: s.name }));
    const visitsInfo = input.existingVisits.map(v => ({
        sid: v.staffIds[0],
        d: v.date,
        s: v.startTime,
        e: v.endTime,
        addr: v.address || '' // Shorten keys to save tokens
    }));

    const prompt = `
   最適化エンジンとして、下記条件で訪問枠を3つ提案せよ。

   条件:
   - 場所: ${input.patientAddress}
   - 時間: ${input.durationMinutes}分
   - 枠: ${input.timeRangeStart}〜${input.timeRangeEnd}
   - 開始日: ${input.startDate}
   - 曜日: [${input.targetDays.join(',')}] (0=日...6=土)
   
   候補スタッフ:
   ${JSON.stringify(staffInfo)}

   既存予定:
   ${JSON.stringify(visitsInfo)}

   ルール:
   1. 既存予定と重複禁止。
   2. 前後30分は移動時間として空ける。
   3. 住所(addr)が近い予定の前後を推奨。
   4. 候補は最大3つ。
   5. JSONのみ出力。理由等のコメント不要。

   Schema:
   [{"staffId":"ID","date":"YYYY-MM-DD","startTime":"HH:mm","endTime":"HH:mm"}]
   `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            staffId: { type: Type.STRING },
                            date: { type: Type.STRING },
                            startTime: { type: Type.STRING },
                            endTime: { type: Type.STRING }
                        },
                        required: ["staffId", "date", "startTime", "endTime"],
                        propertyOrdering: ["staffId", "date", "startTime", "endTime"]
                    }
                }
            }
        });

        if (response.text) {
            return JSON.parse(response.text);
        }
        return [];
    } catch (e) {
        console.error("Gemini API Error:", e);
        throw new Error("AI提案の生成に失敗しました。");
    }
};
window.function = async function (prompt, apiKey, attachmentUrl, model, temperature, maxTokens) {
    // DYNAMIC VALUES
    prompt = prompt?.value ?? "";
    apiKey = apiKey?.value ?? "";
    attachmentUrl = attachmentUrl?.value ?? ""; // Nuovo parametro per il file
    model = model?.value ?? "gpt-4o-mini"; 
    temperature = temperature?.value ? parseFloat(temperature.value) : 0.7;
    maxTokens = maxTokens?.value ? parseInt(maxTokens.value) : 1000;

    // Validate API Key immediately
    if (!apiKey || apiKey.trim() === "") return "Error: API Key is required";

    // Normalizzazione input
    let modelInput = model.trim();
    let modelLower = modelInput.toLowerCase();

    // --- FUNZIONALITÀ SPECIALE: LISTA MODELLI GEMINI ---
    if (modelLower === "list" || modelLower === "help" || modelLower === "info") {
        try {
            const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
            const response = await fetch(listUrl);
            const data = await response.json();
            
            if (data.error) return `Error listing models: ${data.error.message}`;

            if (data.models) {
                const availableModels = data.models
                    .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"))
                    .map(m => m.name.replace("models/", ""))
                    .join(", ");
                return `AVAILABLE GEMINI MODELS:\n${availableModels}`;
            }
            return "No models found.";
        } catch (e) {
            return `Error fetching model list: ${e.message}`;
        }
    }

    // --- LOGICA STANDARD DI GENERAZIONE ---
    const isAnthropic = modelLower.startsWith("claude") || modelLower.startsWith("anthropic");
    const isGemini = modelLower.startsWith("gemini");

    // --- NUOVA LOGICA: GESTIONE FILE (SOLO PER GEMINI) ---
    // Se c'è un link al file, lo scarichiamo e lo convertiamo PRIMA di chiamare l'IA
    let inlineDataPart = null;

    if (attachmentUrl && attachmentUrl.trim() !== "" && isGemini) {
        try {
            const fileResponse = await fetch(attachmentUrl);
            if (!fileResponse.ok) return "Error: Impossible to download the attachment.";

            const mimeType = fileResponse.headers.get("content-type") || "image/jpeg"; // Rileviamo il tipo di file
            const arrayBuffer = await fileResponse.arrayBuffer();
            
            // Conversione in Base64
            let binary = '';
            const bytes = new Uint8Array(arrayBuffer);
            const len = bytes.byteLength;
            for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64Data = btoa(binary);

            // Prepariamo l'oggetto specifico per Gemini
            inlineDataPart = {
                inline_data: {
                    mime_type: mimeType,
                    data: base64Data
                }
            };
        } catch (e) {
            return `Error processing attachment: ${e.message}`;
        }
    }
    
    let apiUrl = "";
    let headers = {};
    let body = {};

    try {
        if (isAnthropic) {
            // --- ANTHROPIC ---
            apiUrl = "https://api.anthropic.com/v1/messages";
            headers = {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
                "anthropic-dangerous-direct-browser-access": "true"
            };
            body = {
                model: modelInput,
                max_tokens: maxTokens,
                temperature: temperature,
                messages: [{ role: "user", content: prompt }]
            };
        } else if (isGemini) {
            // --- GOOGLE GEMINI ---
            let cleanModel = modelInput.replace("models/", "");
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`;
            
            headers = { "Content-Type": "application/json" };
            
            // Costruiamo le "parti" del messaggio
            // 1. Il testo del prompt
            let messageParts = [{ text: prompt }];
            
            // 2. Se abbiamo processato un file, lo aggiungiamo qui
            if (inlineDataPart) {
                messageParts.push(inlineDataPart);
            }

            body = {
                contents: [{ parts: messageParts }],
                generationConfig: {
                    temperature: temperature,
                    maxOutputTokens: maxTokens
                }
            };
        } else {
            // --- OPENAI ---
            apiUrl = "https://api.openai.com/v1/chat/completions";
            headers = {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            };
            body = {
                model: modelInput,
                messages: [{ role: "user", content: prompt }],
                temperature: temperature,
                max_tokens: maxTokens
            };
        }

        const response = await fetch(apiUrl, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMsg = `HTTP ${response.status}`;
            try {
                const errorJson = JSON.parse(errorText);
                errorMsg = errorJson.error?.message || errorJson.error || errorText;
            } catch (e) { errorMsg = errorText; }
            
            return `Error (${modelInput}): ${errorMsg}`;
        }

        const data = await response.json();

        // Estrazione Risposta
        if (isAnthropic) {
            return data.content?.[0]?.text || "No response (Claude)";
        } else if (isGemini) {
            if (data.promptFeedback?.blockReason) {
                return `Blocked: ${data.promptFeedback.blockReason}`;
            }
            return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response (Gemini)";
        } else {
            return data.choices?.[0]?.message?.content || "No response (OpenAI)";
        }

    } catch (error) {
        return `System Error: ${error.message}`;
    }
};

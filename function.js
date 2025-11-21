window.function = async function (prompt, apiKey, model, temperature, maxTokens) {
    // DYNAMIC VALUES
    prompt = prompt?.value ?? "";
    apiKey = apiKey?.value ?? "";
    model = model?.value ?? "gpt-4o-mini"; 
    temperature = temperature?.value ? parseFloat(temperature.value) : 0.7;
    maxTokens = maxTokens?.value ? parseInt(maxTokens.value) : 1000;

    // Validate API Key immediately
    if (!apiKey || apiKey.trim() === "") return "Error: API Key is required";

    // Normalizzazione input
    let modelInput = model.trim();
    let modelLower = modelInput.toLowerCase();

    // --- FUNZIONALITÀ SPECIALE: LISTA MODELLI GEMINI ---
    // Se l'utente scrive "list" o "help" nel campo model, mostriamo i modelli disponibili
    if (modelLower === "list" || modelLower === "help" || modelLower === "info") {
        try {
            const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
            const response = await fetch(listUrl);
            const data = await response.json();
            
            if (data.error) {
                return `Error listing models: ${data.error.message}`;
            }

            if (data.models) {
                // Filtriamo solo i modelli che generano testo (escludiamo quelli per embedding)
                const availableModels = data.models
                    .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"))
                    .map(m => m.name.replace("models/", "")) // Puliamo il nome (togliamo 'models/')
                    .join(", "); // Li uniamo con una virgola
                
                return `AVAILABLE GEMINI MODELS:\n${availableModels}`;
            }
            return "No models found.";
        } catch (e) {
            return `Error fetching model list: ${e.message}`;
        }
    }

    // --- LOGICA STANDARD DI GENERAZIONE ---

    // Logica di selezione provider
    const isAnthropic = modelLower.startsWith("claude") || modelLower.startsWith("anthropic");
    const isGemini = modelLower.startsWith("gemini");
    
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
            // Rimuoviamo 'models/' se presente per sbaglio
            let cleanModel = modelInput.replace("models/", "");
            
            apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${apiKey}`;
            
            headers = { "Content-Type": "application/json" };
            body = {
                contents: [{ parts: [{ text: prompt }] }],
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

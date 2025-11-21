window.function = async function (prompt, apiKey, model, temperature, maxTokens) {
    // DYNAMIC VALUES
    prompt = prompt?.value ?? "";
    apiKey = apiKey?.value ?? "";
    model = model?.value ?? "gpt-4o-mini"; // OpenAI default
    temperature = temperature?.value ? parseFloat(temperature.value) : 0.7;
    maxTokens = maxTokens?.value ? parseInt(maxTokens.value) : 500;

    // Validate inputs
    if (!prompt || prompt.trim() === "") {
        return "Error: Prompt is required";
    }

    if (!apiKey || apiKey.trim() === "") {
        return "Error: API Key is required";
    }

    // Determine which API to use based on model string
    // Normalizziamo il modello in minuscolo per evitare errori di battitura
    const modelLower = model.toLowerCase();
    
    const isAnthropic = modelLower.startsWith("claude") || modelLower.startsWith("anthropic");
    const isGemini = modelLower.startsWith("gemini");
    // Se non è Claude e non è Gemini, assumiamo sia OpenAI
    const isOpenAI = !isAnthropic && !isGemini;

    let apiUrl = "";
    let headers = {};
    let body = {};

    if (isAnthropic) {
        // --- ANTHROPIC CLAUDE API ---
        apiUrl = "https://api.anthropic.com/v1/messages";
        headers = {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true" // Necessario spesso per chiamate client-side
        };
        body = {
            model: model,
            max_tokens: maxTokens,
            temperature: temperature,
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ]
        };
    } else if (isGemini) {
        // --- GOOGLE GEMINI API ---
        // Documentazione: https://ai.google.dev/api/rest/v1beta/models/generateContent
        // L'URL include il nome del modello e la chiave API va passata come parametro query per evitare problemi CORS
        apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        headers = {
            "Content-Type": "application/json"
        };
        body = {
            contents: [{
                parts: [{
                    text: prompt
                }]
            }],
            generationConfig: {
                temperature: temperature,
                maxOutputTokens: maxTokens
            }
        };
    } else {
        // --- OPENAI API ---
        apiUrl = "https://api.openai.com/v1/chat/completions";
        headers = {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        };
        body = {
            model: model,
            messages: [
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: temperature,
            max_tokens: maxTokens
        };
    }

    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: headers,
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: response.statusText } }));
            // Gestione errori specifica per provider se necessario
            const errorMessage = errorData.error?.message || errorData.error?.message || `HTTP ${response.status}`;
            return `Error: ${errorMessage}`;
        }

        const data = await response.json();

        // Extract response based on API
        if (isAnthropic) {
            return data.content?.[0]?.text || "No response generated";
        } else if (isGemini) {
            // Gemini response structure: candidates[0].content.parts[0].text
            return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated";
        } else {
            // OpenAI response structure
            return data.choices?.[0]?.message?.content || "No response generated";
        }
    } catch (error) {
        return `Error: ${error.message || "Failed to call AI API"}`;
    }
};

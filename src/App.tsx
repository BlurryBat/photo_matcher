import { useState } from "react";

function App() {
    const [apiKey, setApiKey] = useState("");
    const [referencePhoto, setReferencePhoto] = useState<File | null>(null);
    const [groupPhotos, setGroupPhotos] = useState<File[]>([]);
    const [matchedIndices, setMatchedIndices] = useState<number[]>([]);
    const [outputText, setOutputText] = useState<string>("");
    const [loading, setLoading] = useState(false);

    const handleReferenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) setReferencePhoto(e.target.files[0]);
    };

    const handleGroupChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) setGroupPhotos(Array.from(e.target.files));
    };

    // ✅ Use the model's indices as-is (1-based), only validate & clean.
    function normalizeIndices(raw: unknown, groupCount: number): number[] {
        const arr = Array.isArray(raw) ? raw : [];

        const nums = arr
            .map((v) => (typeof v === "string" ? Number(v.trim()) : v))
            .filter((v): v is number => Number.isInteger(v));

        // Keep only indices in [1..groupCount], dedupe, sort
        const cleaned = Array.from(new Set(nums.filter((n) => n >= 1 && n <= groupCount)));
        cleaned.sort((a, b) => a - b);
        return cleaned;
    }

    const handleSubmit = async () => {
        if (!apiKey || !referencePhoto || groupPhotos.length === 0) {
            alert("Please provide API key, a reference photo, and group photos.");
            return;
        }

        setLoading(true);
        setMatchedIndices([]);
        setOutputText("");

        const encodeImage = (file: File): Promise<string> =>
            new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

        const referenceBase64 = await encodeImage(referencePhoto);
        const groupBase64 = await Promise.all(groupPhotos.map((f) => encodeImage(f)));

        try {
            const response = await fetch("https://api.openai.com/v1/responses", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    model: "gpt-4o",
                    input: [
                        {
                            role: "user",
                            content: [
                                {
                                    type: "input_text",
                                    text: `
Compare the reference photo to the group photos.
Return ONLY the indices (1-based) of images where the same person is present,
as a pure JSON array, e.g. [1,3,4].
No extra text, no explanations, no keys, just the array.
Indices refer ONLY to the GROUP photos (not the reference).
If the reference photo is also present in the group, include its GROUP index.
                  `,
                                },
                                { type: "input_image", image_url: referenceBase64 },
                                ...groupBase64.map((img) => ({ type: "input_image", image_url: img })),
                            ],
                        },
                    ],
                }),
            });

            const data = await response.json();
            console.log("Raw response:", data);

            const output = data.output?.[0]?.content?.[0]?.text || "";
            setOutputText(output);

            let parsed: number[] = [];
            try {
                // Try direct JSON parse
                parsed = JSON.parse(output);
            } catch {
                // Fallback: regex extract the first [...] array
                const match = output.match(/\[[\d,\s]+\]/);
                if (match) {
                    try {
                        parsed = JSON.parse(match[0]);
                    } catch (e) {
                        console.error("Regex parse failed:", e);
                    }
                }
            }

            const normalized = normalizeIndices(parsed, groupPhotos.length);
            setMatchedIndices(normalized);
        } catch (err) {
            console.error("Error:", err);
        } finally {
            setLoading(false);
        }
    };

    const isMatched = (index: number) => matchedIndices.includes(index + 1);

    return (
        <div
            style={{
                padding: "1rem",
                fontFamily: "Inter, sans-serif",
                maxWidth: "600px",
                margin: "0 auto",
            }}
        >
            <h1 style={{ textAlign: "center" }}>📸 Photo Matcher</h1>

            {/* API Key */}
            <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: ".25rem" }}>API Key</label>
                <input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    style={{
                        width: "100%",
                        padding: ".5rem",
                        borderRadius: "8px",
                        border: "1px solid #ccc",
                    }}
                />
            </div>

            {/* File Inputs */}
            <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: ".25rem" }}>
                    Reference Photo
                </label>
                <input type="file" accept="image/*" onChange={handleReferenceChange} />
            </div>

            <div style={{ marginBottom: "1rem" }}>
                <label style={{ display: "block", marginBottom: ".25rem" }}>Group Photos</label>
                <input type="file" accept="image/*" multiple onChange={handleGroupChange} />
            </div>

            <button
                onClick={handleSubmit}
                style={{
                    width: "100%",
                    padding: ".75rem",
                    border: "none",
                    borderRadius: "8px",
                    background: "#2563eb",
                    color: "white",
                    fontSize: "1rem",
                    cursor: "pointer",
                }}
                disabled={loading}
            >
                {loading ? "⏳ Comparing..." : "🔍 Compare"}
            </button>

            {/* Spinner */}
            {loading && (
                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        marginTop: "2rem",
                    }}
                >
                    <div
                        style={{
                            width: "40px",
                            height: "40px",
                            border: "4px solid #ccc",
                            borderTop: "4px solid #2563eb",
                            borderRadius: "50%",
                            animation: "spin 1s linear infinite",
                        }}
                    />
                    <style>
                        {`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
            `}
                    </style>
                </div>
            )}

            {/* Show results only after response */}
            {!loading && outputText && (
                <>
                    {/* Reference */}
                    {referencePhoto && (
                        <div style={{ marginTop: "2rem", textAlign: "center" }}>
                            <h3>Reference Photo</h3>
                            <img
                                src={URL.createObjectURL(referencePhoto)}
                                alt="Reference"
                                style={{
                                    maxWidth: "100%",
                                    borderRadius: "12px",
                                    boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
                                }}
                            />
                        </div>
                    )}

                    {/* Raw output (optional) */}
                    <div style={{ marginTop: "2rem" }}>
                        <h3>Model Output</h3>
                        <pre
                            style={{
                                background: "#f3f4f6",
                                padding: "1rem",
                                borderRadius: "8px",
                                overflowX: "auto",
                            }}
                        >
              {outputText}
            </pre>
                        <div style={{ fontSize: ".9rem", color: "#374151", marginTop: ".5rem" }}>
                            Normalized indices: [{matchedIndices.join(", ")}]
                        </div>
                    </div>

                    {/* Group Photos */}
                    {groupPhotos.length > 0 && (
                        <div style={{ marginTop: "2rem" }}>
                            <h3>Group Photos</h3>
                            <div
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                                    gap: "1rem",
                                }}
                            >
                                {groupPhotos.map((photo, idx) => (
                                    <div
                                        key={idx}
                                        style={{
                                            position: "relative",
                                            border: "2px solid",
                                            borderColor: isMatched(idx) ? "green" : "red",
                                            borderRadius: "12px",
                                            overflow: "hidden",
                                            textAlign: "center",
                                        }}
                                    >
                                        <img
                                            src={URL.createObjectURL(photo)}
                                            alt={`Group ${idx + 1}`}
                                            style={{ width: "100%", height: "auto", display: "block" }}
                                        />
                                        <div
                                            style={{
                                                position: "absolute",
                                                top: "8px",
                                                right: "8px",
                                                background: isMatched(idx) ? "green" : "red",
                                                color: "white",
                                                borderRadius: "50%",
                                                width: "28px",
                                                height: "28px",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                fontWeight: "bold",
                                            }}
                                        >
                                            {isMatched(idx) ? "✓" : "✗"}
                                        </div>
                                        <p style={{ margin: ".5rem 0" }}>Image {idx + 1}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

export default App;

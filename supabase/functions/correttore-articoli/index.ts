import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { testo } = await req.json()

    if (!testo) {
      return new Response(
        JSON.stringify({ error: "Testo non fornito" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      )
    }

    const prompt = `Correggi il testo nel blocco html che ti allego. Solo errori di sintassi o forme errate. Non modificare niente altro. Quando necessario dividi i paragrafi più lunghi in più parti. Se necessario sistema le frasi troppo contorte usando un tono giornalistico. Togli i tag strong da dentro gli header. Metti in grassetto, con tag strong, un massimo di 9 parole o brevi frasi non ripetute che possano migliorare la visibilità in ottica SEO (considera anche i grassetti già presenti prima della correzione). Metti in corsivo con tag <em> le dichiarazioni tra virgolette. Elimina eventuali paragrafi troppo simili o ripetuti. Restituisci un unico blocco html senza altre modifiche. Segnala poi in modo preciso gli errori trovati e le altre modifiche apportate. Rimuovi paragrafi vuoti del tipo <p>&nbsp;</p>.

Testo da correggere:
${testo}`

    // Delay di 3 secondi per evitare rate limit
    await new Promise(resolve => setTimeout(resolve, 3000))

    const response = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error("Gemini API Error:", response.status, errorData)
      return new Response(
        JSON.stringify({
          error: `API Error: ${response.status}`,
        }),
        { 
          status: response.status, 
          headers: { "Content-Type": "application/json", ...corsHeaders } 
        }
      )
    }

    const data = await response.json()
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text || ""

    // Separa l'HTML corretto dal report degli errori
    const htmlMatch = result.match(/<[^>]+>[\s\S]*<\/[^>]+>/)
    const htmlPart = htmlMatch ? htmlMatch[0] : result.split("\n\n")[0]
    const reportPart = result.includes("\n\n")
      ? result.split("\n\n").slice(1).join("\n\n")
      : ""

    return new Response(
      JSON.stringify({
        html: htmlPart,
        report: reportPart,
      }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    )
  } catch (error) {
    console.error("Error:", error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      }
    )
  }
})

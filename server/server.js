const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { MongoClient } = require("mongodb");
const axios = require("axios");
require("dotenv").config();
const OpenAI = require("openai");

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = "sample_mflix";
const COLLECTION_NAME = "embedded_movies";

const client = new MongoClient(MONGO_URI);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Create MongoDB Aggregation Pipeline for Similarity Calculation
function calculateSimilarityPipeline(queryVector) {
  return [
    {
      $addFields: {
        similarity: {
          $let: {
            vars: {
              dotProduct: {
                $reduce: {
                  input: { $range: [0, queryVector.length] },
                  initialValue: 0,
                  in: {
                    $add: [
                      "$$value",
                      {
                        $multiply: [
                          { $arrayElemAt: ["$plot_embedding", "$$this"] },
                          { $arrayElemAt: [queryVector, "$$this"] },
                        ],
                      },
                    ],
                  },
                },
              },
              queryMagnitude: Math.sqrt(queryVector.reduce((sum, val) => sum + val ** 2, 0)),
              docMagnitude: {
                $sqrt: {
                  $sum: {
                    $map: {
                      input: "$plot_embedding",
                      as: "val",
                      in: { $pow: ["$$val", 2] },
                    },
                  },
                },
              },
            },
            in: {
              $divide: [
                "$$dotProduct",
                { $multiply: ["$$queryMagnitude", "$$docMagnitude"] },
              ],
            },
          },
        },
      },
    },
    { $sort: { similarity: -1 } },
    { $limit: 10 },
  ];
}

// Generate vector embedding using OpenAI API
async function generateVector(inputText) {
  const response = await axios.post(
    "https://api.openai.com/v1/embeddings",
    { input: inputText, model: "text-embedding-ada-002" },
    { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }
  );
  return response.data.data[0].embedding;
}

// Search endpoint
app.post("/search", async (req, res) => {
  const { query, mode } = req.body;

  if (!query || !mode) {
    return res.status(400).json({ error: "Query and mode are required." });
  }

  // Start measuring time
  const startTime = process.hrtime();

  try {
    await client.connect();
    const collection = client.db(DB_NAME).collection(COLLECTION_NAME);

    let results = [];
    let finalAnswer = null;

    if (mode === "lexical") {
      const cursor = await collection.aggregate([
        { $match: { $text: { $search: query } } },
        {
          $project: {
            score: { $meta: "textScore" },
            title: 1,
            plot: 1,
            fullplot: 1,
          },
        },
        { $sort: { score: { $meta: "textScore" } } },
        { $limit: 10 },
      ]);
      results = await cursor.toArray();
    } 
    
    else if (["hybrid", "rag"].includes(mode)) {
      const queryVector = await generateVector(query);

      const cursor = await collection.aggregate([
        ...(mode === "hybrid"
          ? [
              { $match: { $text: { $search: query } } },
              {
                $addFields: {
                  textScore: { $meta: "textScore" }
                }
              }
            ]
          : []),
        ...calculateSimilarityPipeline(queryVector),
        {
          $addFields: {
            weightedScore: {
              $add: [
                { $multiply: ["$similarity", 0.4] },
                { $multiply: ["$textScore", 0.6] }
              ]
            }
          }
        },
        { $sort: { weightedScore: -1 } },
        { $limit: 10 },
      ]);

      results = await cursor.toArray();

      if (mode === "rag") {
        const context = results
          .map((result, index) => `[${index + 1}] ${result.title} - ${result.plot}`)
          .join("\n");

        const messages = [
          { role: "system", content: "You are a movie critic and a famous director. Analyze the movies that the user has provided in the context and recommend the 5 most optimized movies for this user. When recommending, please provide the title and a brief description. Please respond by applying HTML tags including line breaks so that each recommended movie can be displayed on its own line. And at the very beginning, please include the following sentence: The following movies are the most recommended to you." },
          { role: "user", content: `Original Question: ${query}` },
          { role: "user", content: `Context:\n${context}` },
          { role: "user", content: `Based on the context, answer the question: ${query}` },
        ];

        const completion = await openai.chat.completions.create({
          model: "gpt-4",
          messages,
          max_tokens: 300,
          temperature: 0.7,
        });

        finalAnswer = completion.choices[0].message.content.trim();
      }
    } else {
      return res.status(400).json({ error: "Invalid search mode." });
    }

    // End measuring time
    const [seconds, nanoseconds] = process.hrtime(startTime);
    const elapsedTime = (seconds * 1000 + nanoseconds / 1e6).toFixed(2); // 밀리초로 변환

    res.json({ results, total: results.length, answer: finalAnswer, serverTime: `${elapsedTime}ms` });
  } catch (error) {
    console.error("Error during search:", error);
    res.status(500).json({ error: "An error occurred while searching." });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

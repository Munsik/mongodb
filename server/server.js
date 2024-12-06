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

// MongoDB 연결 초기화
async function initializeMongoDB() {
  if (!client.topology || !client.topology.isConnected()) {
    await client.connect();
  }
}

// OpenAI API를 사용하여 벡터 생성
async function generateVector(inputText) {
  const response = await axios.post(
    "https://api.openai.com/v1/embeddings",
    { input: inputText, model: "text-embedding-ada-002" },
    { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` } }
  );
  return response.data.data[0].embedding;
}

// 검색 엔드포인트
app.post("/search", async (req, res) => {
  const { query, mode } = req.body;

  if (!query || !mode) {
    return res.status(400).json({ error: "Query and mode are required." });
  }
  // start time
  const startTime = process.hrtime();

  try {
    await initializeMongoDB();
    const collection = client.db(DB_NAME).collection(COLLECTION_NAME);

    let results = [];
    let finalAnswer = null;

    if (mode === "lexical") {
      const pipeline = [
        { $match: { $text: { $search: query } } }, // $text는 첫 번째 스테이지로 유지
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
      ];
      const cursor = await collection.aggregate(pipeline);
      results = await cursor.toArray();
    } else if (["hybrid", "rag"].includes(mode)) {
      const queryVector = await generateVector(query);

      if (mode === "hybrid") {
        // $match 결과를 가져온 후 $vectorSearch 실행
        const textResults = await collection
          .find({ $text: { $search: query } })
          .project({
            score: { $meta: "textScore" },
            title: 1,
            plot: 1,
            fullplot: 1,
          })
          .limit(10)
          .toArray();

        const pipeline = [
          {
            $vectorSearch: {
              index: "vector_index",
              queryVector: queryVector,
              path: "plot_embedding",
              exact: true,
              limit: 10,
            },
          },
        ];
        const vectorCursor = await collection.aggregate(pipeline);
        const vectorResults = await vectorCursor.toArray();

        // 하이브리드 점수 계산
        results = [...textResults, ...vectorResults].map((doc) => ({
          ...doc,
          weightedScore: doc.score
            ? 0.6 * doc.score + 0.4 * (doc.similarity || 0)
            : doc.similarity,
        }));
        results.sort((a, b) => b.weightedScore - a.weightedScore);
        results = results.slice(0, 10);
      } else {
        const textResults = await collection
          .find({ $text: { $search: query } })
          .project({
            score: { $meta: "textScore" },
            title: 1,
            plot: 1,
            fullplot: 1,
          })
          .limit(10)
          .toArray();

        const pipeline = [
          {
            $vectorSearch: {
              index: "vector_index",
              queryVector: queryVector,
              path: "plot_embedding",
              exact: true,
              limit: 10,
            },
          },
        ];
        const vectorCursor = await collection.aggregate(pipeline);
        const vectorResults = await vectorCursor.toArray();

        // 하이브리드 점수 계산
        results = [...textResults, ...vectorResults].map((doc) => ({
          ...doc,
          weightedScore: doc.score
            ? 0.4 * doc.score + 0.6 * (doc.similarity || 0)
            : doc.similarity,
        }));
        results.sort((a, b) => b.weightedScore - a.weightedScore);
        results = results.slice(0, 10);

        const context = results
          .map((result, index) => `[${index + 1}] ${result.title} - ${result.plot}`)
          .join("\n");

        const messages = [
          {
            role: "system",
            content:
              "You are an esteemed film critic and renowned director. Based on the movie context provided by the user, analyze it and recommend 5 movies that would be most suitable for this user. For each recommendation, provide the title and a brief description. Format your response using HTML line break tags to display each recommended movie on a separate line. Begin your response with the following statement: \"The following movies are highly recommended for you:\" Please provide your recommendations in this format: <br>1. [Movie Title] - [Brief Description] <br>2. [Movie Title] - [Brief Description] <br>3. [Movie Title] - [Brief Description] <br>4. [Movie Title] - [Brief Description] <br>5. [Movie Title] - [Brief Description]",
          },
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

    const [seconds, nanoseconds] = process.hrtime(startTime);
    const elapsedTime = (seconds * 1000 + nanoseconds / 1e6).toFixed(2);

    res.json({
      results,
      total: results.length,
      answer: finalAnswer,
      serverTime: `${elapsedTime}ms`,
    });
  } catch (error) {
    console.error("Error during search:", error);
    res.status(500).json({ error: "An error occurred while searching." });
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

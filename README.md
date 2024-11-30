# Movie Search Application

This project enables movie searches using **Text Search** and **Vector Search**. It uses MongoDB Atlas for data storage and indexing, along with OpenAI's embedding API for vector-based similarity search.



## Prerequisites

### Install Node.js
1. Visit [Node.js Official Website](https://nodejs.org/).
2. Download the **LTS version** (recommended for most users).
3. Install Node.js by following the installer instructions for your operating system.
4. Verify the installation by running the following command in your terminal:
   ```bash
   node -v
   npm -v
   ```
   These commands should output the installed versions of Node.js and npm (Node Package Manager).


## Project Setup

### 1. Clone the Repository
Clone this repository and navigate to the project directory:
```bash
git clone <repository-url>
cd <project-directory>
```

### 2. Install Required Packages

This project uses several npm packages for both the client and the server. Follow these steps:

#### Install Server Dependencies
Run the following command in the project directory:
```bash
npm install express cors body-parser dotenv mongodb axios openai
```
**Purpose** of each package:
- **express**: Web framework for the server.
- **cors**: Enable cross-origin requests.
- **body-parser**: Parse incoming JSON request bodies.
- **dotenv**: Load environment variables from a `.env` file.
- **mongodb**: MongoDB client for interacting with the database.
- **axios**: HTTP client for making API requests.
- **openai**: Client library for OpenAI API.


#### Install Client Dependencies
Run the following command:
```bash
npm install react react-dom
```
These packages are required to run the React-based frontend.

### 3. Set Up MongoDB Atlas

Follow the steps below to configure your database on MongoDB Atlas.

#### a. Create a MongoDB Cluster
1. Log in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a new cluster using the free-tier option.
3. Load the **sample dataset** by navigating to your cluster dashboard, selecting **"Collections"**, and clicking **"Add Sample Dataset"**.

#### b. Configure Database Connection
1. Go to your cluster dashboard and click **"Connect"**.
2. Select **"Connect your application"**.
3. Copy the connection string (e.g., `mongodb+srv://<username>:<password>@<cluster-url>/sample_mflix`).
4. Create a `.env` file in the project directory and add the following:
   ```env
   MONGO_URI=mongodb+srv://<username>:<password>@<cluster-url>/sample_mflix
   OPENAI_API_KEY=your-openai-api-key
   ```
   Replace:
   - `<username>` and `<password>` with your MongoDB credentials.
   - `<cluster-url>` with your cluster's URL.
   - `your-openai-api-key` with the API key obtained from [OpenAI](https://platform.openai.com/).

#### c. Create Indexes in MongoDB
1. Open MongoDB Atlas and navigate to **Collections** > `sample_mflix` > `embedded_movies`.
2. Execute the following commands in the MongoDB shell or command-line interface:

##### Text Index
```javascript
db.embedded_movies.createIndex({ title: "text", plot: "text", fullplot: "text" })
```
**Purpose**: Enables text search functionality.

##### Vector Index
Navigate to **Search** > **Manage Search Indexes** > **Create Index** and use the following configuration:
```json
{
  "fields": [
    {
      "numDimensions": 1536,
      "path": "plot_embedding",
      "similarity": "dotProduct",
      "type": "vector"
    }
  ]
}
```


### 4. Run the Application

#### a. Start the Server
Run the server using the following command:
```bash
node server.js
```
The server will start on `http://localhost:3000`.


#### b. Start the Client
1. Open the project in your preferred IDE or text editor.
2. Use the following command to start the React application:
   ```bash
   npm start
   ```
3. The application will open in your default browser at `http://localhost:3000`.

### 5. Test the Application

1. Enter a movie title or plot keywords into the search bar.
2. Select **Text Search** or **Vector Search** from the dropdown menu.
3. Click **Search** to retrieve results.

### Notes

- Ensure your MongoDB Atlas database and indexes are correctly set up.
- The `.env` file must contain valid MongoDB connection details and an OpenAI API key.

### Troubleshooting

- If you encounter errors related to package installations, try running:
  ```bash
  npm install
  ```
- Ensure the MongoDB Atlas cluster is active and accessible.
- Double-check your `.env` file for accuracy.

### License

This project is licensed under the MIT License.

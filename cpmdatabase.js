const { Pool } = require('pg');

const pgvector = require("pgvector/pg");

class DatabaseManager {
    constructor() {
        this.pool = new Pool({
            user: process.env.DB_USER,
            host: process.env.DB_HOST,
            database: process.env.DB_NAME,
            password: process.env.DB_PASSWORD,
            port: process.env.DB_PORT || 5432,
        });

        this.pool.on('connect', async function (client) {
            await pgvector.registerTypes(client);
          });
    }

    // Vector Similarity Search
    async findClosestEmbedding(queryQuestionEmbedding, queryAnswerEmbedding, limit = 5) {
        const query = `
SELECT 
    id, 
    question, 
    answers, 
    question_type,
    embedding,
    answers_embedding,
    (embedding <=> $1) AS question_cosine_distance,
    (answers_embedding <=> $2) AS answer_cosine_distance,
    CASE 
        WHEN question_type ILIKE '%input%' THEN (embedding <=> $1) * 3.5 + 0.2 
        ELSE (embedding <=> $1) * 3.5 + (answers_embedding <=> $2) 
    END AS total_distance
FROM answers
ORDER BY total_distance
LIMIT $3;
        `;
    
        try {
            const result = await this.pool.query(query, [
                pgvector.toSql(queryQuestionEmbedding),
                pgvector.toSql(queryAnswerEmbedding),
                limit
            ]);
            
            return result.rows.map(row => ({
                ...row,
                question_cosine_distance: parseFloat(row.question_cosine_distance),
                answer_cosine_distance: parseFloat(row.answer_cosine_distance),
                total_distance: parseFloat(row.total_distance)
            }));
        } catch (error) {
            console.error('Error finding closest embedding:', error);
            throw error;
        }
    }
    
    async searchByTestId(test_id) {
        const query = `
            SELECT *
            FROM answers
            WHERE test_id = $1
            ORDER BY id;
        `;

        try {
            const result = await this.pool.query(query, [test_id]);
            return result.rows;
        } catch (error) {
            console.error('Error searching by test_id:', error);
            throw error;
        }
    }
    

    // Close database connection
    async close() {
        await this.pool.end();
    }
}

module.exports = DatabaseManager;
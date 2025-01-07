const express = require('express');
const OpenAI = require('openai');
require('dotenv').config();
const cors = require('cors');


const app = express();

const corsOptions = {
    origin: '*', // Allow all origins - change this in production!
    methods: ['POST', 'GET', 'OPTIONS'], // Allowed methods
    allowedHeaders: ['Content-Type', 'Authorization'], // Allowed headers
    optionsSuccessStatus: 200 // Some legacy browsers (IE11) choke on 204
};

app.use(cors(corsOptions));
app.use(express.json());

// Configure OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Use your existing Assistant ID
const ASSISTANT_ID = process.env.OPENAI_ASSISTANT_ID; // Replace with your Assistant ID

// Endpoint to handle chat requests
app.post('/chat', async (req, res) => {
    try {
        const { message } = req.body;
        
        if (!message) {
            return res.status(400).json({
                error: 'Message is required in the request body'
            });
        }

        // Create a thread for this conversation
        const thread = await openai.beta.threads.create();

        // Add the message to the thread
        await openai.beta.threads.messages.create(
            thread.id,
            { role: "user", content: message }
        );

        // Run the assistant
        const run = await openai.beta.threads.runs.create(
            thread.id,
            { assistant_id: ASSISTANT_ID }
        );

        // Poll for the completion
        let runStatus = await openai.beta.threads.runs.retrieve(
            thread.id,
            run.id
        );

        // Wait for the response to be ready
        while (runStatus.status !== 'completed') {
            if (runStatus.status === 'failed') {
                throw new Error('Assistant run failed');
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
            runStatus = await openai.beta.threads.runs.retrieve(
                thread.id,
                run.id
            );
        }

        // Get the messages
        const messages = await openai.beta.threads.messages.list(
            thread.id
        );

        // Get the latest assistant message
        const assistantMessage = messages.data
            .filter(msg => msg.role === 'assistant')
            .pop();

        const response = assistantMessage.content[0].text.value;

        res.json({
            message: response,
            threadId: thread.id
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            error: 'Failed to get response from Assistant',
            details: error.message
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
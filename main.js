require("dotenv").config();

const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const API_TOKEN = process.env.API_TOKEN;
app.get('/models', async (req, res) => {
    res.status(200).send({data: [{id: 'claude-2'}, {id: 'claude-v1.3'}]});
});
app.post('/chat/completions', async (req, res) => {


    //console.log(req.body);
    const model = req.body.model;
    const temp = req.body.temperature || 1.0;
    const top_p = req.body.top_p || null;
    const top_k = req.body.top_k || null;
    const maxTokens = req.body.max_tokens;
    const stopSequences = req.body.stop || null;
    const isStream = req.body.stream || false;
    var prompt = '';//req.body.messages;
    function getName(str) {
        const nameRegex = /^([^\s:]+):\s/;
        const match = str.match(nameRegex);

        if (match) {
            return match[1];
        } else {
            return null;
        }
    }
    var AIName = undefined;
    let isGotAIName = false;
    req.body.messages.forEach(function (item, i) {
        if (item.role === 'user') {
            prompt += item.content;
        } else if (item.role === 'assistant') {
            if(!isGotAIName){
                
                let res = getName(item.content);
                if(res !== null){
                    isGotAIName = true;
                    AIName = res;
                }
            }
            prompt += item.content;
        } else {
            prompt += item.content;
        }
    });
    if(AIName !== undefined){
        prompt += AIName+': ';
    }
    console.log(`Doing a request with stream = ${isStream}.`);

    // Set up axios instance for SSE
    const sourcegraph = axios.create({
        baseURL: 'https://sourcegraph.com/.api/completions/stream',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `token ${API_TOKEN}`
        },
        responseType: 'stream',
        timeout: 180000,
    });

    let fullContent = "";

    try {
        let postData = {
            model: model,
            prompt: prompt,
            maxTokensToSample: maxTokens
        };

        if (temp)
            postData.temperature = temp;
        if (stopSequences)
            postData.stop_sequences = stopSequences;
        if (top_p)
            postData.top_p = top_p;
        if (top_k)
            postData.top_k = top_k;
        console.log(postData)
        const response = await sourcegraph.post('', postData);

        let previousCompletion = "";
        let buffer = ""; // Buffer to hold incomplete lines
        let foundStop = false;
        response.data.on('data', (chunk) => {
            buffer += chunk.toString();

            let lines = buffer.split("\n");
            buffer = lines.pop(); // Keep the last (potentially incomplete) line in the buffer

            const data = lines.filter(line => line.startsWith('data: ')).map(line => line.replace(/^data: /, ''));

            data.forEach((chunk) => {
                if (foundStop) {
                    console.log(fullContent);
                    //fullContent = removeAfterU(fullContent);
                    res.status(200).send({choices:[{message: {content: fullContent}}], stop_reason: "stop_sequence"});
                    response.data.destroy(); 
                }
                try {
                    const parsedData = JSON.parse(chunk);
                    console.log(parsedData);
                    if ('completion' in parsedData) {
                        //console.log(resp);
                        if (isStream) {
                            console.log(1);
                            // SourceGraph API always returns the full string, but we need the diff
                            const newPart = parsedData.completion.replace(previousCompletion, '');
                            previousCompletion = parsedData.completion;
                            let resp = {completion: newPart, stop_reason: null};
                            res.write(`event: completion\r\ndata: ${JSON.stringify(resp)}\r\n\r\n`);
                        } else {
                            fullContent = parsedData.completion;
                            if (stopSequences.some(seq => fullContent.includes(seq))) {
                                foundStop = true;
                            }
                        }
                    }
                } catch (error) {
                    // If an error is thrown, the JSON is not valid
                    console.error('Invalid JSON:', chunk);
                }
            })
        });
        response.data.on('end', () => {
            if (isStream) {
                let finalResp = {completion: "", stop_reason: "stop_sequence"};
                res.write(`event: completion\r\ndata: ${JSON.stringify(finalResp)}\r\n\r\n`);
            } else {
                if (foundStop === false) {
                    console.log(fullContent);
                    //fullContent = removeAfterU(fullContent);
                    res.status(200).send({choices: [{message: {content: fullContent}}], stop_reason: "stop_sequence"});
                }
            }
            res.end();
            console.log(`Request done.`)
        });

    } catch (error) {
        console.error("Got an error: ", error);
        res.status(500).send('An error occurred while making the request.');
    }
});
function removeAfterU(str) {
    const last6 = str.slice(-6);
    if (last6.includes('U:')) {
        const index = str.lastIndexOf('U:');
        return str.slice(0, index);
    }
    return str;
}
app.use((err, req, res, next) => {
    //console.log(err);
    res.status(500).json({"error": true});
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Promise Rejection:', reason);
});

async function checkToken(token) {
    const data = {
        query: 'query { currentUser { username } }'
    };

    const config = {
        method: 'post',
        url: 'https://sourcegraph.com/.api/graphql',
        headers: {
            'Authorization': `token ${token}`
        },
        data: data
    };

    try {
        const response = await axios(config);
        if (response.data && response.data.data && response.data.data.currentUser) {
            console.log(`Token works, username: ${response.data.data.currentUser.username}`);
            return true;
        } else {
            return false;
        }
    } catch (error) {
        return false;
    }
}

// Two basic checks
if (!API_TOKEN) {
    console.error("SourceGraph API token not found! Create a file named '.env' and put your token there as an API_TOKEN. See .env.example for an example.");
    process.exit(1);
} else if (API_TOKEN.indexOf("sgp_") == -1) {
    console.error("Invalid SourceGraph API token! Make sure you copied the whole token starting with sgp_, like 'sgp_blablabla'.");
    process.exit(1);
}

// Check token validity
checkToken(API_TOKEN).then(isValid => {
    if (!isValid) {
        console.error("Invalid SourceGraph API token! Make sure you copied the whole token and that the token is not revoked.");
        process.exit(1);
    }

    const port = process.env.PORT || 3000;
    app.listen(port, () => console.log(`Server listening on port ${port}`));
});
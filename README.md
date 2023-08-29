# TavernAI SourceGraph proxy

It's fork of sg_proxy proxy script

Requirements: Node, NPM.

1. Create a SourceGraph account (no phone required, just normal email/password).
2. Go to https://sourcegraph.com/, click on your profile icon in upper-right, then Settings, then go to Account->Access tokens, and generate a new token.
3. Clone/download https://github.com/Borov666/tai_sg_proxy, open a console in that directory.
4. Open .env in the proxy folder and put your token there, so it looks like API_TOKEN="your token here"
5. Run `npm install` to install dependencies.
6. Start the proxy - `node main.js`
7. Select Reverse Proxy api in TavernAI's right menu and set the proxy URL as http://127.0.0.1:3000 without pass.

Enjoy.

If you want to use it remotely, you can use any tunneling service e.g. ngrok or cloudflared, for example just cloudflared tunnel --url http://127.0.0.1:3000 is enough to tunnel the proxy through Cloudflare

Notes:

* Only tested with the model claude-2, cloude-1.3 older ones might work if their API allows to, maybe not.
* At the moment the stop sequence doesn't work


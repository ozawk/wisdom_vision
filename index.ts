import { Hono } from 'hono';
import { cors } from 'hono/cors';
import GoogleAuth, { GoogleKey } from 'cloudflare-workers-and-google-oauth';

export interface Env {
	GCP_SERVICE_ACCOUNT: string;
	GCP_SERVICE_SCOPES: string;
	GCP_GEMINI_SERVICE_URL: string;
}

const userText = '';
const systemText =
	'Please answer in no more than 100 words.Please share trivia or other knowledge (any area is fine, such as the development history, expansion in other countries, sales figures, ingredients, etc.) about what stands out in the given image. Also, please give your overall impression of the image (e.g. beautiful, etc.)Please keep your tone casual and doctoral.';

const app = new Hono();
export default app;

app.use(
	'/desc/*',
	cors({
		origin: ['https://wisdom.ozwk.net'],
		allowHeaders: ['X-Custom-Header', 'Upgrade-Insecure-Requests', 'Content-Type'], // ここに追加
		allowMethods: ['POST', 'OPTIONS'],
		maxAge: 600,
		credentials: true
	})
);

app.post('/desc', async c => {
	const body = await c.req.json();
	const image = body.image;
	const location = ' ';
	const weather = ' ';
	const time = ' ';
	let explainText;

	if (typeof image !== 'string') {
		c.status(400);
		return c.body('Invalid image data');
	}
	try {
		explainText = await getExplainText(c, image, location, weather, time);
	} catch (e) {
		c.status(500);
		return c.body((e as Error).message);
	}
	return await c.text(explainText);
});

async function getExplainText (c: any, image: string, location: string, weather: string, time: string) {
	const googleAuth: GoogleKey = JSON.parse(c.env.GCP_SERVICE_ACCOUNT);
	const scopes = new GoogleAuth(googleAuth, [c.env.GCP_SERVICE_SCOPES]);
	const url = c.env.GCP_GEMINI_SERVICE_URL;
	let token;
	try {
		token = await scopes.getGoogleAuthToken();
	} catch (e) {
		throw new Error('Internal server auth error');
	}
	const body = {
		contents: [
			{
				role: 'user',
				parts: [
					{
						inlineData: {
							mimeType: 'image/jpeg',
							data: image
						}
					},
					{ text: userText + ', location:' + location + ', weather:' + weather + ', time:' + time }
				]
			}
		],
		systemInstruction: {
			role: 'system', //これは無視される
			parts: [
				{
					text: systemText
				}
			]
		},
		safetySettings: [
			//すべて敏感な設定
			{ category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_LOW_AND_ABOVE' }, //ヘイトスピーチ
			{ category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_LOW_AND_ABOVE' }, //危険なコンテンツ
			{ category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_LOW_AND_ABOVE' }, //ハラスメント
			{ category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' } //性的描写が露骨なコンテンツ
		]
	};
	getExplainText;
	const init = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: 'Bearer ' + token
		},
		body: JSON.stringify(body)
	};
	interface Candidate {
		content: {
			role: string;
			parts: { text: string }[];
		};
		finishReason: string;
		avgLogprobs: number;
	}
	let response: { candidates: Candidate[] };
	try {
		response = await (await fetch(url, init)).json();
	} catch (e) {
		throw new Error('Internal error');
	}
	return response.candidates[0].content.parts[0].text;
}

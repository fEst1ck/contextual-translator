chrome.runtime.onInstalled.addListener(() => {
	chrome.contextMenus.create({
		id: "translateInContext",
		title: "Translate selected word in context",
		contexts: ["selection"]
	});
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
	if (info.menuItemId === "translateInContext" && info.selectionText) {
		console.log("Selected text: " + info.selectionText);

		// Retrieve the API key from Chrome storage
		chrome.storage.sync.get(['apiKey'], (result) => {
			const apiKey = result.apiKey;

			if (!apiKey) {
				// No API key found, prompt the user to set it
				chrome.action.openPopup(); // Opens the extension's popup where the user can set the API key
				return;
			}

			// Execute the function in the context of the web page
			chrome.scripting.executeScript({
				target: { tabId: tab.id },
				func: getSurroundingParagraph,
				args: [info.selectionText]
			}, (result) => {
				if (result && result[0] && result[0].result) {
					const contextText = result[0].result;
					console.log("Surrounding paragraph: " + contextText);
					sendToChatGPT(info.selectionText, contextText, tab.id, apiKey); // Pass the API key to sendToChatGPT
				}
			});
		});
	}
});


function getSurroundingParagraph(selectedText) {
	const selection = window.getSelection();
	if (!selection.rangeCount) return "";

	const range = selection.getRangeAt(0);
	const node = range.startContainer;

	// Traverse up to find the containing paragraph or block element
	let paragraph = node;
	while (paragraph && paragraph.nodeName !== 'P' && paragraph.nodeName !== 'DIV' && paragraph.nodeName !== 'SECTION') {
		paragraph = paragraph.parentNode;
	}

	return paragraph ? paragraph.innerText : "";
}

function sendToChatGPT(selectedText, contextText, tabId, apiKey) {
	// Display initial popup with "Translating" message
	chrome.scripting.executeScript({
		target: { tabId: tabId },
		func: displayTranslationPopup,
		args: [selectedText, "..."]  // Initial message
	});

	const prompt =
`Translate the word(s) "${selectedText}" into Chinese in the following context: "${contextText}".

Respond in the following format:
If the selected word is only one word, output

<strong>Original form of the word</strong> Part of speech<br>
Pronunciation<br>

Only if multiple words are selected, we don't output the part of speech and pronunciation.

After that, output the translation (not explanation) of the word in the given context in Chinese.

Then, briefly explain in Chinese the translation in the context if necessary. Act like a English teacher explaining the word to a Chinese student.

(For instance, when only one word "cats" is selected
<strong>cat</strong> <em>noun</em><br>
/kæt/<br>
猫<br>
[explanations]

Note that the original form "cat" is shown, rather than the plural form "cats", which is selected.

When multiple words are selected (words like vice-president is considered one word)
<strong>give up</strong><br>
放弃<br>
[explanations]

Be sure to add new lines <br> between each section.
)
`;

	fetch("https://api.openai.com/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Authorization": `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: "gpt-4",
			messages: [{ "role": "user", "content": prompt }],
			stream: true
		})
	})
		.then(async (response) => {
			if (!response.ok) {
				throw new Error('Network response was not ok');
			}

			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			let content = "";

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				content += decoder.decode(value, { stream: true });

				// Extracting partial response and updating popup
				const updatedText = extractContent(content);
				chrome.scripting.executeScript({
					target: { tabId: tabId },
					func: updateTranslationPopup,
					args: [selectedText, updatedText]
				});
			}
		})
		.catch(error => {
			console.error('Error:', error);
			chrome.scripting.executeScript({
				target: { tabId: tabId },
				func: updateTranslationPopup,
				args: [selectedText, "Failed to get translation."]
			});
		});
}

function extractContent(streamedText) {
	let result = '';
	try {
		const lines = streamedText.split('\n');
		for (const line of lines) {
			if (line.trim() === "data: [DONE]") {
				// Ignore the [DONE] token
				continue;
			}

			if (line.trim().startsWith('data: ')) {
				const json = JSON.parse(line.replace('data: ', '').trim());
				result += json.choices[0].delta?.content || '';
			}
		}
	} catch (error) {
		console.error('Error parsing streamed content:', error);
	}
	return result;
}

function displayTranslationPopup(selectedText, message) {
	const existingPopup = document.getElementById('translation-popup');
	if (existingPopup) {
		existingPopup.remove();
	}

	const popup = document.createElement('div');
	popup.id = 'translation-popup';
	popup.style.position = 'absolute';
	popup.style.backgroundColor = '#f1f1f1'; // Light, neutral background color
	popup.style.border = '1px solid #ccc'; // Subtle border
	popup.style.borderRadius = '4px'; // Slightly rounded corners for a clean look
	popup.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.15)'; // Soft shadow for elevation
	popup.style.zIndex = 10000;
	popup.style.maxWidth = '300px';
	popup.style.fontFamily = 'Arial, sans-serif'; // System font for a native feel
	popup.style.color = '#000'; // Standard text color

	// Create the top bar for dragging
	const topBar = document.createElement('div');
	topBar.style.backgroundColor = '#ddd'; // Light grey color for the top bar
	topBar.style.padding = '5px';
	topBar.style.cursor = 'move';
	topBar.style.borderTopLeftRadius = '4px';
	topBar.style.borderTopRightRadius = '4px';
	topBar.style.display = 'flex';
	topBar.style.justifyContent = 'space-between';
	topBar.style.alignItems = 'center';

	// Add a close button to the top bar
	const closeButton = document.createElement('button');
	closeButton.innerText = '✕';
	closeButton.style.backgroundColor = 'transparent';
	closeButton.style.color = '#333'; // Dark grey for a subtle appearance
	closeButton.style.border = 'none';
	closeButton.style.fontSize = '14px';
	closeButton.style.cursor = 'pointer';

	closeButton.addEventListener('click', () => {
		popup.remove();
	});

	topBar.appendChild(document.createElement('span')); // Placeholder to help center the close button
	topBar.appendChild(closeButton);

	// Add the translation text area
	const textElement = document.createElement('div');
	textElement.id = 'translation-text';
	textElement.style.padding = '10px';
	textElement.style.lineHeight = '1.5';
	textElement.innerHTML = message;

	popup.appendChild(topBar);
	popup.appendChild(textElement);

	document.body.appendChild(popup);

	const selection = window.getSelection();
	if (selection.rangeCount > 0) {
		const range = selection.getRangeAt(0);
		const rect = range.getBoundingClientRect();
		popup.style.top = `${rect.top + window.scrollY + 20}px`;
		popup.style.left = `${rect.left + window.scrollX}px`;
	}

	// Make the popup movable using the top bar
	topBar.onmousedown = function (event) {
		event.preventDefault();

		let shiftX = event.clientX - popup.getBoundingClientRect().left;
		let shiftY = event.clientY - popup.getBoundingClientRect().top;

		document.onmousemove = function (event) {
			popup.style.left = event.pageX - shiftX + 'px';
			popup.style.top = event.pageY - shiftY + 'px';
		};

		document.onmouseup = function () {
			document.onmousemove = null;
			document.onmouseup = null;
		};
	};

	topBar.ondragstart = function () {
		return false;
	};
}

function updateTranslationPopup(selectedText, translation) {
	const textElement = document.getElementById('translation-text');
	console.log("Translation: " + translation);
	if (textElement) {
		textElement.innerHTML = `${translation}`;
	}

	// Ensure that strong and em tags are styled correctly
	const style = document.createElement('style');
	style.textContent = `
		#translation-popup strong {
		  font-weight: bold;
		}
		#translation-popup em {
		  font-style: italic;
		}
	  `;
	document.head.appendChild(style);
}

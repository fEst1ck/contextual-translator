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

		// Execute the function in the context of the web page
		chrome.scripting.executeScript({
			target: { tabId: tab.id },
			func: getSurroundingParagraph,
			args: [info.selectionText]
		}, (result) => {
			if (result && result[0] && result[0].result) {
				const contextText = result[0].result;
				console.log("Surrounding paragraph: " + contextText);
				sendToChatGPT(info.selectionText, contextText, tab.id);
			}
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

function sendToChatGPT(selectedText, contextText, tabId) {
	const apiKey = "your-api-key";  // Replace with your OpenAI API key
	const prompt = `Translate the word "${selectedText}" into Chinese (or specify a target language if needed) in the following context: "${contextText}".`;

	fetch("https://api.openai.com/v1/chat/completions", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Authorization": `Bearer ${apiKey}`
		},
		body: JSON.stringify({
			model: "gpt-4",
			messages: [{ "role": "user", "content": prompt }],
			max_tokens: 60
		})
	})
		.then(response => response.json())
		.then(data => {
			const translation = data.choices[0].message.content;
			console.log(`Translation: ${translation}`);

			// Inject the translation into the page
			chrome.scripting.executeScript({
				target: { tabId: tabId },
				func: displayTranslationPopup,
				args: [selectedText, translation]
			});
		})
		.catch(error => console.error('Error:', error));
}

function displayTranslationPopup(selectedText, translation) {
	const existingPopup = document.getElementById('translation-popup');
	if (existingPopup) {
		existingPopup.remove();
	}

	const popup = document.createElement('div');
	popup.id = 'translation-popup';
	popup.style.position = 'absolute';
	popup.style.backgroundColor = '#f9f9f9'; // Light, neutral background color
	popup.style.border = '1px solid #ccc'; // Subtle border
	popup.style.borderRadius = '8px'; // More rounded corners for a modern look
	popup.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)'; // Softer, more natural shadow
	popup.style.zIndex = 10000;
	popup.style.maxWidth = '300px';
	popup.style.fontFamily = 'Arial, sans-serif'; // Use a system font for a more native feel

	// Create the top bar for dragging
	const topBar = document.createElement('div');
	topBar.style.backgroundColor = '#e0e0e0'; // Light grey color for the top bar
	topBar.style.padding = '5px';
	topBar.style.cursor = 'move';
	topBar.style.borderTopLeftRadius = '8px';
	topBar.style.borderTopRightRadius = '8px';
	topBar.style.display = 'flex';
	topBar.style.justifyContent = 'space-between';
	topBar.style.alignItems = 'center';

	// Add a close button to the top bar
	const closeButton = document.createElement('button');
	closeButton.innerText = '✕'; // Use a cross icon for a more modern close button
	closeButton.style.backgroundColor = 'transparent';
	closeButton.style.color = '#333'; // Dark grey for a more subtle appearance
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
	textElement.style.padding = '10px';
	textElement.style.color = '#333'; // Darker text color for better readability
	textElement.style.lineHeight = '1.5';
	textElement.innerText = `Translation for "${selectedText}": ${translation}`;

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

// function displayTranslationPopup(selectedText, translation) {
// 	const existingPopup = document.getElementById('translation-popup');
// 	if (existingPopup) {
// 	  existingPopup.remove();
// 	}
  
// 	const popup = document.createElement('div');
// 	popup.id = 'translation-popup';
// 	popup.style.position = 'absolute';
// 	popup.style.border = '1px solid var(--popup-border-color)';
// 	popup.style.borderRadius = '8px';
// 	popup.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
// 	popup.style.zIndex = 10000;
// 	popup.style.maxWidth = '300px';
// 	popup.style.fontFamily = 'Arial, sans-serif';
// 	popup.style.backgroundColor = 'var(--popup-bg-color)';
// 	popup.style.color = 'var(--popup-text-color)';
  
// 	// Create the top bar for dragging
// 	const topBar = document.createElement('div');
// 	topBar.style.backgroundColor = 'var(--top-bar-bg-color)';
// 	topBar.style.padding = '5px';
// 	topBar.style.cursor = 'move';
// 	topBar.style.borderTopLeftRadius = '8px';
// 	topBar.style.borderTopRightRadius = '8px';
// 	topBar.style.display = 'flex';
// 	topBar.style.justifyContent = 'space-between';
// 	topBar.style.alignItems = 'center';
  
// 	// Add a close button to the top bar
// 	const closeButton = document.createElement('button');
// 	closeButton.innerText = '✕';
// 	closeButton.style.backgroundColor = 'transparent';
// 	closeButton.style.color = 'var(--close-button-color)';
// 	closeButton.style.border = 'none';
// 	closeButton.style.fontSize = '14px';
// 	closeButton.style.cursor = 'pointer';
  
// 	closeButton.addEventListener('click', () => {
// 	  popup.remove();
// 	});
  
// 	topBar.appendChild(document.createElement('span')); // Placeholder to help center the close button
// 	topBar.appendChild(closeButton);
  
// 	// Add the translation text area
// 	const textElement = document.createElement('div');
// 	textElement.style.padding = '10px';
// 	textElement.style.lineHeight = '1.5';
// 	textElement.innerText = `Translation for "${selectedText}": ${translation}`;
  
// 	popup.appendChild(topBar);
// 	popup.appendChild(textElement);
  
// 	document.body.appendChild(popup);
  
// 	const selection = window.getSelection();
// 	if (selection.rangeCount > 0) {
// 	  const range = selection.getRangeAt(0);
// 	  const rect = range.getBoundingClientRect();
// 	  popup.style.top = `${rect.top + window.scrollY + 20}px`;
// 	  popup.style.left = `${rect.left + window.scrollX}px`;
// 	}
  
// 	// Make the popup movable using the top bar
// 	topBar.onmousedown = function(event) {
// 	  event.preventDefault();
  
// 	  let shiftX = event.clientX - popup.getBoundingClientRect().left;
// 	  let shiftY = event.clientY - popup.getBoundingClientRect().top;
  
// 	  document.onmousemove = function(event) {
// 		popup.style.left = event.pageX - shiftX + 'px';
// 		popup.style.top = event.pageY - shiftY + 'px';
// 	  };
  
// 	  document.onmouseup = function() {
// 		document.onmousemove = null;
// 		document.onmouseup = null;
// 	  };
// 	};
  
// 	topBar.ondragstart = function() {
// 	  return false;
// 	};
  
// 	// Apply theme styles based on the user's preferred color scheme
// 	applyThemeStyles();
//   }
  
//   function applyThemeStyles() {
// 	const root = document.documentElement;
  
// 	const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
// 	if (isDarkMode) {
// 	  root.style.setProperty('--popup-bg-color', '#333');
// 	  root.style.setProperty('--popup-text-color', '#eee');
// 	  root.style.setProperty('--popup-border-color', '#444');
// 	  root.style.setProperty('--top-bar-bg-color', '#555');
// 	  root.style.setProperty('--close-button-color', '#eee');
// 	} else {
// 	  root.style.setProperty('--popup-bg-color', '#fff');
// 	  root.style.setProperty('--popup-text-color', '#000');
// 	  root.style.setProperty('--popup-border-color', '#ccc');
// 	  root.style.setProperty('--top-bar-bg-color', '#e0e0e0');
// 	  root.style.setProperty('--close-button-color', '#333');
// 	}
//   }
  
document.getElementById('saveKey').addEventListener('click', () => {
	const apiKey = document.getElementById('apiKey').value;
	if (apiKey) {
		chrome.storage.sync.set({ apiKey: apiKey }, () => {
			alert('API密钥已保存!');
		});
	} else {
		alert('Please enter an API key.');
	}
});

// Load the saved API key when the popup is opened
document.addEventListener('DOMContentLoaded', () => {
	chrome.storage.sync.get(['apiKey'], (result) => {
		if (result.apiKey) {
			document.getElementById('apiKey').value = result.apiKey;
		}
	});
});

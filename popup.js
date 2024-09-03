document.getElementById('save').addEventListener('click', () => {
	const apiKey = document.getElementById('apiKey').value;
	chrome.storage.sync.set({ apiKey }, () => {
	  alert('API Key saved!');
	});
  });
  
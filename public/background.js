// Registered synchronously so Chrome wakes the worker even with no new tab open.
chrome.bookmarks.onRemoved.addListener((id, info) => {
 const keys = [];
 function collect(node) { keys.push(`name:${node.id}`); for (const child of node.children ?? []) collect(child); }
 collect(info.node ?? { id });
 chrome.storage.local.remove(keys).catch(error => console.error('Bookmark Grid: alias cleanup failed; next page load will retry.', error));
});

export {};

// Web Worker for DTM Filter processing
// Note: Using .js extension for better Vite compatibility with workers

// Import the processing function (will be bundled)
// Since we're in a worker, we need to import the compiled version
// For now, we'll inline the necessary code or use importScripts

importScripts('./morphologyUtils.js'); // This won't work directly - need to bundle differently

// For Vite, we need to use a different approach
// Worker will receive the processing function code via message or we inline it here

// Simplified worker that receives processing instructions
self.onmessage = function (e) {
  const { type, data } = e.data;

  if (type === 'process') {
    try {
      // For now, signal that worker needs to be implemented properly
      // The main app will use inline processing as fallback
      self.postMessage({
        type: 'error',
        error: 'Worker implementation requires proper bundling setup. Using inline processing instead.',
      });
    } catch (error) {
      self.postMessage({
        type: 'error',
        error: error.message || 'Unknown error during DTM filtering',
      });
    }
  }
};













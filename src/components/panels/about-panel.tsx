export function AboutPanel() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mb-4 shadow-lg">
        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" />
        </svg>
      </div>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Text to Code</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Version 0.1.0</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 max-w-xs">
        Local speech-to-text transcription that types directly into your apps. Powered by Whisper and Parakeet.
      </p>
    </div>
  );
}

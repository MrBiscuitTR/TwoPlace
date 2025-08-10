process.on('exit', (code) => {
  console.log(`>>> EXIT CODE: ${code}`);
});
process.on('SIGINT', () => {
  console.log('>>> SIGINT RECEIVED');
});
process.on('SIGTERM', () => {
  console.log('>>> SIGTERM RECEIVED');
});
process.on('uncaughtException', (err) => {
  console.log('>>> UNCAUGHT EXCEPTION:', err);
});
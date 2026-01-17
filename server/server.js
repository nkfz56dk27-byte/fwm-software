const express = require('express');
const app = express();

app.use(express.json());
app.use('/api/send-notification', require('./send-notification'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server notifiche avviato su http://localhost:${PORT}`);
});

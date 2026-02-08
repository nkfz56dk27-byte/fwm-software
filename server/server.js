const express = require('express');
const app = express();

const sendOneSignalApi = require('./send-onesignal-api');

app.use(express.json());
// app.use('/api/send-notification', require('./send-fcm-notification'));
app.use('/api', sendOneSignalApi);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // ...log avvio server rimosso...
});

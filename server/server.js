require('dotenv').config();
const express = require('express');
const app = express();

const sendNotification = require('./send-notification.cjs');

app.use(express.json());
app.use('/api/send-notification', sendNotification);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  // ...log avvio server rimosso...
});

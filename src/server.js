const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { chatController } = require('./controllers/chatController');

const app = express();

app.use(cors());
app.use(express.json({ limit: '32kb' }));
app.use(morgan('dev'));

app.post('/chat', chatController);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`ai-help-service listening on port ${PORT}`);
});

require('dotenv').config();
const app = require('./api/app');

const port = process.env.PORT || 5001;

app.listen(port, () => {
    console.log(`🚀 Server running locally on http://localhost:${port}`);
});

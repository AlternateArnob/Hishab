const app  = require('./app');
const port = process.env.PORT || 5001;

// Ensure DB is connected (imported for side-effect)
require('./config/db');

app.listen(port, () => {
  console.log(`🚀  Hishab ERP running on http://localhost:${port}`);
});
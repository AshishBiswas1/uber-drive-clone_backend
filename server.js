const mongoose = require('mongoose');
const dotenv = require('dotenv');

process.on('uncaughtException', (err) => {
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  process.exit(1);
});

dotenv.config({ path: './Config.env' });

const Db = process.env.DATABASE.replace('<db_password>', process.env.PASSWORD);

mongoose
  .connect(Db)
  .then(() => console.log('Database Connected.'))
  .catch((err) => console.log(err));

const app = require('./app');

const port = process.env.PORT || 8000;

const server = app.listen(port, () =>
  console.log(`App running on port ${port}...`)
);

process.on('unhandledRejection', (err) => {
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});

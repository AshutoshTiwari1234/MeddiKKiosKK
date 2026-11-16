require('../config/loadEnv');
const readline = require('node:readline');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const { connectDatabase } = require('../config/database');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

function ask(question) {
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => terminal.question(question, (answer) => {
    terminal.close();
    resolve(answer.trim());
  }));
}

function askSecret(question) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || !process.stdin.setRawMode) {
      reject(new Error('Run this command in an interactive terminal so the password can be entered without echo.'));
      return;
    }

    process.stdout.write(question);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    let value = '';
    const onData = (character) => {
      if (character === '\u0003') {
        process.stdin.removeListener('data', onData);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write('\n');
        reject(new Error('Cancelled.'));
      } else if (character === '\r' || character === '\n') {
        process.stdin.removeListener('data', onData);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdout.write('\n');
        resolve(value);
      } else if (character === '\u007f' || character === '\b') {
        value = value.slice(0, -1);
      } else if (character >= ' ') {
        value += character;
      }
    };
    process.stdin.on('data', onData);
  });
}

async function main() {
  if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI in backend/.env first.');
  if (!await connectDatabase()) throw new Error('Could not connect to MongoDB. Check MONGODB_URI and try again.');
  if (await User.exists({ role: { $in: ['administrator', 'admin'] } })) {
    throw new Error('An administrator already exists. Create additional staff accounts from the administrator workspace.');
  }

  const name = await ask('Administrator name: ');
  const email = (await ask('Administrator email: ')).toLowerCase();
  const password = await askSecret('Password (12+ characters, hidden): ');
  const confirmation = await askSecret('Confirm password (hidden): ');
  if (password !== confirmation) throw new Error('Passwords do not match.');
  if (password.length < 12 || password.length > 128) throw new Error('Password must be between 12 and 128 characters.');
  if (!name || !email.includes('@')) throw new Error('Enter a valid name and email address.');

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ name, email, passwordHash, role: 'administrator' });
  await AuditLog.create({ actorId: user._id, action: 'auth.bootstrap', resourceType: 'user', resourceId: user._id });
  console.log(`Administrator account created for ${user.email}. You can now sign in to MediKiosk.`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => mongoose.disconnect());

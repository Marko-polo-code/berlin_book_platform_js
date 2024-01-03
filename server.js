require('dotenv').config();

const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret_key';

const app = express();
const PORT = process.env.PORT || 3000;

const user = { id: 1, username: 'testuser' };
const token = jwt.sign(user, JWT_SECRET);

// Database connection
const sequelize = new Sequelize(process.env.DATABASE_URL);

// Define User and Book models
const User = sequelize.define('User', {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  pseudonym: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
    set(value) {
      this.setDataValue('password', bcrypt.hashSync(value, 10));
    },
  },
});

User.prototype.generateAuthToken = function () {
  const token = jwt.sign({ id: this.id }, 'dummy_secret_key_for_assessment');
  return token;
};

const Book = sequelize.define('Book', {
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING,
  },
  author: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  isbn: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  price: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },


});

// REST API endpoints
app.use(express.json());

// Authentication middleware to secure certain endpoints
const authenticate = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).send({ error: 'Authentication failed: Token missing' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).send({ error: 'Authentication failed: Token expired' });
    }
    return res.status(401).send({ error: 'Authentication failed: Invalid token' });
  }
};

// User endpoints
// Create a user
app.post('/users', authenticate, async (req, res) => {
  try {
    const { username, pseudonym, password } = req.body;
    const user = await User.create({ username, pseudonym, password });
    res.status(201).send(user);
  } catch (error) {
    res.status(400).send({ error: 'Failed to create user' });
  }
});

// Delete a user
app.delete('/users/:id', authenticate, async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).send({ error: 'User not found' });
    }
    await user.destroy();
    res.send({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(400).send({ error: 'Failed to delete user' });
  }
});

// Update user password
app.put('/users/:id/password', authenticate, async (req, res) => {
  try {
    const userId = req.params.id;
    const { password } = req.body;
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).send({ error: 'User not found' });
    }
    user.password = password;
    await user.save();
    res.send({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(400).send({ error: 'Failed to update password' });
  }
});

// Book endpoints
// Create a new book
app.post('/books', authenticate, async (req, res) => {
  try {
    const { title, description, author, isbn, price } = req.body;
    const book = await Book.create({ title, description, author, isbn, price });
    res.status(201).send(book);
  } catch (error) {
    res.status(400).send({ error: 'Failed to create book' });
  }
});

// List all books
app.get('/books', async (req, res) => {
  try {
    const books = await Book.findAll();
    res.send(books);
  } catch (error) {
    res.status(400).send({ error: 'Failed to list books' });
  }
});

// Search for books
app.get('/books/search', async (req, res) => {
  try {
    const { title, author } = req.query;
    const whereClause = {};
    if (title) whereClause.title = title;
    if (author) whereClause.author = author;
    const books = await Book.findAll({ where: whereClause });
    res.send(books);
  } catch (error) {
    res.status(400).send({ error: 'Failed to search books' });
  }
});

// Update book details
app.put('/books/:id', authenticate, async (req, res) => {
  try {
    const bookId = req.params.id;
    const { title, description, author, isbn, price } = req.body;
    const book = await Book.findByPk(bookId);
    if (!book) {
      return res.status(404).send({ error: 'Book not found' });
    }
    book.title = title;
    book.description = description;
    book.author = author;
    book.isbn = isbn;
    book.price = price;
    await book.save();
    res.send({ message: 'Book updated successfully' });
  } catch (error) {
    res.status(400).send({ error: 'Failed to update book' });
  }
});

// Delete a book
app.delete('/books/:id', authenticate, async (req, res) => {
  try {
    const bookId = req.params.id;
    const book = await Book.findByPk(bookId);
    if (!book) {
      return res.status(404).send({ error: 'Book not found' });
    }
    await book.destroy();
    res.send({ message: 'Book deleted successfully' });
  } catch (error) {
    res.status(400).send({ error: 'Failed to delete book' });
  }
});

// authentication endpoint to verify the username and password
app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ where: { username } });
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).send({ error: 'Invalid username or password' });
    }
    const token = user.generateAuthToken();
    res.send({ token });
  } catch (error) {
    res.status(400).send({ error: 'Login failed' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

module.exports = app;

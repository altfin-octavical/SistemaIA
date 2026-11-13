// Entrada serverless para Vercel: adapta el app Express a una función.
import app from '../src/app.js';

export default (req, res) => app(req, res);

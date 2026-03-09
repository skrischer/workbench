import { NotFoundError } from './src/types/errors.js';

const error = new NotFoundError('Session', 'test-123');
console.log('Error type:', error.constructor.name);
console.log('Error name:', error.name);
console.log('Error message:', error.message);
console.log('Resource:', error.resource);
console.log('ID:', error.id);

const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
}).strict();

const accountRequestSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.').max(100),
  email: z.string().trim().email('Enter a valid work email.').max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12, 'Use a password with at least 12 characters.').max(128),
  role: z.enum(['doctor', 'receptionist']),
  department: z.string().trim().max(100).optional().default(''),
}).strict();

const createUserSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12, 'Use a password with at least 12 characters.').max(128),
  role: z.enum(['administrator', 'doctor', 'receptionist']),
  department: z.string().trim().max(100).optional().default(''),
}).strict();

const userStatusSchema = z.object({ active: z.boolean() }).strict();
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12, 'Use a password with at least 12 characters.').max(128),
}).strict();

module.exports = { accountRequestSchema, changePasswordSchema, createUserSchema, loginSchema, userStatusSchema };

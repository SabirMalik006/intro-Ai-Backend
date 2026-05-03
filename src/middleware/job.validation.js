import { z } from 'zod';

export const jobSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters').max(200),
  company: z.string().min(2, 'Company name is required'),
  location: z.string().min(2, 'Location is required'),
  jobType: z.enum(['full-time', 'part-time', 'remote', 'hybrid', 'contract']),
  experienceLevel: z.enum(['entry', 'mid', 'senior', 'lead']),
  salary: z.object({
    min: z.number().nonnegative().optional(),
    max: z.number().nonnegative().optional(),
    currency: z.string().default('PKR'),
  }).optional(),
  description: z.string().min(10, 'Description must be at least 10 characters').max(5000),
  requirements: z.array(z.string()).min(1, 'At least one requirement is required'),
  skills: z.array(z.string()).optional(),
  applicationDeadline: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), {
    message: "Invalid date format",
  }),
  status: z.enum(['active', 'closed', 'draft']).default('draft'),
  department: z.string().optional(), // backward compatibility
  type: z.string().optional(), // backward compatibility
});

export const validateJob = (req, res, next) => {
  try {
    jobSchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        })),
        code: 'VALIDATION_ERROR'
      });
    }
    next(error);
  }
};

export const validateJobUpdate = (req, res, next) => {
  try {
    jobSchema.partial().parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message
        })),
        code: 'VALIDATION_ERROR'
      });
    }
    next(error);
  }
};

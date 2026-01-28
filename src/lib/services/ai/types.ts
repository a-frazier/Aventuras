// Response format types for structured JSON output
export type ResponseFormatType = 'json_object' | 'json_schema';

export interface JSONSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean' | 'null';
  description?: string;
  properties?: Record<string, JSONSchema>;
  items?: JSONSchema;
  required?: string[];
  enum?: (string | number | boolean | null)[];
  additionalProperties?: boolean | JSONSchema;
  nullable?: boolean;
}

export interface ResponseFormat {
  type: ResponseFormatType;
  json_schema?: {
    name: string;
    description?: string;
    strict?: boolean;
    schema: JSONSchema;
  };
}

// Re-export from new location for backward compatibility
// TODO: Update imports to use '$lib/services/ai/core/types' directly
export * from './core/types';
  responseFormat?: ResponseFormat; // For structured JSON output

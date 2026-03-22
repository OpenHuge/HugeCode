type JsonRecord = Record<string, unknown>;

export type SchemaValidationResult = {
  errors: string[];
  warnings: string[];
  missingRequired: string[];
  typeMismatches: string[];
  extraFields: string[];
};

type ValidationState = {
  errors: string[];
  warnings: string[];
  missingRequired: string[];
  typeMismatches: string[];
  extraFields: string[];
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

function describeValueType(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return "array";
  }
  return typeof value;
}

function joinPath(path: string, key: string): string {
  return path.length > 0 ? `${path}.${key}` : key;
}

function addTypeMismatch(state: ValidationState, message: string): void {
  state.typeMismatches.push(message);
  state.errors.push(message);
}

function matchesExpectedType(value: unknown, expectedType: string): boolean {
  if (expectedType === "string") {
    return typeof value === "string";
  }
  if (expectedType === "number") {
    return typeof value === "number" && Number.isFinite(value);
  }
  if (expectedType === "integer") {
    return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value);
  }
  if (expectedType === "boolean") {
    return typeof value === "boolean";
  }
  if (expectedType === "array") {
    return Array.isArray(value);
  }
  if (expectedType === "object") {
    return isRecord(value);
  }
  return true;
}

function matchesSchema(value: unknown, schema: unknown): boolean {
  if (!isRecord(schema)) {
    return true;
  }

  const variants = Array.isArray(schema.oneOf) ? schema.oneOf : null;
  if (variants) {
    return variants.some((variant) => matchesSchema(value, variant));
  }

  if (Array.isArray(schema.enum) && !schema.enum.some((entry) => Object.is(entry, value))) {
    return false;
  }

  const schemaType = typeof schema.type === "string" ? schema.type : null;
  if (schemaType && !matchesExpectedType(value, schemaType)) {
    return false;
  }

  if (schemaType === "array" && Array.isArray(value) && schema.items !== undefined) {
    return value.every((item) => matchesSchema(item, schema.items));
  }

  if (schemaType === "object" && isRecord(value)) {
    const requiredFields = toStringArray(schema.required);
    for (const field of requiredFields) {
      if (value[field] === undefined) {
        return false;
      }
    }

    const properties = isRecord(schema.properties) ? schema.properties : null;
    if (!properties) {
      return true;
    }
    for (const [key, nestedSchema] of Object.entries(properties)) {
      if (value[key] === undefined) {
        continue;
      }
      if (!matchesSchema(value[key], nestedSchema)) {
        return false;
      }
    }
  }

  return true;
}

function validateValue(
  value: unknown,
  schema: unknown,
  path: string,
  state: ValidationState,
  includeExtraFieldWarnings: boolean
): void {
  if (!isRecord(schema)) {
    return;
  }

  const variants = Array.isArray(schema.oneOf) ? schema.oneOf : null;
  if (variants && !variants.some((variant) => matchesSchema(value, variant))) {
    addTypeMismatch(
      state,
      `Invalid field value at ${path}: value does not match any allowed schema variant.`
    );
    return;
  }

  if (Array.isArray(schema.enum) && !schema.enum.some((entry) => Object.is(entry, value))) {
    addTypeMismatch(
      state,
      `Invalid enum value at ${path}: expected one of ${schema.enum
        .map((entry) => String(entry))
        .join(", ")}, received ${String(value)}.`
    );
    return;
  }

  const schemaType = typeof schema.type === "string" ? schema.type : null;
  if (schemaType && !matchesExpectedType(value, schemaType)) {
    addTypeMismatch(
      state,
      `Invalid field type at ${path}: expected ${schemaType}, received ${describeValueType(value)}.`
    );
    return;
  }

  if (schemaType === "array" && Array.isArray(value) && schema.items !== undefined) {
    for (const [index, item] of value.entries()) {
      validateValue(item, schema.items, `${path}[${index}]`, state, includeExtraFieldWarnings);
    }
    return;
  }

  if (schemaType === "object" && isRecord(value)) {
    const requiredFields = toStringArray(schema.required);
    for (const field of requiredFields) {
      if (value[field] !== undefined) {
        continue;
      }
      const fieldPath = joinPath(path, field);
      state.missingRequired.push(fieldPath);
      state.errors.push(`Missing required field: ${fieldPath}`);
    }

    const properties = isRecord(schema.properties) ? schema.properties : null;
    if (!properties) {
      return;
    }

    if (includeExtraFieldWarnings) {
      for (const key of Object.keys(value)) {
        if (properties[key] !== undefined) {
          continue;
        }
        const fieldPath = joinPath(path, key);
        state.extraFields.push(fieldPath);
        state.warnings.push(`Unexpected field: ${fieldPath}`);
      }
    }

    for (const [key, nestedSchema] of Object.entries(properties)) {
      if (value[key] === undefined) {
        continue;
      }
      validateValue(
        value[key],
        nestedSchema,
        joinPath(path, key),
        state,
        includeExtraFieldWarnings
      );
    }
  }
}

export function validateToolInputAgainstSchema(
  input: unknown,
  schema: unknown
): SchemaValidationResult {
  const state: ValidationState = {
    errors: [],
    warnings: [],
    missingRequired: [],
    typeMismatches: [],
    extraFields: [],
  };

  if (!isRecord(schema)) {
    return state;
  }

  const schemaType = typeof schema.type === "string" ? schema.type : null;
  if (schemaType === "object" && !isRecord(input)) {
    addTypeMismatch(
      state,
      `Invalid root type: expected object, received ${describeValueType(input)}.`
    );
    return state;
  }

  validateValue(input, schema, "", state, true);
  return state;
}
